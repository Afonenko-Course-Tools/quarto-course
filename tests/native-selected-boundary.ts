/** File-only contract fixture; this is NOT a NativeRun or a native qualification. */
import {join} from 'stdlib/path';
import {captureSourceFiles,assertSourceFiles} from '../_extensions/course-core/infrastructure/owned-config-source.ts';
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
const reject=async(f:()=>Promise<unknown>,m:string)=>{let bad=false;try{await f()}catch{bad=true}assert(bad,m)};
const overlay=await Deno.readTextFile(new URL('../_extensions/course-core/infrastructure/owned-config-overlay.ts',import.meta.url));
// The role-loop callback must not recursively inventory unrelated source/vendor bytes.
const roleCall=overlay.slice(overlay.indexOf('sourceRoles=await captureSourceRoles('),overlay.indexOf('all=await writer.snapshot()'));
assert(!roleCall.includes('check:sourceCheck'),'RED: source-role loop repeats whole source/vendor inventory instead of local transaction checks');
const api=await import('../_extensions/course-core/infrastructure/common-path-selected.ts');
const root=await Deno.makeTempDir({prefix:'selected-boundary-'});
try{
 await Deno.mkdir(join(root,'bank'));await Deno.mkdir(join(root,'_extensions'));
 for(let i=0;i<128;i++)await Deno.writeTextFile(join(root,`bank/${i}.qmd`),`# ${i}\n`);
 await Deno.writeTextFile(join(root,'_quarto.yml'),'project: {type: book}\n');
 await Deno.writeTextFile(join(root,'shared.txt'),'Общее условие\n');
 await Deno.writeTextFile(join(root,'include.qmd'),'Фрагмент\n');
 await Deno.writeTextFile(join(root,'_extensions/runtime.ts'),'export {};\n');
 const source='bank/0.qmd',directory=join(root,'_generated/course-spec/native-runs/11111111-1111-4111-8111-111111111111');await Deno.mkdir(directory,{recursive:true});
 const hash=async(p:string)=>api.selectedHash(await Deno.readFile(p));
 const pointer:any={schema:'course-native-run-pointer-v2',projectRoot:root,directory,profiles:['full'],outputDirectory:join(root,'_out'),initialInputFiles:Array.from({length:128},(_,i)=>`bank/${i}.qmd`),renderAll:true,configurationHashes:{},commonPathBinding:{file:'common-files-path-binding.json',sha1:'a'.repeat(40),sha256:'b'.repeat(64)}};
 const row={source,format:'json',rawDeclarations:null,canonicalDeclarations:null,effectiveDeclarations:null};
 const files:Record<string,string|false>=Object.fromEntries(await Promise.all(['_quarto.yml','shared.txt','include.qmd'].map(async n=>[join(root,n),await hash(join(root,n))])));files[join(root,'bank/_metadata.yml')]=false;
 const witness:any={projectRoot:root,runDirectory:directory,profiles:['full'],outputDirectory:pointer.outputDirectory,documents:[row],sourceIdentities:{sources:[{source,physicalPath:join(root,source),linkTarget:null,nativeOwner:root,physicalInspectionHash:'c'.repeat(64)}]},sourceHashes:{[source]:await hash(join(root,source))},configurationInputs:{'_quarto.yml':files[join(root,'_quarto.yml')]},commonSourceHashes:{'shared.txt':files[join(root,'shared.txt')]},metadataClosure:{origins:[...Object.entries(files).map(([path,sha256])=>({path,sha256,context:{source:path.endsWith('_quarto.yml')?null:source,format:'json',declaredBy:null}}))]},nativeExtensionMetadata:{files:{}},canonicalOwnerDeclarations:null};
 pointer.commonPathDocuments=await api.publishSelectedCommonPaths(pointer,witness);
 await Deno.writeTextFile(join(root,'_generated/course-spec/active-native-run.json'),JSON.stringify(pointer));
 const baseline=await captureSourceFiles(root);
 let reads=0;const read=Deno.readFile;Deno.readFile=(async(...args:Parameters<typeof Deno.readFile>)=>{reads++;return await read(...args)}) as typeof Deno.readFile;
 try{const got=await api.readSelectedCommonPath(pointer,source,'json');assert(got.source===source,'selected row mismatch');assert(reads<30,'selected capture read unrelated full input inventory');console.log('selectedCaptureReadFileCalls='+reads+'; fixtureInputs=128')}finally{Deno.readFile=read}
 await Deno.writeTextFile(join(root,'bank/7.qmd'),'# unrelated drift\n');
 await api.readSelectedCommonPath(pointer,source,'json');
 await reject(()=>assertSourceFiles(root,baseline),'global END boundary missed unrelated source drift');
 for(const file of ['_quarto.yml','include.qmd','shared.txt']){
  const old=await Deno.readFile(join(root,file));await Deno.writeTextFile(join(root,file),'DRIFT');await reject(()=>api.readSelectedCommonPath(pointer,source,'json'),'selected closure drift accepted: '+file);await Deno.writeFile(join(root,file),old);
 }
 await Deno.writeTextFile(join(root,'bank/_metadata.yml'),'lang: ru\n');await reject(()=>api.readSelectedCommonPath(pointer,source,'json'),'new absent metadata origin accepted');await Deno.remove(join(root,'bank/_metadata.yml'));
 await reject(()=>api.readSelectedCommonPath({...pointer,outputDirectory:join(root,'foreign')},source,'json'),'foreign pointer binding accepted');
 await reject(()=>api.readSelectedCommonPath(pointer,source,'html'),'foreign format accepted');
 const ref=pointer.commonPathDocuments[0],path=join(directory,ref.file),old=await Deno.readFile(path);await Deno.writeTextFile(path,'{}');await reject(()=>api.readSelectedCommonPath(pointer,source,'json'),'selected record bytes mutation accepted');await reject(()=>api.assertSelectedCommonPaths(pointer,witness),'final boundary missed selected record mutation');await Deno.writeFile(path,old);
 await api.assertSelectedCommonPaths(pointer,witness);
 await Deno.rename(join(root,'include.qmd'),join(root,'saved-include'));await Deno.symlink('saved-include',join(root,'include.qmd'));await reject(()=>api.readSelectedCommonPath(pointer,source,'json'),'symlink metadata include accepted');await Deno.remove(join(root,'include.qmd'));await Deno.rename(join(root,'saved-include'),join(root,'include.qmd'));
 const sourceBytes=await Deno.readFile(join(root,source));await Deno.writeTextFile(join(root,source),'CHANGED');await reject(()=>api.readSelectedCommonPath(pointer,source,'json'),'selected source bytes drift accepted');await Deno.writeFile(join(root,source),sourceBytes);await Deno.rename(join(root,source),join(root,'saved-source'));await Deno.writeFile(join(root,source),sourceBytes);await reject(()=>api.readSelectedCommonPath(pointer,source,'json'),'same-bytes replaced source inode accepted');
 console.log('PASS selected file-only boundary: local read bound, selected/config/include/common/absence drift, pointer/format/hash binding, global END unrelated drift, final record revalidation');
}finally{await Deno.remove(root,{recursive:true})}
