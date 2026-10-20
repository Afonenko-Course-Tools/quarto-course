import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
import {beginNativeRun,loadNativeRun} from '../_extensions/course-core/infrastructure/native-run.ts';
const repo=dirname(dirname(fromFileUrl(import.meta.url))),root=await Deno.makeTempDir({prefix:'metadata-closure-native-'});
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
const external=join(dirname(root),root.split('/').at(-1)+'-external.yaml');
const config=`project:
  type: default
  render: [index.qmd, bank/item.qmd]
  output-dir: _site
  pre-render: _extensions/course-core/entrypoints/pre.ts
  post-render: _extensions/course-core/entrypoints/post.ts
format: html
filters: [course-core]
metadata-files: [_grading.yaml, absent.yaml, ../${external.split('/').at(-1)}]
`;
async function render(){const r=await new Deno.Command(Deno.env.get('QUARTO')||'quarto',{args:['render'],cwd:root,stdout:'piped',stderr:'piped'}).output();return {success:r.success,text:new TextDecoder().decode(r.stdout)+new TextDecoder().decode(r.stderr)}}
try{
 await copy(join(repo,'_extensions/course-core'),join(root,'_extensions/course-core'));
 await Deno.mkdir(join(root,'bank'));await Deno.writeTextFile(join(root,'_quarto.yml'),config);
 await Deno.writeTextFile(external,'title: External metadata\n');
 await Deno.writeTextFile(join(root,'_grading.yaml'),'prairielearn:\n  assessment-defaults: {question-points: 7, allow-multiple-instances: false}\n');
 await Deno.writeTextFile(join(root,'index.qmd'),'# Проверка\n');
 await Deno.writeTextFile(join(root,'bank/item.qmd'),'---\nmetadata-file: _local.yaml\n---\n# Локальное наследование\n');
 await Deno.writeTextFile(join(root,'bank/_local.yaml'),'title: Local\ndescription: The word project-materialization in prose is not a metadata key.\n');
 const r=await render();assert(r.success,r.text);
 const run=await loadNativeRun(root);assert(run.documents.length===2,'Native documents lost');
 const p=JSON.parse(await Deno.readTextFile(join(root,'_generated/course-spec/active-native-run.json'))),w=JSON.parse(await Deno.readTextFile(join(p.directory,'common-files-path-binding.json')));
 assert(w.metadataClosure?.noCommon===true,'Missing no-common proof');
 assert(w.metadataClosure.origins.some((o:any)=>o.path===join(root,'bank/_local.yaml')&&o.context.source==='bank/item.qmd'),'Missing QMD-local metadata origin');
 assert(w.metadataClosure.dependencies.some((e:any)=>e.from===join(root,'bank/item.qmd')&&e.to===join(root,'bank/_local.yaml')&&e.kind==='metadata-file'),'Missing QMD-local dependency edge');
 console.log('PASS actual native owner and QMD-local metadata closure');
 const refuse=async(fn:()=>Promise<unknown>,name:string,nativeParse=false)=>{let rejected=false;try{await fn()}catch(e){assert(String(e).includes('NATIVE.')||nativeParse&&(e as Error).name==='ExternalToolFailure','Unexpected non-contract failure '+name+': '+e);rejected=true;console.log('REFUSED',name,String(e).split('\n')[0])}assert(rejected,'Accepted '+name)};
 const pointerPath=join(root,'_generated/course-spec/active-native-run.json'),pointerBytes=await Deno.readTextFile(pointerPath),proofPath=join(p.directory,'common-files-path-binding.json'),proofBytes=await Deno.readTextFile(proofPath);
 const digest=async(b:Uint8Array,algorithm='SHA-256')=>Array.from(new Uint8Array(await crypto.subtle.digest(algorithm,new Uint8Array(b).buffer)),x=>x.toString(16).padStart(2,'0')).join('');
 const forged=async(change:(v:any)=>void,name:string)=>{const v=JSON.parse(proofBytes);change(v);const bytes=new TextEncoder().encode(JSON.stringify(v));await Deno.writeFile(proofPath,bytes);await Deno.writeTextFile(pointerPath,JSON.stringify({...p,commonPathBinding:{...p.commonPathBinding,sha256:await digest(bytes),sha1:await digest(bytes,'SHA-1')}}));await refuse(()=>loadNativeRun(root),name);await Deno.writeTextFile(proofPath,proofBytes);await Deno.writeTextFile(pointerPath,pointerBytes)};
 await forged(v=>{delete v.metadataClosure},'old witness without metadataClosure');
 await forged(v=>{v.metadataClosure.dependencies=v.metadataClosure.dependencies.filter((e:any)=>e.kind!=='metadata-file')},'missing actual metadata edges');
 await forged(v=>{v.metadataClosure.origins=v.metadataClosure.origins.filter((o:any)=>!o.path.endsWith('_local.yaml'))},'missing QMD-local raw extraction');
 await forged(v=>{v.metadataClosure.origins[0].nativeMetadataHash='0'.repeat(64)},'forged native metadata hash');
 await forged(v=>{v.metadataClosure.origins[0].nativeMetadataHash=false},'missing native raw extraction hash');
 await forged(v=>{v.metadataClosure.origins.find((o:any)=>o.context.source).context.format='latex'},'forged metadata format context');
 await forged(v=>{v.metadataClosure.nativeConfigFiles.owner=v.metadataClosure.nativeConfigFiles.owner.filter((f:string)=>!f.endsWith('_grading.yaml'))},'forged native config inventory');
 await forged(v=>{v.metadataClosure.origins.push({...v.metadataClosure.origins[0],path:join(root,'arbitrary.yaml')})},'arbitrary receipt path');
 for(const file of [join(root,'bank/_local.yaml'),external]){const before=await Deno.readTextFile(file);await Deno.writeTextFile(file,before+'closure-probe-drift: true\n');await refuse(()=>loadNativeRun(root),'metadata byte drift '+file);await Deno.writeTextFile(file,before)}
 await Deno.writeTextFile(join(root,'absent.yaml'),'title: Appeared\n');await refuse(()=>loadNativeRun(root),'referenced absent metadata appeared');await Deno.remove(join(root,'absent.yaml'));
 await Deno.writeTextFile(join(root,'bank/_metadata.yml'),'title: Appeared directory metadata\n');await refuse(()=>loadNativeRun(root),'new directory metadata');await Deno.remove(join(root,'bank/_metadata.yml'));
 const local=join(root,'bank/_local.yaml');await Deno.rename(local,local+'.saved');await Deno.symlink(local+'.saved',local);await refuse(()=>loadNativeRun(root),'metadata symlink');await Deno.remove(local);await Deno.rename(local+'.saved',local);
 console.log('PASS live native inventory, exact closure/edges, hashes and absence currentness');
 Deno.env.set('QUARTO_PROJECT_OUTPUT_DIR','_site');Deno.env.set('QUARTO_PROJECT_INPUT_FILES',[join(root,'index.qmd'),join(root,'bank/item.qmd')].join('\n'));
 const grading=await Deno.readTextFile(join(root,'_grading.yaml'));
 for(const hidden of ['project-materialization: null\n','project-materialization: {}\n','format:\n  html:\n    project-materialization: null\n','other:\n  nested:\n    project-materialization: {projects: {}}\n']){
  await Deno.writeTextFile(join(root,'_grading.yaml'),grading+hidden);await refuse(()=>beginNativeRun(root),'supplemental hidden/null/empty common');
 }
 await Deno.writeTextFile(join(root,'_grading.yaml'),grading);
 for(const file of [join(root,'bank/_metadata.yml'),join(root,'bank/_local.yaml')]){const before=await Deno.readTextFile(file).catch(()=>null);await Deno.writeTextFile(file,'project-materialization: null\n');await refuse(()=>beginNativeRun(root),'directory/QMD include null common');if(before===null)await Deno.remove(file);else await Deno.writeTextFile(file,before)}
 await Deno.writeTextFile(join(root,'_grading.yaml'),'title: one\ntitle: two\n');await refuse(()=>beginNativeRun(root),'ambiguous duplicate metadata',true);
 await Deno.writeTextFile(join(root,'_grading.yaml'),'invalid: [\n');await refuse(()=>beginNativeRun(root),'metadata native parse error',true);await Deno.writeTextFile(join(root,'_grading.yaml'),grading);
 await Deno.mkdir(join(root,'_extensions/hidden-common'),{recursive:true});await Deno.writeTextFile(join(root,'_extensions/hidden-common/_extension.yml'),'title: Hidden\nversion: 0.0.1\ncontributes: {filters: [noop.lua]}\nother: {project-materialization: null}\n');await Deno.writeTextFile(join(root,'_extensions/hidden-common/noop.lua'),'return {}\n');await refuse(()=>beginNativeRun(root),'extension hidden null common');await Deno.remove(join(root,'_extensions/hidden-common'),{recursive:true});
 const common=`project-materialization:\n  projects:\n    exr-a:\n      common-files:\n      - {source: common/helper.txt, target: student/helper.txt, audience: student}\n`;
 await Deno.mkdir(join(root,'common'));await Deno.writeTextFile(join(root,'common/helper.txt'),'PUBLIC_HELPER\n');await Deno.mkdir(join(root,'projects/a/student'),{recursive:true});await Deno.writeTextFile(join(root,'projects/a/student/README.md'),'Публичный комплект.\n');
 await Deno.writeTextFile(join(root,'index.qmd'),'---\nassessment: {kind: lab}\n---\n# Работа {#lab-a}\n\n::: {.task-items}\n1. @exr-a\n:::\n');
 const bank='---\nexercise-bank: true\nexercise-statement-visibility: open\ndefault-exercise-project-check: false\nmetadata-file: _local.yaml\n---\n# Банк\n\n::: {#exr-a difficulty=introductory time=10 project="/projects/a"}\n## Условие\nПубличное условие.\n:::\n';
 await Deno.writeTextFile(join(root,'bank/item.qmd'),bank);await Deno.writeTextFile(join(root,'_quarto.yml'),config+common);await Deno.writeTextFile(join(root,'bank/_metadata.yml'),'title: Ordinary directory inheritance\n');
 const supported=await render();assert(supported.success,supported.text);const commonRun=await loadNativeRun(root);
 const {materializeProjects}=await import('../_extensions/course-core/artifacts/materialize.ts');const stage=root+'-student-stage';
 await materializeProjects({nativeRun:commonRun,sourceRoot:root,outputRoot:stage,exerciseIds:['exr-a'],audience:'student'});assert(await Deno.readTextFile(join(stage,'projects/a/student/helper.txt'))==='PUBLIC_HELPER\n','Supported common bytes changed');
 const cp=JSON.parse(await Deno.readTextFile(pointerPath)),cf=join(cp.directory,'common-files-path-binding.json'),cb=await Deno.readTextFile(cf),cw=JSON.parse(cb);cw.metadataClosure.noCommon=true;const changed=new TextEncoder().encode(JSON.stringify(cw));await Deno.writeFile(cf,changed);await Deno.writeTextFile(pointerPath,JSON.stringify({...cp,commonPathBinding:{...cp.commonPathBinding,sha256:await digest(changed),sha1:await digest(changed,'SHA-1')}}));await refuse(()=>loadNativeRun(root),'forged noCommon true with actual supported declaration');await Deno.writeTextFile(cf,cb);await Deno.writeTextFile(pointerPath,JSON.stringify(cp));
 const oldLocal=await Deno.readTextFile(local);await Deno.writeTextFile(local,oldLocal+'closure-drift: true\n');await refuse(()=>materializeProjects({nativeRun:commonRun,sourceRoot:root,outputRoot:root+'-stale-stage',exerciseIds:['exr-a'],audience:'student'}),'retained materializer supplemental drift');await Deno.writeTextFile(local,oldLocal);
 console.log('PASS supported canonical common plus ordinary supplemental directory/QMD metadata and materializer currentness');
 await Deno.writeTextFile(join(root,'_quarto.yml'),config);await Deno.writeTextFile(join(root,'bank/item.qmd'),bank.replace('---\n','---\n'+common));const qmdOnly=await render();assert(qmdOnly.success,qmdOnly.text);await loadNativeRun(root);console.log('PASS supported raw QMD common plus supplemental absence');
 console.log('FIXTURE',root);

}catch(e){console.error('FIXTURE',root);throw e}
