import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'canonical-model-'));
const cue=process.env.CUE || 'cue';
const exercise={id:'exr-task',target:'manual',project:'',purpose:'demonstration',difficulty:'introductory',sourceTopic:{id:'sec-topic',owner:'proof',rootQmd:'index.qmd'},head:{kind:'Para',level:0,title:'Condition.'},body:{'pandoc-api-version':[1,23,1],meta:{},blocks:[]},nested:0,unknownAttributes:[],source:'index.qmd',extensions:{}};
const model={course:{id:'proof',view:'student'},registeredTargets:['manual'],exercises:[exercise],assessments:[]};
function vet(value){const path=join(dir,'input.json');writeFileSync(path,JSON.stringify(value));return spawnSync(cue,['vet','_extensions/course-core/spec/core.cue',path,'-d','#Course','-c'],{encoding:'utf8'});}
assert.equal(vet(model).status,0,vet(model).stderr);
for(const [label,mutate] of [
 ['required purpose',q=>delete q.purpose],['required difficulty',q=>delete q.difficulty],
 ['explicit adapter title',q=>q.authoredTarget='manual'],['source owner',q=>q.sourceTopic.owner='other'],
 ['source path',q=>q.sourceTopic.rootQmd='other.qmd'],['student control',q=>q.purpose='control']
]){const m=structuredClone(model);mutate(m.exercises[0]);assert.notEqual(vet(m).status,0,label+' accepted');}
console.log('PASS public Exercise CUE: no-target paragraph, mandatory metadata, binding distinction, source identity, closed controls');
