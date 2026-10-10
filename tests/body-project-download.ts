import {buildBodies} from '../_extensions/course-core/body-export/producer.ts';
import {join} from 'stdlib/path';
const root=await Deno.makeTempDir({prefix:'core-contextual-body-'});
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message)};
const link=(label:string,path:string,classes:string[]=[])=>({t:'Link',c:[['',classes,[]],[{t:'Str',c:label}],[path,'']]});
const para=(...content:unknown[])=>({t:'Para',c:content});
const json=(blocks:unknown[])=>JSON.stringify({'pandoc-api-version':[1,23,1],meta:{},blocks});
try{
 await Deno.mkdir(join(root,'_downloads'));
 await Deno.writeTextFile(join(root,'public.txt'),'PUBLIC_FILE_BYTES');
 await Deno.writeTextFile(join(root,'image.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
 await Deno.writeTextFile(join(root,'ordinary.zip'),'GENUINE_PUBLIC_ARCHIVE');
 const condition=[para({t:'Str',c:'PUBLIC_CONDITION'},link('CONTEXTUAL_TEACHER_DOWNLOAD','_downloads/exr-one-full.zip',['project-download']),link('PUBLIC_FILE','public.txt'),link('ORDINARY_ZIP','ordinary.zip'),link('THEORY','https://example.test/theory')),{t:'Para',c:[{t:'Image',c:[['',[],[]],[{t:'Str',c:'PUBLIC_IMAGE'}],['image.svg','']]}]}];
 const answer=[para({t:'Str',c:'PUBLIC_ANSWER'},link('ANSWER_CONTEXTUAL_DOWNLOAD','_downloads/exr-one-full.zip',['project-download-link']))];
 const exercise:any={id:'exr-one',target:'manual',project:'projects/one',purpose:'independent-study',difficulty:'introductory',time:10,statementVisibility:'open',hasSolution:false,hasPublicSolution:false,head:{kind:'Header',level:2,title:'One'},nested:0,unknownAttributes:[],bodyJson:json(condition)};
 const work:any={id:'sec-work',kind:'lab',title:'Work',items:['exr-one'],assignments:{'exr-one':{requirement:'required',workMode:'individual'}},memberContainers:1,memberKinds:['OrderedList'],memberSizes:[1],bodyJson:json([])};
 const doc:any={scope:'document',source:'index.qmd',course:{id:'download-body',view:'full'},document:{source:'index.qmd',output:'index.html',format:'html',profiles:['full']},exercises:[exercise],assessment:work,body:{publicExercises:[exercise],publicAssessment:work,publicAnswers:{'exr-one':{answerType:'manual',publicAnswerJson:json(answer)}}},resources:{source:'index.qmd',format:'html',view:'full',effectiveBase:root,outputDirectory:root,outputFile:join(root,'index.html'),rawUses:['_downloads/exr-one-full.zip','public.txt','ordinary.zip','image.svg'],projectedUses:['_downloads/exr-one-full.zip','public.txt','ordinary.zip','image.svg']}};
 for(const zipExists of [false,true]){
  if(zipExists)await Deno.writeTextFile(join(root,'_downloads/exr-one-full.zip'),'PRIVATE_TEACHER_ZIP_BYTES');
  const before=JSON.stringify(doc);
  const result=await buildBodies(doc,{projectRoot:root,includeClosed:true});
  const payload=JSON.stringify(result.publicPackage);
  assert(!/CONTEXTUAL|project-download|exr-one-full|PRIVATE_TEACHER/.test(payload),'contextual project download leaked into public condition/answer/resources');
  assert(payload.includes('PUBLIC_CONDITION')&&payload.includes('PUBLIC_ANSWER')&&payload.includes('PUBLIC_FILE')&&payload.includes('PUBLIC_IMAGE')&&payload.includes('ORDINARY_ZIP')&&payload.includes('https://example.test/theory'),'genuine public content/link omitted');
  assert(result.publicPackage.resources.length===3&&!result.publicPackage.resources.some(r=>r.target.startsWith('_downloads/')),'contextual ZIP entered public resource inventory');
  assert(JSON.stringify(doc)===before,'public Body filtering mutated trusted native source facts');
 }
 console.log('PASS contextual_download_missing_or_present_excluded_before_public_condition_answer_resources; genuine files/images/links preserved');
}finally{await Deno.remove(root,{recursive:true})}
