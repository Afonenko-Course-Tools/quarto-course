import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
import {collectExport} from '../_extensions/course-core/body-export/collect.ts';
import {loadNativeRun,commonPathDocument,beginNativeRun} from '../_extensions/course-core/infrastructure/native-run.ts';
import {readCommonPathBinding,digest} from '../_extensions/course-core/infrastructure/common-path-binding.ts';
import {materializeProjects} from '../_extensions/course-core/artifacts/materialize.ts';
const root=await Deno.makeTempDir({prefix:'forced-writer-native-'}),bank=join(root,'bank'),repo=dirname(dirname(fromFileUrl(import.meta.url)));
const assert=(v:unknown,s:string)=>{if(!v)throw Error(s)};
async function refuse(label:string,fn:()=>Promise<unknown>){let no=false;try{await fn()}catch(e){assert(String(e).includes('NATIVE.')||String(e).includes('native'),String(e));no=true;console.log('CAUSE',label,String(e).split('\n')[0])}assert(no,'Accepted '+label);console.log('REFUSED',label)}
async function write(path:string,text:string){await Deno.mkdir(dirname(path),{recursive:true});await Deno.writeTextFile(path,text)}
await copy(join(repo,'_extensions/course-core'),join(bank,'_extensions/course-core'));
await write(join(root,'_quarto.yml'),'project: {type: default}\ncourse: {id: writer-probe}\n');
await write(join(bank,'_quarto.yml'),`project: {type: book, resources: ['!projects/**','!common/**']}
book: {title: Writer, chapters: [index.qmd, task.qmd]}
format: html
filters: [course-core]
project-materialization:
  projects:
    exr-writer:
      common-files:
      - {source: common/helper.txt, target: student/helper.txt, audience: student}
`);
await write(join(bank,'index.qmd'),'---\nassessment: {id: lab, kind: lab}\n---\n# Work\n\n::: {.task-items}\n- @exr-writer\n:::\n');
await write(join(bank,'task.qmd'),'---\nexercise-bank: true\nexercise-statement-visibility: open\ndefault-exercise-project-check: false\nformat: {html: {output-file: specific.html}}\n---\n# Bank\n\n::: {#exr-writer difficulty=introductory time=10 project="/projects/a"}\nSynthetic public condition.\n:::\n');await write(join(bank,'common/helper.txt'),'PUBLIC_HELPER\n');await write(join(bank,'projects/a/student/README.md'),'Synthetic starter.\n');
console.log('FIXTURE',root);await collectExport(root,{book:'bank',work:'lab'});const native=await loadNativeRun(bank),ppath=join(bank,'_generated/course-spec/active-native-run.json'),pb=await Deno.readFile(ppath),p=JSON.parse(new TextDecoder().decode(pb)),wpath=join(p.directory,'common-files-path-binding.json'),wb=await Deno.readFile(wpath),w=JSON.parse(new TextDecoder().decode(wb)),rawPath=join(p.directory,'owned-export-profile.json'),raw=await Deno.readFile(rawPath);
assert(JSON.stringify(w.forcedWriter)==='{"kind":"owned-export-json"}','Missing closed writer marker');assert(w.documents.length===w.inputFiles.length&&w.documents.every((d:any)=>d.format==='json'),'Not exact selected JSON scope');assert(await digest(raw)===w.temporaryExportProfile.sha256&&await digest(raw,'SHA-1')===w.temporaryExportProfile.sha1,'Raw profile H changed');
const authored=JSON.parse(await Deno.readTextFile(join(p.directory,'inspections/sha256',w.documentInspectionHashes['task.qmd']+'.json')));assert(authored.formats.html&&!authored.formats.json,'Original authored HTML was rewritten as JSON');assert(native.documents.every(d=>d.document.format==='json'&&d.document.exportContext===true),'No actual JSON event');
await materializeProjects({nativeRun:native,sourceRoot:bank,outputRoot:root+'-student',exerciseIds:['exr-writer'],audience:'student'});assert(await Deno.readTextFile(root+'-student/projects/a/student/helper.txt')==='PUBLIC_HELPER\n','Forced common not materialized');console.log('PASS original HTML, actual JSON, exact raw profile and canonical common kit');
for(const [label,mutate] of [
 ['missing marker',(x:any)=>delete x.forcedWriter],['unknown marker',(x:any)=>x.forcedWriter.kind='caller-json'],['extra marker',(x:any)=>x.forcedWriter.extra=true],['missing owned proof',(x:any)=>delete x.temporaryExportProfile],['marker+profile downgrade',(x:any)=>{delete x.forcedWriter;delete x.temporaryExportProfile}],['extra format',(x:any)=>x.documents.push({...x.documents[0],format:'html'})],
] as [string,(v:any)=>void][]){const changed=structuredClone(w);mutate(changed);const b=new TextEncoder().encode(JSON.stringify(changed)),cp={...p,commonPathBinding:{file:'common-files-path-binding.json',sha1:await digest(b,'SHA-1'),sha256:await digest(b)}};await Deno.writeFile(wpath,b);await Deno.writeTextFile(ppath,JSON.stringify(cp));try{await refuse(label,()=>loadNativeRun(bank))}finally{await Deno.writeFile(wpath,wb);await Deno.writeFile(ppath,pb)}}
await refuse('wrong actual writer request',()=>commonPathDocument(bank,'task.qmd','html'));await refuse('unknown source',()=>commonPathDocument(bank,'unknown.qmd','json'));
for(const [label,change,restore] of [
 ['raw bytes',()=>Deno.writeFile(rawPath,new Uint8Array([...raw,32])),()=>Deno.writeFile(rawPath,raw)],
 ['raw mode',()=>Deno.chmod(rawPath,0o644),()=>Deno.chmod(rawPath,0o600)],
 ['raw missing',()=>Deno.rename(rawPath,join(root,'held-raw')),()=>Deno.rename(join(root,'held-raw'),rawPath)],
 ['extra copy',()=>Deno.writeFile(join(p.directory,'backup-profile.json'),raw),()=>Deno.remove(join(p.directory,'backup-profile.json'))],
 ['active resurrection',()=>Deno.writeFile(join(bank,w.temporaryExportProfile.file),raw),()=>Deno.remove(join(bank,w.temporaryExportProfile.file))],
] as [string,()=>Promise<unknown>,()=>Promise<unknown>][]){await change();try{await refuse(label,()=>loadNativeRun(bank))}finally{await restore()}}
await Deno.rename(rawPath,join(root,'held-raw'));await Deno.symlink(join(root,'held-raw'),rawPath);try{await refuse('symlink raw slot',()=>loadNativeRun(bank))}finally{await Deno.remove(rawPath);await Deno.rename(join(root,'held-raw'),rawPath)}
// Existing native command boundary: corrupt saved bytes after its initial read.
const actual=Deno.env.get('QUARTO')||'quarto',script=join(root,'mid.ts'),wrapper=join(root,'quarto-mid'),marker=join(root,'triggered');
await write(script,`if(Deno.args[0]==='inspect'){let seen=false;try{await Deno.stat(${JSON.stringify(marker)});seen=true}catch{}if(!seen){await Deno.writeTextFile(${JSON.stringify(marker)},'1');await Deno.writeTextFile(${JSON.stringify(rawPath)},'{}')}}const r=await new Deno.Command(${JSON.stringify(actual)},{args:Deno.args,stdin:'inherit',stdout:'inherit',stderr:'inherit'}).spawn().status;Deno.exit(r.code);`);const quote=(s:string)=>"'"+s.replaceAll("'","'\\''")+"'";await Deno.writeTextFile(wrapper,'#!/bin/sh\nexec '+quote(Deno.execPath())+' run --allow-all --no-config '+quote(script)+' "$@"\n',{mode:0o700});Deno.env.set('QUARTO',wrapper);try{await refuse('raw mutation mid-inspect',()=>loadNativeRun(bank));assert(await Deno.readTextFile(marker)==='1','Mutation not triggered')}finally{Deno.env.set('QUARTO',actual);await Deno.writeFile(rawPath,raw)}await loadNativeRun(bank);console.log('PASS marker/raw before-after and restored completed retirement');
// A raw saved file cannot authorize active-profile disappearance in an unfinished capture.
await Deno.writeFile(join(bank,w.temporaryExportProfile.file),raw);Deno.env.set('QUARTO_PROFILE',p.profiles.join(','));Deno.env.set('QUARTO_PROJECT_INPUT_FILES',w.inputFiles.map((s:string)=>join(bank,s)).join('\n'));Deno.env.set('QUARTO_PROJECT_OUTPUT_DIR',p.outputDirectory);Deno.env.set('QUARTO_PROJECT_RENDER_ALL','1');const partial=await beginNativeRun(bank);await Deno.remove(join(bank,w.temporaryExportProfile.file));await refuse('active disappeared without completed capability',()=>readCommonPathBinding(partial));console.log('PASS no raw-profile retirement default');
