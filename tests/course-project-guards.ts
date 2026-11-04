import { join } from "stdlib/path";
import { assertProjectContext, readProjectContexts } from "../_extensions/course-core/public.ts";
const root = await Deno.makeTempDir({prefix:"course-project-guards-"});
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m);};
const request={owner:root,directories:["code"],profiles:[],format:"html"};
async function put(path:string,text:string){await Deno.mkdir(join(root,path,".."),{recursive:true});await Deno.writeTextFile(join(root,path),text);}
async function reject(fragment:string,code:string){await put('_quarto.yml',fragment);let error='';try{await readProjectContexts([request],async()=>{});}catch(e){error=String(e);}assert(error.includes(code),`${code}: ${error}`);}
try {
 await put('code/src/Main.java','class Main {}');
 await reject('course-project: {components: {missing: {path: missing}}}','PROJECT_PATH_MISSING');
 await reject('course-project: {testsets: [one, two]}','PROJECT_CONTRACT');
 await reject('course-project: {unknown: true}','PROJECT_CONTRACT');
 await reject('course-project: {starter: {path: ../../outside}}','CONTEXT_PATH');
 await reject('course-project: {build: {files: {build.gradle: src/Main.java}}}','PROJECT_CONTRACT');
 await put('a.yml','metadata-files: [b.yml]');await put('b.yml','metadata-files: [a.yml]');
 await reject('metadata-files: [a.yml]','PROJECT_INCLUDE_CYCLE');
 await put('extra.yml','course-project: {components: {included: {path: code/src, base: config}}}');
 await put('_quarto.yml',`metadata-files: [extra.yml]\ncourse-project:\n  starter: &src {path: src}\n  components: {alias: *src}\nformat:\n  html:\n    course-project:\n      instructions: {local: {path: src/Main.java}}\n`);
 let expired: unknown;
 await readProjectContexts([request],async([group])=>{
  const context=group.contexts[0];expired=context;
  assert(context.contract.starter?.path===join(root,'code/src'),'Alias starter потерян');
  assert(context.contract.components.alias.path===join(root,'code/src'),'YAML alias не поддержан');
  assert(context.contract.components.included.path===join(root,'code/src'),'Include не поддержан');
  assert(context.contract.instructions?.local?.path===join(root,'code/src/Main.java'),'Format overlay не поддержан');
  let refused=false;try{await assertProjectContext({...context});}catch(e){refused=String(e).includes('CONTEXT_EXPIRED');}assert(refused,'Копия context получила полномочия');
 });
 let refused=false;try{await assertProjectContext(expired);}catch(e){refused=String(e).includes('CONTEXT_EXPIRED');}assert(refused,'Context пережил callback');
 console.log('PASS course-project guards: missing/unsafe/schema/cycles, aliases/includes/format, context lifetime');
} finally {await Deno.remove(root,{recursive:true});}
