import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
const repo=dirname(dirname(fromFileUrl(import.meta.url))),root=await Deno.makeTempDir({prefix:'metadata-includes-native-'});
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
async function command(args:string[]){const r=await new Deno.Command(Deno.env.get('QUARTO')||'quarto',{args,cwd:root,stdout:'piped',stderr:'piped'}).output();return {ok:r.success,text:new TextDecoder().decode(r.stdout)+new TextDecoder().decode(r.stderr)}}
try{
 await copy(Deno.env.get('METADATA_CLOSURE_EXTENSION')||join(repo,'_extensions/course-core'),join(root,'_extensions/course-core'));
 await Deno.mkdir(join(root,'bank'));await Deno.mkdir(join(root,'bank/parts'));
 await Deno.writeTextFile(join(root,'_quarto.yml'),'project:\n  type: default\n  render: [bank/item.qmd]\n  output-dir: _site\n  pre-render: _extensions/course-core/entrypoints/pre.ts\n  post-render: _extensions/course-core/entrypoints/post.ts\nformat: html\nfilters: [course-core]\n');
 await Deno.writeTextFile(join(root,'_quarto-full.yml'),'course: {view: full}\nmetadata-files: [_profile.yaml, _missing-profile.yaml]\n');
 await Deno.writeTextFile(join(root,'_profile.yaml'),'closure-profile-marker: 7\n');await Deno.writeTextFile(join(root,'bank/_missing-profile.yaml'),'closure-local-marker: bank\n');
 await Deno.writeTextFile(join(root,'bank/_metadata.yml'),'metadata-file: _directory.yaml\n');await Deno.writeTextFile(join(root,'bank/_directory.yaml'),'closure-directory-marker: 9\n');
 await Deno.writeTextFile(join(root,'bank/item.qmd'),'# Outer\n\n{{< include parts/_part.qmd >}}\n');await Deno.writeTextFile(join(root,'bank/parts/_part.qmd'),'---\nmetadata-file: _include.yaml\n---\n## Part\n');
 await Deno.writeTextFile(join(root,'bank/parts/_include.yaml'),'closure-include-marker: WRONG_BASE\n');await Deno.writeTextFile(join(root,'bank/_include.yaml'),'closure-include-marker: outer\n');
 const before=await command(['inspect',join(root,'bank/item.qmd'),'--profile','full']);assert(before.ok,before.text);const inspect=JSON.parse(before.text);assert(inspect.formats.html.metadata['closure-include-marker']==='outer','Stock include context changed');assert(inspect.formats.html.metadata['closure-directory-marker']===9,'Stock directory metadata-file value changed');
 const nested=await command(['inspect',join(root,'bank/item.qmd'),'--profile','full']);assert(nested.ok,nested.text);assert(JSON.parse(nested.text).formats.html.metadata['closure-local-marker']==='bank','Stock missing-profile input context changed');
 const result=await command(['render','--profile','full']);assert(result.ok,result.text);
 const p=JSON.parse(await Deno.readTextFile(join(root,'_generated/course-spec/active-native-run.json'))),w=JSON.parse(await Deno.readTextFile(join(p.directory,'common-files-path-binding.json'))),c=w.metadataClosure;
 assert(c.noCommon,'Unexpected declaration');
 for(const [from,to,source] of [[join(root,'bank/parts/_part.qmd'),join(root,'bank/_include.yaml'),'bank/item.qmd'],[join(root,'_quarto-full.yml'),join(root,'bank/_missing-profile.yaml'),'bank/item.qmd'],[join(root,'bank/_metadata.yml'),join(root,'bank/_directory.yaml'),'bank/item.qmd']])assert(c.dependencies.some((e:any)=>e.from===from&&e.to===to&&e.context.source===source&&e.kind==='metadata-file'),'Missing actual dependency '+from+' -> '+to);
 assert(c.origins.some((o:any)=>o.path===join(root,'_missing-profile.yaml')&&o.context.source==='bank/item.qmd'&&o.sha256===false),'Missing profile absence watch');
 const {loadNativeRun}=await import('../_extensions/course-core/infrastructure/native-run.ts');await loadNativeRun(root);
 for(const file of [join(root,'bank/_include.yaml'),join(root,'bank/_missing-profile.yaml'),join(root,'bank/_directory.yaml')]){const prior=await Deno.readTextFile(file);await Deno.writeTextFile(file,prior+'closure-drift: true\n');let refused=false;try{await loadNativeRun(root)}catch(e){assert(String(e).includes('NATIVE.'),String(e));refused=true}assert(refused,'Accepted consumed metadata drift');await Deno.writeTextFile(file,prior)}
 await Deno.writeTextFile(join(root,'_missing-profile.yaml'),'closure-local-marker: new-root\n');let appearance=false;try{await loadNativeRun(root)}catch(e){assert(String(e).includes('NATIVE.'),String(e));appearance=true}assert(appearance,'Accepted new owner candidate affecting native rebasing');await Deno.remove(join(root,'_missing-profile.yaml'));
 console.log('PASS actual included-QMD outer input scope, native-selected profile metadata, missing path fallback and currentness');console.log('FIXTURE',root);
}catch(e){console.error('FIXTURE',root);throw e}
