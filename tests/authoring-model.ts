import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo=dirname(dirname(fromFileUrl(import.meta.url)));
const root=await Deno.makeTempDir({prefix:"course-authoring-model-"});
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
async function render(expected?:string) {
 const r=await new Deno.Command(Deno.env.get("QUARTO")||"quarto",{args:["render",".","--profile","student","--fail-if-warnings"],cwd:root,stdout:"piped",stderr:"piped"}).output();
 const log=new TextDecoder().decode(r.stdout)+new TextDecoder().decode(r.stderr);
 assert(expected?!r.success&&log.includes(expected):r.success,log);
 return log;
}
async function doc(source:string) {
 for await(const f of Deno.readDir(join(root,"_generated/course-spec/documents/student"))) {
  const d=JSON.parse(await Deno.readTextFile(join(root,"_generated/course-spec/documents/student",f.name)));
  if(d.source===source)return d;
 }
 throw Error("Document missing: "+source);
}
try {
 await copy(join(repo,"_extensions/course-core"),join(root,"_extensions/course-core"));
 await Deno.writeTextFile(join(root,"_quarto.yml"),"project:\n  type: book\n  output-dir: _site\nbook:\n  title: Model\n  chapters: [index.qmd, bank.qmd, work.qmd]\nformat:\n  html:\n    theme: none\nfilters: [course-core]\ncourse:\n  id: authoring-model\n");
 await Deno.writeTextFile(join(root,"_quarto-student.yml"),"course:\n  view: student\n");
 await Deno.writeTextFile(join(root,"index.qmd"),"# Native\n\n::: {#exr-native}\nNATIVE_CONDITION\n:::\n\n::: {#sol-native}\nNATIVE_SOLUTION\n:::\n");
 await Deno.writeTextFile(join(root,"bank.qmd"),"---\nexercise-bank: true\nexercise-statement-visibility: open\n---\n# Bank\n\n::: {#exr-open difficulty=introductory time=10}\nOPEN_CONDITION\n:::\n\n::: {#exr-secret difficulty=advanced time=25 statement-visibility=restricted}\nRESTRICTED_CONDITION\n:::\n");
 await Deno.writeTextFile(join(root,"work.qmd"),"---\nassessment: {kind: seminar, theory-time: 2.5}\n---\n# Work {#sec-work}\n\n::: {.task-items stage=classroom}\n1. @exr-open\n:::\n\n::: {.task-items stage=homework}\n1. [@exr-secret]{requirement=optional work-mode=pair}\n:::\n");
 await render();
 const native=await doc("index.qmd"),bank=await doc("bank.qmd"),work=await doc("work.qmd");
 assert(native.exercises.length===0,"outside-bank native exr became canonical");
 assert((await Deno.readTextFile(join(root,"_site/index.html"))).includes("NATIVE_SOLUTION"),"native outside-bank solution removed");
 assert(bank.declarations.length===2&&bank.declarations[1].statementVisibility==="restricted","raw restricted declaration missing");
 assert(bank.exercises.length===1&&!JSON.stringify(bank).includes("RESTRICTED_CONDITION"),"restricted AST escaped student facts");
 assert(work.rawAssessment.items.length===2&&work.rawAssessment.bodyJson===undefined,"raw composition lost members or retained AST");
 assert(work.rawAssessment.assignments["exr-secret"].workMode==="pair"&&work.rawAssessment.theoryTime===2.5,"assignment fields/theoryTime lost");
 if(Deno.args[0]!=="bank"){
 const html=await Deno.readTextFile(join(root,"_site/work.html"));
 assert(!html.includes("exr-secret"),"restricted cross-document assignment escaped student HTML");
 }
 console.log("PASS bank/native/raw composition and strict native cross-document student references");
}finally{await Deno.remove(root,{recursive:true})}
