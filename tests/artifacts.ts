import {resolveArtifact} from '../_extensions/course-core/artifacts/resolve.ts';
import {loadNativeRun,type NativeRun} from '../_extensions/course-core/infrastructure/native-run.ts';
import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl} from 'stdlib/path';
const root=await Deno.makeTempDir();
try{
 await Deno.mkdir(root+'/projects/demo/student',{recursive:true});await Deno.writeTextFile(root+'/projects/demo/student/Demo.java','class Demo {}');
 await Deno.writeTextFile(root+'/demo.qmd','# Demo\n');await Deno.writeTextFile(root+'/demo.html','CURRENT_OUTPUT');
 const document:any={scope:'document',source:'demo.qmd',course:{view:'student'},projects:[{exerciseId:'exr-demo',source:'demo.qmd',projectRoot:'projects/demo',bankMember:false,purpose:'demonstration',statementVisibility:'open',artifactPolicy:{student:'full',full:'full',conditions:true}}],document:{source:'demo.qmd',format:'html',output:'demo.html',profiles:['student']},body:{publicExercises:[{id:'exr-demo',project:'/projects/demo',statementVisibility:'open'}]}};
 const run={schema:'course-native-run-v1',projectRoot:root,outputDirectory:root,documents:[document],profiles:['student'],renderAll:true,inputFiles:[root+'/demo.qmd'],outputFiles:[root+'/demo.html'],adapters:[]} as NativeRun;
 const assert=(value:unknown,message:string)=>{if(!value)throw Error(message)};
 const resolved=await resolveArtifact(run,{source:'demo.qmd',exerciseId:'exr-demo'});
 assert(resolved.kind==='full'&&resolved.projectRoot==='projects/demo','open demonstration full denied');
 document.projects[0].purpose=undefined;document.projects[0].artifactPolicy.student='starter';
 let fabricatedOrdinaryRejected=false;try{await resolveArtifact(run,{source:'demo.qmd',exerciseId:'exr-demo'})}catch(error){fabricatedOrdinaryRejected=String(error).includes('active-native-run.json')}
 assert(fabricatedOrdinaryRejected,'Fabricated no-common starter without current proof accepted');
 const fabricated=structuredClone(run);fabricated.documents[0].projects![0].materialization={commonFiles:[{source:'common/Support.java',target:'student/Support.java',audience:'student'}],includeGit:true};
 let fabricatedRejected=false;try{await resolveArtifact(fabricated,{source:'demo.qmd',exerciseId:'exr-demo'})}catch(error){fabricatedRejected=String(error).includes('active-native-run.json')}
 assert(fabricatedRejected,'Fabricated common artifact without current proof accepted');
 const seedRoot=await Deno.makeTempDir({prefix:'artifact-seed-native-'}),unpack=await Deno.makeTempDir();
 try{
  await copy(dirname(dirname(fromFileUrl(import.meta.url)))+'/_extensions/course-core',seedRoot+'/_extensions/course-core');
  await Deno.mkdir(seedRoot+'/common');await Deno.writeTextFile(seedRoot+'/common/Support.java','PUBLIC_SUPPORT');
  await Deno.mkdir(seedRoot+'/projects/demo/student',{recursive:true});await Deno.writeTextFile(seedRoot+'/projects/demo/student/Demo.java','class Demo {}');
  const config={project:{type:'default',render:['demo.qmd'],'output-dir':'_site',resources:['!projects/**','!common/**'],'pre-render':'_extensions/course-core/entrypoints/pre.ts','post-render':'_extensions/course-core/entrypoints/post.ts'},format:'html',filters:['course-core'],course:{id:'artifact-seed'},'project-materialization':{projects:{'exr-demo':{'common-files':[{source:'common/Support.java',target:'student/Support.java',audience:'student'}],'include-git':true}}}};
  await Deno.writeTextFile(seedRoot+'/_quarto.yml',JSON.stringify(config));await Deno.writeTextFile(seedRoot+'/_quarto-student.yml','course: {view: student}\n');
  await Deno.writeTextFile(seedRoot+'/demo.qmd','---\nexercise-bank: true\nexercise-statement-visibility: open\n---\n# Банк\n\n::: {#exr-demo difficulty=introductory time=10 project="/projects/demo"}\n## Условие\nОткрытый пример.\n:::\n');
  const git=(args:string[])=>new Deno.Command('git',{args,cwd:seedRoot+'/projects/demo/student',stdout:'null',stderr:'piped'}).outputSync();
  assert(git(['init']).success,'Git seed init failed');assert(git(['add','.']).success,'Git seed add failed');assert(git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','Seed']).success,'Git seed commit failed');
  const capture=async()=>{const r=await new Deno.Command(Deno.env.get('QUARTO')||'quarto',{args:['render','--profile','student'],cwd:seedRoot,stdout:'piped',stderr:'piped'}).output();assert(r.success,new TextDecoder().decode(r.stdout)+new TextDecoder().decode(r.stderr));return await loadNativeRun(seedRoot)};
  const noCommonConfig={...config};delete (noCommonConfig as any)['project-materialization'];await Deno.writeTextFile(seedRoot+'/_quarto.yml',JSON.stringify(noCommonConfig));
  assert((await resolveArtifact(await capture(),{source:'demo.qmd',exerciseId:'exr-demo'})).kind==='starter','ordinary student full allowed');
  await Deno.writeTextFile(seedRoot+'/_quarto.yml',JSON.stringify(config));
  const seeded=await resolveArtifact(await capture(),{source:'demo.qmd',exerciseId:'exr-demo'});
  assert(seeded.files?.some(f=>f.name==='.git/HEAD')&&seeded.files.some(f=>f.name==='Support.java'),'Captured seed/common missing from exact artifact inventory');
  for(const file of seeded.files!){const target=unpack+'/'+file.name;await Deno.mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});await Deno.writeFile(target,file.bytes)}
  const history=new Deno.Command('git',{args:['log','--format=%s'],cwd:unpack}).outputSync();
  assert(history.success&&new TextDecoder().decode(history.stdout).trim()==='Seed','Restored seed history unreadable');
  config['project-materialization'].projects['exr-demo']['include-git']=false;await Deno.writeTextFile(seedRoot+'/_quarto.yml',JSON.stringify(config));
  assert(!(await resolveArtifact(await capture(),{source:'demo.qmd',exerciseId:'exr-demo'})).files!.some(f=>f.name.startsWith('.git/')),'Default excludes lost');
 }finally{await Deno.remove(unpack,{recursive:true});await Deno.remove(seedRoot,{recursive:true})}
 let rejected=false;try{await resolveArtifact(run,{source:'demo.qmd',exerciseId:'exr-demo',kind:'full'})}catch{rejected=true}assert(rejected,'explicit ordinary full allowed');
 document.projects[0].statementVisibility='restricted';document.projects[0].artifactPolicy.student=undefined;
 rejected=false;try{await resolveArtifact(run,{source:'demo.qmd',exerciseId:'exr-demo'})}catch{rejected=true}assert(rejected,'restricted download allowed');
 document.course.view='full';document.projects[0].statementVisibility='open';
 await Deno.writeTextFile(root+'/_quarto.yml','project: {type: website}\nwebsite: {site-url: "https://example.test/course/"}\n');
 await Deno.writeTextFile(root+'/demo.qmd','# Demo\n');
 await Deno.writeTextFile(root+'/image.svg','<svg xmlns="http://www.w3.org/2000/svg"></svg>');
 await Deno.writeTextFile(root+'/demo.html','<div data-course-artifact-dependency="*"><p>REQUIRED_PREPARATION</p></div><div id="exr-demo"><h2>Demo</h2><p>PUBLIC_CONDITION</p><img src="image.svg?download=1#icon"><p><a href="theory.html#sec-theory">Theory</a></p><div class="solution"><div><p>PRIVATE_NESTED_SOLUTION</p></div></div><a class="project-download" href="exr-demo-full.zip">Download</a></div><div id="exr-other"><div data-course-artifact-dependency="*"><p>UNRELATED_PUBLIC_PREPARATION</p></div><div class="grading-notes"><div data-course-artifact-dependency="*"><p>PRIVATE_OTHER_PREREQUISITE</p></div></div></div>');
 run.outputFiles=[root+'/demo.html'];
 document.resources={source:'demo.qmd',format:'html',view:'full',effectiveBase:root,outputDirectory:root,outputFile:root+'/demo.html',rawUses:['image.svg?download=1#icon'],projectedUses:['image.svg?download=1#icon']};
 const conditions=await resolveArtifact(run,{source:'demo.qmd',exerciseId:'exr-demo',kind:'conditions'});
 const html=new TextDecoder().decode(conditions.files!.find(f=>f.name==='index.html')!.bytes);
 assert(html.includes('REQUIRED_PREPARATION')&&html.includes('PUBLIC_CONDITION')&&html.includes('https://example.test/course/theory.html#sec-theory'),'conditions lost native preparation/cross-document link');
 assert(!html.includes('UNRELATED_PUBLIC_PREPARATION'),'conditions promoted unrelated preparation');
 assert(!html.includes('PRIVATE_OTHER_PREREQUISITE'),'conditions promoted private prerequisite from another exercise');
 assert(!html.includes('PRIVATE_NESTED_SOLUTION')&&!html.includes('exr-demo-full.zip'),'conditions leaked nested solution/download');
 assert(html.includes('image.svg?download=1#icon'),'conditions asset URL suffix lost');
 assert(conditions.files!.some(f=>f.name.endsWith('image.svg')),'conditions local asset omitted');
 const readmeFile=conditions.files!.find(f=>f.name==='README.md');
 assert(readmeFile,'conditions standalone README missing');
 const readme=new TextDecoder().decode(readmeFile!.bytes);
 assert(readme.includes('index.html')&&readme.includes('xdg-open index.html')&&readme.includes('open index.html')&&readme.includes('start "" index.html'),'conditions README lacks working browser commands');
 assert(!/gradle|junit|PRIVATE_NESTED_SOLUTION/i.test(readme),'conditions README includes grading or private material');
 console.log('PASS conditions_native_ast_preparation_assets_crossrefs_no_solutions_no_downloads');
 console.log('PASS trusted artifact audience, open nonbank demonstration and explicit kind guards');
}finally{await Deno.remove(root,{recursive:true})}
