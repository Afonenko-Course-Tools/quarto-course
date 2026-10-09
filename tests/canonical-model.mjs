import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'canonical-model-'));
const cue=process.env.CUE || 'cue';
const exercise={id:'exr-task',target:'manual',project:'',purpose:'demonstration',difficulty:'introductory',time:10,statementVisibility:'open',hasSolution:true,hasPublicSolution:true,sourceTopic:{id:'sec-topic',owner:'proof',rootQmd:'index.qmd'},head:{kind:'Header',level:2,title:'Task'},body:{'pandoc-api-version':[1,23,1],meta:{},blocks:[]},nested:0,unknownAttributes:[],source:'index.qmd',extensions:{}};
const model={course:{id:'proof',view:'student'},registeredTargets:['manual'],exercises:[exercise],assessments:[]};
function vet(value){const path=join(dir,'input.json');writeFileSync(path,JSON.stringify(value));return spawnSync(cue,['vet','_extensions/course-core/spec/core.cue',path,'-d','#Course','-c'],{encoding:'utf8'});}
assert.equal(vet(model).status,0,vet(model).stderr);
for(const [label,mutate] of [
 ['missing own difficulty',q=>delete q.difficulty],['missing own time',q=>delete q.time],['fractional task time',q=>q.time=1.5],['missing statement visibility',q=>delete q.statementVisibility],['invalid purpose',q=>q.purpose='unknown'],['invalid difficulty',q=>q.difficulty='hard'],
 ['effective adapter title',q=>q.head={kind:'Para',level:0,title:'Condition'}],
 ['source path',q=>q.sourceTopic.rootQmd='other.qmd']
]){const m=structuredClone(model);mutate(m.exercises[0]);assert.notEqual(vet(m).status,0,label+' accepted');}
const native=structuredClone(model);delete native.course.id;for(const k of ['purpose','sourceTopic','target'])delete native.exercises[0][k];assert.equal(vet(native).status,0,vet(native).stderr);
console.log('PASS native optional identity/metadata, explicit invalid values and source provenance');
