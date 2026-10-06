import { dirname, fromFileUrl, join } from 'stdlib/path';
import { copy } from 'stdlib/fs';
const repo=dirname(dirname(fromFileUrl(import.meta.url)));
const root=await Deno.makeTempDir({prefix:'course-root-export-'});
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m);};
const started=performance.now();
try {
 await Deno.mkdir(join(root,'bank'));
 await copy(join(repo,'_extensions/course-core'),join(root,'bank/_extensions/course-core'));
 await copy(join(repo,'_extensions/course-presentation'),join(root,'bank/_extensions/course-presentation'));
 const qrcPath=join(dirname(repo),'quarto-reference-catalog/_extensions/reference-catalog');
 let group=false;
 try { await Deno.stat(qrcPath); await Deno.stat(join(dirname(repo),'quarto-project-download/_extensions/project-download')); group=true; }
 catch(e) { if(!(e instanceof Deno.errors.NotFound))throw e; }
 if(group) {
  await copy(qrcPath,join(root,'bank/_extensions/reference-catalog'));
  await copy(join(dirname(repo),'quarto-project-download/_extensions/project-download'),join(root,'bank/_extensions/project-download'));
 }
 await Deno.writeTextFile(join(root,'_quarto.yml'),'project: {type: default}\ncourse: {id: logical-course}\n');
 await Deno.writeTextFile(join(root,'bank/_quarto.yml'),'project:\n  type: book\n  output-dir: _book\n  pre-render: missing-web-pre.ts\n  post-render: missing-web-post.ts\nbook:\n  title: Bank\n  chapters: [index.qmd, work.qmd, ordinary.qmd]\nformat: html\nfilters: [course-core, course-presentation'+(group?', reference-catalog, project-download':'')+']\nreference-catalog: {namespace: bank}\n');
 await Deno.writeTextFile(join(root,'bank/index.qmd'),'---\ntitle: Bank\n---\n# Bank\n');
 await Deno.writeTextFile(join(root,'bank/work.qmd'),'---\ntitle: Selected lab\nassessment: {id: lab-one, kind: lab}\n---\n# Selected lab\n\n:::: {.content-visible when-profile=student}\n::: {.task-items}\n1. @exr-one\n2. [@exr-control]{requirement="optional"}\n3. @exr-student-source\n4. @exr-full-source\n5. @exr-feature-source\n:::\n::::\n');
 await Deno.writeTextFile(join(root,'bank/ordinary.qmd'),'# Questions\n\n::: {#exr-one}\nSOURCE_CONDITION\n\n::: {.content-visible when-profile=full}\nFULL_ONLY_SECRET\n:::\n\n::: {.content-visible when-profile=full when-format=json}\nCOMBINED_FULL_SECRET\n:::\n\n::: {.content-hidden when-profile=student when-format=json}\nHIDDEN_STUDENT_SECRET\n:::\n\n::: {.content-hidden when-profile=full when-format=json}\nPUBLIC_NATIVE_HIDDEN_IN_FULL\n:::\n\n::: {#sol-one}\nCLOSED_SOLUTION\n:::\n\n```{.yaml .answer-spec}\ntype: numeric\nkey: {value: 42, tolerance: {absolute: 0}}\n```\n:::\n\n::: {#exr-unused}\n'+(group?'{{< xref remote exr-outside \"External authored reference\" >}}':'')+'\n\n```{=html}\nUNSUPPORTED_UNASSIGNED\n```\n:::\n');
 await Deno.writeTextFile(join(root,'bank/audience-tasks.qmd'),'# Audience tasks\n\n:::: {.content-visible when-profile=student}\n::: {#exr-student-source}\nSTUDENT_SOURCE_SELECTED\n:::\n::::\n\n:::: {.content-visible when-profile=full}\n::: {#exr-full-source}\nFULL_SOURCE_SELECTED\n\n::: {.content-visible when-profile=full}\nNESTED_FULL_SOURCE_SECRET\n:::\n:::\n::::\n\n:::: {.content-visible when-profile=feature}\n::: {#exr-feature-source}\nFUNCTIONAL_SOURCE_SELECTED\n:::\n::::\n');
 await Deno.writeTextFile(join(root,'bank/control.qmd'),'# Closed-only page\n\n::: {#exr-control course-role="control"}\nCONTROL_CONDITION\n:::\n');
 await Deno.writeTextFile(join(root,'bank/unrelated-work.qmd'),'---\nassessment: {id: unrelated, kind: handout}\n---\n# Unrelated\n\n::: {.task-items}\n- @exr-unassigned-missing\n:::\n');
 await Deno.writeTextFile(join(root,'bank/_quarto-full.yml'),'project: {output-dir: _book/full}\ncourse: {view: full}\n');
 await Deno.writeTextFile(join(root,'bank/_quarto-feature.yaml'),'feature-value: enabled\n');
 await Deno.mkdir(join(root,'bank/not-a-project'));
 const {collectExport}=await import('../_extensions/course-core/body-export/collect.ts');
 let badBook=false;try{await collectExport(root,{book:'bank/not-a-project',work:'lab-one'});}catch(e){badBook=String(e).includes('EXPORT.BOOK_PROJECT_REQUIRED');}assert(badBook,'a bank subdirectory must not inherit its parent book root');
 const r=await new Deno.Command(Deno.env.get('QUARTO')||'quarto',{args:['run',join(repo,'_extensions/course-core/entrypoints/export.ts'),'--book','bank','--work','lab-one','--output','_generated/exports/export.json','--profile','feature'],cwd:root,stdout:'piped',stderr:'piped'}).output();
 const log=new TextDecoder().decode(r.stdout)+new TextDecoder().decode(r.stderr);assert(r.success,log);
 const teacher=JSON.parse(await Deno.readTextFile(join(root,'_generated/exports/export.json'))),publicPackage=JSON.parse(await Deno.readTextFile(join(root,'_generated/exports/export.public.json')));
 assert(teacher.owner==='logical-course'&&teacher.questions.length===5,'root identity and exact closure missing');
 assert(teacher.questions[1].id==='exr-control'&&JSON.stringify(teacher.questions[1].condition).includes('CONTROL_CONDITION'),'student-excluded control source absent export');
 assert(teacher.questions[0].closedKey.key.value===42&&JSON.stringify(teacher).includes('CLOSED_SOLUTION'),'full source answer/solution lost');
 assert(!JSON.stringify(publicPackage).match(/CLOSED_SOLUTION|FULL_ONLY_SECRET|COMBINED_FULL_SECRET|HIDDEN_STUDENT_SECRET|NESTED_FULL_SOURCE_SECRET|closedKey|42/),'private export data leaked public package');
 assert(JSON.stringify(publicPackage).includes('PUBLIC_NATIVE_HIDDEN_IN_FULL'),'profile false must short-circuit native hidden conjunction in public projection');
 for(const text of ['STUDENT_SOURCE_SELECTED','FULL_SOURCE_SELECTED','FUNCTIONAL_SOURCE_SELECTED'])assert(JSON.stringify(publicPackage).includes(text),'audience task/work selection or functional profile lost: '+text);
 assert(!JSON.stringify(teacher).includes('UNSUPPORTED_UNASSIGNED'),'unused broad-bank task was exported');
 try{await Deno.stat(join(root,'bank/_book'));throw Error('export prepared full HTML book');}catch(e){if(!(e instanceof Deno.errors.NotFound))throw e;}
 for await(const e of Deno.readDir(join(root,'bank')))assert(!e.name.startsWith('_quarto-course-export-'),'temporary export profile retained');
 const forwarded=await new Deno.Command(Deno.env.get('QUARTO')||'quarto',{args:['run',join(repo,'_extensions/course-core/entrypoints/export.ts'),'--','--book','bank','--work','lab-one','--output','_generated/exports/forwarded.json','--profile','feature'],cwd:root,stdout:'piped',stderr:'piped'}).output();assert(forwarded.success,new TextDecoder().decode(forwarded.stderr));
 assert(JSON.parse(await Deno.readTextFile(join(root,'_generated/exports/forwarded.json'))).questions.length===5,'forwarded script profile lost source variant');
 const collection=await collectExport(root,{book:'bank',work:'lab-one',profiles:['feature']});
 assert(collection.result.model.exercises.length===5&&collection.result.model.assessments.length===1,'PL selected result must contain selected work closure');
 if(group) {
 await Deno.writeTextFile(join(root,'bank/qrc-work.qmd'),'---\ntitle: QRC work\nassessment: {id: qrc-work, kind: handout}\n---\n# QRC work\n\n:::: {.content-visible when-profile=full}\n::: {.task-items}\n- @exr-unused\n:::\n::::\n');
 const qrc=await collectExport(root,{book:'bank',work:'qrc-work'});
 const {buildBodies}=await import('../_extensions/course-core/body-export/producer.ts');
 let refused=false;try{await buildBodies(qrc.result,{projectRoot:qrc.projectRoot,courseId:qrc.courseId,work:qrc.work});}catch(e){refused=String(e).includes('BODY.QRC_REFERENCE_UNRESOLVED: remote:exr-outside');}
 assert(refused,'selected unresolved QRC marker must fail without inventing a link; unassigned source markers are allowed');
 }
 assert(collection.result.documents.every(d=>d.document.profiles.includes('feature')),'functional profile lost in source export');
 console.log(`PASS root book/work raw native JSON export, control source, closure, private split, functional profiles (${Math.round(performance.now()-started)}ms)`);
}finally{await Deno.remove(root,{recursive:true});}
