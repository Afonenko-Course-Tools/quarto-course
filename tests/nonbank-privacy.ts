import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
const repo=dirname(dirname(fromFileUrl(import.meta.url))),root=await Deno.makeTempDir({prefix:'core-nonbank-privacy-'});
try{
 await copy(join(repo,'_extensions/course-core'),join(root,'_extensions/course-core'));
 await Deno.writeTextFile(join(root,'_quarto.yml'),'project: {type: website, output-dir: _site}\nformat:\n  html:\n    code-tools: {source: true, toggle: false}\n    keep-source: true\ncourse: {id: nonbank, view: student}\nfilters: [course-core]\n');
 await Deno.writeTextFile(join(root,'index.qmd'),`# Nonbank {#sec-nonbank}\n\n::: {#exr-native statement-visibility=restricted}\nUNMANAGED_NATIVE_BODY\n:::\n\n::: {#exr-closed project="/projects/closed" statement-visibility=restricted}\nPRIVATE_CONDITION\n:::\n\n::: {#sol-closed}\nPRIVATE_CLOSED_SOLUTION\n:::\n\n::: {#exr-open project="/projects/open" statement-visibility=open}\nPUBLIC_OPEN_BODY\n:::\n\n::: {#sol-open}\nPRIVATE_ORDINARY_SOLUTION\n:::\n\n::: {#exr-demo project="/projects/demo" statement-visibility=open course-role=demonstration}\nPUBLIC_DEMO_BODY\n:::\n\n::: {#sol-demo}\nPUBLIC_DEMO_SOLUTION\n:::\n`);
 const rendered=await new Deno.Command(Deno.env.get('QUARTO')??'quarto',{args:['render','--fail-if-warnings'],cwd:root,stdout:'piped',stderr:'piped'}).output();
 if(!rendered.success)throw Error(new TextDecoder().decode(rendered.stdout)+new TextDecoder().decode(rendered.stderr));
 const html=await Deno.readTextFile(join(root,'_site/index.html'));
 for(const marker of ['PRIVATE_CONDITION','PRIVATE_CLOSED_SOLUTION','PRIVATE_ORDINARY_SOLUTION'])if(html.includes(marker))throw Error('nonbank_source_or_solution_privacy: '+marker);
 if(/id=["']quarto-embedded-source-code(?:-modal)?["']/.test(html))throw Error('nonbank_source_modal_not_removed');
 for(const marker of ['UNMANAGED_NATIVE_BODY','PUBLIC_OPEN_BODY','PUBLIC_DEMO_BODY','PUBLIC_DEMO_SOLUTION'])if(!html.includes(marker))throw Error('nonbank_native_and_demo_parity: '+marker);
 try{const source=await Deno.readTextFile(join(root,'_site/index.qmd'));if(source.includes('PRIVATE_'))throw Error('nonbank_private_source_copy');}catch(error){if(!(error instanceof Deno.errors.NotFound))throw error;}
 const files=[...Deno.readDirSync(join(root,'_generated/course-spec/documents/student'))];
 const document=JSON.parse(await Deno.readTextFile(join(root,'_generated/course-spec/documents/student',files[0].name)));
 if(document.exercises.length||document.declarations.length||document.projects.length!==3)throw Error('nonbank privacy changed bank membership');
 console.log('PASS native nonbank modal/statement/sibling-solution privacy and bank isolation');
}finally{await Deno.remove(root,{recursive:true})}
