import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
import {withNativeArtifactBatch,resolveArtifact,type ArtifactRequest,type ResolvedArtifact} from '../_extensions/course-core/artifacts/resolve.ts';
import {loadNativeRun} from '../_extensions/course-core/infrastructure/native-run.ts';
const repo=dirname(dirname(fromFileUrl(import.meta.url))),out=Deno.env.get('INSPECTION_BUDGET_OUTPUT')||await Deno.makeTempDir({prefix:'artifact-batch-native-'}),root=join(out,'fixture');await Deno.mkdir(root,{recursive:true});
const actual=await Deno.realPath(Deno.env.get('QUARTO')||'/usr/bin/quarto'),python=await Deno.realPath(Deno.env.get('QUARTO_PYTHON')||'/usr/bin/python3');
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)},results:{name:string;inspect:number;error?:string}[]=[];
await copy(join(repo,'_extensions'),join(root,'_extensions'));await Deno.mkdir(join(root,'projects/a/student'),{recursive:true});await Deno.mkdir(join(root,'common'));
await Deno.writeTextFile(join(root,'projects/a/student/README.md'),'Публичный комплект.\n');await Deno.writeTextFile(join(root,'common/intro.txt'),'Общее предусловие.\n');
await Deno.writeTextFile(join(root,'_quarto.yml'),`project:
  type: default
  output-dir: _site
  render: [index.qmd]
  resources: ['!projects/**', '!common/**']
  pre-render: _extensions/course-core/entrypoints/pre.ts
  post-render: _extensions/course-core/entrypoints/post.ts
filters: [course-core]
course: {id: artifact-batch}
website: {site-url: 'https://example.invalid/course/'}
exercise-bank: true
exercise-statement-visibility: open
format:
  html: {theme: none}
project-materialization:
  projects:
    exr-a:
      common-files:
      - {source: common/intro.txt, target: student/intro.txt, audience: student}
`);await Deno.writeTextFile(join(root,'_quarto-student.yml'),'course: {view: student}\n');
await Deno.writeTextFile(join(root,'index.qmd'),'# Тема {#sec-topic}\n\n::: {#exr-a difficulty=introductory time=10 project="/projects/a"}\n## Условие\nОткрытое условие и [материалы](index.html#sec-topic).\n:::\n');
const log=join(out,'calls.jsonl'),script=join(out,'quarto-wrapper.py'),wrapper=join(out,'quarto-wrapper');await Deno.writeTextFile(script,`import sys,subprocess,json,time,os\nt=time.monotonic();r=subprocess.run([${JSON.stringify(actual)},*sys.argv[1:]])\nwith open(${JSON.stringify(log)},'a') as f:f.write(json.dumps({'argv':sys.argv[1:],'cwd':os.getcwd(),'exit':r.returncode,'seconds':time.monotonic()-t})+'\\n')\nsys.exit(r.returncode)\n`);const quote=(s:string)=>"'"+s.replaceAll("'","'\\''")+"'";await Deno.writeTextFile(wrapper,'#!/bin/sh\nexec '+quote(python)+' '+quote(script)+' "$@"\n',{mode:0o700});await Deno.chmod(wrapper,0o700);Deno.env.set('QUARTO',wrapper);Deno.env.set('QUARTO_PROFILE','student');
const rendered=await new Deno.Command(actual,{args:['render','--profile','student'],cwd:root,stdout:'piped',stderr:'piped'}).output();await Deno.writeFile(join(out,'render.stdout'),rendered.stdout);await Deno.writeFile(join(out,'render.stderr'),rendered.stderr);assert(rendered.success,new TextDecoder().decode(rendered.stderr));
const calls=async()=> (await Deno.readTextFile(log)).trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));await Deno.writeTextFile(join(out,'render-calls.json'),JSON.stringify(await calls(),null,2)+'\n');
const count=async()=> (await calls()).filter(c=>c.argv[0]==='inspect').length;
const save=async(name:string,error?:string)=>{results.push({name,inspect:await count(),...(error?{error}:{})});await Deno.writeTextFile(join(out,'results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results.at(-1)))};
const originalRead=Deno.readFile,reads=new Map<string,number>();
(Deno as any).readFile=async(path:string|URL,options?:any)=>{const name=String(path);if(name.includes('/inspections/sha256/'))reads.set(name,(reads.get(name)||0)+1);return await originalRead(path,options)};
const request:ArtifactRequest={source:'index.qmd',exerciseId:'exr-a',kind:'starter'};let retained:((request:ArtifactRequest)=>Promise<ResolvedArtifact>)|undefined;
await Deno.writeTextFile(log,'');await withNativeArtifactBatch(root,{view:'student'},async batch=>{
 retained=batch.resolveArtifact;
 for(let i=0;i<3;i++){const artifact=await batch.resolveArtifact(request);assert(artifact.files?.some(f=>f.name==='intro.txt'&&new TextDecoder().decode(f.bytes)==='Общее предусловие.\n'),'Common starter bytes changed')}
 const conditions=await batch.resolveArtifact({...request,kind:'conditions'});assert(conditions.files?.some(f=>f.name==='index.html'&&new TextDecoder().decode(f.bytes).includes('https://example.invalid/course/index.html#sec-topic')),'Conditions site-url did not use admitted owner');
});(Deno as any).readFile=originalRead;assert(reads.size>0&&[...reads.values()].every(n=>n===2),'Original union must be read exactly at entry and after B');await Deno.writeTextFile(join(out,'original-read-counts.json'),JSON.stringify([...reads],null,2)+'\n');await save('batch-three-starters-and-conditions');assert(await count()===2,'BATCH_INSPECTION_BUDGET_REGRESSION');
await Deno.writeTextFile(log,'');let expired=false;try{await retained!(request)}catch(e){expired=String(e).includes('NATIVE.RUN_NOT_CURRENT')}assert(expired&&await count()===0,'Expired resolver retained authority');await save('expired-resolver');
await Deno.writeTextFile(log,'');await withNativeArtifactBatch(root,{},async()=>{let refused=false;try{await withNativeArtifactBatch(root,{},async()=>{})}catch(e){refused=String(e).includes('NATIVE.RUN_NOT_CURRENT')}assert(refused,'Reentrant batch accepted')});await save('reentrant-batch');assert(await count()===2,'Reentrant guard opened another proof');
const pointer=JSON.parse(await Deno.readTextFile(join(root,'_generated/course-spec/active-native-run.json'))),store=join(pointer.directory,'inspections/sha256'),first=[...Deno.readDirSync(store)][0].name,originalPath=join(store,first),before=await Deno.readFile(originalPath);
await Deno.writeTextFile(log,'');let originalRefused=false;try{await withNativeArtifactBatch(root,{},async batch=>{await batch.resolveArtifact(request);await Deno.writeFile(originalPath,new Uint8Array([...before,32]));return 'MUST_NOT_RETURN'})}catch(e){originalRefused=String(e).includes('NATIVE.COMMON_PATH_BINDING_INVALID');await save('original-drift-after-use',String(e))}finally{await Deno.writeFile(originalPath,before)}assert(originalRefused,'Original union mutation escaped B');
await Deno.writeTextFile(log,'');let contextRefused=false;try{await withNativeArtifactBatch(root,{},async batch=>{batch.run.documents[0].course.id='forged';return 'MUST_NOT_RETURN'})}catch(e){contextRefused=e instanceof TypeError||String(e).includes('NATIVE.RUN_NOT_CURRENT')}assert(contextRefused,'Run mutation accepted');await save('run-context-mutation');
const run=await loadNativeRun(root);await Deno.writeTextFile(log,'');await resolveArtifact(run,request);await save('standalone-fresh-proof');assert(await count()===2,'Standalone resolver bypassed proof');
await Deno.writeTextFile(log,'');await withNativeArtifactBatch(root,{},async batch=>{await batch.resolveArtifact(request)});await save('restored-positive-new-operation');assert(await count()===2,'New operation reused prior live proof');
