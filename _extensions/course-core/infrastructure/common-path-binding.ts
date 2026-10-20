/** Внутреннее подтверждение native-путей; авторский metadata/fact API прежний. */
import {basename,dirname,fromFileUrl,join,relative,resolve} from 'stdlib/path';
import {diagnostic} from '../domain/diagnostics.ts';
import {command,quartoExecutable} from './process.ts';
import type {NativeRun,NativeRunPointer} from './native-run.ts';
const fail=(message:string):never=>{throw diagnostic('NATIVE.COMMON_PATH_BINDING_INVALID',message,{field:'project-materialization'})};
export const stable=(value:unknown):string=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export async function digest(bytes:Uint8Array,algorithm='SHA-256'){return Array.from(new Uint8Array(await crypto.subtle.digest(algorithm,new Uint8Array(bytes).buffer)),x=>x.toString(16).padStart(2,'0')).join('')}
// Stock toInputRelativePaths joins the owner offset to the canonical spelling.
// relative(inputDir, owner/source) instead collapses shared input/source prefixes.
function ownerEffectiveSource(root:string,input:string,source:string){return join(relative(dirname(resolve(root,input)),root),source).replaceAll('\\','/')}
function local(value:unknown):asserts value is string{
 if(typeof value!=='string'||!value||/^[\/\\]/.test(value)||/[\\\0:*?\[\]{}]/.test(value)||value.split('/').some(p=>!p||p==='.'||p==='..'||p==='.git'))fail('Недопустимый canonical путь');
}
const privateParts=new Set(['private','reference','solution','solutions','grading-notes','rubric.md','contract.md','tests']);
const generated=new Set(['.git','.gradle','.mvn','.quarto','_generated','node_modules','build','target','out','__pycache__','_extensions','site_libs','_output','_site','_book']);
const generatedPart=(p:string)=>generated.has(p)||/^_(?:site|output|book)(?:-|$)/.test(p);
const excluded=(p:string)=>/\.(qmd|rmd|ipynb|class|jar)$/i.test(p)||/^(?:_quarto(?:[-.].*)?|_metadata\.ya?ml)$/i.test(p)||p==='check.sh'||p.startsWith('.')&&p!=='.gitignore';
export async function regular(root:string,name:string,optional=false):Promise<Uint8Array|undefined>{
 local(name);let path=root;
 for(const part of name.split('/')){
  path=join(path,part);
  try{const info=await Deno.lstat(path);if(info.isSymlink)fail('Символическая ссылка в proof: '+name)}catch(e){if(e instanceof Deno.errors.NotFound&&optional)return;throw e}
 }
 if(await Deno.realPath(path)!==path||!(await Deno.lstat(path)).isFile)fail('Нужен regular file внутри owner: '+name);
 return await Deno.readFile(path);
}
type Section={projects:Record<string,{'common-files':{source:string;target:string;audience:'student'|'grading'}[];'include-git'?:boolean}>};
function section(raw:any):Section|null{
 if(raw==null)return null;
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).join(',')!=='projects'||!raw.projects||typeof raw.projects!=='object'||Array.isArray(raw.projects))fail('Некорректная canonical materialization section');
 for(const [id,e] of Object.entries(raw.projects) as [string,any][]){
  if(!/^exr-[a-z0-9][a-z0-9-]*$/.test(id)||!e||typeof e!=='object'||Object.keys(e).some(k=>!['common-files','include-git'].includes(k))||!Array.isArray(e['common-files'])||e['include-git']!==undefined&&typeof e['include-git']!=='boolean')fail('Некорректная canonical declaration: '+id);
  const targets=new Set();
  for(const f of e['common-files']){
   if(!f||Object.keys(f).sort().join(',')!=='audience,source,target'||!['student','grading'].includes(f.audience))fail('Некорректный canonical common entry');
   local(f.source);local(f.target);
   if(f.source.split('/').some((p:string)=>privateParts.has(p)||generatedPart(p)||excluded(p)))fail('Закрытый/source/config/generated common source');
   if(f.target.split('/').some((p:string)=>generatedPart(p)))fail('Generated common target');
   if(f.audience==='student'&&(!f.target.startsWith('student/')||f.target.split('/').some((p:string)=>privateParts.has(p)||excluded(p))))fail('Непубличный student target');
   if(f.audience==='grading'&&f.target.startsWith('student/'))fail('Grading target внутри student');
   if(!['student','reference','tests'].includes(f.target.split('/')[0])&&!['rubric.md','contract.md'].includes(f.target))fail('Common target вне partitions');
   if(targets.has(f.target))fail('Повторный common target');targets.add(f.target);
  }
 }
 return raw;
}
function unsupported(raw:any){
 if(!raw||typeof raw!=='object')return;
 for(const [key,v] of Object.entries(raw)){
  if(['metadata-file','metadata-files'].includes(key)&&v!=null)fail('Неподтверждённый metadata-file origin');
  if(key!=='project-materialization')unsupported(v);
 }
}
function nestedDeclaration(raw:any,top=true):boolean{
 if(!raw||typeof raw!=='object')return false;
 return Object.entries(raw).some(([k,v])=>k==='project-materialization'?!top:nestedDeclaration(v,false));
}
// Это inventory native metadata, не повторное разрешение extension IDs.
async function extensionMetadata(roots:string[]){
 const files:Record<string,string>={};
 async function descriptor(dir:string){
  let found=false;
  for(const name of ['_extension.yml','_extension.yaml']){
   const bytes=await regular(dir,name,true);if(bytes){files[join(dir,name)]=await digest(bytes);found=true}
  }return found;
 }
 for(const root of roots){
  try{if(await Deno.realPath(root)!==root||!(await Deno.lstat(root)).isDirectory)fail('Неподтверждённый extension metadata root')}catch(e){if(e instanceof Deno.errors.NotFound)continue;throw e}
  for await(const entry of Deno.readDir(root)){
   if(entry.isSymlink)fail('Symlink в native extension metadata root');if(!entry.isDirectory)continue;
   const dir=join(root,entry.name);if(await descriptor(dir))continue;
   // Inventory повторяет только поддержанную stock layout: namespace + extension.
   for await(const child of Deno.readDir(dir)){
    if(child.isSymlink)fail('Symlink в extension namespace');if(child.isDirectory)await descriptor(join(dir,child.name));
   }
  }
 }return files;
}
function extensionRoots(root:string,extensions:any[]){
 const roots=new Set<string>([join(root,'_extensions')]);
 for(const e of extensions){
  if(typeof e.path!=='string'||!e.path.startsWith('/')&& !/^[A-Za-z]:[\\/]/.test(e.path))fail('Неизвестный native extension path');
  let dir=e.path;while(basename(dir)!=='_extensions'){const next=dirname(dir);if(next===dir)fail('Неизвестный native extension namespace');dir=next}roots.add(dir);
 }return [...roots].sort();
}
export interface CommonPathWitness {
 schema:'course-common-files-path-binding-v1';projectRoot:string;runDirectory:string;profiles:string[];outputDirectory:string;renderAll:boolean;
 quartoVersion:string;ownerInspectionHash:string;documentInspectionHashes:Record<string,string>;
 configurationInputs:Record<string,string|false>;inputFiles:string[];sourceHashes:Record<string,string>;commonSourceHashes:Record<string,string>;
 nativeExtensionMetadata:{roots:string[];files:Record<string,string>};
 canonicalOwnerDeclarations:Section|null;documents:{source:string;format:string;rawDeclarations:Section|null;effectiveDeclarations:Section|null;canonicalDeclarations:Section|null}[];
 temporaryExportProfile?:{profile:string;file:string;sha256:string;sha1:string};
}
async function inventory(root:string,output:string){
 const result:Record<string,string>={};
 async function walk(dir:string){for await(const e of Deno.readDir(dir)){
  const path=join(dir,e.name);if(path===output||generatedPart(e.name))continue;
  if(e.isSymlink)fail('Символическая ссылка в исходном inventory: '+path);
  if(e.isDirectory)await walk(path);else if(e.isFile)result[relative(root,path).replaceAll('\\','/')]=await digest(await Deno.readFile(path));else fail('Специальный файл в owner');
 }}await walk(root);return result;
}
function canonicalFact(value:Section|null){
 if(!value)return undefined;
 return Object.fromEntries(Object.entries(value.projects).map(([id,e])=>[id,{commonFiles:e['common-files'],...(e['include-git']!==undefined?{includeGit:e['include-git']}:{})}]));
}
async function currentInputs(root:string,w:CommonPathWitness,p:NativeRunPointer){
 if(stable(await extensionMetadata(w.nativeExtensionMetadata.roots))!==stable(w.nativeExtensionMetadata.files))fail('Native extension metadata closure изменён');
 for(const [name,hash] of Object.entries({...w.configurationInputs,...w.sourceHashes,...w.commonSourceHashes})){
  const retired=p.commonPathRetirement;
  const expect=retired&&name===retired.file?false:hash;
  const bytes=await regular(root,name,true);if((bytes?await digest(bytes):false)!==expect)fail('Proof устарел: '+name);
 }
}
export async function produceCommonPathBinding(p:NativeRunPointer){
 const root=p.projectRoot,before=await inventory(root,p.outputDirectory);
 const args=p.profiles.length?['--profile',p.profiles.join(',')]:[];
 const discovery=JSON.parse(await command(quartoExecutable(),['inspect',root,...args],root));
 const roots=extensionRoots(root,discovery.extensions??[]),extensionBefore=await extensionMetadata(roots);
 const ownerText=await command(quartoExecutable(),['inspect',root,...args],root),owner=JSON.parse(ownerText);
 if(stable(roots)!==stable(extensionRoots(root,owner.extensions??[]))||stable(extensionBefore)!==stable(await extensionMetadata(roots)))fail('Extension metadata drift во время authoritative inspect');
 if(owner.dir!==root||!owner.files||!owner.fileInformation)fail('Не установлен native owner');
 const canonical=section(owner.config?.['project-materialization']);
 unsupported(owner.config);if(nestedDeclaration(owner.config))fail('Неподдерживаемая вложенная owner declaration');
 for(const extension of owner.extensions??[])if(nestedDeclaration(extension,false))fail('Неподтверждённый extension origin');
 const names=['_quarto.yml','_quarto.yaml',...p.profiles.flatMap(x=>['_quarto-'+x+'.yml','_quarto-'+x+'.yaml'])];
 const config:Record<string,string|false>={};
 const sourceHashes:Record<string,string>={},commons:Record<string,string>={},documents:CommonPathWitness['documents']=[],docHashes:Record<string,string>={};
 const selected=(p.initialInputFiles?.length?p.initialInputFiles:owner.files.input).map((x:string)=>relative(root,resolve(root,x)).replaceAll('\\','/'));
 if(new Set(selected).size!==selected.length)fail('Повторный input');
 for(const name of owner.files.config??[]){const rel=relative(root,resolve(root,name)).replaceAll('\\','/');if(!names.includes(rel))fail('Неизвестный config origin: '+rel)}
 const record=(name:string,table:Record<string,string|false>)=>{local(name);table[name]=before[name]??false};
 for(const name of names)record(name,config);
 const collect=async(value:Section|null)=>{for(const e of Object.values(value?.projects??{}))for(const f of e['common-files']){const bytes=await regular(root,f.source);if(!bytes||before[f.source]!==await digest(bytes))fail('Common source drift во время inspect');commons[f.source]=before[f.source]}};
 await collect(canonical);
 for(const source of selected){
  local(source);if(!before[source]||!owner.files.input.includes(resolve(root,source)))fail('Input не принадлежит native inventory: '+source);
  sourceHashes[source]=before[source];
  const information=owner.fileInformation[source];if(!information||typeof information.metadata!=='object'||!Array.isArray(information.includeMap))fail('Отсутствует raw native QMD metadata');
  const raw=section(information.metadata['project-materialization']);unsupported(information.metadata);if(nestedDeclaration(information.metadata))fail('Неизвестный QMD declaration origin');
  const canonicalDocument=canonical||raw?{projects:{...canonical?.projects,...raw?.projects}}:null;
  for(const id of Object.keys(raw?.projects??{}))if(canonical?.projects[id])fail('Неоднозначный owner/QMD origin: '+id);
  await collect(raw);
  let directory=dirname(source);
  while(true){
   for(const file of ['_metadata.yml','_metadata.yaml',...(directory==='.'?[]:['_quarto.yml','_quarto.yaml'])]){
    const name=directory==='.'?file:directory+'/'+file;record(name,config);
    if(config[name]&&canonicalDocument)fail('Неподтверждённый directory metadata/owner origin: '+name);
   }
   if(directory==='.')break;directory=dirname(directory);
  }
  for(const include of information.includeMap){
   if(!include||typeof include.source!=='string'||typeof include.target!=='string')fail('Неизвестный native include closure');
   const original=resolve(root,include.source),target=resolve(dirname(original),include.target);
   for(const file of [original,target]){const name=relative(root,file).replaceAll('\\','/');local(name);if(!before[name])fail('Неполный include closure');sourceHashes[name]=before[name]}
  }
  const text=await command(quartoExecutable(),['inspect',resolve(root,source),...args],root),doc=JSON.parse(text);
  docHashes[source]=await digest(new TextEncoder().encode(text));
  if(doc.project?.dir!==root||!doc.formats)fail('Чужой native document owner: '+source);
  if(stable(doc.fileInformation?.[source]?.metadata??doc.fileInformation?.[resolve(root,source)]?.metadata)!==stable(information.metadata))fail('Raw QMD metadata drift');
  for(const [format,details] of Object.entries(doc.formats) as [string,any][]){
   const effective=details.metadata?.['project-materialization']??null;
   const predicted=canonicalDocument?structuredClone(canonicalDocument):null;
   if(predicted&&canonical)for(const id of Object.keys(canonical.projects))for(const f of predicted.projects[id]['common-files'])f.source=ownerEffectiveSource(root,source,f.source);
   if(stable(predicted)!==stable(effective))fail('Необъяснённая effective materialization секция: '+source+'/'+format);
   documents.push({source,format:['pdf','beamer'].includes(format)?'latex':format,rawDeclarations:raw,effectiveDeclarations:effective,canonicalDeclarations:canonicalDocument});
  }
 }
 const after=await inventory(root,p.outputDirectory);
 if(stable(extensionBefore)!==stable(await extensionMetadata(roots)))fail('Extension metadata drift во время document inspect');
 for(const [name,hash] of Object.entries({...config,...sourceHashes,...commons}))if((after[name]??false)!==hash)fail('Input/config/common drift во время inspect: '+name);
 const witness:CommonPathWitness={schema:'course-common-files-path-binding-v1',projectRoot:root,runDirectory:p.directory,profiles:p.profiles,outputDirectory:p.outputDirectory,renderAll:p.renderAll,quartoVersion:owner.quarto?.version,ownerInspectionHash:await digest(new TextEncoder().encode(ownerText)),documentInspectionHashes:docHashes,configurationInputs:config,inputFiles:selected,sourceHashes,commonSourceHashes:commons,canonicalOwnerDeclarations:canonical,documents,nativeExtensionMetadata:{roots,files:extensionBefore}};
 const profile=p.profiles[0],name='_quarto-'+profile+'.yml';
 if(/^course-export-[0-9a-f-]{36}$/.test(profile??'')){
  const bytes=await regular(root,name);let value;try{value=JSON.parse(new TextDecoder().decode(bytes))}catch{fail('Export profile должен быть private generated JSON')}
  const pr=value.project,extension=dirname(dirname(fromFileUrl(import.meta.url)));
  if(!pr||Object.keys(pr).sort().join(',')!=='output-dir,post-render,pre-render,render,type'||pr['pre-render']!==join(extension,'entrypoints/pre.ts')||pr['post-render']!==join(extension,'entrypoints/post.ts'))fail('Не подтверждены owned export hooks');
  if(Object.keys(value).sort().join(',')!=='course,course-export-context,crossref,filters,format,project'||value['course-export-context']!==true||value.course?.view!=='full'||stable(value.filters)!==stable(['course-core'])||stable(value.format)!==stable({json:{}})||stable(value.crossref)!==stable({})||pr?.type!=='default'||resolve(root,pr['output-dir'])!==p.outputDirectory||p.outputDirectory!==join(root,'_generated/course-spec/export-output',profile)||!Array.isArray(pr.render)||pr.render.length!==selected.length||new Set(pr.render).size!==selected.length||pr.render.some((x:string)=>!selected.includes(x)))fail('Не подтверждён generated export profile');
  witness.temporaryExportProfile={profile,file:name,sha256:await digest(bytes!),sha1:await digest(bytes!,'SHA-1')};
 }
 const bytes=new TextEncoder().encode(JSON.stringify(witness));
 await Deno.writeFile(join(p.directory,'common-files-path-binding.json'),bytes,{createNew:true,mode:0o600});
 return {file:'common-files-path-binding.json' as const,sha1:await digest(bytes,'SHA-1'),sha256:await digest(bytes)};
}
export async function readCommonPathBinding(p:NativeRunPointer):Promise<CommonPathWitness>{
 const ref=p.commonPathBinding;if(!ref||Object.keys(ref).sort().join(',')!=='file,sha1,sha256'||ref.file!=='common-files-path-binding.json')fail('Отсутствует private witness ref');
 const bytes=await regular(p.directory,ref.file);if(!bytes||await digest(bytes)!==ref.sha256||await digest(bytes,'SHA-1')!==ref.sha1)fail('Witness bytes/hash изменены');
 const w=JSON.parse(new TextDecoder().decode(bytes)) as CommonPathWitness;
 if(w.schema!=='course-common-files-path-binding-v1'||w.projectRoot!==p.projectRoot||w.runDirectory!==p.directory||w.outputDirectory!==p.outputDirectory||w.renderAll!==p.renderAll||stable(w.profiles)!==stable(p.profiles))fail('Witness принадлежит другому native run');
 if(p.commonPathRetirement){const r=p.commonPathRetirement;if(!w.temporaryExportProfile||stable(r)!==stable(w.temporaryExportProfile))fail('Чужое retirement record')}

 const required=['schema','projectRoot','runDirectory','profiles','outputDirectory','renderAll','quartoVersion','ownerInspectionHash','documentInspectionHashes','configurationInputs','inputFiles','sourceHashes','commonSourceHashes','canonicalOwnerDeclarations','documents','nativeExtensionMetadata'];
 if(required.some(k=>!Object.hasOwn(w,k))||Object.keys(w).some(k=>![...required,'temporaryExportProfile'].includes(k))||typeof w.quartoVersion!=='string'||!Array.isArray(w.inputFiles)||!Array.isArray(w.documents)||!w.configurationInputs||!w.sourceHashes||!w.commonSourceHashes||!w.documentInspectionHashes)fail('Некорректная closed witness schema');
 const em=w.nativeExtensionMetadata;if(!em||Object.keys(em).sort().join(',')!=='files,roots'||!Array.isArray(em.roots)||!em.roots.includes(join(p.projectRoot,'_extensions'))||em.roots.some(r=>typeof r!=='string'||basename(r)!=='_extensions')||!em.files||Object.entries(em.files).some(([path,hash])=>typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash)||!em.roots.some(root=>{const rel=relative(root,path).replaceAll('\\','/');return !!rel&&rel!=='..'&&!rel.startsWith('../')&&!rel.startsWith('/')&&!/^[A-Za-z]:/.test(rel)})||!['_extension.yml','_extension.yaml'].includes(basename(path))))fail('Неполный native extension metadata inventory');
 const initial=(p.initialInputFiles??[]).map(x=>relative(p.projectRoot,resolve(p.projectRoot,x)).replaceAll('\\','/'));
 if(initial.length&&stable(initial)!==stable(w.inputFiles))fail('Witness input scope изменён');
 for(const name of w.inputFiles){local(name);if(!Object.hasOwn(w.sourceHashes,name)||!w.documents.some(d=>d.source===name)||!Object.hasOwn(w.documentInspectionHashes,name))fail('Неполный source proof')}
 const configNames=['_quarto.yml','_quarto.yaml',...p.profiles.flatMap(x=>['_quarto-'+x+'.yml','_quarto-'+x+'.yaml'])];
 for(const source of w.inputFiles){let dir=dirname(source);while(true){for(const name of ['_metadata.yml','_metadata.yaml',...(dir==='.'?[]:['_quarto.yml','_quarto.yaml'])])configNames.push(dir==='.'?name:dir+'/'+name);if(dir==='.')break;dir=dirname(dir)}}
 if(new Set(configNames).size!==Object.keys(w.configurationInputs).length||configNames.some(n=>!Object.hasOwn(w.configurationInputs,n)))fail('Неполный config/absence closure');
 for(const [name,h] of Object.entries({...w.configurationInputs,...w.sourceHashes,...w.commonSourceHashes})){local(name);if(h!==false&&!/^[a-f0-9]{64}$/.test(h))fail('Некорректный source hash')}
 const owner=section(w.canonicalOwnerDeclarations),commonNames=new Set<string>(),seenDocs=new Set();
 for(const row of w.documents){
  if(Object.keys(row).sort().join(',')!=='canonicalDeclarations,effectiveDeclarations,format,rawDeclarations,source'||!w.inputFiles.includes(row.source)||typeof row.format!=='string'||seenDocs.has(row.source+'\0'+row.format))fail('Некорректный source/format witness');seenDocs.add(row.source+'\0'+row.format);
  const raw=section(row.rawDeclarations);for(const id of Object.keys(raw?.projects??{}))if(owner?.projects[id])fail('Неоднозначный raw origin');
  const expected=owner||raw?{projects:{...owner?.projects,...raw?.projects}}:null;
  if(stable(row.canonicalDeclarations)!==stable(expected))fail('Canonical witness не выводится из raw declarations');
  const effective=expected?structuredClone(expected):null;
  if(effective&&owner)for(const id of Object.keys(owner.projects))for(const file of effective.projects[id]['common-files'])file.source=ownerEffectiveSource(p.projectRoot,row.source,file.source);
  if(stable(effective)!==stable(row.effectiveDeclarations))fail('Effective witness не соответствует raw source binding');
  for(const entry of Object.values(expected?.projects??{}))for(const file of entry['common-files'])commonNames.add(file.source);
  if(expected)for(const name of configNames)if(/(?:^|\/)_metadata\.ya?ml$/.test(name)&&w.configurationInputs[name]!==false)fail('Неподтверждённый directory metadata origin');
 }
 if(commonNames.size!==Object.keys(w.commonSourceHashes).length||[...commonNames].some(n=>!Object.hasOwn(w.commonSourceHashes,n)))fail('Неполный canonical common source inventory');
 if(w.temporaryExportProfile){const t=w.temporaryExportProfile;if(Object.keys(t).sort().join(',')!=='file,profile,sha1,sha256'||!/^course-export-[0-9a-f-]{36}$/.test(t.profile)||t.profile!==p.profiles[0]||t.file!=='_quarto-'+t.profile+'.yml'||t.sha256!==w.configurationInputs[t.file]||!/^[a-f0-9]{40}$/.test(t.sha1))fail('Некорректный generated profile identity')}
 await currentInputs(p.projectRoot,w,p);return w;
}
export function validateCapturedCommon(run:NativeRun,w:CommonPathWitness){
 for(const d of run.documents){
  const proof=w.documents.filter(x=>x.source===d.source&&x.format===d.document.format);if(proof.length!==1)fail('Неверный source/format capture');
  const expected=canonicalFact(proof[0].canonicalDeclarations);
  if(stable(d.projectMaterializations??null)!==stable(expected??null))fail('Captured section не совпадает с canonical witness');
  for(const fact of d.projects??[])if(stable(fact.materialization??null)!==stable(expected?.[fact.exerciseId]??null))fail('Captured project/common mismatch');
 }
}
