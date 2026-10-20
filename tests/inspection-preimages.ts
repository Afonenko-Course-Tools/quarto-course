import {join} from 'stdlib/path';
import {storeInspection,checkInspectionStore} from '../_extensions/course-core/infrastructure/inspection-preimages.ts';
const root=await Deno.makeTempDir({prefix:'inspection-preimages-'}),refs=new Set<string>();
const assert=(v:unknown,s:string)=>{if(!v)throw Error(s)};
async function refuse(name:string,fn:()=>Promise<unknown>){let no=false;try{await fn()}catch{no=true}assert(no,'Accepted '+name);console.log('REFUSED',name)}
const text=' {"quarto":{"version":"1"}}\n',h=await storeInspection(root,text,refs);
assert(h===await storeInspection(root,text,refs)&&refs.size===1,'Same-H not deduplicated');
const path=join(root,'inspections/sha256',h+'.json'),before=await Deno.readFile(path);
assert(new TextDecoder().decode(before)===text,'Preimage changed');await checkInspectionStore(root,refs);
await Deno.writeTextFile(path,text+' ');await refuse('changed bytes',()=>checkInspectionStore(root,refs));await Deno.writeFile(path,before);
await Deno.chmod(path,0o644);await refuse('mode',()=>checkInspectionStore(root,refs));await Deno.chmod(path,0o600);
await Deno.rename(path,path+'.held');await refuse('missing/extra suffix',()=>checkInspectionStore(root,refs));await Deno.symlink(path+'.held',path);await refuse('symlink blob',()=>checkInspectionStore(root,refs));await Deno.remove(path);await Deno.rename(path+'.held',path);
await Deno.writeTextFile(join(root,'inspections/sha256','extra.json'),text);await refuse('extra',()=>checkInspectionStore(root,refs));await Deno.remove(join(root,'inspections/sha256','extra.json'));
await Deno.rename(join(root,'inspections/sha256'),join(root,'saved'));await Deno.symlink(join(root,'saved'),join(root,'inspections/sha256'));await refuse('linked parent',()=>checkInspectionStore(root,refs));await Deno.remove(join(root,'inspections/sha256'));await Deno.rename(join(root,'saved'),join(root,'inspections/sha256'));
await Deno.chmod(join(root,'inspections'),0o755);await refuse('directory mode',()=>checkInspectionStore(root,refs));await Deno.chmod(join(root,'inspections'),0o700);
await refuse('foreign run absent store',async()=>checkInspectionStore(await Deno.makeTempDir(),refs));await checkInspectionStore(root,refs);await Deno.remove(root,{recursive:true});console.log('PASS exact private preimages and closed inventory');
