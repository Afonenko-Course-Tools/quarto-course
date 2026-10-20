import {materializeStarterArtifact,materializeProjects} from '../_extensions/course-core/artifacts/materialize.ts';
import {bindArtifactProjectMaterializations} from '../_extensions/course-core/domain/project-materialization.ts';
import type {NativeRun} from '../_extensions/course-core/infrastructure/native-run.ts';
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
const root=await Deno.makeTempDir({prefix:'core-starter-artifact-'}),source=root+'/source',output=root+'/output';
const write=async(path:string,value:string)=>{await Deno.mkdir(path.slice(0,path.lastIndexOf('/')),{recursive:true});await Deno.writeTextFile(path,value)};
try{
 await write(source+'/a.qmd','PUBLIC_A');await write(source+'/b.qmd','PUBLIC_B');await write(source+'/common/Support.java','PUBLIC_COMMON');await write(source+'/common/Grading.java','PRIVATE_GRADING_CANARY');
 await write(source+'/projects/a/student/Main.java','PUBLIC_STARTER');await write(source+'/projects/b/student/Main.java','PUBLIC_B_STARTER');await write(output+'/a.html','CURRENT_A');await write(output+'/b.html','CURRENT_B');
 const mapping={commonFiles:[{source:'common/Support.java',target:'student/Support.java',audience:'student'},{source:'common/Grading.java',target:'tests/Grading.java',audience:'grading'}]};
 const doc=(id:string)=>({scope:'document',source:id+'.qmd',course:{view:'student'},document:{source:id+'.qmd',format:'html',output:id+'.html',profiles:['student']},exercises:[{id:'exr-'+id,project:'/projects/'+id}],projects:[{exerciseId:'exr-'+id,source:id+'.qmd',projectRoot:'projects/'+id,statementVisibility:'open',artifactPolicy:{student:'starter',full:'full',conditions:true}}],body:{publicExercises:[{id:'exr-'+id,project:'/projects/'+id,statementVisibility:'open'}]},projectMaterializations:{'exr-a':mapping,'exr-b':mapping}});
 const run={schema:'course-native-run-v1',renderAll:false,projectRoot:source,outputDirectory:output,profiles:['student'],documents:[doc('a')],inputFiles:[source+'/a.qmd'],outputFiles:[output+'/a.html'],adapters:[]} as unknown as NativeRun;
 const request={source:'a.qmd',exerciseId:'exr-a'};
 const files=await materializeStarterArtifact(run,request);
 assert(!files.some(f=>new TextDecoder().decode(f.bytes).includes('PRIVATE_GRADING_CANARY')),'Grading common leaked');
 assert(files.length===2&&files.some(f=>f.name==='Support.java'),'Partial common artifact failed');
 assert(!files.some(f=>f.name.includes('materialization.json')||f.name.startsWith('projects/')),'Artifact returned stage receipt/root');
 const reject=async(r:any=run,q:any=request)=>{let failed=false;try{await materializeStarterArtifact(r,q)}catch{failed=true}assert(failed,'Invalid artifact context accepted')};
 await reject(run,{source:'b.qmd',exerciseId:'exr-a'});
 await reject({...run,profiles:['full']});await reject({...run,inputFiles:[source+'/b.qmd']});await reject({...run,outputFiles:[output+'/b.html']});await reject({...run,outputDirectory:source});
 const changed=structuredClone(run) as any;changed.documents[0].body.publicExercises[0].project='/projects/other';await reject(changed);
 const restricted=structuredClone(run) as any;restricted.documents[0].course.view='full';restricted.documents[0].projects[0].statementVisibility='restricted';await reject(restricted);
 const duplicate=structuredClone(run) as any;duplicate.documents.push(duplicate.documents[0]);await reject(duplicate);
 const conflict=structuredClone(run) as any;const other=doc('b');other.projectMaterializations['exr-a']={commonFiles:[]} as any;conflict.documents.push(other);await reject(conflict);
 const duplicateOther=structuredClone(run) as any;const duplicated=doc('b');duplicated.projects.push(duplicated.projects[0]);duplicateOther.documents.push(duplicated);await reject(duplicateOther);
 const known=structuredClone(run) as any;known.documents[0].exercises.push({id:'exr-b',project:''});await reject(known);
 const invalid=structuredClone(run) as any;invalid.documents[0].projectMaterializations['exr-uncaptured']={commonFiles:[{source:'../secret',target:'student/x',audience:'student'}]};await reject(invalid);
 let strict=false;try{bindArtifactProjectMaterializations({...run,renderAll:true})}catch{strict=true}assert(strict,'Full artifact deferred stale ID');
 assert(bindArtifactProjectMaterializations(run).length===1,'Partial binder synthesized unknown project');
 for(const audience of ['student','grading'] as const){let failed=false;try{await materializeProjects({nativeRun:run,sourceRoot:source,outputRoot:root+'/forbidden-'+audience,exerciseIds:['exr-a'],audience,teacherRoot:audience==='grading'?root+'/teacher':undefined})}catch{failed=true}assert(failed,'Full stage API accepted partial')}
 run.documents.push(doc('b') as any);run.renderAll=true;run.inputFiles.push(source+'/b.qmd');run.outputFiles.push(output+'/b.html');assert((await materializeStarterArtifact(run,request)).length===2,'Full capture common binding failed');
 console.log('PASS partial student artifact, current document capability, deferred unknown ID, strict full owner, privacy/context/conflict guards');
}finally{await Deno.remove(root,{recursive:true})}
