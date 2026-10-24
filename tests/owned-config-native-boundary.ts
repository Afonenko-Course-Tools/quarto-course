import {join} from 'stdlib/path';
import {captureSourceFiles,assertOverlaySourceFiles,ownedCtimeRepresentation} from '../_extensions/course-core/infrastructure/owned-config-source.ts';
import {openConfigEntryView} from '../_extensions/course-core/infrastructure/owned-config-entry.ts';
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
const reject=async(f:()=>unknown|Promise<unknown>,m:string)=>{let refused=false;try{await f()}catch{refused=true}assert(refused,m)};
const top=Deno.env.get('COURSE_NATIVE_BOUNDARY_TEST_ROOT')||await Deno.makeTempDir({prefix:'owned-native-boundary-'});await Deno.mkdir(top,{recursive:true,mode:0o700});
let count=0;
async function fixture(name:string,existing=false){const root=join(top,name);await Deno.mkdir(root,{mode:0o700});await Deno.writeTextFile(join(root,'index.qmd'),'# Input\n',{createNew:true});await Deno.writeTextFile(join(root,'_quarto.yml'),'project: {}\n',{createNew:true});if(existing)await Deno.mkdir(join(root,'index_files'),{mode:0o755});const before=await captureSourceFiles(root),identities={'index.qmd':{physicalPath:join(root,'index.qmd'),linkTarget:null,sha256:before['index.qmd'].sha256!}};return {root,before,check:(protectedPaths:string[]=[])=>assertOverlaySourceFiles(root,before,before,['index.qmd'],identities,protectedPaths)}}
async function pair(root:string){await Deno.mkdir(join(root,'index_files/mediabag'),{recursive:true,mode:0o755})}
{
 const f=await fixture('lawful');await pair(f.root);await f.check();await Deno.remove(join(f.root,'index_files/mediabag'));await f.check();await Deno.remove(join(f.root,'index_files'));await f.check();count++;
}
{
 const f=await fixture('preexisting',true);await Deno.rename(join(f.root,'index_files'),join(top,'preexisting-original'));await pair(f.root);await reject(()=>f.check(),'pre-existing empty slot rebased');count++;
}
{
 const f=await fixture('unselected');await Deno.mkdir(join(f.root,'other_files/mediabag'),{recursive:true,mode:0o755});await reject(()=>f.check(),'unselected stem accepted');count++;
}
{
 const f=await fixture('protected');await pair(f.root);await reject(()=>f.check([join(f.root,'index_files/future-resource.svg')]),'protected resource absence/tree overlap');count++;
}
for(const [name,child,directory] of [['hidden','.hidden',false],['file','media.svg',false],['subdirectory','extra',true]] as const){
 const f=await fixture(name);await pair(f.root);const p=join(f.root,'index_files/mediabag',child);if(directory)await Deno.mkdir(p);else await Deno.writeTextFile(p,'protected');await reject(()=>f.check(),'nonempty mediabag '+name);count++;
}
{
 const f=await fixture('sibling');await pair(f.root);await Deno.mkdir(join(f.root,'index_files/extra'));await reject(()=>f.check(),'unknown sibling accepted');count++;
}
{
 const f=await fixture('linked');await Deno.mkdir(join(top,'foreign'));await Deno.symlink(join(top,'foreign'),join(f.root,'index_files'));await reject(()=>f.check(),'linked slot accepted');count++;
}
{
 const f=await fixture('foreign-mode');await pair(f.root);await Deno.chmod(join(f.root,'index_files/mediabag'),0o777);await reject(()=>f.check(),'foreign native slot fullmode accepted');count++;
}
{
 const f=await fixture('midcheck');await pair(f.root);const path=join(f.root,'index_files'),readDir=Deno.readDir;let seen=0,replaced=false;
 Deno.readDir=((p:string|URL)=>{if(p===path&&++seen===2&&!replaced){Deno.renameSync(path,join(top,'midcheck-old'));Deno.mkdirSync(path,{mode:0o755});Deno.mkdirSync(join(path,'mediabag'),{mode:0o755});replaced=true}return readDir(p)}) as typeof Deno.readDir;
 try{await reject(()=>f.check(),'mid-check inode replacement accepted');assert(replaced,'mid-check replacement did not execute')}finally{Deno.readDir=readDir}count++;
}
assert(ownedCtimeRepresentation('100:123456789',100000)('101:987654321')===101000,'seconds representation');count++;
assert(ownedCtimeRepresentation('100:123456789',100123)('101:987654321')===101987,'milliseconds representation');count++;
for(const [stamp,value] of [['100:1',100000],['100:0',100000],['100:123456789',100001],['100:123456789',null],['bad',100000],['100:1000000000',100000]] as const){await reject(()=>ownedCtimeRepresentation(stamp,value),'ambiguous/missing/inconsistent pair');count++}
await reject(()=>ownedCtimeRepresentation('100:123456789',100000)('9000000000000000:1'),'Date overflow accepted');count++;
{
 const f=await fixture('native-ctime'),dlopen=Deno.dlopen;let hookExecuted=false;
 let view:Awaited<ReturnType<typeof openConfigEntryView>>|undefined;
 // Runtime hashes finish before acquisition; all native library symbols remain real.
 Deno.dlopen=((...args:Parameters<typeof Deno.dlopen>)=>{
  const library=dlopen(...args);
  if(!hookExecuted){
   hookExecuted=true;
   try{
    const pause=(1015-Date.now()%1000)%1000;
    if(pause)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,pause);
    Deno.chmodSync(join(f.root,'_quarto.yml'),0o644);
   }catch(error){library.close();throw error}
  }
  return library;
 }) as typeof Deno.dlopen;
 try{
  view=await openConfigEntryView(f.root,'_quarto.yml');Deno.dlopen=dlopen;
  assert(hookExecuted&&Deno.dlopen===dlopen,'native ctime acquisition hook or restoration missing');
  const held=view,before=held.identity;await Deno.chmod(join(f.root,'_quarto.yml'),before.mode&0o7777);await reject(()=>held.check(),'full native ctime drift accepted');
  const after=await openConfigEntryView(f.root,'_quarto.yml');try{assert(before.ctime!==after.identity.ctime&&before.ctime.split(':')[0]===after.identity.ctime.split(':')[0],'not an actual same-second native-nanosecond control: '+JSON.stringify({before:before.ctime,after:after.identity.ctime}));assert(before.ino===after.identity.ino&&before.mode===after.identity.mode&&before.mtime===after.identity.mtime,'control changed identity beyond ctime')}finally{after.close()}
 }finally{Deno.dlopen=dlopen;view?.close()}count++;
}
console.log(JSON.stringify({status:'PASS',focusedControls:count,scope:'ARCH86 EMPTY slots + immutable original-pair ctime; actual native same-second mutation refused; not export proof'}));
// ARCH87: focused native JSON recipe/admission/held-entry controls (not export proof).
{
 const jsonApi=await import('../_extensions/course-core/infrastructure/owned-config-source.ts');
 const jsonEntry=await import('../_extensions/course-core/infrastructure/owned-config-entry.ts');
 const jsonTop=await Deno.makeTempDir({prefix:'owned-json-boundary-'});let jsonControls=0;
 const body=JSON.stringify({'pandoc-api-version':[1,23,1],meta:{},blocks:[]});
 async function jsonFixture(name:string){const root=join(jsonTop,name);await Deno.mkdir(root,{mode:0o700});await Deno.mkdir(join(root,'nested'));for(const n of ['index.qmd','nested/lab.qmd'])await Deno.writeTextFile(join(root,n),'# Input\n');const initial=await captureSourceFiles(root),selected=['index.qmd','nested/lab.qmd'],identities=Object.fromEntries(selected.map(n=>[n,{physicalPath:join(root,n),linkTarget:null,sha256:initial[n].sha256!}])),frames=Object.fromEntries(selected.map(n=>[n,{project:{dir:root},fileInformation:{[join(root,n)]:{}},formats:{json:{pandoc:{'output-file':n==='index.qmd'?'index.json':'custom.html'},render:{'output-ext':'json'}}}}])),output=join(root,'_generated/export');return {root,initial,selected,identities,frames,output,slots:jsonApi.nativeJsonOutputSlots(root,selected,identities,frames,output)}}
 const f=await jsonFixture('positive');assert(f.slots[0].temporary==='index.json'&&f.slots[1].temporary==='nested/custom.html.json','root/nested/general output-file stock semantics');await jsonApi.admitNativeJsonSlots(f.root,f.initial,f.slots,[]);jsonControls++;
 const doc=(slot:any)=>({scope:'document',source:slot.source,course:{id:'course',view:'full'},document:{source:slot.source,format:'json',exportContext:true,profiles:['owned'],output:join(f.root,slot.temporary)}});
 await Deno.writeTextFile(join(f.root,f.slots[0].temporary),body);const snapshot=await jsonApi.nativeJsonSnapshot(f.root,f.slots,true,async slot=>jsonApi.assertNativeJsonDocument(f.root,f.output,['owned'],'course',slot,doc(slot)));
 try{await assertOverlaySourceFiles(f.root,f.initial,f.initial,f.selected,f.identities,[],snapshot.states);await snapshot.check()}finally{snapshot.close()}jsonControls++;
 await reject(()=>jsonApi.admitNativeJsonSlots(f.root,f.initial,f.slots,[]),'pre-existing native slot overwritten');assert(await Deno.readTextFile(join(f.root,'index.json'))===body,'pre-existing bytes changed');jsonControls++;
 await reject(()=>jsonApi.admitNativeJsonSlots(f.root,f.initial,[f.slots[1]],[join(f.root,f.slots[1].temporary)]),'protected absent resource slot accepted');jsonControls++;
 const duplicate=structuredClone(f.frames);duplicate['nested/lab.qmd']=duplicate['index.qmd'];await reject(()=>jsonApi.nativeJsonOutputSlots(f.root,f.selected,f.identities,duplicate,f.output),'foreign execution frame admitted');jsonControls++;
 for(const [field,value] of [['source','foreign.qmd'],['format','html'],['profiles',['full']],['exportContext',false],['output','unrelated.json']] as const){const d=doc(f.slots[0]);(d.document as any)[field]=value;await reject(()=>jsonApi.assertNativeJsonDocument(f.root,f.output,['owned'],'course',f.slots[0],d),'frame/captured document mismatch '+field);jsonControls++}
 await reject(()=>jsonApi.nativeJsonSnapshot(f.root,f.slots,false,()=>Promise.resolve()),'leftover after relocation accepted');jsonControls++;
 const held=await jsonEntry.openNativeJsonOutput(f.root,'index.json');try{await Deno.rename(join(f.root,'index.json'),join(jsonTop,'retained-index.json'));await Deno.writeTextFile(join(f.root,'index.json'),body);await reject(()=>held.check(),'same-bytes inode replacement admitted')}finally{held.close()}jsonControls++;
 for(const kind of ['link','hardlink','oversize','invalid-json','no-document'] as const){const g=await jsonFixture(kind),path=join(g.root,'index.json');if(kind==='link')await Deno.symlink(join(f.root,'index.json'),path);else if(kind==='hardlink'){const seed=join(jsonTop,'hardlink-source');await Deno.writeTextFile(seed,body);await Deno.link(seed,path);}else if(kind==='oversize'){const fd=await Deno.open(path,{write:true,createNew:true});try{await fd.truncate(64*1024*1024+1)}finally{fd.close()}}else await Deno.writeTextFile(path,kind==='invalid-json'?'{}':body);await reject(()=>jsonApi.nativeJsonSnapshot(g.root,g.slots,true,async()=>{if(kind==='no-document')throw Error('no current capture')}),'native JSON '+kind+' admitted');jsonControls++}
 const g=await jsonFixture('duplicates');g.frames['nested/lab.qmd'].project.dir=g.root;g.frames['nested/lab.qmd'].formats.json.pandoc['output-file']='index.json';g.identities['nested/lab.qmd'].physicalPath=join(g.root,'index.qmd');await reject(()=>jsonApi.nativeJsonOutputSlots(g.root,g.selected,g.identities,g.frames,g.output),'contradictory physical/frame source accepted');jsonControls++;
 const missing=structuredClone(f.frames);delete (missing['index.qmd'].formats.json.pandoc as any)['output-file'];await reject(()=>jsonApi.nativeJsonOutputSlots(f.root,f.selected,f.identities,missing,f.output),'guessed missing output-file');jsonControls++;
 await Deno.writeTextFile(join(f.root,'unrelated.json'),body);const extra=await jsonApi.nativeJsonSnapshot(f.root,f.slots,true,async()=>{});try{await reject(()=>assertOverlaySourceFiles(f.root,f.initial,f.initial,f.selected,f.identities,[],extra.states),'unselected JSON ignored')}finally{extra.close()}jsonControls++;
 const duplicateRoot=await jsonFixture('same-directory-duplicate'),second='other.qmd';await Deno.writeTextFile(join(duplicateRoot.root,second),'# Other');const duplicateSources=['index.qmd',second],duplicateIds={...duplicateRoot.identities,[second]:{physicalPath:join(duplicateRoot.root,second),linkTarget:null,sha256:'a'.repeat(64)}},duplicateFrames={'index.qmd':duplicateRoot.frames['index.qmd'],[second]:{project:{dir:duplicateRoot.root},fileInformation:{[join(duplicateRoot.root,second)]:{}},formats:{json:{pandoc:{'output-file':'index.json'},render:{'output-ext':'json'}}}}};await reject(()=>jsonApi.nativeJsonOutputSlots(duplicateRoot.root,duplicateSources,duplicateIds,duplicateFrames,duplicateRoot.output),'two inputs with one output admitted');jsonControls++;
 const operatorUid=Deno.uid;(Deno as any).uid=()=>operatorUid()!+1;try{await reject(()=>jsonEntry.openNativeJsonOutput(f.root,'index.json'),'actual owner versus foreign operator identity admitted')}finally{(Deno as any).uid=operatorUid}jsonControls++;
 console.log(JSON.stringify({status:'PASS',jsonBoundaryControls:jsonControls,scope:'ARCH87 source-side typed JSON controls; no native export claim'}));
}

// ARCH87: simultaneous temporary/final relation.
{
 const {captureSourceFiles,nativeJsonOutputSlots,nativeJsonSnapshot}=await import('../_extensions/course-core/infrastructure/owned-config-source.ts');
const root=await Deno.makeTempDir({prefix:'native-json-pair-'}),input=join(root,'index.qmd'),output=join(root,'_generated/export');await Deno.writeTextFile(input,'# Input');const initial=await captureSourceFiles(root),slots=nativeJsonOutputSlots(root,['index.qmd'],{'index.qmd':{physicalPath:input,linkTarget:null,sha256:initial['index.qmd'].sha256!}},{'index.qmd':{project:{dir:root},fileInformation:{[input]:{}},formats:{json:{pandoc:{'output-file':'index.json'},render:{'output-ext':'json'}}}}},output);
const body=JSON.stringify({'pandoc-api-version':[1,23],meta:{},blocks:[]});await Deno.mkdir(output,{recursive:true});await Deno.writeTextFile(join(root,'index.json'),body);await Deno.writeTextFile(join(output,'index.json'),body);const positive=await nativeJsonSnapshot(root,slots,true,async()=>{});try{await positive.check()}finally{positive.close()}
await Deno.writeTextFile(join(output,'index.json'),JSON.stringify({'pandoc-api-version':[1,23],meta:{},blocks:[{t:'Null'}]}));let rejected=false;try{const bad=await nativeJsonSnapshot(root,slots,true,async()=>{});bad.close()}catch{rejected=true}if(!rejected)throw Error('different final/transient bytes accepted');console.log('PASS simultaneous transient/final exact bytes; different final bytes refused');
}
// ARCH87 review: genuine Core exportContext versus adapter four shared fields.
{
 const {assertNativeJsonAdapter}=await import('../_extensions/course-core/infrastructure/owned-config-source.ts');
 const root=await Deno.makeTempDir({prefix:'native-json-adapter-'}),output=join(root,'_generated/export'),slot={source:'index.qmd',temporary:'index.json',final:join(output,'index.json')};
 const core={source:'index.qmd',course:{id:'course',view:'full'},document:{source:'index.qmd',format:'json',output:join(root,'index.json'),profiles:['owned'],exportContext:true}};
 const adapter={source:'index.qmd',adapter:'prairielearn',course:{id:'course',view:'full'},document:{source:'index.qmd',format:'json',output:join(root,'index.json'),profiles:['owned']}};
 assertNativeJsonAdapter(root,output,slot,core,adapter,'prairielearn');
 for(const [field,value] of [['source','other.qmd'],['format','html'],['profiles',['full']],['output','foreign.json']] as const){const bad=structuredClone(adapter);(bad.document as any)[field]=value;await reject(()=>assertNativeJsonAdapter(root,output,slot,core,bad,'prairielearn'),'adapter wrong shared '+field)}
 console.log('PASS genuine Core exportContext + adapter four-field relation; four mismatches refused');
}
