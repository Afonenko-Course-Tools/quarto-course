import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
import {loadNativeRun,beginNativeRun,prepareNativeExportCleanup} from '../_extensions/course-core/infrastructure/native-run.ts';
import {materializeProjects,materializeStarterArtifact} from '../_extensions/course-core/artifacts/materialize.ts';
const root=await Deno.makeTempDir({prefix:'common-path-native-'}),repo=dirname(dirname(fromFileUrl(import.meta.url)));
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message)};
async function refuses(fn:()=>Promise<unknown>,name:string){let rejected=false;try{await fn()}catch(error){rejected=true;console.log('CAUSE',name,String((error as Error).message).split('\n')[0])}assert(rejected,'Accepted '+name);console.log('REFUSED',name)}
async function run(...args:string[]){const result=await new Deno.Command(Deno.env.get('QUARTO')||'quarto',{args,cwd:root,stdout:'piped',stderr:'piped'}).output();return {success:result.success,text:new TextDecoder().decode(result.stdout)+new TextDecoder().decode(result.stderr)}}
try{
 await copy(join(repo,'_extensions/course-core'),join(root,'_extensions/course-core'));
 await Deno.mkdir(join(root,'bank'));await Deno.mkdir(join(root,'common'));await Deno.mkdir(join(root,'projects/a/student'),{recursive:true});
 await Deno.writeTextFile(join(root,'common/helper.txt'),'CANONICAL_COMMON\n');await Deno.writeTextFile(join(root,'projects/a/student/Main.java'),'class Main {}\n');
 const config=`project:
  type: book
  output-dir: _site
  resources: ['!projects/**','!common/**']
  pre-render: _extensions/course-core/entrypoints/pre.ts
  post-render: _extensions/course-core/entrypoints/post.ts
book: {title: Binding, chapters: [index.qmd, bank/items.qmd]}
format: html
filters: [course-core]
course: {id: common-binding}
project-materialization:
  projects:
    exr-a:
      common-files:
      - {source: common/helper.txt, target: student/helper.txt, audience: student}
`;
 await Deno.writeTextFile(join(root,'_quarto.yml'),config);await Deno.writeTextFile(join(root,'_quarto-full.yml'),'course: {view: full}\n');
 await Deno.writeTextFile(join(root,'index.qmd'),'---\nassessment: {kind: lab}\n---\n# Лабораторная {#lab-a}\n\n::: {.task-items}\n1. @exr-a\n:::\n');
 await Deno.writeTextFile(join(root,'bank/items.qmd'),'---\nexercise-bank: true\nexercise-statement-visibility: open\n---\n# Банк\n\n::: {#exr-a difficulty=introductory time=10 project="/projects/a"}\n## Условие\nОткрытое условие.\n:::\n');
 const rendered=await run('render','--profile','full');assert(rendered.success,rendered.text);
 const native=await loadNativeRun(root);const fact=native.documents.flatMap(d=>d.projects??[]).find(p=>p.exerciseId==='exr-a');assert(fact?.materialization?.commonFiles[0].source==='common/helper.txt','Canonical path lost');
 const output=await Deno.makeTempDir({prefix:'common-path-stage-parent-'});const stage=join(output,'student');
 const receipt=await materializeProjects({nativeRun:native,sourceRoot:root,outputRoot:stage,exerciseIds:['exr-a'],audience:'student'});
 assert(await Deno.readTextFile(join(stage,'projects/a/student/helper.txt'))==='CANONICAL_COMMON\n','Common materialization changed bytes');
 assert(receipt.commonSources['common/helper.txt'],'Canonical source receipt missing');
 await Deno.writeTextFile(join(root,'projects/a/student/helper.txt'),'COLLISION');await refuses(()=>materializeProjects({nativeRun:native,sourceRoot:root,outputRoot:join(output,'collision'),exerciseIds:['exr-a'],audience:'student'}),'task-owned common collision');await Deno.remove(join(root,'projects/a/student/helper.txt'));
 console.log('PASS root/nested full capture and exact common materialization');
 const pointerPath=join(root,'_generated/course-spec/active-native-run.json'),pointerBytes=await Deno.readTextFile(pointerPath),pointer=JSON.parse(pointerBytes),proofPath=join(pointer.directory,'common-files-path-binding.json'),proofBytes=await Deno.readTextFile(proofPath);
 for(const name of ['common/helper.txt','bank/items.qmd','_quarto.yml','_quarto-full.yml','_extensions/course-core/_extension.yml']){
  const file=join(root,name),before=await Deno.readTextFile(file);await Deno.writeTextFile(file,before+'\nDRIFT');
  await refuses(()=>loadNativeRun(root),'byte drift '+name);await refuses(()=>materializeProjects({nativeRun:native,sourceRoot:root,outputRoot:join(output,'drift'),exerciseIds:['exr-a'],audience:'student'}),'retained materializer '+name);await Deno.writeTextFile(file,before);
 }
 await Deno.writeTextFile(join(root,'_extensions/course-core/UNRELATED.txt'),'UNRELATED_CODE_OR_DOC\n');await loadNativeRun(root);await Deno.remove(join(root,'_extensions/course-core/UNRELATED.txt'));console.log('PASS unrelated extension file does not invalidate metadata proof');
 await Deno.mkdir(join(root,'_extensions/new-available'),{recursive:true});await Deno.writeTextFile(join(root,'_extensions/new-available/_extension.yml'),'title: New extension\nversion: 0.0.1\ncontributes: {filters: []}\n');await refuses(()=>loadNativeRun(root),'new native extension metadata');await Deno.remove(join(root,'_extensions/new-available'),{recursive:true});
 await Deno.writeTextFile(join(root,'bank/_metadata.yml'),'title: new metadata\n');await refuses(()=>loadNativeRun(root),'new metadata origin');await Deno.remove(join(root,'bank/_metadata.yml'));
 for(const change of [
  {...pointer,schema:'course-native-run-pointer-v1'},
  {...pointer,commonPathBinding:{...pointer.commonPathBinding,file:'../common-files-path-binding.json'}},
  {...pointer,commonPathBinding:{...pointer.commonPathBinding,sha1:'0'.repeat(40)}},
  {...pointer,commonPathBinding:{...pointer.commonPathBinding,sha256:'0'.repeat(64)}},
  {...pointer,commonPathRetirement:{profile:'full',file:'_quarto-full.yml',sha1:pointer.configurationHashes['_quarto-full.yml'],sha256:'0'.repeat(64)}}
 ]){await Deno.writeTextFile(pointerPath,JSON.stringify(change));await refuses(()=>loadNativeRun(root),'forged/old pointer');await Deno.writeTextFile(pointerPath,pointerBytes)}
 await Deno.rename(proofPath,proofPath+'.saved');await Deno.symlink(proofPath+'.saved',proofPath);await refuses(()=>loadNativeRun(root),'symlink witness');await Deno.remove(proofPath);await Deno.rename(proofPath+'.saved',proofPath);
 await Deno.writeTextFile(proofPath,proofBytes+' ');await refuses(()=>loadNativeRun(root),'modified witness');await Deno.writeTextFile(proofPath,proofBytes);
 await refuses(()=>prepareNativeExportCleanup(root,'full'),'functional profile retirement');
 const partial=await run('render','bank/items.qmd','--profile','full');assert(partial.success,partial.text);const partialRun=await loadNativeRun(root);assert(!partialRun.renderAll,'Partial scope upgraded');
 const files=await materializeStarterArtifact(partialRun,{source:'bank/items.qmd',exerciseId:'exr-a'});assert(files.some(f=>f.name==='helper.txt'&&new TextDecoder().decode(f.bytes)==='CANONICAL_COMMON\n'),'Partial starter common lost');
 await refuses(()=>materializeProjects({nativeRun:partialRun,sourceRoot:root,outputRoot:join(output,'full-from-partial'),exerciseIds:['exr-a'],audience:'student'}),'full stage from partial');
 console.log('PASS currentness, identity, symlink and partial/full boundaries');
 // Negative raw origins go through stock inspect, never through a new parser.
 Deno.env.set('QUARTO_PROFILE','full');Deno.env.set('QUARTO_PROJECT_OUTPUT_DIR','_site');Deno.env.set('QUARTO_PROJECT_INPUT_FILES',[join(root,'index.qmd'),join(root,'bank/items.qmd')].join('\n'));
 for(const source of ['../escape.txt','common/../helper.txt','common/../common/helper.txt','../'+root.split('/').at(-1)+'/common/helper.txt','/absolute.txt','common\\helper.txt','https://example.invalid/x','common/*.txt','common//helper.txt','.git/config','reference/answer.txt','_site-full/leak.txt','_generated/leak.txt','common/']){
  await Deno.writeTextFile(join(root,'_quarto.yml'),config.replace('source: common/helper.txt','source: '+JSON.stringify(source)));
  await refuses(()=>beginNativeRun(root),'raw owner source '+source);let present=true;try{await Deno.stat(pointerPath)}catch{present=false}assert(!present,'Failed producer retained pointer');
 }
 await Deno.writeTextFile(join(root,'_quarto.yml'),config);
 const qmd=await Deno.readTextFile(join(root,'bank/items.qmd'));
 for(const source of ['../escape.txt','common/../common/helper.txt']){
  const declaration='project-materialization:\n  projects:\n    exr-local:\n      common-files:\n      - {source: '+JSON.stringify(source)+', target: student/x, audience: student}\n';
  await Deno.writeTextFile(join(root,'bank/items.qmd'),qmd.replace('---\n','---\n'+declaration));await refuses(()=>beginNativeRun(root),'raw QMD traversal');
 }
 await Deno.writeTextFile(join(root,'bank/items.qmd'),qmd);
 await Deno.writeTextFile(join(root,'bank/_metadata.yml'),'project-materialization:\n  projects:\n    exr-a:\n      common-files:\n      - {source: ../common/helper.txt, target: student/helper.txt, audience: student}\n');await refuses(()=>beginNativeRun(root),'masked directory origin');await Deno.remove(join(root,'bank/_metadata.yml'));
 await Deno.rename(join(root,'common/helper.txt'),join(root,'common/original.txt'));await Deno.symlink(join(root,'common/original.txt'),join(root,'common/helper.txt'));await refuses(()=>beginNativeRun(root),'common final symlink');await Deno.remove(join(root,'common/helper.txt'));await Deno.rename(join(root,'common/original.txt'),join(root,'common/helper.txt'));
 await Deno.writeTextFile(join(root,'_quarto.yml'),config.replace('source: common/helper.txt','source: common/helper.txt, source: common/helper.txt'));await refuses(()=>beginNativeRun(root),'duplicate owner YAML fields');await Deno.writeTextFile(join(root,'_quarto.yml'),config);
 await Deno.writeTextFile(join(root,'bank/items.qmd'),qmd.replace('exercise-bank: true','exercise-bank: true\nexercise-bank: true'));await refuses(()=>beginNativeRun(root),'duplicate raw QMD YAML fields');await Deno.writeTextFile(join(root,'bank/items.qmd'),qmd);
 await Deno.rename(join(root,'common'),join(root,'original-common'));await Deno.symlink(join(root,'original-common'),join(root,'common'));await refuses(()=>beginNativeRun(root),'common intermediate symlink');await Deno.remove(join(root,'common'));await Deno.rename(join(root,'original-common'),join(root,'common'));
 await Deno.writeTextFile(join(root,'_quarto.yml'),config.replace('target: student/helper.txt, audience: student','target: student/helper.txt, audience: grading'));await refuses(()=>beginNativeRun(root),'grading common targets student');await Deno.writeTextFile(join(root,'_quarto.yml'),config);
 await Deno.writeTextFile(join(root,'bank/_quarto.yml'),'project: {type: default}\n');await refuses(()=>beginNativeRun(root),'nested wrong owner');await Deno.remove(join(root,'bank/_quarto.yml'));
 await Deno.mkdir(join(root,'_extensions/unsupported-origin'),{recursive:true});await Deno.writeTextFile(join(root,'_extensions/unsupported-origin/_extension.yml'),'title: Unsupported raw origin\nversion: 0.0.1\ncontributes:\n  formats:\n    html:\n      project-materialization:\n        projects:\n          exr-a:\n            common-files:\n            - {source: common/helper.txt, target: student/helper.txt, audience: student}\n');
 await Deno.writeTextFile(join(root,'_quarto.yml'),config.replace('format: html','format: unsupported-origin-html'));
 const stockExtension=await run('inspect',root,'--profile','full');assert(stockExtension.success,'Stock extension fixture invalid: '+stockExtension.text);assert(JSON.stringify(JSON.parse(stockExtension.text).extensions).includes('Unsupported raw origin'),'Stock extension origin absent');await refuses(()=>beginNativeRun(root),'actual stock extension raw origin');
 await Deno.remove(join(root,'_extensions/unsupported-origin'),{recursive:true});await Deno.writeTextFile(join(root,'_quarto.yml'),config);
 console.log('PASS raw owner/QMD and unknown-origin fail-closed guards');
 const localConfig=config.slice(0,config.indexOf('project-materialization:'));
 const localDeclaration='project-materialization:\n  projects:\n    exr-a:\n      common-files:\n      - {source: common/helper.txt, target: student/helper.txt, audience: student}\n';
 await Deno.writeTextFile(join(root,'_quarto.yml'),localConfig);await Deno.writeTextFile(join(root,'bank/items.qmd'),qmd.replace('---\n','---\n'+localDeclaration));
 const localRender=await run('render','--profile','full');assert(localRender.success,localRender.text);const localRun=await loadNativeRun(root);
 await materializeProjects({nativeRun:localRun,sourceRoot:root,outputRoot:join(output,'qmd-local'),exerciseIds:['exr-a'],audience:'student'});
 console.log('PASS actual raw QMD-local canonical origin');
 await Deno.writeTextFile(join(root,'_quarto.yml'),config);await Deno.writeTextFile(join(root,'bank/items.qmd'),qmd);
 await Deno.mkdir(join(root,'_extensions/common-inject'),{recursive:true});await Deno.writeTextFile(join(root,'_extensions/common-inject/_extension.yml'),'title: Synthetic mutation\nversion: 0.0.1\ncontributes:\n  filters:\n  - {at: pre-ast, path: inject.lua}\n');
 for(const mutation of ["f[1]=nil","f[2]={source=f[1].source,target='student/extra.txt',audience='student'}","f[1].source='other.txt'","f[1].target='student/new.txt'","f[1].audience='grading'","entry['include-git']=true"]){
  await Deno.writeTextFile(join(root,'_extensions/common-inject/inject.lua'),"function Pandoc(doc) local entry=doc.meta['project-materialization'].projects['exr-a'];local f=entry['common-files'];"+mutation+";return doc end\n");
  await Deno.writeTextFile(join(root,'_quarto.yml'),config.replace('filters: [course-core]','filters: [common-inject, course-core]'));
  const refused=await run('render','--profile','full');assert(!refused.success&&refused.text.includes('Effective materialization'),'Effective section mutation bypassed witness: '+mutation+'\n'+refused.text);await refuses(()=>loadNativeRun(root),'failed effective capture cannot be loaded');console.log('REFUSED effective mutation',mutation);
 }
 await Deno.remove(join(root,'_extensions/common-inject/inject.lua'));await Deno.writeTextFile(join(root,'_quarto.yml'),config);
 const {collectExport}=await import('../_extensions/course-core/body-export/collect.ts');await collectExport(root,{book:'.',work:'lab-a'});const exported=await loadNativeRun(root);assert(exported.documents.every(d=>d.document.format==='json'),'JSON export capture changed');
 await materializeProjects({nativeRun:exported,sourceRoot:root,outputRoot:join(output,'json-export'),exerciseIds:['exr-a'],audience:'student'});
 const exportedPointer=JSON.parse(await Deno.readTextFile(pointerPath));assert(exportedPointer.commonPathRetirement?.profile.startsWith('course-export-'),'Owned temporary profile retirement missing');
 await refuses(()=>prepareNativeExportCleanup(root,'full'),'functional profile retirement after export');
 console.log('PASS full effective-section equality, JSON export and exact owned-profile retirement');

 // Keep immutable fixture evidence only when explicitly requested by an operator.
 if(Deno.env.get('COMMON_PATH_PROBE_KEEP'))console.log('FIXTURE',root);
 else {await Deno.remove(root,{recursive:true});await Deno.remove(output,{recursive:true})}
}catch(error){console.error('FIXTURE',root);throw error}
