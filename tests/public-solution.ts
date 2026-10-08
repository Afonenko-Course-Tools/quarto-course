import {copy} from "stdlib/fs";
import {dirname,fromFileUrl,join} from "stdlib/path";
import {collectExport} from "../_extensions/course-core/body-export/collect.ts";
const repo=dirname(dirname(fromFileUrl(import.meta.url)));
const root=await Deno.makeTempDir({prefix:"course-public-solution-"});
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
async function write(condition:string){await Deno.writeTextFile(join(root,"index.qmd"),`---
exercise-bank: true
exercise-statement-visibility: open
assessment: {kind: seminar}
---
# Work {#sec-work}

::::: {#exr-demo difficulty=introductory time=10 course-role=demonstration}
DEMONSTRATION_CONDITION

:::: {.content-visible ${condition}}
::: {.solution}
PUBLIC_SOLUTION_PAYLOAD
:::
::::
:::::

::: {.task-items stage=demonstration}
1. @exr-demo
:::
`)}
async function render(profile:string,error?:string,args:string[]=[]){
 const r=await new Deno.Command(Deno.env.get("QUARTO")||"quarto",{args:["render","--profile",profile,"--fail-if-warnings",...args],cwd:root,stdout:"piped",stderr:"piped"}).output();
 const log=new TextDecoder().decode(r.stdout)+new TextDecoder().decode(r.stderr);
 assert(error?!r.success&&log.includes(error):r.success,log);
 if(!error){const html=await Deno.readTextFile(join(root,"_site/index.html"));assert(!html.includes("course-public-solution"),"witness markup leaked into output")}
}
try{
 await copy(Deno.env.get("COURSE_TEST_EXTENSION")??join(repo,"_extensions/course-core"),join(root,"_extensions/course-core"));
 await Deno.writeTextFile(join(root,"_quarto.yml"),`project:
  type: book
  output-dir: _site
  pre-render: _extensions/course-core/entrypoints/pre.ts
  post-render: _extensions/course-core/entrypoints/post.ts
book:
  title: Witness
  chapters: [index.qmd]
filters: [course-core]
format: html
fail-if-warnings: true
course: {id: witness}
`);
 for(const profile of ["student","full"])await Deno.writeTextFile(join(root,`_quarto-${profile}.yml`),`course: {view: ${profile}}\n`);
 await write("when-profile=student");await render("full");await render("student");
 const border="+"+"-".repeat(42)+"+";
 const table=[border,...["::: {.solution}","PUBLIC_SOLUTION_PAYLOAD",":::"].map(line=>"| "+line.padEnd(40)+" |"),border].join("\n");
 for(const nested of [table,"> ::: {.solution}\n> PUBLIC_SOLUTION_PAYLOAD\n> :::","- ::: {.solution}\n\n  PUBLIC_SOLUTION_PAYLOAD\n\n  :::","With a note.[^solution]\n\n[^solution]:\n\n    ::: {.solution}\n    PUBLIC_SOLUTION_PAYLOAD\n    :::"]){
   await write("when-profile=student");
   const source=await Deno.readTextFile(join(root,"index.qmd"));
   await Deno.writeTextFile(join(root,"index.qmd"),source.replace("::: {.solution}\nPUBLIC_SOLUTION_PAYLOAD\n:::",nested));
   await render("student");await render("full");
 }

 for(const condition of ["when-format=latex","when-meta=missing","when-profile=full"]){await write(condition);await render("full","CORE.ASSESSMENT_INVALID");await render("student","CORE.ASSESSMENT_INVALID")}
 await write("when-format=html");await render("full");
 let rejected=false;try{await collectExport(root,{book:".",work:"sec-work"})}catch(e){rejected=String(e).includes("CORE.ASSESSMENT_INVALID")}
 assert(rejected,"JSON source projection invented a solution unavailable in that native format");
 await write("when-profile=student");await collectExport(root,{book:".",work:"sec-work"});
 await render("student","CORE.VISIBILITY_INVALID",["-M","course-export-context:true"]);
 console.log("PASS native public solution witness: profiles/format/meta, JSON export and HTML context refusal");
}finally{await Deno.remove(root,{recursive:true})}
