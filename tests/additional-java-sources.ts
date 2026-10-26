import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
import {collectProjectChecks} from '../_extensions/course-core/project-checks/collect.ts';
const repository=dirname(dirname(fromFileUrl(import.meta.url))),root=await Deno.makeTempDir({prefix:'core-extra-java-'});
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message);};
try{
 const project=join(root,'bank/projects/demo');
 for(const path of ['student','tests','reference'])await Deno.mkdir(join(project,path),{recursive:true});
 await copy(join(repository,'_extensions/course-core'),join(root,'bank/_extensions/course-core'));
 await Deno.writeTextFile(join(root,'_quarto.yml'),'project: {type: default, render: [index.qmd]}\ncourse: {id: extra-test}\n');
 await Deno.writeTextFile(join(root,'index.qmd'),'# Root\n');
 const yaml=`project: {type: book}\nbook: {title: Checks, chapters: [index.qmd]}\ncourse: {id: extra-test}\nproject-checks:\n  defaults:\n    runtime: java25-junit-v1\n    scoring: {mode: weighted}\n  source-profiles:\n    main: {mode: implementation, root: student, include: ["**/*.java"]}\n  profiles:\n    junit:\n      source-profile: main\n      tests: ["tests/*.java"]\n      references: [{name: correct, root: reference}]\n      additional-java-sources: {archive: additional-sources.zip, max-files: 128, max-file-bytes: 1048576, max-total-bytes: 4194304, max-archive-bytes: 2097152}\n`;
 await Deno.writeTextFile(join(root,'bank/_quarto.yml'),yaml);
 await Deno.writeTextFile(join(root,'bank/_quarto-full.yml'),'course: {view: full}\n');
 await Deno.writeTextFile(join(root,'bank/index.qmd'),'# Demo\n\n::: {#exr-demo project="/projects/demo" project-check=junit}\n## Demo\nCondition\n:::\n');
 await Deno.writeTextFile(join(project,'student/Main.java'),'class Main {}');
 await Deno.writeTextFile(join(project,'tests/ExampleTest.java'),'class ExampleTest {}');
 await Deno.writeTextFile(join(project,'reference/Main.java'),'class Main extends Base {}');
 await Deno.writeTextFile(join(project,'reference/Base.java'),'class Base {}');
 const a=await collectProjectChecks(root,{book:'bank'}),selected=a.projects[0];
 assert(selected.check['additional-java-sources']?.['max-files']===128,'native Lua lost numeric typed policy');
 assert(selected.sources.length===1&&selected.references[0].sources.length===2,'optional reference extras were lost');
 await Deno.writeTextFile(join(root,'checks.json'),JSON.stringify(a));
 const vet=await new Deno.Command(Deno.env.get('CUE')??'cue',{args:['vet',join(repository,'_extensions/course-core/spec/core.cue'),join(repository,'_extensions/course-core/project-checks/manifest.cue'),join(root,'checks.json'),'-d','#ChecksManifest','-c'],stdout:'piped',stderr:'piped'}).output();
 assert(vet.success,new TextDecoder().decode(vet.stderr));
 for(const required of [false,true]){
  await Deno.writeTextFile(join(root,'bank/_quarto.yml'),yaml.replace('max-files: 128',`primary-required: ${required}, max-files: 128`));
  const optional=await collectProjectChecks(root,{book:'bank'});
  assert(optional.projects[0].check['additional-java-sources']?.['primary-required']===required,'typed primary-required lost');
  await Deno.writeTextFile(join(root,'checks.json'),JSON.stringify(optional));
  const checked=await new Deno.Command(Deno.env.get('CUE')??'cue',{args:['vet',join(repository,'_extensions/course-core/spec/core.cue'),join(repository,'_extensions/course-core/project-checks/manifest.cue'),join(root,'checks.json'),'-d','#ChecksManifest','-c'],stdout:'piped',stderr:'piped'}).output();
  assert(checked.success,new TextDecoder().decode(checked.stderr));
 }
 await Deno.mkdir(join(project,'reference/other'));
 await Deno.writeTextFile(join(project,'reference/other/Solution.java'),'package other; class Solution {}');
 await Deno.writeTextFile(join(root,'bank/_quarto.yml'),yaml.replace('include: ["**/*.java"]','include: ["Main.java"]').replace('max-files: 128','primary-required: false, max-files: 128'));
 const free=await collectProjectChecks(root,{book:'bank'});
 assert(free.projects[0].sources.length===1&&free.projects[0].references[0].sources.length===3,'optional reference namespace restricted to starter include');
 await Deno.remove(join(project,'reference/other'),{recursive:true});
 await Deno.writeTextFile(join(root,'bank/_quarto.yml'),yaml);
 await Deno.writeTextFile(join(project,'reference/Base.java'),'class Base {int changed;}');
 const b=await collectProjectChecks(root,{book:'bank'});assert(a.inventoryHash!==b.inventoryHash,'extra reference source bytes not hashed');
 for(const replacement of ['max-files: 129','max-files: 1.5','max-files: true','primary-required: 0, max-files: 128','primary-required: "false", max-files: 128']){
  await Deno.writeTextFile(join(root,'bank/_quarto.yml'),yaml.replace('max-files: 128',replacement));
  let rejected=false;try{await collectProjectChecks(root,{book:'bank'});}catch{rejected=true;}assert(rejected,'invalid policy accepted '+replacement);
 }
 await Deno.writeTextFile(join(root,'bank/_quarto.yml'),yaml.replace(/      additional-java-sources:.*\n/,''));
 let legacyRejected=false;try{await collectProjectChecks(root,{book:'bank'});}catch{legacyRejected=true;}assert(legacyRejected,'legacy reference mapping silently widened');
 console.log('PASS optional Java policy/native numeric extraction/reference extras/hash/CUE/legacy mapping');
}finally{await Deno.remove(root,{recursive:true});}
