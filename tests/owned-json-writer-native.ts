/** Настоящий collectExport: local formats/custom names и отказ до повреждения source. */
import {copy} from 'stdlib/fs';
import {dirname,fromFileUrl,join} from 'stdlib/path';
import {collectExport} from '../_extensions/course-core/body-export/collect.ts';
const repo=dirname(dirname(fromFileUrl(import.meta.url))),top=Deno.env.get('OWNED_JSON_WRITER_OUTPUT')||await Deno.makeTempDir({prefix:'owned-json-writer-native-'});
const assert=(value:unknown,message:string)=>{if(!value)throw Error(message)};
const cases=['directory-custom','document-default','collision-default','collision-custom','protected-absent','linked-output','duplicate-output'] as const;
const results=[];
for(const name of cases){
 const root=join(top,name),bank=join(root,'bank'),nested=name!=='duplicate-output',work=nested?'items/work.qmd':'work.qmd';
 await Deno.mkdir(join(bank,'items'),{recursive:true});await copy(join(repo,'_extensions/course-core'),join(bank,'_extensions/course-core'));
 await Deno.writeTextFile(join(root,'_quarto.yml'),'project: {type: default}\ncourse: {id: native-json-writer}\n');
 const custom=name==='directory-custom'||name==='collision-custom'||name==='duplicate-output',leaf=custom?'chosen.html.json':'work.json',temporary=join(bank,nested?'items':'',leaf);
 const config='project:\n  type: book\n  pre-render: [_extensions/course-core/entrypoints/pre.ts, _extensions/course-core/entrypoints/pre.ts]\n  post-render: [_extensions/course-core/entrypoints/post.ts, _extensions/course-core/entrypoints/post.ts]\n  resources: [resource.txt, "!_generated/**"'+(name==='protected-absent'?', items/work.json':'')+']\nbook: {title: Writer, chapters: [index.qmd, '+work+']}\nformat: html\nfilters: [course-core]\n';
 await Deno.writeTextFile(join(bank,'_quarto.yml'),config);await Deno.writeTextFile(join(bank,'resource.txt'),'UNCHANGED_PUBLIC_RESOURCE\n');
 await Deno.writeTextFile(join(bank,'index.qmd'),'---\nassessment: {id: lab, kind: lab}\n'+(name==='duplicate-output'?'output-file: chosen.html\n':'')+'---\n# Работа\n\n::: {.task-items}\n- @exr-one\n:::\n');
 const metadata='exercise-bank: true\nexercise-statement-visibility: open\n'+(name==='document-default'?'':'format: {html: {theme: none}}\n');
 if(nested)await Deno.writeTextFile(join(bank,'items/_metadata.yml'),metadata);
 await Deno.writeTextFile(join(bank,work),'---\n'+(nested?'':metadata)+(name==='document-default'?'format: html\n':'')+(custom?'output-file: chosen.html\n':'')+'---\n# Банк\n\n::: {#exr-one difficulty=introductory time=10}\nПубличное условие.\n:::\n');
 const original=new Map<string,string>();for(const file of ['_quarto.yml','resource.txt','index.qmd',work,...(nested?['items/_metadata.yml']:[])])original.set(file,await Deno.readTextFile(join(bank,file)));
 const configBefore=await Deno.lstat(join(bank,'_quarto.yml'));let protectedPath:string|undefined,sentinel:Uint8Array|undefined,entry:Deno.FileInfo|undefined;
 if(name.startsWith('collision')){await Deno.writeTextFile(temporary,'AUTHORED_JSON_SENTINEL\n');protectedPath=temporary}
 if(name==='linked-output'){protectedPath=join(root,'outside.json');await Deno.writeTextFile(protectedPath,'FOREIGN_TARGET_SENTINEL\n');await Deno.symlink(protectedPath,temporary)}
 if(protectedPath){sentinel=await Deno.readFile(protectedPath);entry=await Deno.lstat(protectedPath)}
 let error:unknown,result:Awaited<ReturnType<typeof collectExport>>|undefined;
 try{result=await collectExport(root,{book:'bank',work:'lab'})}catch(e){error=e}
 const positive=name==='directory-custom'||name==='document-default';
 if(positive){assert(!error,'Valid forced JSON rejected '+name+': '+String(error));assert(result?.result.model.exercises.length===1,'Missing exercise '+name)}
 else{assert(error,'Unsafe writer unexpectedly accepted '+name);assert(String(error).includes('NATIVE.COMMON_PATH_BINDING_INVALID'),'Expected Core guard diagnostic '+name+': '+String(error))}
 for(const [file,text] of original)assert(await Deno.readTextFile(join(bank,file))===text,'Authored file changed '+name+': '+file);
 const configAfter=await Deno.lstat(join(bank,'_quarto.yml'));assert(configBefore.dev===configAfter.dev&&configBefore.ino===configAfter.ino&&configBefore.mode===configAfter.mode&&configBefore.mtime?.getTime()===configAfter.mtime?.getTime(),'Source config identity changed '+name);
 if(protectedPath){const after=await Deno.lstat(protectedPath),bytes=await Deno.readFile(protectedPath);assert(bytes.length===sentinel!.length&&bytes.every((b,i)=>b===sentinel![i]),'Protected bytes overwritten '+name);for(const key of ['dev','ino','mode','size'] as const)assert(entry![key]===after[key],'Protected entry changed '+name+': '+key);assert(entry!.mtime?.getTime()===after.mtime?.getTime()&&entry!.ctime?.getTime()===after.ctime?.getTime(),'Protected timestamps changed '+name)}
 if(positive)try{await Deno.lstat(temporary);throw Error('Temporary output left after success '+name)}catch(e){if(!(e instanceof Deno.errors.NotFound))throw e}
 const profiles=[];for await(const entry of Deno.readDir(bank))if(entry.name.startsWith('_quarto-course-export-'))profiles.push(entry.name);assert(profiles.length===0,'Owned profile left after '+name);
 results.push({name,positive,expectedFailure:!positive,sourcePreserved:true,protectedEntryPreserved:!!protectedPath});console.log('PASS actual public writer '+name);
}
await Deno.writeTextFile(join(top,'result.json'),JSON.stringify({status:'PASS',cases:results},null,2)+'\n');
