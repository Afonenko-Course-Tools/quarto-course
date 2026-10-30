/** Настоящий config transaction: EMPTY cleanup сохраняет inode и все чужие bytes. */
import {join} from 'stdlib/path';
import {beginConfigEntry} from '../_extensions/course-core/infrastructure/owned-config-entry.ts';
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
const reject=async(use:()=>Promise<unknown>,message:string)=>{let refused=false;try{await use()}catch{refused=true}assert(refused,message)};
const top=await Deno.makeTempDir({prefix:'owned-empty-quarantine-'}),source='project: {type: book}\n';
async function fixture(name:string){
 const root=join(top,name),destination=join(root,'_generated/course-spec/native-runs/11111111-1111-4111-8111-111111111111/aborted-native-empty');
 await Deno.mkdir(root);await Deno.writeTextFile(join(root,'_quarto.yml'),source);const t=await beginConfigEntry(root,'_quarto.yml');
 await t.prepare(new TextEncoder().encode('project: {type: default}\n'));await t.quarantineSource();await t.installExecution();await t.quarantineExecution();await t.restoreSource();await Deno.mkdir(destination,{recursive:true,mode:0o700});
 return {root,destination,t};
}
try{
 const f=await fixture('lawful');try{
  await Deno.mkdir(join(f.root,'index_files/mediabag'),{recursive:true,mode:0o755});const before=await Deno.lstat(join(f.root,'index_files'));
  const result=await f.t.quarantineEmptyNativeOutput('index_files',f.destination),after=await Deno.lstat(join(f.destination,result.quarantine));
  assert(before.ino===after.ino&&before.dev===after.dev&&before.mode===after.mode,'Native empty inode changed');
  assert((await Deno.lstat(join(f.destination,result.quarantine,'mediabag'))).isDirectory,'Empty child lost');
  try{await Deno.lstat(join(f.root,'index_files'));throw Error('Native directory still in source')}catch(e){if(!(e instanceof Deno.errors.NotFound))throw e}
  assert(await Deno.readTextFile(join(f.root,'_quarto.yml'))===source,'Cleanup changed restored config');
 }finally{f.t.close()}
 for(const kind of ['nonempty','linked','linked-parent','mode'] as const){
  const f=await fixture(kind);try{
   await Deno.mkdir(join(f.root,'foreign'));await Deno.writeTextFile(join(f.root,'foreign/sentinel'),'FOREIGN_BYTES');let name='index_files';
   if(kind==='linked')await Deno.symlink(join(f.root,'foreign'),join(f.root,name));
   else if(kind==='linked-parent'){await Deno.mkdir(join(f.root,'foreign/index_files'));await Deno.symlink(join(f.root,'foreign'),join(f.root,'alias'));name='alias/index_files'}
   else{await Deno.mkdir(join(f.root,name),{mode:0o755});if(kind==='nonempty')await Deno.writeTextFile(join(f.root,name,'sentinel'),'AUTHORED_BYTES');else await Deno.chmod(join(f.root,name),0o777)}
   await reject(()=>f.t.quarantineEmptyNativeOutput(name,f.destination),'Unsafe native empty cleanup '+kind);
   assert(await Deno.readTextFile(join(f.root,'foreign/sentinel'))==='FOREIGN_BYTES','Foreign bytes changed '+kind);
   if(kind==='nonempty')assert(await Deno.readTextFile(join(f.root,name,'sentinel'))==='AUTHORED_BYTES','Nonempty directory damaged');
   const names=[];for await(const e of Deno.readDir(f.destination))names.push(e.name);assert(names.length===0,'Rejected cleanup moved entry '+kind);
  }finally{f.t.close()}
 }
 {
  const dlopen=Deno.dlopen;let root='',armed=false,executed=false;
  (Deno as any).dlopen=(...args:any[])=>{
   const library=(dlopen as any)(...args),symbols=library.symbols;
   if(!symbols.renameat2)return library;
   return {symbols:{...symbols,renameat2:(...values:any[])=>{
    const name=new TextDecoder().decode(values[1]).replace(/\0.*$/,'');
    if(armed&&name==='index_files'){
     armed=false;executed=true;Deno.renameSync(join(root,'index_files'),join(root,'saved-native-original'));
     Deno.mkdirSync(join(root,'index_files'),{mode:0o755});Deno.writeTextFileSync(join(root,'index_files/sentinel'),'FOREIGN_RACE_BYTES');
    }
    return symbols.renameat2(...values);
   }},close:()=>library.close()};
  };
  let f:Awaited<ReturnType<typeof fixture>>|undefined;
  try{
   f=await fixture('namespace-race');root=f.root;await Deno.mkdir(join(root,'index_files'),{mode:0o755});const before=await Deno.lstat(join(root,'index_files'));armed=true;
   await reject(()=>f!.t.quarantineEmptyNativeOutput('index_files',f!.destination),'Namespace race accepted as owned EMPTY');
   assert(executed,'Namespace race did not execute');assert((await Deno.lstat(join(root,'saved-native-original'))).ino===before.ino,'Original native directory lost');
   const names=[];for await(const entry of Deno.readDir(f.destination))names.push(entry.name);assert(names.length===1,'Race entry not preserved in quarantine');
   assert(await Deno.readTextFile(join(f.destination,names[0],'sentinel'))==='FOREIGN_RACE_BYTES','Race bytes lost');assert(await Deno.readTextFile(join(root,'_quarto.yml'))===source,'Race changed source config');
  }finally{(Deno as any).dlopen=dlopen;f?.t.close()}
 }
 {
  const f=await fixture('expired');try{
   const backup=join(f.root,'_generated/course-spec/native-runs/11111111-1111-4111-8111-111111111111/owned-export-source-config.raw');await Deno.writeTextFile(backup,source,{createNew:true,mode:0o600});
   await f.t.retire(backup);await f.t.verifyRetired();await Deno.mkdir(join(f.root,'index_files'),{mode:0o755});
   await reject(()=>f.t.quarantineEmptyNativeOutput('index_files',f.destination),'Retired transaction still authorized native cleanup');
   assert((await Deno.lstat(join(f.root,'index_files'))).isDirectory,'Retired cleanup moved source entry');
  }finally{f.t.close()}
 }
 console.log('PASS actual native EMPTY quarantine; inode preserved; nonempty/symlink/parent/mode refused; raced foreign bytes preserved with refusal');
}finally{await Deno.remove(top,{recursive:true})}
