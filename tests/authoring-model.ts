import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo=dirname(dirname(fromFileUrl(import.meta.url)));
const root=await Deno.makeTempDir({prefix:"course-authoring-model-"});
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m)};
async function render(expected?:string,args:string[]=[]) {
 const r=await new Deno.Command(Deno.env.get("QUARTO")||"quarto",{args:["render",...(args.length?args:["."]),"--profile","student","--fail-if-warnings"],cwd:root,stdout:"piped",stderr:"piped"}).output();
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
 await Deno.writeTextFile(join(root,"_quarto.yml"),"project:\n  type: book\n  output-dir: _site\nbook:\n  title: Model\n  chapters: [index.qmd, bank.qmd, work.qmd]\nformat:\n  html:\n    theme: none\nfilters: [course-core]\nfail-if-warnings: true\ncourse:\n  id: authoring-model\n");
 await Deno.writeTextFile(join(root,"_quarto-student.yml"),"course:\n  view: student\n");
 await Deno.writeTextFile(join(root,"index.qmd"),"# Native\n\n::: {#exr-native}\nNATIVE_CONDITION\n:::\n\n::: {#sol-native}\nNATIVE_SOLUTION\n:::\n");
 await Deno.writeTextFile(join(root,"bank.qmd"),"---\nexercise-bank: true\nexercise-statement-visibility: open\ncode-tools: true\nkeep-source: true\n---\n# Bank\n\n:::: {#exr-open difficulty=introductory time=10 course-role=demonstration}\nOPEN_CONDITION\n\n::: {.solution}\nDEMO_PUBLIC_SOLUTION\n:::\n::::\n\n::: {#exr-secret difficulty=advanced time=25 statement-visibility=restricted}\nRESTRICTED_CONDITION\n:::\n");
 await Deno.writeTextFile(join(root,"work.qmd"),"---\nassessment: {kind: seminar, theory-time: 2.5}\ncode-tools: true\nkeep-source: true\n---\n# Work {#sec-work}\n\n::: {.task-items stage=demonstration}\n1. @exr-open\n:::\n\n::: {.task-items stage=homework}\n1. [@exr-secret]{requirement=optional work-mode=pair}\n:::\n");
 await render();
 const native=await doc("index.qmd"),bank=await doc("bank.qmd"),work=await doc("work.qmd");
 assert(native.exercises.length===0,"outside-bank native exr became canonical");
 assert((await Deno.readTextFile(join(root,"_site/index.html"))).includes("NATIVE_SOLUTION"),"native outside-bank solution removed");
 assert(bank.declarations.length===2&&bank.declarations[1].statementVisibility==="restricted","raw restricted declaration missing");
 const bankHtml=await Deno.readTextFile(join(root,"_site/bank.html"));
 assert(!bankHtml.includes("quarto-embedded-source-code"),"bank source modal remained enabled");
 assert(!bankHtml.includes("RESTRICTED_CONDITION"),"native code-tools embedded restricted source");
 try{const source=await Deno.readTextFile(join(root,"_site/bank.qmd"));assert(!source.includes("RESTRICTED_CONDITION"),"native source copy leaked restricted condition")}catch(e){if(!(e instanceof Deno.errors.NotFound))throw e}
 assert(bank.exercises.length===1&&!JSON.stringify(bank).includes("RESTRICTED_CONDITION"),"restricted AST escaped student facts");
 assert(work.rawAssessment.items.length===2&&work.rawAssessment.bodyJson===undefined,"raw composition lost members or retained AST");
 assert(work.rawAssessment.assignments["exr-secret"].workMode==="pair"&&work.rawAssessment.theoryTime===2.5,"assignment fields/theoryTime lost");
 if(Deno.args[0]!=="bank"){
 const html=await Deno.readTextFile(join(root,"_site/work.html"));
 assert(!html.includes("quarto-embedded-source-code"),"work source modal embeds restricted assignment IDs");
 try{await Deno.stat(join(root,"_site/work.qmd"));throw Error("work QMD source copy retains restricted assignment IDs")}catch(e){if(!(e instanceof Deno.errors.NotFound))throw e}
 assert(!html.includes("exr-secret"),"restricted filters-only cross-document assignment escaped student HTML");
 const config=await Deno.readTextFile(join(root,"_quarto.yml"));
 await Deno.writeTextFile(join(root,"_quarto.yml"),config.replace("  type: book\n","  type: book\n  pre-render: _extensions/course-core/entrypoints/pre.ts\n  post-render: _extensions/course-core/entrypoints/post.ts\n"));
 await render();
 const hooked=await Deno.readTextFile(join(root,"_site/work.html"));
 assert(hooked.includes("exr-open")&&!hooked.includes("exr-secret"),"current-run native links lost open member or leaked restricted member");
 assert(hooked.includes("обязательные 10 мин; все 35 мин")&&hooked.includes("обязательные 12.5 мин; все 37.5 мин"),"current-run four totals/theory-time lost");
 const current=await doc("work.qmd");
 assert(!JSON.stringify({...current,rawAssessment:undefined,declarations:undefined}).includes("exr-secret"),"restricted Cite or marker leaked in projected service AST");
 const ordered=await Deno.readTextFile(join(root,"_quarto.yml"));
 await Deno.writeTextFile(join(root,"_quarto.yml"),ordered.replace("[index.qmd, bank.qmd, work.qmd]","[index.qmd, work.qmd, bank.qmd]"));
 await render();
 assert(!(await Deno.readTextFile(join(root,"_site/work.html"))).includes("exr-secret"),"work-before-bank source order leaked restricted reference");
 await render(undefined,["work.qmd"]);
 const partial=await Deno.readTextFile(join(root,"_site/work.html"));
 assert(!partial.includes("exr-secret")&&!partial.includes('data-course-assessment-time="ready"'),"partial preview reused prior closed link/fake totals");
 await Deno.writeTextFile(join(root,"late-failure.lua"),'return {{Pandoc=function(doc) error("LATE_NATIVE_STOP") end}}');
 await render("LATE_NATIVE_STOP",["work.qmd","--lua-filter","late-failure.lua"]);
 const configured=await Deno.readTextFile(join(root,"_quarto.yml"));
 await Deno.writeTextFile(join(root,"_quarto.yml"),configured.replace('  pre-render: _extensions/course-core/entrypoints/pre.ts\n','').replace('  post-render: _extensions/course-core/entrypoints/post.ts\n',''));
 await render(undefined,["work.qmd"]);
 const hookless=await Deno.readTextFile(join(root,"_site/work.html"));
 assert(!hookless.includes("exr-secret"),"aborted pointer restored late-projection in filters-only render");
 const hooklessDoc=await doc("work.qmd");
 assert(!JSON.stringify({...hooklessDoc,rawAssessment:undefined,declarations:undefined}).includes("exr-secret"),"aborted pointer leaked restricted Cite in filters-only projected AST");
 }
 console.log("PASS bank/native/raw composition and strict native cross-document student references");
}finally{await Deno.remove(root,{recursive:true})}
