import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
import {collectExport} from '../_extensions/course-core/body-export/collect.ts';
import {buildBodies} from '../_extensions/course-core/body-export/producer.ts';
const repo=dirname(dirname(fromFileUrl(import.meta.url))),root=await Deno.makeTempDir({prefix:'native-slots-'});
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
try{
 await copy(join(repo,'_extensions/course-core'),join(root,'_extensions/course-core'));
 await Deno.writeTextFile(join(root,'_quarto.yml'),'project:\n  type: book\n  output-dir: _site\n  pre-render: _extensions/course-core/entrypoints/pre.ts\n  post-render: _extensions/course-core/entrypoints/post.ts\nbook:\n  title: Slots\n  chapters: [index.qmd]\nformat: html\nfilters: [course-core]\ncourse: {id: slots-demo}\n');
 await Deno.writeTextFile(join(root,'_quarto-student.yml'),'course: {view: student}\n');
 const source='---\nexercise-bank: true\nexercise-statement-visibility: open\nassessment: {kind: lab, id: numbers, theory-time: 5}\n---\n# Позиции\n\n::: {#exr-a difficulty=introductory time=10}\nOPEN_A\n:::\n\n::: {#exr-b difficulty=introductory time=20 statement-visibility=restricted}\nRESTRICTED_B\n:::\n\n::: {#exr-c difficulty=introductory time=3}\nOPEN_C\n:::\n\n::: {.task-items stage=homework}\n1. @exr-c\n1. [@exr-a; @exr-b]{.task-alternatives #alt-numbers selection=random}\n:::\n';
 await Deno.writeTextFile(join(root,'index.qmd'),source);
 const selected=await collectExport(root,{book:'.',work:'numbers'});
 const {package:p,publicPackage:pub}=await buildBodies(selected.result,{projectRoot:root,courseId:'slots-demo',work:'numbers',includeClosed:true});
 assert(p.schema==='course-body-package-v2'&&p.questions.length===3,'all canonical candidates must export');
 assert(p.works[0].slots.length===2&&p.works[0].slots[1].id==='slots-demo/numbers/alt-numbers'&&p.works[0].slots[1].candidates.length===2,'slot identity or candidates changed');
 assert(pub.works[0].slots[1].candidates.length===2,'public transport must preserve canonical group');
 const r=await new Deno.Command(Deno.env.get('QUARTO')||'quarto',{args:['render','--profile','student'],cwd:root,stdout:'piped',stderr:'piped'}).output();
 assert(r.success,new TextDecoder().decode(r.stdout)+new TextDecoder().decode(r.stderr));
 const html=await Deno.readTextFile(join(root,'_site/index.html'));
 assert(!html.includes('RESTRICTED_B')&&!html.includes('exr-b')&&html.includes('exr-a'),'student alternative projection leaks restricted candidate or loses open one');
 assert(html.includes('13–23 мин')&&html.includes('18–28 мин'),'random times must sum ranges and theory once');
 console.log('PASS native compact groups, canonical Body v2 inventory, student privacy and time ranges');
}finally{await Deno.remove(root,{recursive:true})}
