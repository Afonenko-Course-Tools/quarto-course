import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'canonical-contract-'));
const cue=process.env.CUE || 'cue';
const attr=(key,value)=>({key,value});
const header=(id,order=1,ancestors=[])=>({kind:'Header',id,order,ancestors,classes:[],attributes:[],contentJson:'',topLevel:!ancestors.length,level:2,title:'Topic',titleJson:'topic'});
const exr=(attributes=[attr('course-role','demonstration'),attr('difficulty','introductory')],order=2,ancestors=[])=>({kind:'Div',id:'exr-task',order,ancestors,classes:[],attributes,contentJson:''});
function document(rows,identityRows=rows){
 const raw=occurrences=>({source:'index.qmd',owner:'proof',nativeShape:'native',readerShape:'shape',occurrences,assessment:'{}',assessmentFacts:{enabled:false,chapterId:'',title:'',headers:[]}});
 return {...raw(rows),identity:raw(identityRows)};
}
function evaluate(before,after=[]){
 const path=join(dir,'input.json');writeFileSync(path,JSON.stringify({input:{mode:after.length?'reconcile':'inventory',before,after}}));
 const r=spawnSync(cue,['export','_extensions/course-core/owner-preflight/reconcile.cue',path,'-e','report','--out','json'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
const valid=document([header('sec-topic'),exr()]);
const checks = [
 ['missing purpose',document([header('sec-topic'),exr([attr('difficulty','introductory')])]),'CORE.EXERCISE_PURPOSE_REQUIRED'],
 ['missing difficulty',document([header('sec-topic'),exr([attr('course-role','demonstration')])]),'CORE.EXERCISE_DIFFICULTY_REQUIRED'],
 ['display role',document([header('sec-topic'),exr([attr('course-role','prediction'),attr('difficulty','introductory')])]),'CORE.EXERCISE_PURPOSE_REQUIRED'],
 ['automatic topic',document([header('sec-auto'),exr()],[header(''),exr()]),'CORE.EXERCISE_SOURCE_TOPIC_REQUIRED'],
 ['no surrounding topic',document([exr()]),'CORE.EXERCISE_SOURCE_TOPIC_REQUIRED'],
 ['own title',document([exr(undefined,1),header('sec-own',2,[{id:'exr-task',classes:[],attributes:[]}])]),'CORE.EXERCISE_SOURCE_TOPIC_REQUIRED'],
];
for(const [name,d,code] of checks){assert(evaluate([d]).diagnostics.some(x=>x.code===code),`${name} did not report ${code}`);console.log('PASS '+name);}
const good=evaluate([valid]);assert.deepEqual(good.diagnostics,[]);assert.equal(good.exercises[0].sourceTopic.id,'sec-topic');
const moved=document([exr(undefined,1),header('sec-topic',2)]);
assert(evaluate([valid],[moved]).diagnostics.some(x=>x.code==='CORE.EXERCISE_SOURCE_TOPIC_CHANGED'),'engine moved Exercise across topic without refusal');
console.log('PASS explicit topic and actual source-topic drift');
for(const [field,value] of [['time','0'],['work-mode','team'],['typo','1']]){
 const row=exr([...exr().attributes,attr(field,value)]);
 assert(evaluate([document([header('sec-topic'),row])]).diagnostics.some(x=>x.code==='CORE.EXERCISE_INVALID' && x.field===field),`hidden/original ${field} accepted`);
}
const automaticNearest=document([header('sec-topic'),header('automatic',2),exr(undefined,3)],[header('sec-topic'),header('',2),exr(undefined,3)]);
assert(evaluate([automaticNearest]).diagnostics.some(x=>x.code==='CORE.EXERCISE_SOURCE_TOPIC_REQUIRED'),'automatic nearer Header borrowed remote explicit topic');
const siblingHeader={...header('sec-sibling'),ancestorOrders:[1],ancestors:[{id:'',classes:[],attributes:[]}]};
const scopedTask={...exr(),ancestorOrders:[3],ancestors:[{id:'',classes:[],attributes:[]}]};
assert(evaluate([document([siblingHeader,scopedTask])]).diagnostics.some(x=>x.code==='CORE.EXERCISE_SOURCE_TOPIC_REQUIRED'),'identical sibling wrappers shared a topic');
const sol={...exr([],3),id:'sol-task'};
assert.deepEqual(evaluate([document([header('sec-topic'),exr(),sol])]).diagnostics,[]);
assert(evaluate([document([header('sec-topic'),exr(),{...sol,id:'sol-orphan'}])]).diagnostics.some(x=>x.code==='CORE.SOLUTION_PAIRING_INVALID'),'orphan sol accepted');
const closed=document([header('sec-topic'),exr([attr('course-role','control'),attr('difficulty','advanced')])]);
closed.resources={profile:'student',canonicalIds:[],references:[{id:'exr-task',target:'index.qmd#exr-task'}]};
assert(evaluate([closed]).diagnostics.some(x=>x.code==='CORE.PROFILE_REFERENCE_INTEGRITY'),'visible reference to excluded target accepted');
console.log('PASS original metadata, nearest topic, wrapper scopes, sol pairing and reference integrity');

const twoTasks=document([header('sec-topic'),exr(),{...exr(undefined,3),id:'exr-another'}]);
assert.deepEqual(evaluate([twoTasks]).diagnostics,[]);
console.log('PASS multiple canonical tasks through generated vocabulary membership');

const beforeScope=document([{...header('sec-topic'),ancestorOrders:[]},{...header('sec-inner',2),ancestorOrders:[1]},{...exr(undefined,3),ancestorOrders:[1]}]);
const afterScope=document([{...header('sec-topic'),ancestorOrders:[]},{...header('sec-inner',2),ancestorOrders:[1]},{...exr(undefined,3),ancestorOrders:[]}]);
assert(evaluate([beforeScope],[afterScope]).diagnostics.some(x=>x.code==='CORE.EXERCISE_SOURCE_TOPIC_CHANGED'),'actual non-Div scope change accepted');
console.log('PASS actual non-Div source-topic scope drift');

const explicitTask={...exr([...exr().attributes,attr('target','manual')]),firstKind:'Header'};
const explicitBefore=document([header('sec-topic'),explicitTask]);
const explicitAfter=document([header('sec-topic'),{...explicitTask,firstKind:'Para'}]);
assert(evaluate([explicitBefore],[explicitAfter]).diagnostics.some(x=>x.code==='CORE.DECLARATION_ADDED_OR_CHANGED'),'actual adapter heading drift accepted');
console.log('PASS actual explicitly bound adapter heading drift');

const publicSource=document([header('sec-public')]);
publicSource.resources={profile:'student',canonicalIds:[],references:[{id:'exr-task',target:'#exr-task'}]};
const fullOnlySource=document([header('sec-hidden'),exr([attr('course-role','control'),attr('difficulty','advanced')])]);
fullOnlySource.source='hidden.qmd';fullOnlySource.identity.source='hidden.qmd';
fullOnlySource.resources={profile:'full',canonicalIds:['exr-task'],references:[]};
assert(evaluate([publicSource,fullOnlySource]).diagnostics.some(x=>x.code==='CORE.PROFILE_REFERENCE_INTEGRITY'),'reference borrowed full-only target');
console.log('PASS reference integrity includes full-only source declarations without granting visibility');

const emptyTarget=document([header('sec-topic'),{...exr([attr('course-role','control'),attr('difficulty','advanced'),attr('target','')]),firstKind:'Header'}]);
assert(evaluate([emptyTarget]).diagnostics.some(x=>x.code==='CORE.EXERCISE_INVALID' && x.field==='target'),'explicit empty target escaped original inventory');
console.log('PASS hidden explicit empty target refused before projection');

const displayExample={...exr([],1),id:'exm-task'};
assert.deepEqual(evaluate([document([displayExample,sol])]).diagnostics,[]);
assert.equal(evaluate([document([displayExample,sol])]).exercises.length,0,'exm promoted to canonical Exercise');
assert(evaluate([document([displayExample,{...sol,attributes:[attr('for','exm-other')]}])]).diagnostics.some(x=>x.code==='CORE.SOLUTION_PAIRING_INVALID'),'display solution redirected by for');
assert(evaluate([document([header('sec-topic'),exr(),displayExample,sol])]).diagnostics.some(x=>x.code==='CORE.SOLUTION_PAIRING_INVALID'),'ambiguous exr/exm native suffix accepted');
console.log('PASS display examples use unique native solution suffix without canonical Exercise metadata');

assert.deepEqual(evaluate([document([{...displayExample,id:'exm-exr-task'},{...sol,id:'sol-exr-task'}])]).diagnostics,[]);
console.log('PASS complete native suffix is preserved when it contains an exr prefix');
