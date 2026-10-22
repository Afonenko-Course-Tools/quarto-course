import {join} from 'stdlib/path';
import {withInspectionWriter,withInspectionSnapshot,inspectionSnapshotData,checkInspectionStore,storeInspection} from '../_extensions/course-core/infrastructure/inspection-preimages.ts';
const assert=(v:unknown,s:string)=>{if(!v)throw Error(s)};
async function refuse(s:string,f:()=>Promise<unknown>|unknown){let no=false;try{await f()}catch(e){assert(String(e).includes('NATIVE.COMMON_PATH_BINDING_INVALID'),String(e));no=true}assert(no,'Принято '+s);console.log('REFUSED',s)}
const root=await Deno.makeTempDir({prefix:'inspection-transaction-'}),other=await Deno.makeTempDir();
try{
 let saved:any,reads=0;const read=Deno.readFile;(Deno as any).readFile=async(path:any)=>{if(String(path).includes('/inspections/sha256/'))reads++;return await read(path)};
 await withInspectionWriter(root,async writer=>{
  const refs:string[]=[];
  for(let i=0;i<8;i++)refs.push(await writer.append(JSON.stringify({quarto:{version:'1'},i})));
  assert(reads===8,'Append перечитывает прежние blobs: '+reads);
  const all=await writer.snapshot();assert(reads===16&&Object.isFrozen(all)&&Object.isFrozen(all[refs[0]].quarto),'Snapshot не immutable/полный');
  await refuse('reentrant writer',()=>withInspectionWriter(root,async()=>{}));
  const path=join(root,'inspections/sha256',refs[0]+'.json'),before=await read(path);await Deno.writeTextFile(path,new TextDecoder().decode(before).replace('"1"','"2"'));
  await refuse('same-length old blob перед границей',()=>writer.snapshot());await refuse('same-H existing blob collision',()=>writer.append(new TextDecoder().decode(before)));await Deno.writeFile(path,before);
  saved=writer;
 });
 await refuse('expired writer',()=>saved.append('{}'));
 const entries=[...Deno.readDirSync(join(root,'inspections/sha256'))].map(x=>x.name.slice(0,-5)),refs=new Set(entries),binding={nonce:'one'};
 let retained:any;
 await withInspectionSnapshot(root,refs,binding,async phase=>{
  retained=phase;const all=inspectionSnapshotData(phase,root,refs,binding);assert(Object.isFrozen(all),'Mutable snapshot');
  await refuse('foreign root',()=>inspectionSnapshotData(phase,other,refs,binding));
  await refuse('foreign reference set',()=>inspectionSnapshotData(phase,root,new Set(),binding));
  await refuse('foreign identity',()=>inspectionSnapshotData(phase,root,refs,{nonce:'one'}));
  await refuse('reentrant phase',()=>withInspectionSnapshot(root,refs,binding,async()=>{}));
  binding.nonce='two';await refuse('mutated binding',()=>inspectionSnapshotData(phase,root,refs,binding));binding.nonce='one';
 });
 await refuse('expired phase',()=>inspectionSnapshotData(retained,root,refs,binding));
 await refuse('fabricated phase',()=>inspectionSnapshotData({} as any,root,refs,binding));
 const path=join(root,'inspections/sha256',entries[0]+'.json'),before=await read(path);await Deno.writeFile(path,new Uint8Array([...before,32]));
 await refuse('unowned direct reader remains fresh',()=>checkInspectionStore(root,refs));await refuse('unowned append remains fresh',()=>storeInspection(root,'{}',refs));await Deno.writeFile(path,before);
 (Deno as any).readFile=read;console.log('PASS finite private inspection transactions, fresh boundary, append reads linear');
}finally{await Deno.remove(root,{recursive:true});await Deno.remove(other,{recursive:true})}
