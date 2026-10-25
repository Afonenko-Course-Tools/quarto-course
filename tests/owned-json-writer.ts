/** File-only проверки intent/held guards; не свидетельство принятого NativeRun. */
import {join} from 'stdlib/path';
import {actualNativeJsonSlot,captureNativeJsonIntents,writeNativeJsonIntent,nativeJsonIntentDirectory,nativeJsonIntentName} from '../_extensions/course-core/infrastructure/owned-json-writer.ts';
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message)};
const reject=async(use:()=>unknown|Promise<unknown>,message:string)=>{let refused=false;try{await use()}catch{refused=true}assert(refused,message)};
const top=await Deno.makeTempDir({prefix:'owned-json-intent-'});let controls=0;
async function fixture(name:string){
 const root=join(top,name),directory=join(root,'_generated/course-spec/native-runs/11111111-1111-4111-8111-111111111111');
 await Deno.mkdir(join(directory,nativeJsonIntentDirectory),{recursive:true,mode:0o700});
 for(const name of ['index.qmd','other.qmd'])await Deno.writeTextFile(join(root,name),'# Source\n');
 const p:any={schema:'course-native-run-pointer-v3',projectRoot:root,directory,profiles:['owned'],outputDirectory:join(root,'_generated/export'),renderAll:true,configurationHashes:{},commonPathBinding:{file:'common-files-path-binding.json',sha1:'a'.repeat(40),sha256:'b'.repeat(64)},ownedConfigOverlay:{kind:'owned-config-overlay-v1',sourceContext:{sha1:'c'.repeat(40),sha256:'d'.repeat(64)}},overlayState:'active'};
 const ctx:any={selected:['index.qmd','other.qmd'],identities:Object.fromEntries(['index.qmd','other.qmd'].map(source=>[source,{physicalPath:join(root,source),linkTarget:null,sha256:'e'.repeat(64)}]))};
 return {root,p,ctx,slot:actualNativeJsonSlot(p,ctx,'index.qmd',join(root,'native-custom.json'),join(p.outputDirectory,'native-custom.json'))};
}
try{
 const f=await fixture('lawful');assert(JSON.stringify(f.slot)===JSON.stringify({source:'index.qmd',temporary:'native-custom.json',final:join(f.p.outputDirectory,'native-custom.json')}),'Exact writer slot lost');controls++;
 for(const [source,writer,document] of [['foreign.qmd',join(f.root,'native-custom.json'),f.slot.final],['index.qmd',join(top,'foreign.json'),f.slot.final],['index.qmd',join(f.root,'index.qmd'),f.slot.final],['index.qmd',join(f.root,'native-custom.json'),join(f.root,'foreign.json')],['index.qmd',join(f.root,'bad\\name.json'),join(f.root,'bad\\name.json')]]){await reject(()=>actualNativeJsonSlot(f.p,f.ctx,source,writer,document),'Foreign input/writer/document admitted');controls++}
 const empty=await captureNativeJsonIntents(f.p,f.ctx);try{assert(empty.slots.length===0,'Empty intent scope');await empty.check()}finally{empty.close()}controls++;
 await writeNativeJsonIntent(f.p,f.slot,f.slot.final);
 const snapshot=await captureNativeJsonIntents(f.p,f.ctx);try{assert(snapshot.slots.length===1&&snapshot.slots[0].temporary==='native-custom.json','Written exact intent missing');await snapshot.check();await reject(()=>writeNativeJsonIntent(f.p,f.slot,f.slot.final),'Duplicate source intent overwritten');await snapshot.check()}finally{snapshot.close()}controls++;
 await reject(()=>captureNativeJsonIntents({...f.p,outputDirectory:join(f.root,'foreign')},f.ctx),'Foreign pointer accepted');controls++;
 const path=join(f.p.directory,nativeJsonIntentDirectory,await nativeJsonIntentName('index.qmd')),bytes=await Deno.readFile(path),view=await captureNativeJsonIntents(f.p,f.ctx);
 try{await Deno.rename(path,join(top,'retained-intent'));await Deno.writeFile(path,bytes,{createNew:true,mode:0o600});await reject(()=>view.check(),'Same-bytes replacement intent accepted')}finally{view.close()}controls++;
 await Deno.writeTextFile(join(f.p.directory,nativeJsonIntentDirectory,'unexpected.json'),'{}',{mode:0o600});await reject(()=>captureNativeJsonIntents(f.p,f.ctx),'Unknown intent entry accepted');controls++;
 const duplicate=await fixture('duplicate-output');await writeNativeJsonIntent(duplicate.p,duplicate.slot,duplicate.slot.final);const other=actualNativeJsonSlot(duplicate.p,duplicate.ctx,'other.qmd',join(duplicate.root,'native-custom.json'),duplicate.slot.final);await writeNativeJsonIntent(duplicate.p,other,other.final);await reject(()=>captureNativeJsonIntents(duplicate.p,duplicate.ctx),'Two sources share an output');controls++;
 for(const kind of ['extra-field','mode','symlink'] as const){
  const g=await fixture(kind);await writeNativeJsonIntent(g.p,g.slot,g.slot.final);const path=join(g.p.directory,nativeJsonIntentDirectory,await nativeJsonIntentName('index.qmd'));
  if(kind==='extra-field'){const value=JSON.parse(await Deno.readTextFile(path));value.extra=true;await Deno.writeTextFile(path,JSON.stringify(value))}
  if(kind==='mode')await Deno.chmod(path,0o644);
  if(kind==='symlink'){await Deno.rename(path,join(top,'symlink-seed'));await Deno.symlink(join(top,'symlink-seed'),path)}
  await reject(()=>captureNativeJsonIntents(g.p,g.ctx),'Invalid intent '+kind+' accepted');controls++;
 }
 const parent=await fixture('parent'),held=await captureNativeJsonIntents(parent.p,parent.ctx),directory=join(parent.p.directory,nativeJsonIntentDirectory);
 try{await Deno.rename(directory,join(parent.p.directory,'retained-original'));await Deno.mkdir(directory,{mode:0o700});await reject(()=>held.check(),'Empty private directory inode replacement accepted')}finally{held.close()}controls++;
 console.log('PASS '+controls+' native JSON intent/held identity controls; file-only, not native export acceptance');
}finally{await Deno.remove(top,{recursive:true})}
