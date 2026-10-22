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

const out=Deno.env.get('CURRENTNESS_OUTPUT')||await Deno.makeTempDir({prefix:'currentness-batch-native-'}),explicitRoot=Deno.env.get('CURRENTNESS_FIXTURE'),root=explicitRoot||join(out,'fixture'),mode=Deno.env.get('CURRENTNESS_MODE')||(explicitRoot?'probe':'setup');
await Deno.mkdir(out,{recursive:true});console.log('FIXTURE',root);
const quote=(s:string)=>"'"+s.replaceAll("'","'\\''")+"'";
const log=join(out,'stock-commands.jsonl'),wrapper=join(out,'quarto-wrapper'),script=join(out,'quarto-wrapper.py');
await Deno.writeTextFile(script,`import subprocess,sys,json,time,os\nt=time.monotonic();r=subprocess.run([${JSON.stringify(actualQuarto)},*sys.argv[1:]])\nwith open(${JSON.stringify(log)},'a') as f:f.write(json.dumps({'argv':sys.argv[1:],'cwd':os.getcwd(),'exit':r.returncode,'durationSeconds':time.monotonic()-t})+'\\n')\nsys.exit(r.returncode)\n`);
await Deno.writeTextFile(wrapper,'#!/bin/sh\nexec '+quote(python)+' '+quote(script)+' "$@"\n',{mode:0o700});await Deno.chmod(wrapper,0o700);Deno.env.set('QUARTO',wrapper);
const sources=['index.qmd','bank/item.qmd','bank/second.qmd'];
if(mode==='setup'){
 await Deno.mkdir(join(root,'bank'),{recursive:true});await Deno.mkdir(join(root,'common'),{recursive:true});
 await Deno.writeTextFile(join(root,'_quarto.yml'),'project:\n  type: default\n  render: [index.qmd, bank/item.qmd, bank/second.qmd]\n  output-dir: _site\nformat: html\nproject-materialization:\n  projects:\n    exr-batch:\n      common-files:\n      - {source: common/preamble.md, target: student/PREREQUISITE.md, audience: student}\n');
 await Deno.writeTextFile(join(root,'_quarto-full.yml'),'course: {view: full}\nmetadata-files: [_grading.yaml]\n');await Deno.writeTextFile(join(root,'_grading.yaml'),'title: Пакетная проверка\n');await Deno.writeTextFile(join(root,'bank/_metadata.yml'),'description: Наследование\n');
 await Deno.writeTextFile(join(root,'index.qmd'),'# Начало\n');await Deno.writeTextFile(join(root,'bank/item.qmd'),'# Один\n\n{{< include ../common/preamble.md >}}\n');await Deno.writeTextFile(join(root,'bank/second.qmd'),'# Два\n');await Deno.writeTextFile(join(root,'common/preamble.md'),'Общий фрагмент.\n');
 Deno.env.set('QUARTO_PROJECT_INPUT_FILES',sources.map(s=>join(root,s)).join('\n'));Deno.env.set('QUARTO_PROJECT_OUTPUT_DIR','_site');Deno.env.set('QUARTO_PROJECT_RENDER_ALL','1');Deno.env.set('QUARTO_PROFILE','full');await beginNativeRun(root);
 const initial=await Deno.readTextFile(log);await Deno.writeTextFile(join(out,'initial-capture-commands.jsonl'),initial);await Deno.writeTextFile(log,'');
}
Deno.env.set('QUARTO_PROFILE','full');const result:any[]=[];
for(const source of sources){
 await Deno.writeTextFile(log,'');const started=performance.now(),value=await commonPathDocument(root,source,'html');const calls=(await Deno.readTextFile(log)).trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));const inspect=calls.filter(x=>x.argv[0]==='inspect'),owner=inspect.filter(x=>x.argv[1]===root),direct=inspect.filter(x=>x.argv[1]!==root);result.push({source,value,ownerProcesses:owner.length,directProcesses:direct.length,durationMilliseconds:performance.now()-started,calls});
 await Deno.writeTextFile(join(out,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({source,ownerProcesses:owner.length,directProcesses:direct.length}));
}
for(const r of result){assert(r.value.canonicalDeclarations.projects['exr-batch']['common-files'][0].source==='common/preamble.md','Потерян canonical common source');assert(r.value.effectiveDeclarations.projects['exr-batch']['common-files'][0].source===(r.source.startsWith('bank/')?'../common/preamble.md':'common/preamble.md'),'Изменился stock source rebasing')}
const baseline=Deno.env.get('CURRENTNESS_BASELINE');if(baseline){const prior=JSON.parse(await Deno.readTextFile(baseline));assert(JSON.stringify(prior.map((x:any)=>x.value))===JSON.stringify(result.map(x=>x.value)),'Изменились фактические полные document binding результаты')}
assert(result.every(x=>x.ownerProcesses===2&&x.directProcesses===0),'PERF_REGRESSION: нужно ровно2 actual owner inspect и0 direct для каждого regular document');console.log('PASS реальные stock A/B counts и точные document binding значения');
