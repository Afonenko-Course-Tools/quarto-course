import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
import {collectExport} from '../_extensions/course-core/body-export/collect.ts';
import {loadNativeRun,withLoadedNativeRun,assertCommonPathRun} from '../_extensions/course-core/infrastructure/native-run.ts';
const repo=dirname(dirname(fromFileUrl(import.meta.url))),out=Deno.env.get('OWNED_OPERATION_OUTPUT')||await Deno.makeTempDir({prefix:'owned-operation-native-'}),root=join(out,'fixture'),bank=join(root,'bank');
await Deno.mkdir(bank,{recursive:true});await copy(join(repo,'_extensions/course-core'),join(bank,'_extensions/course-core'));
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
await Deno.writeTextFile(join(root,'_quarto.yml'),'project: {type: default}\ncourse: {id: owned-operation}\n');
const config='project:\n  type: book\n  pre-render: [_extensions/course-core/entrypoints/pre.ts, _extensions/course-core/entrypoints/pre.ts]\n  post-render: [_extensions/course-core/entrypoints/post.ts, _extensions/course-core/entrypoints/post.ts]\n  resources: [resource.txt, "!_generated/**"]\nbook: {title: Owned, chapters: [index.qmd, task.qmd]}\nformat: html\nfilters: [course-core]\n';
await Deno.writeTextFile(join(bank,'_quarto.yml'),config);await Deno.writeTextFile(join(bank,'resource.txt'),'UNCHANGED_PUBLIC_RESOURCE\n');
await Deno.writeTextFile(join(bank,'index.qmd'),'---\nassessment: {id: lab, kind: lab}\n---\n# Работа\n\n::: {.task-items}\n- @exr-one\n:::\n');await Deno.writeTextFile(join(bank,'task.qmd'),'---\nexercise-bank: true\nexercise-statement-visibility: open\n---\n# Банк\n\n::: {#exr-one difficulty=introductory time=10}\nПубличное условие.\n:::\n');
const configPath=join(bank,'_quarto.yml'),before=await Deno.lstat(configPath),collected=await collectExport(root,{book:'bank',work:'lab'}),after=await Deno.lstat(configPath);
assert(collected.result.model.exercises.length===1,'Actual owned export lost exercise');assert(await Deno.readTextFile(configPath)===config,'Owned source bytes not restored');
for(const key of ['dev','ino','mode','uid','gid','size'] as const)assert(before[key]===after[key],'Owned source identity changed: '+key);assert(before.mtime?.getTime()===after.mtime?.getTime(),'Owned source mtime changed');assert(await Deno.readTextFile(join(bank,'resource.txt'))==='UNCHANGED_PUBLIC_RESOURCE\n','Resource bytes changed');
const pointer=JSON.parse(await Deno.readTextFile(join(bank,'_generated/course-spec/active-native-run.json')));assert(pointer.schema==='course-native-run-pointer-v3'&&pointer.overlayState==='restored','No real restored v3 pointer');
const run=await loadNativeRun(bank,{view:'full'});assert(run.documents.length===2&&run.documents.every(d=>d.document.format==='json'&&d.document.exportContext===true),'Owned completed scope changed');
const copyA=await Deno.readTextFile(join(pointer.directory,'native-run.json')),copyB=await Deno.readTextFile(join(bank,'_generated/course-spec/native-run.json'));assert(copyA===copyB,'Completed copies differ');const saved=JSON.parse(copyA);assert(saved.ownedConfigRestoration?.sha256===pointer.ownedConfigRestoration.sha256,'Actual restoration reference differs');
await Deno.writeTextFile(join(out,'result.json'),JSON.stringify({schema:pointer.schema,state:pointer.overlayState,documents:run.documents.map(d=>({source:d.source,format:d.document.format,output:d.document.output})),sourceIdentityRestored:true,resourcesUnchanged:true,completedCopiesEqual:true},null,2)+'\n');console.log('PASS genuine composed-hook owned export, final completion and restored source scope');

// Все owned outputs/completed/context принимаются до callback; request loop не сканирует весь run.
const fileRead=Deno.readFile,textRead=Deno.readTextFile;let loopReads=0;
const globalPath=(p:unknown)=>{const s=String(p);return /\/(?:common-files-path-binding|native-run|owned-export-source-context|owned-export-profile)\.json$/.test(s)||run.outputFiles.includes(s)};
(Deno as any).readFile=async(p:any,...args:any[])=>{if(globalPath(p))loopReads++;return await (fileRead as any)(p,...args)};
(Deno as any).readTextFile=async(p:any,...args:any[])=>{if(globalPath(p))loopReads++;return await (textRead as any)(p,...args)};
try{await withLoadedNativeRun(bank,{view:'full'},async current=>{const before=loopReads;for(let i=0;i<16;i++)await assertCommonPathRun(current);assert(loopReads===before,'OWNED_REQUEST_LOOP_GLOBAL_OUTPUT_READ '+(loopReads-before))})}finally{(Deno as any).readFile=fileRead;(Deno as any).readTextFile=textRead}
console.log('PASS owned completed/output/context admission: sixteen local requests, zero global reads');
