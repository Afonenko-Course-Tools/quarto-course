import { materializeProjects } from '../_extensions/course-core/artifacts/materialize.ts';
import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl} from 'stdlib/path';
import {loadNativeRun,type NativeRun} from '../_extensions/course-core/infrastructure/native-run.ts';

const assert=(ok:unknown,message:string)=>{if(!ok)throw Error(message)};
const root=await Deno.makeTempDir({prefix:'core-materialize-'});
const source=root+'/source',teacher=root+'/teacher';
const project='projects/numbers/demo';
const write=async(path:string,text:string)=>{
 await Deno.mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});
 await Deno.writeTextFile(path,text);
};
const exists=async(path:string)=>{try{await Deno.lstat(path);return true}catch(error){if(error instanceof Deno.errors.NotFound)return false;throw error}};
try{
 await write(source+'/'+project+'/student/src/Main.java','class Main {}\n');
 await write(source+'/'+project+'/student/README.md','Публичная инструкция\n');
 await write(source+'/'+project+'/student/build/generated.class','GENERATED');
 await write(teacher+'/'+project+'/reference/src/Main.java','PRIVATE_REFERENCE');
 await write(teacher+'/'+project+'/tests/private/Case.java','PRIVATE_CASE');
 await write(source+'/common/Support.java','class Support {}\n');
 await write(source+'/numbers.qmd','Публичное каноническое условие\n');
 let fact:any={exerciseId:'exr-numbers-demo',source:'numbers.qmd',projectRoot:project,bankMember:true,statementVisibility:'open',artifactPolicy:{student:'starter',full:'full',conditions:true}};
 const nativeRun={schema:'course-native-run-v1',projectRoot:source,outputDirectory:source+'/_site',documents:[{source:'numbers.qmd',course:{view:'student'},projects:[fact]}],profiles:['student'],renderAll:true,inputFiles:[],outputFiles:[],adapters:[]} as unknown as NativeRun;
 const options={nativeRun,sourceRoot:source,outputRoot:root+'/student-stage',exerciseIds:[fact.exerciseId],audience:'student' as const};
 const manifest=await materializeProjects(options);
 assert(await Deno.readTextFile(options.outputRoot+'/'+project+'/student/src/Main.java')==='class Main {}\n','Student source changed');
 assert(!await exists(options.outputRoot+'/'+project+'/reference'),'Private reference leaked');
 assert(!await exists(options.outputRoot+'/'+project+'/student/build'),'Generated output copied');
 assert(manifest.files.every(file=>/^[a-f0-9]{64}$/.test(file.sha256)),'Missing file hashes');
 await materializeProjects({...options,checkOnly:true});
 await write(options.outputRoot+'/'+project+'/student/unexpected.txt','UNEXPECTED');
 let rejectedCheck=false;try{await materializeProjects({...options,checkOnly:true})}catch{rejectedCheck=true}
 assert(rejectedCheck,'Check accepted an extra unrecorded file');
 await Deno.remove(options.outputRoot+'/'+project+'/student/unexpected.txt');
 const gradingRoot=root+'/grading-stage';
 await materializeProjects({...options,outputRoot:gradingRoot,audience:'grading',teacherRoot:teacher});
 assert(await Deno.readTextFile(gradingRoot+'/'+project+'/reference/src/Main.java')==='PRIVATE_REFERENCE','Reference overlay missing');
 assert(await Deno.readTextFile(gradingRoot+'/'+project+'/tests/private/Case.java')==='PRIVATE_CASE','Private tests missing');
 let caseNumber=0;
 const rejects=async(change:any,label:string)=>{
  const outputRoot=root+'/rejected-'+caseNumber++;
  let rejected=false;try{await materializeProjects({...options,outputRoot,...change})}catch{rejected=true}
  assert(rejected,label+' accepted');
  if(!change.outputRoot)assert(!await exists(outputRoot),label+' wrote output before validation');
 };
 await rejects({exerciseIds:['exr-missing']},'Unknown task');
 await rejects({exerciseIds:[]},'Empty selection');
 await rejects({exerciseIds:[fact.exerciseId,fact.exerciseId]},'Duplicate selection');
 await rejects({teacherRoot:teacher},'Student with teacher root');
 await rejects({audience:'grading'},'Grading without teacher root');
 await rejects({outputRoot:source+'/nested-output'},'Output inside source');
 await rejects({outputRoot:root},'Output contains source');
 await rejects({audience:'grading',teacherRoot:source},'Teacher/source overlap');
 let commonFact=fact as any;
 commonFact.materialization={commonFiles:[{source:'common/Support.java',target:'student/src/Support.java',audience:'student'},{source:'common/Support.java',target:'tests/Support.java',audience:'grading'}]};
 const capture=async()=>{
  if(!await exists(source+'/_extensions/course-core'))await copy(dirname(dirname(fromFileUrl(import.meta.url)))+'/_extensions/course-core',source+'/_extensions/course-core');
  const facts=nativeRun.documents.flatMap(d=>d.projects??[]),projects=Object.fromEntries(facts.filter(f=>f.materialization).map(f=>[f.exerciseId,{'common-files':f.materialization!.commonFiles,...(f.materialization!.includeGit!==undefined?{'include-git':f.materialization!.includeGit}:{})}]));
  await write(source+'/_quarto.yml',JSON.stringify({project:{type:'default','output-dir':'_site',render:['numbers.qmd'],resources:['!projects/**','!common/**'],'pre-render':'_extensions/course-core/entrypoints/pre.ts','post-render':'_extensions/course-core/entrypoints/post.ts'},format:'html',filters:['course-core'],course:{id:'materialize-fixture'},...(Object.keys(projects).length?{'project-materialization':{projects}}:{})}));
  await write(source+'/_quarto-student.yml','course: {view: student}\n');
  await write(source+'/numbers.qmd','---\nexercise-bank: true\nexercise-statement-visibility: open\n---\n# Проекты\n\n'+facts.map(f=>'::: {#'+f.exerciseId+' difficulty=introductory time=10 project="/'+f.projectRoot+'"}\n## Условие\nОткрытое условие.\n:::\n').join('\n'));
  const rendered=await new Deno.Command(Deno.env.get('QUARTO')||'quarto',{args:['render','--profile','student'],cwd:source,stdout:'piped',stderr:'piped'}).output();assert(rendered.success,new TextDecoder().decode(rendered.stdout)+new TextDecoder().decode(rendered.stderr));
  Object.assign(nativeRun,await loadNativeRun(source));fact=nativeRun.documents.flatMap(d=>d.projects??[]).find(f=>f.exerciseId==='exr-numbers-demo');commonFact=fact;
 };
 await capture();
 const common=await materializeProjects({...options,outputRoot:root+'/common-student'});
 assert(await Deno.readTextFile(root+'/common-student/'+project+'/student/src/Support.java')==='class Support {}\n','Public common omitted');
 assert(!await exists(root+'/common-student/'+project+'/tests'),'Grading common leaked to student');
 assert(Object.keys(common.commonSources).length===1,'Canonical common identity lost');
 const commonGrading=await materializeProjects({...options,outputRoot:root+'/common-grading',audience:'grading',teacherRoot:teacher});
 assert(commonGrading.files.some(f=>f.target===project+'/tests/Support.java'),'Grading common omitted');
 assert(!await exists(source+'/'+project+'/student/src/Support.java'),'Common copied into editable source');
 commonFact.materialization.commonFiles.push({source:'common/Support.java',target:'student/README.md',audience:'student'});
 await rejects({},'Task-owned/common collision');
 commonFact.materialization.commonFiles.pop();
 for(const mapping of [
  {source:'common/Support.java',target:'student/secret.txt',audience:'grading'},
  {source:'common/Support.java',target:'student/private/secret.txt',audience:'student'},
  {source:'numbers.qmd',target:'student/leak.txt',audience:'student'},
  {source:'common/Support.java',target:'student/source.qmd',audience:'student'},
  {source:'common/Support.java',target:'student/reference/rubric.md',audience:'student'},
  {source:project+'/reference/Secret.java',target:'student/Secret.java',audience:'student'},
 ]){
  await write(source+'/'+project+'/reference/Secret.java','CLOSED_SOURCE_CANARY');
  const saved=commonFact.materialization.commonFiles;commonFact.materialization.commonFiles=[mapping];
  await rejects({audience:'grading',teacherRoot:teacher},'Common privacy bypass '+mapping.target+' '+mapping.source);
  commonFact.materialization.commonFiles=saved;
 }
 for(const sourcePath of ['/absolute','../outside','common/*.java','.git/config']){
  commonFact.materialization.commonFiles[0].source=sourcePath;
  await rejects({},'Unsafe common source '+sourcePath);
 }
 commonFact.materialization.commonFiles[0].source='common/Support.java';
 commonFact.materialization.commonFiles[0].target='../other/student/Support.java';
 await rejects({},'Cross-project common target');
 commonFact.materialization.commonFiles[0].target='student/src/Support.java';
 const second={...fact,exerciseId:'exr-second',projectRoot:'projects/control/second'};
 await write(source+'/'+second.projectRoot+'/student/Main.java','class Main {}');
 (nativeRun.documents[0].projects as any[]).push(second);
 const selected=[fact.exerciseId,second.exerciseId];
 await capture();
 const both=await materializeProjects({...options,exerciseIds:selected,outputRoot:root+'/both'});
 assert(Object.keys(both.commonSources).length===1&&both.files.filter(f=>f.origin==='common').length===2,'Common not shared across selected projects');
 await write(source+'/common/Support.java','class Support { int changed; }\n');
 await rejects({exerciseIds:selected},'Stale common bytes require fresh capture');
 await capture();
 const updated=await materializeProjects({...options,exerciseIds:selected,outputRoot:root+'/both-updated'});
 const copies=updated.files.filter(f=>f.origin==='common');
 assert(copies.length===2&&copies[0].sha256===copies[1].sha256&&copies[0].sha256!==both.files.find(f=>f.origin==='common')!.sha256,'Canonical change did not update both generated copies');
 (nativeRun.documents[0].projects as any[]).pop();
 delete commonFact.materialization;
 await capture();
 await Deno.symlink(source+'/'+project+'/student/README.md',source+'/'+project+'/student/link.md');
 await rejects({},'Source symlink');
 await Deno.remove(source+'/'+project+'/student/link.md');
 await write(teacher+'/'+project+'/student/README.md','ATTEMPTED_OVERRIDE');
 await rejects({audience:'grading',teacherRoot:teacher},'Teacher override of public files');
 await Deno.remove(teacher+'/'+project+'/student',{recursive:true});
 const git=(args:string[])=>new Deno.Command('git',{args,cwd:source,stdout:'piped',stderr:'piped'}).outputSync();
 for(const args of [['init','-q'],['add','.'],['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','Source snapshot']])assert(git(args).success,'Git source fixture failed');
 const head=new TextDecoder().decode(git(['rev-parse','HEAD']).stdout).trim();
 const gitManifest=await materializeProjects({...options,outputRoot:root+'/git-source-stage'});
 assert(gitManifest.sourceCommit===head,'Full stage omitted internally observed sourceCommit');
 await write(source+'/_quarto.yml','# CONFIG_ONLY_COMMIT\n');assert(git(['add','_quarto.yml']).success,'Config add failed');assert(git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','Config only']).success,'Config-only commit failed');
 const newHead=new TextDecoder().decode(git(['rev-parse','HEAD']).stdout).trim();assert(newHead!==gitManifest.sourceCommit,'Config-only commit did not change HEAD');
 await write(source+'/'+project+'/student/private/canary.txt','PRIVATE_CANARY');
 await rejects({},'Private canary in student tree');
 assert(await Deno.readTextFile(source+'/'+project+'/student/README.md')==='Публичная инструкция\n','Source modified');
 console.log('PASS materialize public/grading partitions, hashes, paths, symlinks, overlay and private canary');
}finally{await Deno.remove(root,{recursive:true})}
