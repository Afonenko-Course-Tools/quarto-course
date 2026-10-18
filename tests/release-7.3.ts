import {copy} from "stdlib/fs";
import {join} from "stdlib/path";
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
const root=await Deno.makeTempDir({prefix:"core-release-73-"});
try {
 for(const name of ["course-core","course-presentation"])await copy(new URL("../_extensions/"+name,import.meta.url).pathname,join(root,"_extensions",name));
 for(const disabled of [false,true]) {
 await Deno.writeTextFile(join(root,"_quarto.yml"),`project:
  type: book
  pre-render: _extensions/course-core/entrypoints/pre.ts
  post-render: _extensions/course-core/entrypoints/post.ts
book: {title: Банк, chapters: [index.qmd, work.qmd]}
course: {id: release-test, view: student${disabled?", assessment-time: false":""}}
filters: [course-core, course-presentation]
format: html
lang: ru
`);
 await Deno.writeTextFile(join(root,"index.qmd"),`---
exercise-bank: true
exercise-statement-visibility: open
---
# Банк

::: {#exr-timed difficulty=introductory time=10}
## Условие

RELEASE_CONDITION_73
:::
`);
 await Deno.writeTextFile(join(root,"work.qmd"),`---
assessment: {id: lab, kind: lab, theory-time: 5}
---
# Работа

::: {.task-items}
1. @exr-timed RELEASE_ASSIGNED_CONDITION_73
:::
`);
 const r=await new Deno.Command(Deno.env.get("QUARTO")||"quarto",{args:["render","--fail-if-warnings"],cwd:root,stdout:"piped",stderr:"piped"}).output();
 assert(r.success,new TextDecoder().decode(r.stdout)+new TextDecoder().decode(r.stderr));
 const bank=await Deno.readTextFile(join(root,"_book/index.html")),work=await Deno.readTextFile(join(root,"_book/work.html"));
 assert(work.includes("RELEASE_ASSIGNED_CONDITION_73"),"В назначении потеряно условие");
 assert(!work.includes("course-assignment-pending:"),"Остался отложенный маркер");
 assert(work.includes('data-course-assessment-time="ready"')===!disabled,"Неверная видимость сводки времени");
 assert(bank.includes("course-meta-time")===!disabled,"Неверная видимость отдельной подписи времени");
 const docs=join(root,"_generated/course-spec/documents/student");
 const records=[];for(const e of Deno.readDirSync(docs))records.push(JSON.parse(await Deno.readTextFile(join(docs,e.name))));
 assert(records.some(d=>d.exercises?.some((e:any)=>e.id==="exr-timed"&&e.time===10)),"Потеряны данные времени");
 }
 console.log("PASS 7.3: время по умолчанию/false, сохранность данных, фактическое назначенное условие");
} finally {await Deno.remove(root,{recursive:true})}
