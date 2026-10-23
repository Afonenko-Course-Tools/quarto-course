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
 const f=await fixture('native-ctime');const pause=(1000-Date.now()%1000)%1000;await new Promise(resolve=>setTimeout(resolve,pause+15));await Deno.chmod(join(f.root,'_quarto.yml'),0o644);const view=await openConfigEntryView(f.root,'_quarto.yml');
 try{
  const before=view.identity;await Deno.chmod(join(f.root,'_quarto.yml'),before.mode&0o7777);await reject(()=>view.check(),'full native ctime drift accepted');
  const after=await openConfigEntryView(f.root,'_quarto.yml');try{assert(before.ctime!==after.identity.ctime&&before.ctime.split(':')[0]===after.identity.ctime.split(':')[0],'not an actual same-second native-nanosecond control');assert(before.ino===after.identity.ino&&before.mode===after.identity.mode&&before.mtime===after.identity.mtime,'control changed identity beyond ctime')}finally{after.close()}
 }finally{view.close()}count++;
}
console.log(JSON.stringify({status:'PASS',focusedControls:count,scope:'ARCH86 EMPTY slots + immutable original-pair ctime; actual native same-second mutation refused; not export proof'}));
