/** Внутренний capability завершённого exporter run; не caller flag/receipt default. */
import {basename,join,relative,resolve} from 'stdlib/path';
import type {NativeRunPointer} from './native-run.ts';
import type {CommonPathWitness} from './common-path-binding.ts';
import {metadataBytes} from './metadata-closure.ts';
import {diagnostic} from '../domain/diagnostics.ts';
const fail=(s:string):never=>{throw diagnostic('NATIVE.COMMON_PATH_BINDING_INVALID',s,{field:'project-materialization'})};
const stable=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const equalSet=(a:string[],b:string[])=>Array.isArray(a)&&Array.isArray(b)&&new Set(a).size===a.length&&new Set(b).size===b.length&&stable([...a].sort())===stable([...b].sort());
const keys=(v:any,names:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===names.sort().join(',');
const issued=new WeakSet<object>();
const hash=async(bytes:Uint8Array,algorithm='SHA-256')=>Array.from(new Uint8Array(await crypto.subtle.digest(algorithm,new Uint8Array(bytes).buffer)),b=>b.toString(16).padStart(2,'0')).join('');
export type ExportRetirement={readonly root:string;readonly file:string;readonly sha256:string;readonly sources:readonly string[]};
export function verifiedRetirement(value:unknown):value is ExportRetirement{return !!value&&typeof value==='object'&&issued.has(value)}
async function read(path:string){const bytes=await metadataBytes(path);if(!bytes)fail('Нет completed export evidence: '+path);try{return JSON.parse(new TextDecoder().decode(bytes!))}catch{fail('Некорректный completed export evidence: '+path)}}
function inside(root:string,path:string){const rel=relative(root,path);if(!rel||rel==='..'||rel.startsWith('../')||resolve(root,rel)!==path)fail('Completed export path вне scope');return path}
/** Полнота уже записанного run проверяется также ДО записи retirement transition. */
export async function validateCompletedExportScope(p:NativeRunPointer,w:CommonPathWitness){
 if(stable(await read(join(p.projectRoot,'_generated/course-spec/active-native-run.json')))!==stable(p))fail('Completed export pointer уже не current');
 const witnessBytes=await metadataBytes(join(p.directory,'common-files-path-binding.json'));if(!witnessBytes||await hash(witnessBytes)!==p.commonPathBinding.sha256||await hash(witnessBytes,'SHA-1')!==p.commonPathBinding.sha1||stable(JSON.parse(new TextDecoder().decode(witnessBytes)))!==stable(w))fail('Completed witness/ref не current');
 const initial=p.initialInputFiles;if(!Array.isArray(initial)||!initial.length||!equalSet(initial,w.inputFiles.map(s=>resolve(p.projectRoot,s)))||stable(initial)!==stable(w.inputFiles.map(s=>resolve(p.projectRoot,s))))fail('Нет exact initial export inputs');
 if(!w.sourceIdentities||!Array.isArray(w.sourceIdentities.sources)||w.sourceIdentities.sources.some(s=>!s||typeof s.source!=='string')||stable(w.sourceIdentities.sources.map(s=>s.source))!==stable(w.inputFiles)||!equalSet(Object.keys(w.documentInspectionHashes),w.inputFiles)||Object.values(w.documentInspectionHashes).some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)))fail('Нет полного identity/inspection scope');
 if(!/^[-0-9a-f]{36}$/.test(basename(p.directory))||resolve(p.projectRoot,'_generated/course-spec/native-runs',basename(p.directory))!==p.directory)fail('Чужой run nonce');
 const run=await read(join(p.directory,'native-run.json')),copy=await read(join(p.projectRoot,'_generated/course-spec/native-run.json'));
 if(stable(run)!==stable(copy)||run.schema!=='course-native-run-v1'||run.directory!==p.directory||run.projectRoot!==p.projectRoot||run.outputDirectory!==p.outputDirectory||run.renderAll!==p.renderAll||stable(run.profiles)!==stable(p.profiles)||!Array.isArray(run.documents)||!run.documents.length||!Array.isArray(run.outputFiles)||!equalSet(run.inputFiles,initial!))fail('Нет exact completed export run');
 const expected=w.documents.map(d=>d.source+'\0'+d.format),actual:string[]=[],outputs:string[]=[],byKey=new Map<string,any>();
 for(const d of run.documents){
  if(!d||d.scope!=='document'||d.source!==d.document?.source||!w.inputFiles.includes(d.source)||d.document.exportContext!==true||d.document.format!=='json'||stable(d.document.profiles)!==stable(p.profiles)||typeof d.document.output!=='string')fail('Неполный completed source/format');
  const key=d.source+'\0'+d.document.format,out=inside(p.outputDirectory,resolve(p.outputDirectory,d.document.output));
  if(!await metadataBytes(out))fail('Нет current native output');actual.push(key);outputs.push(out);byKey.set(key,d);
 }
 if(!equalSet(actual,expected)||!equalSet(run.documents.map((d:any)=>d.source),w.inputFiles)||!equalSet(outputs,run.outputFiles))fail('Completed source/format/output set изменён');
 const captured:string[]=[];
 for await(const e of Deno.readDir(join(p.directory,'documents'))){
  if(e.isSymlink||!e.isFile||!e.name.endsWith('.json'))fail('Чужая запись private document inventory');
  const d=await read(join(p.directory,'documents',e.name)),key=d.source+'\0'+d.document?.format,done=byKey.get(key);if(!done)fail('Лишний private captured document');
  if(d.document.output!==done.document.output){
   const original=inside(p.projectRoot,resolve(p.outputDirectory,d.document.output)),relocated=inside(p.outputDirectory,resolve(p.outputDirectory,relative(p.projectRoot,original)));
   if(d.document.exportContext!==true||d.document.format!=='json'||relocated!==resolve(p.outputDirectory,done.document.output))fail('Private output mapping изменён');d.document.output=done.document.output;
  }
  if(stable(d)!==stable(done))fail('Private/completed document не совпадают');captured.push(key);
 }
 if(!equalSet(captured,expected))fail('Неполный private document inventory');
}
/** Не вызывает pointer/loadNativeRun и не создаёт новый proof. */
export async function completedExportRetirement(p:NativeRunPointer,w:CommonPathWitness):Promise<ExportRetirement|undefined>{
 const r=p.commonPathRetirement;if(!r)return;
 if(stable(await read(join(p.projectRoot,'_generated/course-spec/active-native-run.json')))!==stable(p))fail('Retirement pointer уже не current');
 const witnessBytes=await metadataBytes(join(p.directory,'common-files-path-binding.json'));if(!witnessBytes||await hash(witnessBytes)!==p.commonPathBinding.sha256||await hash(witnessBytes,'SHA-1')!==p.commonPathBinding.sha1||stable(JSON.parse(new TextDecoder().decode(witnessBytes)))!==stable(w))fail('Retirement witness/ref не current');
 if(!w.temporaryExportProfile||stable(r)!==stable(w.temporaryExportProfile)||!keys(r,['profile','file','sha1','sha256'])||!/^course-export-[0-9a-f-]{36}$/.test(r.profile)||r.profile!==p.profiles[0]||r.file!=='_quarto-'+r.profile+'.yml'||w.configurationInputs[r.file]!==r.sha256||p.configurationHashes[r.file]!==false||p.outputDirectory!==join(p.projectRoot,'_generated/course-spec/export-output',r.profile))fail('Не доказан generated retirement lifecycle');
 if(await metadataBytes(join(p.projectRoot,r.file)))fail('Retired profile снова существует');
 await validateCompletedExportScope(p,w);
 const token=Object.freeze({root:p.projectRoot,file:r.file,sha256:r.sha256,sources:Object.freeze([...w.inputFiles])});issued.add(token);return token;
}
/** Отсутствие config объясняет только точная live stock форма вне render-list. */
export function assertUnlistedFallback(doc:any,input:string,owner:any,retirement:ExportRetirement|undefined,source:string){
 if(!verifiedRetirement(retirement)||!retirement.sources.includes(source)||owner.dir!==retirement.root||doc.project?.dir!==retirement.root||!Array.isArray(owner.files?.input)||owner.files.input.includes(input)||!keys(doc.project.files,['input'])||!Array.isArray(doc.project.files.input)||doc.project.files.input.length||!keys(doc.project.config,['project','engines'])||!keys(doc.project.config.project,[])||!Array.isArray(doc.project.config.engines)||stable(doc.project.config.engines)!==stable(owner.config?.engines)||stable(doc.engines)!==stable(owner.engines)||doc.quarto?.version!==owner.quarto?.version)fail('Не подтверждён retired unlisted native fallback');
}
