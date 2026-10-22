import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
import {collectExport} from '../_extensions/course-core/body-export/collect.ts';
import {loadNativeRun} from '../_extensions/course-core/infrastructure/native-run.ts';
import {readOwnedProfileEvidence} from '../_extensions/course-core/infrastructure/owned-export-profile.ts';
import {digest} from '../_extensions/course-core/infrastructure/common-path-binding.ts';
const root=await Deno.makeTempDir({prefix:'owned-hook-context-native-'}),bank=join(root,'bank'),repo=dirname(dirname(fromFileUrl(import.meta.url)));
const assert=(v:unknown,s:string)=>{if(!v)throw Error(s)};
async function write(p:string,t:string){await Deno.mkdir(dirname(p),{recursive:true});await Deno.writeTextFile(p,t)}
async function refuse(label:string,fn:()=>Promise<unknown>){let error='';try{await fn()}catch(e){error=String(e)}assert(error.includes('NATIVE.'),'Accepted/wrong error '+label+': '+error);console.log('REFUSED',label,error.split('\n')[0])}
await copy(join(repo,'_extensions/course-core'),join(bank,'_extensions/course-core'));
await write(join(root,'_quarto.yml'),'project: {type: default}\ncourse: {id: hooks}\n');await write(join(bank,'_quarto.yml'),'project: {type: book}\nbook: {title: Hooks, chapters: [index.qmd,task.qmd]}\nformat: html\nfilters: [course-core]\n');
await write(join(bank,'index.qmd'),'---\nassessment: {id: lab, kind: lab}\n---\n# Work\n\n::: {.task-items}\n- @exr-one\n:::\n');await write(join(bank,'task.qmd'),'---\nexercise-bank: true\nexercise-statement-visibility: open\n---\n# Bank\n\n::: {#exr-one difficulty=introductory time=10}\nSynthetic condition.\n:::\n');
console.log('FIXTURE',root);await collectExport(root,{book:'bank',work:'lab'});await loadNativeRun(bank);
const p=JSON.parse(await Deno.readTextFile(join(bank,'_generated/course-spec/active-native-run.json'))),w=JSON.parse(await Deno.readTextFile(join(p.directory,'common-files-path-binding.json'))),rawPath=join(p.directory,'owned-export-profile.json'),raw=await Deno.readFile(rawPath),value=JSON.parse(new TextDecoder().decode(raw)),ownerPath=join(p.directory,'inspections/sha256',w.ownerInspectionHash+'.json'),ownerBytes=await Deno.readFile(ownerPath),owner=JSON.parse(new TextDecoder().decode(ownerBytes));
assert(value.project['pre-render']===join(repo,'_extensions/course-core/entrypoints/pre.ts'),'Producer hook root changed');assert(owner.config.project['pre-render'][0]===value.project['pre-render'],'Original hook pair not retained');assert(value.project['pre-render']!==join(bank,'_extensions/course-core/entrypoints/pre.ts'),'Test did not exercise copied reader');console.log('PASS canonical producer/copied reader exact original pair');
for(const [label,mutate] of [
 ['owner hook swapped',(x:any)=>{[x['pre-render'],x['post-render']]=[x['post-render'],x['pre-render']]}],
 ['owner hook mixed',(x:any)=>x['post-render']=[join(bank,'_extensions/course-core/entrypoints/post.ts')]],
 ['owner hook extra',(x:any)=>x['pre-render'].push(x['pre-render'][0])],
 ['owner hook missing',(x:any)=>delete x['post-render']],
 ['owner hook scalar',(x:any)=>x['pre-render']=x['pre-render'][0]],
 ['owner hook same suffix other root',(x:any)=>x['pre-render']=['/tmp/other/course-core/entrypoints/pre.ts']],
] as [string,(v:any)=>void][]){
 const changed=structuredClone(owner);mutate(changed.config.project);const bytes=new TextEncoder().encode(JSON.stringify(changed)),h=await digest(bytes),next=join(p.directory,'inspections/sha256',h+'.json'),cw={...w,ownerInspectionHash:h};
 assert(!Object.values(w.documentInspectionHashes).includes(w.ownerInspectionHash)&&!w.sourceIdentities.sources.some((s:any)=>s.physicalInspectionHash===w.ownerInspectionHash),'Owner ref unexpectedly shared');
 await Deno.rename(ownerPath,join(root,'held-owner'));await Deno.writeFile(next,bytes,{createNew:true,mode:0o600});try{await refuse(label,()=>readOwnedProfileEvidence(cw))}finally{await Deno.remove(next);await Deno.rename(join(root,'held-owner'),ownerPath)}
}
for(const [label,mutate] of [
 ['raw hook swap',(x:any)=>{[x.project['pre-render'],x.project['post-render']]=[x.project['post-render'],x.project['pre-render']]}],
 ['raw hook mixed',(x:any)=>x.project['post-render']=join(bank,'_extensions/course-core/entrypoints/post.ts')],
 ['raw hook scalar-to-array',(x:any)=>x.project['pre-render']=[x.project['pre-render']]],
 ['raw render list',(x:any)=>x.project.render=['unknown.qmd']],
 ['raw nonce output',(x:any)=>x.project['output-dir']+='-other'],
] as [string,(v:any)=>void][]){const changed=structuredClone(value);mutate(changed);const bytes=new TextEncoder().encode(JSON.stringify(changed)),h=await digest(bytes),cw=structuredClone(w);cw.temporaryExportProfile.sha256=h;cw.temporaryExportProfile.sha1=await digest(bytes,'SHA-1');cw.configurationInputs[cw.temporaryExportProfile.file]=h;await Deno.writeFile(rawPath,bytes);try{await refuse(label,()=>readOwnedProfileEvidence(cw))}finally{await Deno.writeFile(rawPath,raw)}}
await loadNativeRun(bank);console.log('PASS hook/nonce/render-list refusals restored actual completed run');
