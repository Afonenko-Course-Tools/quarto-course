import { join } from 'stdlib/path';
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
let api:any;try{api=await import('../_extensions/course-core/infrastructure/owned-config-entry.ts')}catch(e){if(!(e instanceof TypeError))throw e}
assert(typeof api?.beginConfigEntry==='function','RED: Core821 lacks the controlled same-owner config-entry transaction');
const root=Deno.env.get('COURSE_CONFIG_ENTRY_TEST_ROOT')||await Deno.makeTempDir({prefix:'owned-config-entry-'});
await Deno.mkdir(root,{recursive:true,mode:0o700});
const source='project:\n  type: book\n  post-render: [one.ts, two.ts, three.ts]\n';
const bytes=new TextEncoder().encode(source),execution=new TextEncoder().encode('{"project":{"type":"default"}}');
const fixture=async(name:string)=>{const r=join(root,name);await Deno.mkdir(r,{mode:0o700});await Deno.writeTextFile(join(r,'_quarto.yml'),source,{createNew:true,mode:0o6750});await Deno.chmod(join(r,'_quarto.yml'),0o6750);return r};
const rejected=async(action:()=>Promise<unknown>,reason:string)=>{let rejected=false;try{await action()}catch{rejected=true}assert(rejected,reason)};
{
 const r=await fixture('roundtrip'),before=await Deno.lstat(join(r,'_quarto.yml')),t=await api.beginConfigEntry(r,'_quarto.yml');
 try{assert(new TextDecoder().decode(t.source.bytes)===source,'original bytes');await t.prepare(execution);await t.quarantineSource();await t.installExecution();await t.checkActive();assert(await Deno.readTextFile(join(r,'_quarto.yml'))===new TextDecoder().decode(execution),'execution bytes');await t.quarantineExecution();await t.restoreSource();await t.checkRestored();const after=await Deno.lstat(join(r,'_quarto.yml'));assert(before.ino===after.ino&&before.dev===after.dev&&before.uid===after.uid&&before.gid===after.gid&&before.mode===after.mode,'restore inode/owner/fullmode');assert(await Deno.readTextFile(join(r,'_quarto.yml'))===source,'restore exact bytes');await rejected(()=>t.retire(undefined), 'release without retained backup accepted');const backup=join(r,'_generated/course-spec/native-runs/11111111-1111-4111-8111-111111111111/owned-export-source-config.raw');await Deno.mkdir(join(backup,'..'),{recursive:true,mode:0o700});await Deno.writeFile(backup,bytes,{createNew:true,mode:0o600});await t.retire(backup);await t.verifyRetired()}finally{t.close()}
}
{
 const r=await fixture('foreign-before-activation'),t=await api.beginConfigEntry(r,'_quarto.yml');
 try{await t.prepare(execution);await Deno.rename(join(r,'_quarto.yml'),join(r,'old-original'));await Deno.writeTextFile(join(r,'_quarto.yml'),source,{createNew:true});await rejected(()=>t.quarantineSource(),'same bytes foreign inode accepted');assert(await Deno.readTextFile(join(r,'_quarto.yml'))===source,'foreign inode bytes lost')}finally{t.close()}
}
{
 const r=await fixture('install-collision'),t=await api.beginConfigEntry(r,'_quarto.yml');
 try{await t.prepare(execution);await t.quarantineSource();await Deno.writeTextFile(join(r,'_quarto.yml'),'FOREIGN',{createNew:true});await rejected(()=>t.installExecution(),'install overwrote foreign config');assert(await Deno.readTextFile(join(r,'_quarto.yml'))==='FOREIGN','foreign install bytes lost');assert(await Deno.readTextFile(join(t.leasePath,'quarantined-source'))===source,'original quarantine lost')}finally{t.close()}
}
{
 const r=await fixture('restore-collision'),t=await api.beginConfigEntry(r,'_quarto.yml');
 try{await t.prepare(execution);await t.quarantineSource();await t.installExecution();await t.quarantineExecution();await Deno.writeTextFile(join(r,'_quarto.yml'),'FOREIGN-RESTORE',{createNew:true});await rejected(()=>t.restoreSource(),'restore overwrote foreign config');assert(await Deno.readTextFile(join(r,'_quarto.yml'))==='FOREIGN-RESTORE','foreign restore bytes lost');assert(await Deno.readTextFile(join(t.leasePath,'quarantined-source'))===source,'source backup lost')}finally{t.close()}
}
{
 const r=await fixture('orphan-lease'),t=await api.beginConfigEntry(r,'_quarto.yml');t.close();await rejected(()=>api.beginConfigEntry(r,'_quarto.yml'),'orphan lease accepted');assert(await Deno.readTextFile(join(r,'_quarto.yml'))===source,'orphan refusal changed source');
}
{
 const r=await fixture('local-refusal');await Deno.writeTextFile(join(r,'_quarto.yml.local'),'project: {}\n',{createNew:true});await rejected(()=>api.beginConfigEntry(r,'_quarto.yml'),'.local not refused');assert(await Deno.readTextFile(join(r,'_quarto.yml'))===source,'local refusal changed source');
}
{
 const r=await fixture('local-after-lease'),t=await api.beginConfigEntry(r,'_quarto.yml');try{await t.prepare(execution);await Deno.writeTextFile(join(r,'_quarto.yml.local'),'foreign: true\n',{createNew:true});await rejected(()=>t.quarantineSource(),'new .local accepted during transaction');assert(await Deno.readTextFile(join(r,'_quarto.yml'))===source,'late local refusal changed source')}finally{t.close()}
}
{
 const r=await fixture('foreign-lease'),t=await api.beginConfigEntry(r,'_quarto.yml');try{await t.prepare(execution);await Deno.rename(t.leasePath,t.leasePath+'-saved');await Deno.mkdir(t.leasePath,{mode:0o700});await Deno.writeTextFile(join(t.leasePath,'foreign'),'FOREIGN',{createNew:true});await rejected(()=>t.quarantineSource(),'foreign lease inode accepted');assert(await Deno.readTextFile(join(r,'_quarto.yml'))===source,'foreign lease refusal changed source');assert(await Deno.readTextFile(join(t.leasePath,'foreign'))==='FOREIGN','foreign lease changed')}finally{t.close()}
}
{
 const r=await fixture('same-inode-ctime-drift'),t=await api.beginConfigEntry(r,'_quarto.yml');try{await t.prepare(execution);const path=join(r,'_quarto.yml');await Deno.chmod(path,0o6751);await Deno.chmod(path,0o6750);await rejected(()=>t.quarantineSource(),'same inode restoredmode foreign ctime drift accepted');assert(await Deno.readTextFile(path)===source,'ctime refusal changed source')}finally{t.close()}
}
{
 const r=await fixture('loader-environment-drift'),t=await api.beginConfigEntry(r,'_quarto.yml'),old=Deno.env.get('LD_LIBRARY_PATH');try{Deno.env.set('LD_LIBRARY_PATH','not-used-by-test');await rejected(()=>t.prepare(execution),'loader environment drift accepted');assert(await Deno.readTextFile(join(r,'_quarto.yml'))===source,'loader drift changed source')}finally{if(old===undefined)Deno.env.delete('LD_LIBRARY_PATH');else Deno.env.set('LD_LIBRARY_PATH',old);t.close()}
}
{
 const r=await fixture('bounded-source-before-allocation');const path=join(r,'_quarto.yml'),fd=await Deno.open(path,{write:true});try{await fd.truncate(16*1024*1024+1)}finally{fd.close()}const old=await Deno.lstat(path);await rejected(()=>api.beginConfigEntry(r,'_quarto.yml'),'unbounded source config accepted');const after=await Deno.lstat(path);assert(old.ino===after.ino&&old.size===after.size,'oversize refusal changed source');let generated=false;try{await Deno.lstat(join(r,'_generated'));generated=true}catch(e){if(!(e instanceof Deno.errors.NotFound))throw e}assert(!generated,'oversize refusal wrote owner');
}
{
 const r=await fixture('retired-private-foreign-entry'),t=await api.beginConfigEntry(r,'_quarto.yml');try{await t.prepare(execution);await t.quarantineSource();await t.installExecution();await t.quarantineExecution();await t.restoreSource();const run=join(r,'_generated/course-spec/native-runs/22222222-2222-4222-8222-222222222222');await Deno.mkdir(run,{recursive:true,mode:0o700});const backup=join(run,'owned-export-source-config.raw');await Deno.writeFile(backup,bytes,{createNew:true,mode:0o600});await t.retire(backup);const q=join(run,'owned-export-config-quarantine');await Deno.rename(join(q,'source.raw'),join(r,'saved-source.raw'));await Deno.writeTextFile(join(q,'source.raw'),'FOREIGN-PRIVATE',{createNew:true,mode:0o600});await rejected(()=>t.verifyRetired(),'foreign entry after validation was accepted');assert(await Deno.readTextFile(join(q,'source.raw'))==='FOREIGN-PRIVATE','foreign private entry deleted');assert(await Deno.readTextFile(join(r,'saved-source.raw'))===source&&await Deno.readTextFile(backup)===source,'source backups lost');assert(await Deno.readTextFile(join(r,'_quarto.yml'))===source,'restored source lost')}finally{t.close()}
}
{
 const r=await fixture('retired-private-samebytes-inode'),t=await api.beginConfigEntry(r,'_quarto.yml');try{await t.prepare(execution);await t.quarantineSource();await t.installExecution();await t.quarantineExecution();await t.restoreSource();const run=join(r,'_generated/course-spec/native-runs/33333333-3333-4333-8333-333333333333');await Deno.mkdir(run,{recursive:true,mode:0o700});const backup=join(run,'owned-export-source-config.raw');await Deno.writeFile(backup,bytes,{createNew:true,mode:0o600});await t.retire(backup);const raw=join(run,'owned-export-config-quarantine/source.raw');await Deno.rename(raw,join(r,'saved-source.raw'));await Deno.writeFile(raw,bytes,{createNew:true,mode:0o600});await rejected(()=>t.verifyRetired(),'samebytes foreign private inode accepted');assert(await Deno.readTextFile(raw)===source&&await Deno.readTextFile(join(r,'saved-source.raw'))===source,'private inode refusal lost bytes')}finally{t.close()}
}
console.log('PASS 13 config-entry controls: exact restore/fullmode, foreign inode/lease, collision, .local, ctime и loader environment');
