import { dirname, fromFileUrl, join } from "stdlib/path";
import { copy } from "stdlib/fs";
import { collectExport } from "../_extensions/course-core/body-export/collect.ts";
import { buildBodies } from "../_extensions/course-core/body-export/producer.ts";
import { loadNativeRun } from "../_extensions/course-core/infrastructure/native-run.ts";
const repo=dirname(dirname(fromFileUrl(import.meta.url)));
const root=await Deno.makeTempDir({prefix:"course-bank-ownership-"});
const started=performance.now();
function assert(value:unknown,message:string):asserts value {if(!value)throw Error(message);}
async function write(path:string,value:string){await Deno.mkdir(dirname(join(root,path)),{recursive:true});await Deno.writeTextFile(join(root,path),path.startsWith('bank/')&&!path.includes('/nested/')&&path.endsWith('.qmd')&&!path.endsWith('work.qmd')?'---\nexercise-bank: true\nexercise-statement-visibility: open\n---\n'+value:value);}
try {
 await copy(join(repo,"_extensions/course-core"),join(root,"bank/_extensions/course-core"));
 await write("_quarto.yml","project: {type: default}\ncourse: {id: logical-course}\n");
 await write("bank/_quarto.yml","project: {type: book, output-dir: _book}\nbook: {title: Bank, chapters: [index.qmd, work.qmd, questions.qmd]}\nformat: html\nfilters: [course-core]\n");
 await write("bank/index.qmd","---\ntitle: Bank\n---\n# Bank\n");
 await write("bank/work.qmd","---\nassessment: {id: selected, kind: lab}\n---\n# Work\n\n::: {.task-items}\n- @exr-local\n- @exr-unpublished\n- @exr-alias\n:::\n");
 await write("bank/questions.qmd","# Questions\n\n::: {#exr-local difficulty=introductory time=10}\nOWN_BANK_CONDITION\n:::\n");
 await write("bank/unpublished.qmd","# Unpublished source\n\n::: {#exr-unpublished difficulty=introductory time=10}\nOWN_UNPUBLISHED_CONDITION\n:::\n");
 await write("bank/nested/_quarto.yaml","project: {type: default}\nformat: revealjs\n");
 await write("bank/nested/deep/index.qmd","# Separate native project\n\n::: {#exr-local difficulty=introductory time=10}\nFOREIGN_DUPLICATE_ID\n:::\n\n::: {#exr-foreign difficulty=introductory time=10}\nFOREIGN_CONDITION\n:::\n");
 await write("bank/own-source.md","---\nexercise-bank: true\nexercise-statement-visibility: open\n---\n# Owned alias source\n\n::: {#exr-alias difficulty=introductory time=10}\nOWN_ALIAS_CONDITION\n:::\n");
 await Deno.symlink("own-source.md",join(root,"bank/alias.qmd"));
 await Deno.symlink("nested/deep/index.qmd",join(root,"bank/nested-alias.qmd"));
 const selected=await collectExport(root,{book:"bank",work:"selected"});
 const bodies=await buildBodies(selected.result,{projectRoot:selected.projectRoot,courseId:selected.courseId,work:selected.work});
 assert(bodies.publicPackage.questions.length===3&&JSON.stringify(bodies.publicPackage).includes("OWN_UNPUBLISHED_CONDITION"),"unpublished bank source must survive native ownership selection");
 const run=await loadNativeRun(join(root,"bank"));
 assert(run.documents.length===5&&run.documents.every(d=>!d.source.startsWith("nested/")&&d.source!=="nested-alias.qmd"),"nested native project participated in source render");
 await write("bank/nested/deep/index.qmd","# Separate native project\n\n::: {#exr-foreign difficulty=introductory time=10}\nFOREIGN_CONDITION\n:::\n");
 await write("bank/foreign-work.qmd","---\nassessment: {id: foreign-member, kind: lab}\n---\n# Foreign member\n\n::: {.task-items}\n- @exr-foreign\n:::\n");
 let missing=false;try {await collectExport(root,{book:"bank",work:"foreign-member"});}catch(e){missing=e instanceof Error && (e as any).code === "CORE.UNKNOWN_MEMBER" && ["foreign-work.qmd", "foreign-member", "exr-foreign", "items"].every(term => e.message.includes(term));}
 assert(missing,"missing bank member was implicitly imported from nested project");
 await write("bank/nested/deep/index.qmd","# Separate native project\n\n::: {#exr-invalid difficulty=introductory time=10}\n```{.yaml .answer-spec}\ntype: unknown-foreign-bank\n```\n:::\n");
 const own=await collectExport(root,{book:"bank",work:"selected"});
 assert(own.result.model.exercises.length===3,"foreign declaration validation affected chosen bank");
 assert(JSON.stringify(bodies.publicPackage).includes("OWN_ALIAS_CONDITION"),"legitimate physically contained own-bank alias lost");
 await write("outside/foreign.qmd","# Outside bank\n\n::: {#exr-outside difficulty=introductory time=10}\nOUTSIDE_BANK_CONDITION\n:::\n");
 await Deno.symlink("../outside/foreign.qmd",join(root,"bank/outside-alias.qmd"));
 let outside=false;try {await collectExport(root,{book:"bank",work:"selected"});}catch(e){outside=String(e).includes("EXPORT.SOURCE_OUTSIDE_BANK:");}
 assert(outside,"physically outside symlink input was treated as owned bank source");
 console.log(`PASS bank native ownership: foreign duplicate/invalid declarations excluded, missing member cannot import, own unpublished QMD retained (${Math.round(performance.now()-started)}ms)`);
}finally {await Deno.remove(root,{recursive:true});}
