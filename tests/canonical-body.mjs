import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'canonical-body-'));
const cue=process.env.CUE || 'cue';
const node={kind:'Div',id:'exr-task',classes:[],attributes:[{key:'course-role',value:'demonstration'},{key:'difficulty',value:'introductory'}],path:'blocks.0',ancestors:[],firstKind:'Para',firstLevel:0,json:'{}',memberKinds:[],memberSizes:[],items:[]};
function check(n){const path=join(dir,'input.json');writeFileSync(path,JSON.stringify({input:{owner:'proof',source:'index.qmd',nodes:[n],compare:false,before:[],signatures:[],assessment:{enabled:false,kind:''},firstHeader:{id:'sec-topic',title:'Topic',authored:true,topLevel:true}}}));return spawnSync(cue,['vet','_extensions/course-core/body-export/components.cue',path,'-c'],{encoding:'utf8'});}
assert.equal(check(node).status,0,check(node).stderr);
const control=structuredClone(node);control.attributes[0].value='control';
assert.notEqual(check(control).status,0,'canonical control escaped public Body');assert(check(control).stderr.includes('_public'),'wrong control refusal');
const legacy=structuredClone(node);legacy.classes.push('control');assert.notEqual(check(legacy).status,0,'legacy control class escaped');
const adapter=structuredClone(node);adapter.attributes.push({key:'target',value:'manual'});assert.notEqual(check(adapter).status,0,'explicit adapter title requirement lost');
adapter.firstKind='Header';adapter.firstLevel=2;assert.equal(check(adapter).status,0,check(adapter).stderr);
console.log('PASS Body no-target paragraph, explicit adapter heading, canonical/legacy control refusal');

for (const target of ['cloud','prairielearn']) {
 const bound=structuredClone(adapter);bound.attributes.find(a=>a.key==='target').value=target;
 const refused=check(bound);assert.notEqual(refused.status,0,target+' entered public Body');
 assert(refused.stderr.includes('_targets'),'wrong unsupported Body adapter refusal');
}
console.log('PASS finite source adapter allowance does not open public Body targets');
