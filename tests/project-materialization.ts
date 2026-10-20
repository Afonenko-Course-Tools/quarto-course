import {bindProjectMaterializations} from '../_extensions/course-core/domain/project-materialization.ts';
const assert=(ok:unknown,message:string)=>{if(!ok)throw Error(message)};
const mapping={commonFiles:[{source:'common/x',target:'student/x',audience:'student' as const}]};
const project={exerciseId:'exr-b',source:'b.qmd',projectRoot:'projects/b'} as any;
const documents=[{source:'a.qmd',projects:[],projectMaterializations:{'exr-b':mapping}},{source:'b.qmd',projects:[project],projectMaterializations:{'exr-b':mapping}}] as any;
assert(bindProjectMaterializations(documents)[0].materialization.commonFiles[0].source==='common/x','Cross-document metadata lost');
assert(!project.materialization,'Captured input mutated');
for(const invalid of [
 [...documents,{source:'c.qmd',projects:[],projectMaterializations:{'exr-stale':mapping}}],
 [...documents,{source:'c.qmd',projects:[],projectMaterializations:{'exr-b':{commonFiles:[]}}}],
 [{source:'a.qmd',projects:[],projectMaterializations:{'exr-b':mapping}}],
]){
 let rejected=false;try{bindProjectMaterializations(invalid)}catch{rejected=true}
 assert(rejected,'Stale/missing/conflicting owner declaration accepted');
}
console.log('PASS owner materialization binding, cross-document declarations and stale/conflict guards');
