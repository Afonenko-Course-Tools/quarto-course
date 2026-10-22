import {join,resolve} from 'stdlib/path';
const runtime=Deno.env.get('CURRENTNESS_RUNTIME')||new URL('../_extensions/course-core/infrastructure/native-run.ts',import.meta.url).href;
const {beginNativeRun,commonPathDocument}=await import(runtime);
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
async function executable(requested:string){
 const paths=requested.includes('/')||requested.includes('\\')?[resolve(requested)]:(Deno.env.get('PATH')||'').split(Deno.build.os==='windows'?';':':').map(dir=>resolve(dir||'.',requested));
 for(const path of paths)try{if((await Deno.stat(path)).isFile)return await Deno.realPath(path)}catch(e){if(!(e instanceof Deno.errors.NotFound))throw e}
 throw Error('Не найден исполняемый инструмент '+requested);
}
// Фиксируем фактический harness tool до установки wrapper; рекурсии QUARTO нет.
const actualQuarto=await executable(Deno.env.get('QUARTO')||'quarto'),python=await executable(Deno.env.get('QUARTO_PYTHON')||'python3');

const out=Deno.env.get('CURRENTNESS_OUTPUT')||await Deno.makeTempDir({prefix:'currentness-transaction-native-'}),root=join(out,'fixture');await Deno.mkdir(join(root,'bank'),{recursive:true});await Deno.mkdir(join(root,'common'),{recursive:true});await Deno.mkdir(join(root,'_extensions/passive'),{recursive:true});
const files:Record<string,string>={'_quarto.yml':'project:\n  type: default\n  render: [index.qmd, bank/item.qmd]\n  output-dir: _site\nformat: html\n','_quarto-full.yml':'metadata-files: [_grading.yaml, absent.yaml]\n','_grading.yaml':'title: Проверка currentness\n','index.qmd':'# Начало\n','bank/item.qmd':'# Один\n\n{{< include ../common/preamble.md >}}\n','bank/_metadata.yml':'description: Наследование\n','common/preamble.md':'Публичный фрагмент.\n','_extensions/passive/_extension.yml':'title: Passive\nversion: 0.0.1\ncontributes: {filters: [noop.lua]}\n','_extensions/passive/noop.lua':'return {}\n'};
for(const [name,text] of Object.entries(files))await Deno.writeTextFile(join(root,name),text);
Deno.env.set('QUARTO_PROFILE','full');Deno.env.set('QUARTO_PROJECT_INPUT_FILES',['index.qmd','bank/item.qmd'].map(s=>join(root,s)).join('\n'));Deno.env.set('QUARTO_PROJECT_OUTPUT_DIR','_site');Deno.env.set('QUARTO_PROJECT_RENDER_ALL','1');Deno.env.set('QUARTO',actualQuarto);await beginNativeRun(root);
const pp=join(root,'_generated/course-spec/active-native-run.json'),pb=await Deno.readTextFile(pp),p=JSON.parse(pb),wp=join(p.directory,'common-files-path-binding.json'),wb=await Deno.readTextFile(wp),preimage=join(p.directory,'inspections/sha256', [...Deno.readDirSync(join(p.directory,'inspections/sha256'))][0].name),prebytes=await Deno.readFile(preimage);
const wrapper=join(out,'quarto-wrapper'),script=join(out,'wrapper.py'),control=join(out,'control.json');
await Deno.writeTextFile(script,`import sys,json,subprocess,pathlib,os,time\nf=pathlib.Path(${JSON.stringify(control)});c=json.loads(f.read_text())\nif sys.argv[1]=='inspect':\n c['count']+=1\n if c['count']==c['at']:\n  c['triggered']=True;f.write_text(json.dumps(c))\n  for op in c.get('ops',[]):\n   p=pathlib.Path(op['path']);k=op['kind']\n   if k=='append':p.write_bytes(p.read_bytes()+op['data'].encode())\n   elif k=='write':p.write_text(op['data'])\n   elif k=='delete':p.unlink()\n   elif k=='chmod':p.chmod(op['mode'])\n   elif k=='symlink':p.rename(str(p)+'.held');p.symlink_to(op['target'])\n   elif k=='pointer':\n    v=json.loads(p.read_text());v[op['field']]=op['value'];p.write_text(json.dumps(v))\n  if c.get('parentEnv'):\n   pathlib.Path(c['signal']).write_text('ready')\n   for i in range(3000):\n    if pathlib.Path(c['release']).exists():break\n    time.sleep(.01)\n   else:sys.exit(98)\n else:f.write_text(json.dumps(c))\nr=subprocess.run([${JSON.stringify(actualQuarto)},*sys.argv[1:]])\nsys.exit(r.returncode)\n`);
const quote=(s:string)=>"'"+s.replaceAll("'","'\\''")+"'";
const wrapperText='#!/bin/sh\nexec '+quote(python)+' '+quote(script)+' "$@"\n';await Deno.writeTextFile(wrapper,wrapperText,{mode:0o700});await Deno.chmod(wrapper,0o700);Deno.env.set('QUARTO',wrapper);
const op=(kind:string,path:string,rest:Record<string,unknown>={})=>({kind,path,...rest});const append=(name:string)=>[op('append',join(root,name),{data:'\ncurrentness-drift: true\n'})];
const scenarios:any[]=[
 {name:'source-between-A-B',ops:append('bank/item.qmd')},
 {name:'include-between-A-B',ops:append('common/preamble.md')},
 {name:'config-between-A-B',ops:append('_quarto.yml')},
 {name:'profile-between-A-B',ops:append('_quarto-full.yml')},
 {name:'supplemental-between-A-B',ops:append('_grading.yaml')},
 {name:'directory-between-A-B',ops:append('bank/_metadata.yml')},
 {name:'absent-present-between-A-B',ops:[op('write',join(root,'absent.yaml'),{data:'title: Возникший metadata\n'})]},
 {name:'nested-owner-between-A-B',ops:[op('write',join(root,'bank/_quarto.yml'),{data:'project: {type: default}\n'})]},
 {name:'descriptor-between-A-B',ops:append('_extensions/passive/_extension.yml')},
 {name:'pointer-run-swap',ops:[op('pointer',pp,{field:'directory',value:p.directory+'-other'})]},
 {name:'pointer-profile-swap',ops:[op('pointer',pp,{field:'profiles',value:['student']})]},
 {name:'witness-between-A-B',ops:[op('append',wp,{data:' '})]},
 {name:'preimage-bytes-during-A',at:1,ops:[op('append',preimage,{data:' '})]},
 {name:'preimage-mode-between-A-B',ops:[op('chmod',preimage,{mode:0o644})]},
 {name:'preimage-missing-between-A-B',ops:[op('delete',preimage)]},
 {name:'preimage-extra-between-A-B',ops:[op('write',join(p.directory,'inspections/sha256','0'.repeat(64)+'.json'),{data:'{}'})]},
 {name:'same-bytes-leaf-retarget',ops:[op('symlink',join(root,'index.qmd'),{target:join(root,'same.md')})]},
 {name:'linked-parent',ops:[op('symlink',join(root,'bank'),{target:join(root,'bank.held')})]},
 {name:'source-membership-config',ops:[op('write',join(root,'_quarto.yml'),{data:files['_quarto.yml'].replace('index.qmd, bank/item.qmd','index.qmd')})]},
 {name:'invoked-tool-bytes',ops:[op('append',wrapper,{data:'# изменённый invoked tool\n'})]},
 {name:'parent-environment',parentEnv:{name:'QUARTO_PROFILE',value:'student'},ops:[]},
 {name:'parent-tool-environment',parentEnv:{name:'QUARTO',value:actualQuarto},ops:[]}
];
await Deno.writeTextFile(join(root,'same.md'),files['index.qmd']);const only=Deno.env.get('CURRENTNESS_SCENARIO'),results:any[]=[];
for(const scenario of scenarios.filter(s=>!only||s.name===only)){
 const state={...scenario,count:0,at:scenario.at??2,triggered:false,signal:join(out,'signal'),release:join(out,'release')};for(const f of [state.signal,state.release])try{await Deno.remove(f)}catch{}
 await Deno.writeTextFile(control,JSON.stringify(state));const envBefore={QUARTO:Deno.env.get('QUARTO')!,QUARTO_PROFILE:Deno.env.get('QUARTO_PROFILE')!};let error='',accepted=false;
 const mutateParent=scenario.parentEnv?(async()=>{for(let i=0;i<3000;i++){try{await Deno.stat(state.signal);Deno.env.set(scenario.parentEnv.name,scenario.parentEnv.value);await Deno.writeTextFile(state.release,'done');return}catch{}await new Promise(r=>setTimeout(r,10))}throw Error('Не получен stock mutation signal')})():Promise.resolve();
 try{await commonPathDocument(root,'index.qmd','html');accepted=true}catch(e){error=String(e)}finally{
  await mutateParent;for(const [k,v] of Object.entries(envBefore))Deno.env.set(k,v);
  for(const name of ['index.qmd','bank']){try{if((await Deno.lstat(join(root,name))).isSymlink){await Deno.remove(join(root,name));await Deno.rename(join(root,name)+'.held',join(root,name))}}catch{}}
  for(const [name,text] of Object.entries(files))await Deno.writeTextFile(join(root,name),text);
  for(const name of ['absent.yaml','bank/_quarto.yml'])try{await Deno.remove(join(root,name))}catch{}
  await Deno.writeTextFile(pp,pb);await Deno.writeTextFile(wp,wb);await Deno.writeFile(preimage,prebytes);await Deno.chmod(preimage,0o600);try{await Deno.remove(join(p.directory,'inspections/sha256','0'.repeat(64)+'.json'))}catch{}
  await Deno.writeTextFile(wrapper,wrapperText);await Deno.chmod(wrapper,0o700);
 }
 const c=JSON.parse(await Deno.readTextFile(control));results.push({name:scenario.name,triggered:c.triggered,accepted,error,stockInspectProcesses:c.count});await Deno.writeTextFile(join(out,'results.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results.at(-1)));assert(c.triggered&&!accepted&&error.includes('NATIVE.'),'MUTATION_REGRESSION '+scenario.name);
}
await Deno.writeTextFile(control,JSON.stringify({count:0,at:-1,triggered:false}));await Deno.writeTextFile(join(root,'unrelated-resource.txt'),'Несвязанный ресурс.\n');await commonPathDocument(root,'index.qmd','html');await Deno.remove(join(root,'unrelated-resource.txt'));console.log('PASS restored exact proof и unrelated resource positive; private/source state восстановлен');

// Capability не создаётся caller JSON и не переживает scope реального stock ответа.
const {withFreshOwnerFrame,freshOwnerData}=await import(new URL('./metadata-closure.ts',runtime).href);
let fabricatedAccepted=false;try{freshOwnerData({native:{}},root,['full']);fabricatedAccepted=true}catch(e){assert(String(e).includes('NATIVE.'),String(e))}assert(!fabricatedAccepted,'Caller JSON создал trusted owner frame');
let retained:any;await withFreshOwnerFrame(root,['full'],async()=>{},async(frame:any)=>{retained=frame;const actual=freshOwnerData(frame,root,['full']);assert(Object.isFrozen(actual)&&Object.isFrozen(actual.fileInformation),'Actual owner frame изменяем');return undefined});
let expiredAccepted=false;try{freshOwnerData(retained,root,['full']);expiredAccepted=true}catch(e){assert(String(e).includes('NATIVE.'),String(e))}assert(!expiredAccepted,'Завершённый owner frame переиспользован');console.log('PASS actual owner capability: no caller JSON, deep-frozen native, no reuse outside callback');
