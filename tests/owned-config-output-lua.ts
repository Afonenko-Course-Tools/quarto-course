/** Только Lua admission: synthetic descriptors НЕ являются NativeRun/capability. */
const repo=decodeURIComponent(new URL('../',import.meta.url).pathname).replace(/\/$/,''),root=await Deno.makeTempDir({prefix:'owned-config-output-lua-'}),quarto=Deno.env.get('QUARTO')||'quarto';
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
const hash=async(b:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1',new TextEncoder().encode(b)))).map(v=>v.toString(16).padStart(2,'0')).join('');
const overlay={kind:'owned-config-overlay-v1',sourceContext:{sha1:'a'.repeat(40),sha256:'b'.repeat(64)}};
const profile='course-export-11111111-1111-1111-1111-111111111111';
const cases:any[]=[];
async function fixture(name:string,change:(p:any,w:any)=>void=()=>{},extra?:{slot?:string;kind?:string;error?:string;nil?:boolean;legacy?:boolean;noPointer?:boolean}){
 const dir=root+'/'+name,run=dir+'/_generated/course-spec/native-runs/11111111-1111-1111-1111-111111111111';await Deno.mkdir(run,{recursive:true});
 const config='project: {type: default}\n',owned='format: json\n';await Deno.writeTextFile(dir+'/_quarto.yml',config);await Deno.writeTextFile(dir+'/_quarto-'+profile+'.yml',owned);
 const context=JSON.stringify({synthetic:'NOT_A_NATIVE_SOURCE_CONTEXT'}),o=structuredClone(overlay);o.sourceContext.sha1=await hash(context);await Deno.writeTextFile(run+'/owned-export-source-context.json',context);
 const p:any={schema:extra?.legacy?'course-native-run-pointer-v2':'course-native-run-pointer-v3',directory:run,projectRoot:dir,profiles:[profile],outputDirectory:dir+'/_out',initialInputFiles:['index.qmd'],renderAll:false,configurationHashes:{'_quarto.yml':await hash(config),'_quarto.yaml':false,['_quarto-'+profile+'.yml']:await hash(owned),['_quarto-'+profile+'.yaml']:false},ownedConfigOverlay:o,overlayState:'active'};
 const w:any={schema:'course-common-files-path-binding-v2',ownedConfigOverlay:structuredClone(o),sourceInspectionRefs:['c'.repeat(64)]};
 if(extra?.legacy){delete p.ownedConfigOverlay;delete p.overlayState;w.schema='course-common-files-path-binding-v1';delete w.ownedConfigOverlay;delete w.sourceInspectionRefs}
 change(p,w);const bytes=JSON.stringify(w);p.commonPathBinding={file:'common-files-path-binding.json',sha1:await hash(bytes),sha256:'d'.repeat(64)};
 await Deno.writeTextFile(run+'/common-files-path-binding.json',bytes);
 if(!extra?.noPointer)await Deno.writeTextFile(dir+'/_generated/course-spec/active-native-run.json',JSON.stringify(p));
 if(extra?.slot)await Deno.writeTextFile(run+'/'+extra.slot,'SYNTHETIC_NOT_PROOF');
 cases.push({name,root:dir,profiles:[profile],kind:extra?.kind||'current',error:extra?.error,nil:!!extra?.nil});
}
try{
 await fixture('ordinary-no-pointer',()=>{},{noPointer:true,nil:true});
 await fixture('legacy-v2-current',()=>{},{legacy:true});
 await fixture('active-v3-shape');
 const bad='NATIVE.RUN_POINTER_INVALID';
 for(const [name,change] of Object.entries({unknownkey:(p:any):unknown=>p.extra=true,missingoverlay:(p:any):unknown=>delete p.ownedConfigOverlay,wrongkind:(p:any):unknown=>p.ownedConfigOverlay.kind='future',extraref:(p:any):unknown=>p.ownedConfigOverlay.sourceContext.extra=true,badsha:(p:any):unknown=>p.ownedConfigOverlay.sourceContext.sha256='B'.repeat(64),pointerrefs:(p:any):unknown=>p.sourceInspectionRefs=[],badstate:(p:any):unknown=>p.overlayState='future',activefinalref:(p:any):unknown=>p.ownedConfigRestoration={file:'owned-export-restored-entry.json',sha1:'e'.repeat(40),sha256:'f'.repeat(64)}}))await fixture(name,change as any,{error:bad});
 await fixture('active-final-slot',()=>{},{slot:'owned-export-restored-entry.json',error:bad});
 await fixture('active-completed',()=>{},{slot:'native-run.json',error:bad});
 await fixture('restored-no-writer',(p)=>{p.overlayState='restored';p.ownedConfigRestoration={file:'owned-export-restored-entry.json',sha1:'e'.repeat(40),sha256:'f'.repeat(64)}},{nil:true});
 await fixture('restored-missing-ref',(p)=>p.overlayState='restored',{error:bad});
 await fixture('restored-unknown-ref',(p)=>{p.overlayState='restored';p.ownedConfigRestoration={file:'owned-export-restored-entry.json',sha1:'e'.repeat(40),sha256:'f'.repeat(64),extra:true}},{error:bad});
 await fixture('active-requires-full-proof',()=>{},{kind:'bound',error:'AUTHORITATIVE_TS_BRIDGE_REQUIRED'});
 for(const [name,change] of Object.entries({oldwitness:(_p:any,w:any):unknown=>w.schema='course-common-files-path-binding-v1',mismatch:(_p:any,w:any):unknown=>w.ownedConfigOverlay.sourceContext.sha256='e'.repeat(64),missingrefs:(_p:any,w:any):unknown=>delete w.sourceInspectionRefs,scalarrefs:(_p:any,w:any):unknown=>w.sourceInspectionRefs='c'.repeat(64),refextra:(_p:any,w:any):unknown=>w.ownedConfigOverlay.extra=true}))await fixture(name,change as any,{kind:'bound',error:'NATIVE.COMMON_PATH_BINDING_INVALID'});
 const driver=`local cases=pandoc.json.decode(assert(io.open(${JSON.stringify(root+'/cases.json')},'rb')):read('*a'))
package.path=${JSON.stringify(repo+'/_extensions/course-core/?.lua;')}..package.path
local output=require('./output')
local bridgeCalls=0
pandoc.pipe=function(command,args,input)
 assert(args[1]=='run' and args[2]:match('/entrypoints/common%-path%-binding%.ts$') and args[3]=='--' and args[4]=='--root' and args[6]=='--source' and args[8]=='--format' and input=='','BRIDGE_ARGV_CHANGED')
 bridgeCalls=bridgeCalls+1;error('AUTHORITATIVE_TS_BRIDGE_REQUIRED')
end
for _,case in ipairs(cases) do
 quarto={project={directory=case.root,profile=case.profiles},doc={input_file='index.qmd'}};FORMAT='json'
 local ok,result=pcall(function() if case.kind=='bound' then return output.bound_materialization({meta={}}) end;return output.current_run(case.root) end)
 if case.error then assert(not ok and tostring(result):find(case.error,1,true),case.name..': expected '..case.error..' got '..tostring(result))
 else assert(ok,case.name..': '..tostring(result));assert((result==nil)==case['nil'],case.name..': wrong enrollment') end
 io.stderr:write('PASS Lua descriptor only '..case.name..'\\n')
end
assert(bridgeCalls==1,'Malformed descriptor reached full bridge or full bridge bypassed')
return {{Pandoc=function(doc) return doc end}}
`;
 await Deno.writeTextFile(root+'/cases.json',JSON.stringify(cases));await Deno.writeTextFile(root+'/driver.lua',driver);
 const child=await new Deno.Command(quarto,{args:['pandoc','--from','markdown','--to','json','--lua-filter',root+'/driver.lua'],stdin:'piped',stdout:'piped',stderr:'piped'}).spawn();await child.stdin.close();const r=await child.output();const text=new TextDecoder().decode(r.stderr);console.log(text);assert(r.success,text);console.log('PASS',cases.length,'Lua descriptor controls; synthetic only, native integration OPEN');
}finally{await Deno.remove(root,{recursive:true})}
