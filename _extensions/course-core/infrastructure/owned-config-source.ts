/** SOURCE preimages controlled overlay. Ни execution-owner, ни авторский API. */
import {join,resolve,relative,basename} from 'stdlib/path';
import {diagnostic} from '../domain/diagnostics.ts';
import {command,quartoExecutable} from './process.ts';
import {sourceFile,sourceMetadata} from './source-identities.ts';
import {metadataBytes} from './metadata-closure.ts';
const fail=(message:string):never=>{throw diagnostic('NATIVE.COMMON_PATH_BINDING_INVALID',message,{field:'project-materialization'})};
const stable=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const hash=async(b:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(b).buffer)),x=>x.toString(16).padStart(2,'0')).join('');
const keys=(v:any,n:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===n.sort().join(',');
const hex=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export type SourceRoleIdentities=Record<string,{physicalPath:string;linkTarget:string|null;sha256:string}>;
export type SourceInspectionRoles={owner:string;selection:string;physical:Record<string,string>;lexical:Record<string,string>};
/** Exact explicit roles, never all blobs found under inspections/. */
export function sourceRoleRefs(roles:SourceInspectionRoles,selected:string[]){
 if(!keys(roles,['owner','selection','physical','lexical'])||!selected.length||new Set(selected).size!==selected.length||selected.some(s=>typeof s!=='string'||!s||s.startsWith('/')||s.split('/').some(p=>!p||p==='.'||p==='..')||/[\\\0]/.test(s)))fail('Нет exact source-role scope');
 for(const role of ['physical','lexical'] as const){const table=roles[role];if(!table||typeof table!=='object'||Array.isArray(table)||stable(Object.keys(table).sort())!==stable([...selected].sort()))fail('Неполный source-role document inventory')}
 const refs=[roles.owner,roles.selection,...Object.values(roles.physical),...Object.values(roles.lexical)];if(refs.some(h=>!hex(h)))fail('Некорректный source-role original ref');return new Set(refs);
}
export type SourceFileState={kind:'file'|'directory'|'link';dev:number|null;ino:number|null;mode:number|null;uid:number|null;gid:number|null;size?:number;mtime?:number|null;ctime?:number|null;sha256?:string;target?:string};
export type SourceFiles=Record<string,SourceFileState>;
// Только известные producer outputs. Installed extension payloads НЕ исключены.
const ignored=new Set(['.git','.quarto','_generated']);
function identity(s:Deno.FileInfo){return {dev:s.dev,ino:s.ino,mode:s.mode,uid:s.uid,gid:s.gid}}
async function sourceState(path:string):Promise<SourceFileState>{
 const s=await Deno.lstat(path);let row:SourceFileState;
 if(s.isDirectory&&!s.isSymlink)row={kind:'directory',...identity(s)};
 else if(s.isFile&&!s.isSymlink){const bytes=await Deno.readFile(path);row={kind:'file',...identity(s),size:s.size,mtime:s.mtime?.getTime()??null,ctime:s.ctime?.getTime()??null,sha256:await hash(bytes)}}
 else if(s.isSymlink)row={kind:'link',...identity(s),mtime:s.mtime?.getTime()??null,ctime:s.ctime?.getTime()??null,target:await Deno.readLink(path)};
 else fail('Специальный source entry в overlay closure');
 const after=await Deno.lstat(path);if(stable(identity(after))!==stable(identity(s))||s.size!==after.size||s.mtime?.getTime()!==after.mtime?.getTime()||s.ctime?.getTime()!==after.ctime?.getTime())fail('Source entry изменён во время fingerprint');return row!;
}
/** Полный owner-local source/vendor inventory до transaction, без producer outputs. */
export async function captureSourceFiles(root:string):Promise<SourceFiles>{
 if(resolve(root)!==root||await Deno.realPath(root)!==root)fail('Source root не canonical');
 const result:SourceFiles={};
 async function walk(path:string){const state=await sourceState(path),name=relative(root,path).replaceAll('\\','/');if(state.kind==='link'&&name.split('/').includes('_extensions'))fail('Linked extension payload в overlay source closure');result[name]=state;if(state.kind==='directory'){const entries=[];for await(const e of Deno.readDir(path))if(!(ignored.has(e.name)&&(e.name!=='.git'||path===root)))entries.push(e.name);for(const e of entries.sort())await walk(join(path,e))}}
 await walk(root);return result;
}
/** Named base/profile transition is explicit; no arbitrary ignored paths. */
export async function assertSourceFiles(root:string,expected:SourceFiles,transition?:{base:'_quarto.yml'|'_quarto.yaml';baseState:SourceFileState;profile:string;profileState:SourceFileState|false}){
 const actual=await captureSourceFiles(root),bound={...expected};
 if(transition){
  if(!['_quarto.yml','_quarto.yaml'].includes(transition.base)||!Object.hasOwn(expected,transition.base)||!/^_quarto-course-export-[0-9a-f-]{36}\.yml$/.test(transition.profile)||!Object.hasOwn(expected,transition.profile))fail('Нет named overlay entry transition');
  bound[transition.base]=transition.baseState;if(transition.profileState===false)delete bound[transition.profile];else bound[transition.profile]=transition.profileState;
 }
 if(stable(actual)!==stable(bound))fail('Source/vendor entry bytes/identity/inventory drift');
}
/** Source roles are independent of execution owner and cannot substitute it. */
export function validateSourceRoles(root:string,selected:string[],profiles:string[],roles:SourceInspectionRoles,all:Record<string,any>,selectionProfile:string,identities:SourceRoleIdentities){
 const refs=sourceRoleRefs(roles,selected);if([...refs].some(h=>!Object.hasOwn(all,h)))fail('Отсутствует original source-role blob');
 if(!profiles.length||profiles[0]!=='full'||new Set(profiles).size!==profiles.length||profiles.slice(1).some(p=>!/^[-a-z0-9]+$/.test(p)||p==='full'||p==='student'||p.startsWith('course-export-')))fail('Неверные sourceProfiles');
 if(!/^course-export-[0-9a-f-]{36}$/.test(selectionProfile)||!identities||stable(Object.keys(identities).sort())!==stable([...selected].sort()))fail('Нет closed selection/physical identity binding');
 const owner=all[roles.owner],selection=all[roles.selection];
 for(const frame of [owner,selection])if(frame?.dir!==root||!frame.config||!Array.isArray(frame.files?.input)||!Array.isArray(frame.files?.config)||!frame.fileInformation||typeof frame.quarto?.version!=='string')fail('Нет actual source owner/selection frame');
 if(owner.config.project?.type!=='book'||owner.quarto.version!==selection.quarto.version)fail('Original source bank/Quarto mismatch');
 const configs=(xs:any)=>{if(!Array.isArray(xs)||xs.some(x=>typeof x!=='string'||resolve(root,x)!==x||x.endsWith('.local'))||new Set(xs).size!==xs.length)fail('Некорректный original source config scope');return xs as string[]};
 const sourceConfigs=configs(owner.files.config),selectionConfigs=configs(selection.files.config),profilePath=join(root,'_quarto-'+selectionProfile+'.yml');
 if(sourceConfigs.includes(profilePath)||!selectionConfigs.includes(profilePath)||stable(selectionConfigs.filter(x=>x!==profilePath))!==stable(sourceConfigs))fail('Source/selection original profiles/config mismatch');
 for(const source of selected){
  const path=resolve(root,source),lexical=all[roles.lexical[source]],physical=all[roles.physical[source]],identity=identities[source];
  if(!keys(identity,['physicalPath','linkTarget','sha256'])||typeof identity.physicalPath!=='string'||resolve(root,identity.physicalPath)!==identity.physicalPath||!relative(root,identity.physicalPath)||relative(root,identity.physicalPath).startsWith('..')||!hex(identity.sha256)||!(identity.linkTarget===null||typeof identity.linkTarget==='string'&&!!identity.linkTarget))fail('Некорректная source physical identity');
  if((identity.linkTarget===null?path:resolve(join(path,'..'),identity.linkTarget))!==identity.physicalPath)fail('Source alias не соответствует original physical identity');
  if(!selection.files.input.includes(path)||!selection.fileInformation[source])fail('Source вне admitted selected inventory');
  for(const doc of [lexical,physical])if(doc?.project?.dir!==root||doc.quarto?.version!==owner.quarto.version||!doc.formats||typeof doc.formats!=='object'||!doc.fileInformation)fail('Чужой source-role document owner');
  const raw=(doc:any,p:string)=>{const row=doc.fileInformation[p];if(!row?.metadata||!Array.isArray(row.includeMap))fail('Нет raw source-role metadata');return row};
  const lexicalRaw=raw(lexical,path),selectedRaw=selection.fileInformation[source];
  if(stable(lexicalRaw.metadata)!==stable(selectedRaw.metadata)||stable(lexicalRaw.includeMap)!==stable(selectedRaw.includeMap))fail('Lexical/selection source metadata mismatch');
  const physicalRaw=raw(physical,identity.physicalPath);if(stable(physicalRaw.metadata)!==stable(selectedRaw.metadata)||stable(physicalRaw.includeMap)!==stable(selectedRaw.includeMap))fail('Physical/selection source metadata mismatch');
  if(stable(configs(lexical.project.files?.config))!==stable(selectionConfigs))fail('Source lexical config/profile mismatch');
  if(physical.project.files&&Object.hasOwn(physical.project.files,'config')){if(stable(configs(physical.project.files.config))!==stable(selectionConfigs))fail('Source physical config/profile mismatch')}
  else if(identity.linkTarget===null||identity.physicalPath===path||selection.files.input.includes(identity.physicalPath)||!keys(physical.project.files,['input'])||stable(physical.project.files.input)!==stable([])||!keys(physical.project.config,['project','engines'])||!keys(physical.project.config.project,[])||stable(physical.project.config.engines)!==stable(selection.config.engines)||stable(physical.project.engines)!==stable([])||!keys(physical.project.fileInformation,[]))fail('Нет exact source-preview unlisted alias shape');
  const original=owner.fileInformation[source];if(original&&(stable(original.metadata)!==stable(selectedRaw.metadata)||stable(original.includeMap)!==stable(selectedRaw.includeMap)))fail('Source-owner/selected metadata mismatch');
 }
 return {owner,selection};
}

/** Capture RAW source stdout before activation. Source/selection profiles are honest. */
export async function captureSourceRoles(input:{root:string;selected:string[];sourceProfiles:string[];selectionProfiles:string[];sourceOwnerText:string;selectionText:string;append:(text:string)=>Promise<string>;check:()=>Promise<unknown>}){
 const {root,selected,sourceProfiles,selectionProfiles,append,check}=input;
 if(selectionProfiles.length!==sourceProfiles.length+1||!/^course-export-[0-9a-f-]{36}$/.test(selectionProfiles[0])||stable(selectionProfiles.slice(1))!==stable(sourceProfiles))fail('Нет distinct source selection profile stack');
 await check();
 const roles:SourceInspectionRoles={owner:await append(input.sourceOwnerText),selection:await append(input.selectionText),physical:{},lexical:{}};
 const all:Record<string,any>={[roles.owner]:JSON.parse(input.sourceOwnerText),[roles.selection]:JSON.parse(input.selectionText)};
 const identities:SourceRoleIdentities={};
 for(const source of selected){
  await check();const before=await sourceFile(root,source),args=['--profile',selectionProfiles.join(',')];
  const physicalText=await command(quartoExecutable(),['inspect',before.physicalPath,...args],root,{QUARTO_PROFILE:selectionProfiles.join(',')});await check();
  const lexicalText=before.linkTarget===null?physicalText:await command(quartoExecutable(),['inspect',join(root,source),...args],root,{QUARTO_PROFILE:selectionProfiles.join(',')});await check();
  const after=await sourceFile(root,source);if(before.physicalPath!==after.physicalPath||before.linkTarget!==after.linkTarget||await hash(before.bytes)!==await hash(after.bytes))fail('Source identity drift во время source-role inspect');
  const physical=JSON.parse(physicalText),lexical=JSON.parse(lexicalText);
  const a=sourceMetadata(physical,before.physicalPath),b=sourceMetadata(lexical,join(root,source));if(stable(a.metadata)!==stable(b.metadata)||stable(a.includeMap)!==stable(b.includeMap))fail('Source physical/lexical metadata mismatch');
  roles.physical[source]=await append(physicalText);roles.lexical[source]=await append(lexicalText);
  all[roles.physical[source]]=physical;all[roles.lexical[source]]=lexical;
  identities[source]={physicalPath:before.physicalPath,linkTarget:before.linkTarget,sha256:await hash(before.bytes)};
 }
 validateSourceRoles(root,selected,sourceProfiles,roles,all,selectionProfiles[0],identities);await check();return {roles,identities};
}

export type SourceDependencyClosure={origins:Record<string,SourceFileState|false>;extensions:Record<string,SourceFiles>};
/** Paths originate in explicit native metadata closure/extension roots, not a caller glob. */
export async function captureSourceDependencies(origins:string[],extensionRoots:string[]):Promise<SourceDependencyClosure>{
 if(new Set(origins).size!==origins.length||new Set(extensionRoots).size!==extensionRoots.length)fail('Повторный source dependency origin');
 const result:SourceDependencyClosure={origins:{},extensions:{}};
 for(const path of [...origins].sort()){
  if(typeof path!=='string'||resolve(path)!==path)fail('Неканонический source dependency origin');
  const bytes=await metadataBytes(path);if(!bytes){result.origins[path]=false;continue}
  const row=await sourceState(path);if(row.kind!=='file'||row.sha256!==await hash(bytes))fail('Source metadata dependency drift');result.origins[path]=row;
 }
 for(const root of [...extensionRoots].sort()){
  if(typeof root!=='string'||resolve(root)!==root||basename(root)!=='_extensions')fail('Неизвестный native extension root');
  const rows:SourceFiles={};
  async function walk(path:string){
   const row=await sourceState(path);if(row.kind==='link'||await Deno.realPath(path)!==path)fail('Linked native extension payload');
   rows[relative(root,path).replaceAll('\\','/')]=row;
   if(row.kind==='directory'){const names=[];for await(const e of Deno.readDir(path))names.push(e.name);for(const name of names.sort())await walk(join(path,name))}
  }
  try{await walk(root)}catch(e){if(e instanceof Deno.errors.NotFound){try{await Deno.lstat(root)}catch(missing){if(missing instanceof Deno.errors.NotFound){result.extensions[root]={};continue}throw missing}}throw e}
  if(rows['']?.kind!=='directory')fail('Native extension root не directory');result.extensions[root]=rows;
 }
 return result;
}
export async function assertSourceDependencies(expected:SourceDependencyClosure){
 if(!keys(expected,['origins','extensions'])||!expected.origins||!expected.extensions)fail('Нет closed source dependency closure');
 const actual=await captureSourceDependencies(Object.keys(expected.origins),Object.keys(expected.extensions));if(stable(actual)!==stable(expected))fail('Source metadata/ancestor extension identity/inventory drift');
}

export {sourceState as overlayEntryState};

/** ARCH86: finite initial-absent EMPTY native slots, never an ignored suffix/glob. */
export async function assertOverlaySourceFiles(root:string,expected:SourceFiles,initial:SourceFiles,selected:string[],identities:SourceRoleIdentities,protectedPaths:string[]){
 if(!initial['']||initial[''].kind!=='directory'||new Set(selected).size!==selected.length||stable(Object.keys(identities).sort())!==stable([...selected].sort()))fail('Нет bound native empty-slot scope');
 const allowed=new Set<string>();
 const local=(path:string)=>{const n=relative(root,path).replaceAll('\\','/');return !!n&&!n.startsWith('../')&&n!=='..'&&resolve(root,n)===path?n:undefined};
 for(const source of selected){
  const identity=identities[source],input=resolve(root,source);
  // Alias spelling has no inferred target. Existing exact identity guards still apply.
  if(!local(input)||identity.linkTarget!==null||identity.physicalPath!==input)continue;
  const name=basename(input),dot=name.lastIndexOf('.'),stem=dot>0?name.slice(0,dot):name;
  const parent=relative(root,resolve(input,'..')).replaceAll('\\','/'),base=(parent?parent+'/':'')+stem+'_files';
  if(Object.hasOwn(initial,base))continue;
  for(const slot of [base,base+'/mediabag']){
   if(Object.hasOwn(initial,slot))continue;
   const abs=resolve(root,slot);if(!local(abs))fail('Native slot вне owner');
   if(protectedPaths.some(p=>{p=resolve(p);return p===abs||p.startsWith(abs+'/')||abs.startsWith(p+'/')}))continue;
   allowed.add(slot);
  }
 }
 const actual=await captureSourceFiles(root),normalized={...actual};
 for(const name of allowed){
  const row=actual[name];if(!row)continue;
  if(row.kind!=='directory'||row.uid!==initial[''].uid||row.gid!==initial[''].gid||row.dev!==initial[''].dev||row.mode===null||(row.mode&0o7777)!==0o755)fail('Foreign/special native EMPTY slot');
  const path=resolve(root,name),parents:string[]=[];let parent=resolve(path,'..');while(true){parents.push(parent);if(parent===root)break;const next=resolve(parent,'..');if(next===parent)fail('Native slot parent вне owner');parent=next}
  const parentStates=[];for(const p of parents){const s=await sourceState(p);if(s.kind!=='directory'||await Deno.realPath(p)!==p)fail('Linked native EMPTY slot parent');parentStates.push(s)}
  if(await Deno.realPath(path)!==path||stable(await sourceState(path))!==stable(row))fail('Native EMPTY slot identity changed');
  const children=[];for await(const e of Deno.readDir(path))children.push(e.name);
  const child=name.endsWith('/mediabag')?undefined:name+'/mediabag';
  if(child?(children.length!==0&&(children.length!==1||children[0]!=='mediabag'||!allowed.has(child)||!actual[child])):children.length!==0)fail('Непустой/неизвестный native EMPTY slot');
  const again=[];for await(const e of Deno.readDir(path))again.push(e.name);if(stable(again.sort())!==stable(children.sort()))fail('Native EMPTY slot children changed during validation');
  if(stable(await sourceState(path))!==stable(row))fail('Native EMPTY slot replaced during validation');
  for(let i=0;i<parents.length;i++)if(stable(await sourceState(parents[i]))!==stable(parentStates[i]))fail('Native EMPTY slot parent replaced');
  delete normalized[name];
 }
 if(stable(normalized)!==stable(expected))fail('Overlay source/vendor files changed');
}

/** One immutable original pair, selected BEFORE source activation; no live refresh. */
export function ownedCtimeRepresentation(originalNative:string,originalDeno:unknown){
 const parse=(stamp:string)=>{if(typeof stamp!=='string'||!/^(-?(?:0|[1-9][0-9]*)):(0|[1-9][0-9]{0,8})$/.test(stamp))fail('Некорректный bound native ctime');const [s,n]=stamp.split(':').map(BigInt);if(n<0n||n>999999999n)fail('Native ctime nanoseconds range');return {seconds:s*1000n,milliseconds:s*1000n+n/1000000n}};
 const original=parse(originalNative),valid=(n:bigint)=>n>=-8640000000000000n&&n<=8640000000000000n;
 if(typeof originalDeno!=='number'||!Number.isSafeInteger(originalDeno)||!valid(BigInt(originalDeno)))fail('Нет immutable original Deno ctime');
 const matching=(['seconds','milliseconds'] as const).filter(k=>valid(original[k])&&Number(original[k])===originalDeno);if(matching.length!==1)fail('Неоднозначное/несовместимое original ctime representation');const kind=matching[0];
 return (restoredNative:string)=>{const n=parse(restoredNative)[kind];if(!valid(n))fail('Restored ctime вне Date range');return Number(n)};
}
