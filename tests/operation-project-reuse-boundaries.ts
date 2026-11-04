import * as Core from "../_extensions/course-core/public.ts";
import { join } from "stdlib/path";
const root=await Deno.makeTempDir({prefix:'project-boundaries-'});
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m);};
async function put(p:string,t:string){await Deno.mkdir(join(root,p,'..'),{recursive:true});await Deno.writeTextFile(join(root,p),t);}
const request={owner:root,directories:['projects/a'],profiles:[],format:'html'};
try{
 await put('_quarto.yml','course-project: {starter: {path: student}}');
 await put('projects/a/student/Main.java','ORIGINAL');
 // QMD frontmatter больше не является конфигурацией code directory.
 await put('projects/a/native-input.qmd','---\ncourse-project: {starter: {path: missing}}\n---');
 await Core.readProjectContexts([request],async([group])=>{
  const ctx=group.contexts[0];assert(ctx.input===join(root,'projects/a'),'input не directory');
  const plan=await Core.planProject(ctx,{audience:'student'});assert(plan.input===ctx.input,'Plan сменил code directory');
  await put('projects/a/student/Main.java','CURRENT');
  await Core.assertProjectContext(ctx); // Нет собственной гарантии freshness.
 });
 for(const directory of ['../outside','projects/a/native-input.qmd']){
  let error='';try{await Core.readProjectContexts([{...request,directories:[directory]}],async()=>{});}catch(e){error=String(e);}assert(!!error,'Unsafe/non-directory request принят');
 }
 await Deno.mkdir(join(root,'foreign'));await Deno.symlink(join(root,'foreign'),join(root,'projects/link'));
 let error='';try{await Core.readProjectContexts([{...request,directories:['projects/link']}],async()=>{});}catch(e){error=String(e);}assert(error.includes('CONTEXT_INPUT'),'Directory symlink принят: '+error);
 console.log('PASS project boundaries: directory-only, QMD ignored, current source, unsafe paths and symlinks');
}finally{await Deno.remove(root,{recursive:true});}
