import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
import {collectExport} from '../_extensions/course-core/body-export/collect.ts';
import {loadNativeRun} from '../_extensions/course-core/infrastructure/native-run.ts';
const repo=dirname(dirname(fromFileUrl(import.meta.url))),root=await Deno.makeTempDir({prefix:'forced-writer-lua-'}),actual=Deno.env.get('QUARTO')||'/usr/bin/quarto';
const assert=(v:unknown,s:string)=>{if(!v)throw Error(s)};
async function write(p:string,t:string){await Deno.mkdir(dirname(p),{recursive:true});await Deno.writeTextFile(p,t)}
async function fixture(name:string,extra=''){
 const dir=join(root,name),bank=join(dir,'bank');await copy(join(repo,'_extensions/course-core'),join(bank,'_extensions/course-core'));
 await write(join(dir,'_quarto.yml'),'project: {type: default}\ncourse: {id: writer-lua}\n');
 await write(join(bank,'_quarto.yml'),'project: {type: book}\nbook: {title: Synthetic, chapters: [index.qmd, task.qmd]}\nformat: html\nfilters: [course-core]\n');
 await write(join(bank,'index.qmd'),'---\nassessment: {id: lab, kind: lab}\n---\n# Work\n\n::: {.task-items}\n- @exr-one\n:::\n');
 await write(join(bank,'task.qmd'),'---\nexercise-bank: true\nexercise-statement-visibility: open\ndefault-exercise-project-check: false\n'+extra+'---\n# Bank\n\n::: {#exr-one difficulty=introductory time=10 project="/projects/a"}\nSynthetic condition.\n:::\n');
 await write(join(bank,'projects/a/student/README.md'),'Synthetic starter.\n');await write(join(bank,'helper.txt'),'PUBLIC\n');return {dir,bank};
}
async function refused(name:string,dir:string,diagnostic:string){let error='';try{await collectExport(dir,{book:'bank',work:'lab'})}catch(e){error=String(e);const failure=e as any,stem=join(dir,'caught-failure');await write(stem+'.json',JSON.stringify({name:failure.name,message:failure.message,stack:failure.stack,exitCode:failure.exitCode,tool:failure.tool},null,2)+'\n');await write(stem+'.stdout',failure.stdout??'');await write(stem+'.stderr',failure.stderr??'');console.log('FAILURE_EVIDENCE',name,stem)}assert(error.includes(diagnostic),name+' wrong refusal: '+error);let completed=false;try{await loadNativeRun(join(dir,'bank'));completed=true}catch{}assert(!completed,name+' left completed run');console.log('REFUSED',name,diagnostic)}
const quote=(s:string)=>"'"+s.replaceAll("'","'\\''")+"'";
async function wrongWriterWrapper(name:string){
 const script=join(root,name+'.ts'),wrapper=join(root,name),seen=join(root,name+'-argv.json');
 await write(script,`const args=[...Deno.args];if(args[0]==='render'){const i=args.indexOf('--to');if(i<0||args[i+1]!=='json')throw Error('No actual owned JSON request');args[i+1]='html';await Deno.writeTextFile(${JSON.stringify(seen)},JSON.stringify(args))}const r=await new Deno.Command(${JSON.stringify(actual)},{args,stdin:'inherit',stdout:'inherit',stderr:'inherit'}).spawn().status;Deno.exit(r.code);`);
 await Deno.writeTextFile(wrapper,'#!/bin/sh\nexec '+quote(Deno.execPath())+' run --allow-all --no-config '+quote(script)+' "$@"\n',{mode:0o700});return {wrapper,seen};
}
export async function checkNativeWrongFormat(){
console.log('FIXTURE',root);const {wrapper}=await wrongWriterWrapper('native-quarto-wrong-writer');
// Test-only additional entry call: actual HTML FORMAT reaches the existing native
// fence BEFORE the untouched production handler/visibility guard. No FORMAT or metadata edits.
const nativeWrong=await fixture('native-wrong-format'),nativeFilter=join(nativeWrong.bank,'_extensions/course-core/filter.lua'),nativeBefore=await Deno.readTextFile(nativeFilter),entry='return __perfFilters({{Pandoc = function(doc)',formatLog=join(nativeWrong.dir,'actual-format.txt');
assert(nativeBefore.includes(entry),'Missing existing native handler');
const probe=`\n  local probe=assert(io.open(${JSON.stringify(formatLog)},'wb'));assert(probe:write(FORMAT));probe:close()\n  output.bound_materialization(doc)`;
await Deno.writeTextFile(nativeFilter,nativeBefore.replace(entry,entry+probe));
assert((await Deno.readTextFile(nativeFilter)).replace(entry+probe,entry)===nativeBefore,'Production handler changed beyond extra probe');
Deno.env.set('QUARTO',wrapper);try{await refused('ACTUAL NATIVE wrong FORMAT',nativeWrong.dir,'NATIVE.COMMON_PATH_BINDING_INVALID: Неизвестный source/format текущего witness')}finally{Deno.env.set('QUARTO',actual)}
assert(await Deno.readTextFile(formatLog)==='html','Probe did not observe real native HTML FORMAT');
const failure=JSON.parse(await Deno.readTextFile(join(nativeWrong.dir,'caught-failure.json'))),stderr=await Deno.readTextFile(join(nativeWrong.dir,'caught-failure.stderr'));
assert(failure.exitCode!==0&&stderr.includes('NATIVE.COMMON_PATH_BINDING_INVALID: Неизвестный source/format текущего witness; источник=index.qmd, поле=native-run')&&stderr.includes('output.bound_materialization')&&!stderr.includes('CORE.VISIBILITY_INVALID'),'Did not reach exact NATIVE fence before visibility');
const pointer=JSON.parse(await Deno.readTextFile(join(nativeWrong.bank,'_generated/course-spec/active-native-run.json'))),witness=JSON.parse(await Deno.readTextFile(join(pointer.directory,'common-files-path-binding.json'))),raw=JSON.parse(await Deno.readTextFile(join(pointer.directory,'owned-export-profile.json')));
assert(witness.forcedWriter?.kind==='owned-export-json'&&witness.documents.every((d:any)=>d.format==='json')&&raw.project['pre-render']===join(repo,'_extensions/course-core/entrypoints/pre.ts'),'No genuine canonical owned JSON proof');
assert([...Deno.readDirSync(join(pointer.directory,'documents'))].length===0,'Wrong writer emitted facts');
for(const f of [join(pointer.directory,'native-run.json'),join(nativeWrong.bank,'_generated/course-spec/native-run.json')]){let exists=false;try{await Deno.stat(f);exists=true}catch(e){if(!(e instanceof Deno.errors.NotFound))throw e}assert(!exists,'Wrong writer emitted completed run')}
console.log('PASS ACTUAL html FORMAT -> existing bound_materialization NATIVE fence; no facts/completed run');
}
async function main(){
console.log('FIXTURE',root);
const good=await fixture('qmd-common','project-materialization:\n  projects:\n    exr-one:\n      common-files:\n      - {source: helper.txt, target: student/helper.txt, audience: student}\n');
await collectExport(good.dir,{book:'bank',work:'lab'});const run=await loadNativeRun(good.bank);assert(run.documents.some(d=>d.source==='task.qmd'&&d.document.format==='json'&&d.projects?.length),'QMD common missing actual JSON facts');console.log('PASS supported QMD common actual JSON');
const wrong=await fixture('wrong-writer'),{wrapper,seen}=await wrongWriterWrapper('quarto-wrong-writer');
Deno.env.set('QUARTO',wrapper);try{await refused('ACTUAL HTML writer',wrong.dir,'CORE.VISIBILITY_INVALID');assert(JSON.parse(await Deno.readTextFile(seen)).includes('html'),'Actual render writer not changed')}finally{Deno.env.set('QUARTO',actual)}
await checkNativeWrongFormat();
const mismatch=await fixture('full-section'),filter=join(mismatch.bank,'_extensions/course-core/filter.lua'),original=await Deno.readTextFile(filter),needle='  local boundMaterialization=output.bound_materialization(doc)';assert(original.includes(needle),'Missing actual filter binding');await Deno.writeTextFile(filter,original.replace(needle,"  doc.meta['project-materialization']=pandoc.MetaMap({projects=pandoc.MetaMap({})})\n"+needle));await refused('ACTUAL Lua full section mismatch',mismatch.dir,'NATIVE.COMMON_PATH_BINDING_INVALID');
const hidden=await fixture('unknown-format-common','format:\n  html:\n    project-materialization: null\n');await refused('unknown null format common',hidden.dir,'NATIVE.COMMON_PATH_BINDING_INVALID');
console.log('PASS actual Lua writer/full-section fences and QMD origin');
}
if(import.meta.main)await main();
