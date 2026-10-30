import {quartoExecutableForTest} from './quarto-executable.ts';
import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
import {withNativeArtifactBatch,resolveArtifact,type ArtifactRequest,type ResolvedArtifact} from '../_extensions/course-core/artifacts/resolve.ts';
import {withCommonPathBinding} from '../_extensions/course-core/infrastructure/common-path-binding.ts';
import {loadNativeRun} from '../_extensions/course-core/infrastructure/native-run.ts';
const repo=dirname(dirname(fromFileUrl(import.meta.url))),out=Deno.env.get('INSPECTION_BUDGET_OUTPUT')||await Deno.makeTempDir({prefix:'artifact-batch-native-'}),root=join(out,'fixture');await Deno.mkdir(root,{recursive:true});
const actual=await quartoExecutableForTest(),python=await Deno.realPath(Deno.env.get('QUARTO_PYTHON')||'/usr/bin/python3');
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
const originalRead=Deno.readFile,originalText=Deno.readTextFile,reads=new Map<string,number>(),globalReads=new Map<string,number>();
const countGlobal=(path:unknown)=>{const name=String(path);if(name===wrapper||name.endsWith('/native-qmd-raw.lua')||/\/(?:common-files-path-binding|native-run|owned-export-source-context)\.json$/.test(name))globalReads.set(name,(globalReads.get(name)||0)+1)};
(Deno as any).readTextFile=async(path:any,options?:any)=>{countGlobal(path);return await originalText(path,options)};
(Deno as any).readFile=async(path:string|URL,options?:any)=>{const name=String(path);countGlobal(path);if(name.includes('/inspections/sha256/'))reads.set(name,(reads.get(name)||0)+1);return await originalRead(path,options)};
const request:ArtifactRequest={source:'index.qmd',exerciseId:'exr-a',kind:'starter'};let retained:((request:ArtifactRequest)=>Promise<ResolvedArtifact>)|undefined;
await Deno.writeTextFile(log,'');await withNativeArtifactBatch(root,{view:'student'},async batch=>{
 retained=batch.resolveArtifact;
 const loopStart=[...globalReads.values()].reduce((a,b)=>a+b,0);for(let i=0;i<16;i++){const artifact=await batch.resolveArtifact(request);assert(artifact.files?.some(f=>f.name==='intro.txt'&&new TextDecoder().decode(f.bytes)==='Общее предусловие.\n'),'Common starter bytes changed')}
 assert([...globalReads.values()].reduce((a,b)=>a+b,0)===loopStart,'REQUEST_LOOP_GLOBAL_READ');const conditions=await batch.resolveArtifact({...request,kind:'conditions'});assert(conditions.files?.some(f=>f.name==='index.html'&&new TextDecoder().decode(f.bytes).includes('https://example.invalid/course/index.html#sec-topic')),'Conditions site-url did not use admitted owner');
});(Deno as any).readFile=originalRead;(Deno as any).readTextFile=originalText;await Deno.writeTextFile(join(out,'global-read-counts.json'),JSON.stringify([...globalReads],null,2)+'\n');assert([...globalReads].filter(([p])=>p.endsWith('/common-files-path-binding.json')).every(([,n])=>n<=6),'BOUNDARY_WITNESS_READ_BUDGET '+JSON.stringify([...globalReads]));assert([...globalReads].filter(([p])=>p.endsWith('/native-run.json')).every(([,n])=>n<=3),'BOUNDARY_COMPLETED_READ_BUDGET '+JSON.stringify([...globalReads]));assert(reads.size>0&&[...reads.values()].every(n=>n===2),'Original union must be read exactly at entry and after B');await Deno.writeTextFile(join(out,'original-read-counts.json'),JSON.stringify([...reads],null,2)+'\n');await save('batch-sixteen-starters-and-conditions');assert(await count()===2,'BATCH_INSPECTION_BUDGET_REGRESSION');
// Ошибка callback не оставляет необработанный отказ ещё работающего запроса.
const callbackFailure=new Error('callback failure while artifact is pending'),artifactFailure=new Error('late artifact failure');
const unhandled:unknown[]=[];
const onUnhandled=(event:PromiseRejectionEvent)=>{unhandled.push(event.reason);event.preventDefault()};
let enter!:()=>void,release!:()=>void,entered=false;
const started=new Promise<void>(resolve=>{enter=resolve}),gate=new Promise<void>(resolve=>{release=resolve});
const readBeforePending=Deno.readFile;
addEventListener('unhandledrejection',onUnhandled);
try{
 let caught:unknown;
 try{await withNativeArtifactBatch(root,{},async batch=>{
  (Deno as any).readFile=async(path:any,options?:any)=>{
   if(String(path)===join(root,'projects/a/student/README.md')){entered=true;enter();await gate;throw artifactFailure}
   return await readBeforePending(path,options);
  };
  void batch.resolveArtifact(request);
  let timeout:number|undefined;
  try{await Promise.race([started,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('pending artifact was not reached')),5000)})])}
  finally{if(timeout!==undefined)clearTimeout(timeout)}
  setTimeout(release,0);throw callbackFailure;
 })}catch(error){caught=error}
 assert(entered&&caught===callbackFailure,'Pending request changed callback error identity: '+String(caught));
 await new Promise(resolve=>setTimeout(resolve,0));
 await new Promise(resolve=>setTimeout(resolve,0));
 assert(unhandled.length===0,'PENDING_ARTIFACT_UNHANDLED_REJECTION '+unhandled.map(String).join('; '));
 console.log('PASS callback failure drains actual pending request rejection and preserves error identity');
}finally{release();(Deno as any).readFile=readBeforePending;removeEventListener('unhandledrejection',onUnhandled)}
await Deno.writeTextFile(log,'');let expired=false;try{await retained!(request)}catch(e){expired=String(e).includes('NATIVE.RUN_NOT_CURRENT')}assert(expired&&await count()===0,'Expired resolver retained authority');await save('expired-resolver');
await Deno.writeTextFile(log,'');await withNativeArtifactBatch(root,{},async()=>{let refused=false;try{await withNativeArtifactBatch(root,{},async()=>{})}catch(e){refused=String(e).includes('NATIVE.RUN_NOT_CURRENT')}assert(refused,'Reentrant batch accepted')});await save('reentrant-batch');assert(await count()===2,'Reentrant guard opened another proof');
const pointer=JSON.parse(await Deno.readTextFile(join(root,'_generated/course-spec/active-native-run.json'))),store=join(pointer.directory,'inspections/sha256'),first=[...Deno.readDirSync(store)][0].name,originalPath=join(store,first),before=await Deno.readFile(originalPath);
await Deno.writeTextFile(log,'');let originalRefused=false;try{await withNativeArtifactBatch(root,{},async batch=>{await batch.resolveArtifact(request);await Deno.writeFile(originalPath,new Uint8Array([...before,32]));return 'MUST_NOT_RETURN'})}catch(e){originalRefused=String(e).includes('NATIVE.COMMON_PATH_BINDING_INVALID');await save('original-drift-after-use',String(e))}finally{await Deno.writeFile(originalPath,before)}assert(originalRefused,'Original union mutation escaped B');
await Deno.writeTextFile(log,'');let contextRefused=false;try{await withNativeArtifactBatch(root,{},async batch=>{batch.run.documents[0].course.id='forged';return 'MUST_NOT_RETURN'})}catch(e){contextRefused=e instanceof TypeError||String(e).includes('NATIVE.RUN_NOT_CURRENT')}assert(contextRefused,'Run mutation accepted');await save('run-context-mutation');
const run=await loadNativeRun(root);await Deno.writeTextFile(log,'');await resolveArtifact(run,request);await save('standalone-fresh-proof');assert(await count()===2,'Standalone resolver bypassed proof');
await Deno.writeTextFile(log,'');await withNativeArtifactBatch(root,{},async batch=>{await batch.resolveArtifact(request)});await save('restored-positive-new-operation');assert(await count()===2,'New operation reused prior live proof');

// Сохранённый local guard не переживает finite callback, даже если файлы прежние.
let retainedCheck:(()=>Promise<void>)|undefined;await withCommonPathBinding(pointer,async(_w,check)=>{retainedCheck=check});let phaseExpired=false;try{await retainedCheck!()}catch(e){phaseExpired=String(e).includes('NATIVE.COMMON_PATH_BINDING_INVALID')}assert(phaseExpired,'Expired local binding guard accepted');
// Persistent witness drift во время final original union обязан отказать ДО результата.
const witnessPath=join(pointer.directory,'common-files-path-binding.json'),witnessBefore=await Deno.readFile(witnessPath);let unionReads=0,triggered=false,refused=false;
(Deno as any).readFile=async(path:any,options?:any)=>{const bytes=await originalRead(path,options);if(String(path)===originalPath&&++unionReads===2){await Deno.writeFile(witnessPath,new Uint8Array([...witnessBefore,32]));triggered=true}return bytes};
try{await withNativeArtifactBatch(root,{},async()=> 'MUST_NOT_RETURN')}catch(e){refused=String(e).includes('NATIVE.COMMON_PATH_BINDING_INVALID')}finally{(Deno as any).readFile=originalRead;await Deno.writeFile(witnessPath,witnessBefore)}assert(triggered&&refused,'Final original-union drift escaped prepublication fence');console.log('PASS expired local phase and witness drift during final union refused');

// IO admission completed-state делается до последнего полного fence, а не внутри publication.
let published=false,prepublishTriggered=false,prepublishRefused=false;
try{await withCommonPathBinding(pointer,async()=> 'MUST_NOT_RETURN',async()=>{published=true},async()=>{prepublishTriggered=true;await Deno.writeFile(witnessPath,new Uint8Array([...witnessBefore,32]))})}catch(e){prepublishRefused=String(e).includes('NATIVE.COMMON_PATH_BINDING_INVALID')}finally{await Deno.writeFile(witnessPath,witnessBefore)}assert(prepublishTriggered&&prepublishRefused&&!published,'Final input drift published after completion admission');console.log('PASS completion admission precedes final fence/publication');
