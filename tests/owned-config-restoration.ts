import {join} from 'stdlib/path';
import {beginConfigEntry} from '../_extensions/course-core/infrastructure/owned-config-entry.ts';
import {validateRestorationRecord,validateCompletedRestorationRefs} from '../_extensions/course-core/infrastructure/owned-config-proof.ts';
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
const reject=(f:()=>unknown,m:string)=>{let bad=false;try{f()}catch{bad=true}assert(bad,m)};
const root=Deno.env.get('COURSE_CONFIG_RESTORATION_ROOT');if(!root)throw Error('Нужен свежий fixture root');await Deno.mkdir(root,{mode:0o700});
const source=new TextEncoder().encode('project:\n  type: book\n'),execution=new TextEncoder().encode('{"project":{"type":"default"}}');await Deno.writeFile(join(root,'_quarto.yml'),source,{createNew:true,mode:0o6750});await Deno.chmod(join(root,'_quarto.yml'),0o6750);
const t=await beginConfigEntry(root,'_quarto.yml');
try{
 assert(typeof (t as any).restoredEntry==='function','RED: no exact final anchored EntryIdentity for bound restoration');
 await t.prepare(execution);await t.quarantineSource();await t.installExecution();await t.quarantineExecution();await t.restoreSource();
 const restored=await (t as any).restoredEntry();
 const digest=async(b:Uint8Array,alg:string)=>Array.from(new Uint8Array(await crypto.subtle.digest(alg,new Uint8Array(b).buffer)),x=>x.toString(16).padStart(2,'0')).join('');
 const hashes=async(b:Uint8Array)=>({sha1:await digest(b,'SHA-1'),sha256:await digest(b,'SHA-256')});
 const run=join(root,'_generated/course-spec/native-runs/11111111-1111-4111-8111-111111111111');
 // Shape/relation unit inputs, НЕ captured NativeRun и НЕ restoration capability.
 const bound={projectRoot:root,runDirectory:run,file:'_quarto.yml' as const,sourceContext:await hashes(new TextEncoder().encode('unit-source-context')),sourceConfig:await hashes(source),executionConfig:await hashes(execution),originalEntry:t.source.identity};
 const record={schema:'course-owned-export-restored-entry-v1',...bound,restoredEntry:restored};validateRestorationRecord(record,bound);
 for(const field of ['ino','devMajor','devMinor','uid','gid','mode','size','mtime']){
  const changed=structuredClone(record);changed.restoredEntry[field]=typeof changed.restoredEntry[field]==='number'?changed.restoredEntry[field]+1:field==='mtime'?'1:1':String(BigInt(changed.restoredEntry[field])+1n);
  reject(()=>validateRestorationRecord(changed,bound),'changed original identity '+field+' accepted');
 }
 for(const changed of [{...record,extra:true},{...record,runDirectory:root},{...record,sourceContext:{...record.sourceContext,sha256:'f'.repeat(64)}},{...record,restoredEntry:{...record.restoredEntry,ctime:'invalid'}}])reject(()=>validateRestorationRecord(changed,bound),'foreign/malformed restored record accepted');
 const invalidIdentity={...t.source.identity,mode:-32768},badBound={...bound,originalEntry:invalidIdentity};reject(()=>validateRestorationRecord({...record,originalEntry:invalidIdentity,restoredEntry:{...invalidIdentity}},badBound),'negative mode accepted as EntryIdentity');
 const ref={file:'owned-export-restored-entry.json',...await hashes(new TextEncoder().encode(JSON.stringify(record)))};
 const pointer={schema:'course-native-run-pointer-v3',overlayState:'restored',directory:run,ownedConfigRestoration:ref};const copy={directory:run,ownedConfigRestoration:ref};validateCompletedRestorationRefs(pointer,copy,copy);
 reject(()=>validateCompletedRestorationRefs({...pointer,ownedConfigRestoration:{...ref,sha256:'e'.repeat(64)}},copy,copy),'pointer-only record refresh accepted');
 reject(()=>validateCompletedRestorationRefs(pointer,{...copy,directory:root},copy),'foreign completed copy accepted');
 reject(()=>validateCompletedRestorationRefs({...pointer,overlayState:'active'},copy,copy),'active completion accepted');
 await Deno.mkdir(run,{recursive:true,mode:0o700});const backup=join(run,'owned-export-source-config.raw');await Deno.writeFile(backup,source,{createNew:true,mode:0o600});await t.retire(backup);await t.verifyRetired();
 console.log('PASS: actual anchored same-inode/fullmode restoration identity; closed record relations and both completed-ref bindings; unit proof only.');
}finally{t.close()}
