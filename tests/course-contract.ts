import { dirname, fromFileUrl, join } from "stdlib/path";
import { copy } from "stdlib/fs";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({prefix:"course-contract-"});
const assert = (v:unknown,m:string) => {if(!v) throw Error(m);};
const started = performance.now();
async function render(body:string, expected?:string) {
  await Deno.writeTextFile(join(root,"index.qmd"),body);
  const r = await new Deno.Command(Deno.env.get("QUARTO")||"quarto",{args:["render","index.qmd","--to","html"],cwd:root,stdout:"piped",stderr:"piped"}).output();
  const log = new TextDecoder().decode(r.stdout)+new TextDecoder().decode(r.stderr);
  assert(expected ? !r.success&&log.includes(expected):r.success,log);
  if(expected)return;
  const documents=[];
  try { for await(const f of Deno.readDir(join(root,"_generated/course-spec/documents/default"))) documents.push(JSON.parse(await Deno.readTextFile(join(root,"_generated/course-spec/documents/default",f.name)))); } catch(e) {if(!(e instanceof Deno.errors.NotFound))throw e;}
  return documents[0];
}
try {
  await copy(join(repo,"_extensions/course-core"),join(root,"_extensions/course-core"));
  await Deno.writeTextFile(join(root,"_quarto.yml"),"project:\n  type: default\n  output-dir: _site\nformat: html\nfilters: [course-core]\n");
  const ordinary="## Ordinary heading\n\n::: {#exr-native .content-visible when-format=html name=Native-exercise-title}\nNATIVE_CONDITION\n:::\n\n::: {#exm-example}\nNATIVE_EXAMPLE\n:::\n\n::: {#sol-unrelated}\nStandalone native solution.\n:::\n";
  const d=await render(ordinary);
  assert(d?.exercises.length===0,"Outside-bank native exercises must not enter canonical facts");

  assert(d?.course.id===undefined,"ordinary render must not invent course identity");

  await render('---\nexercise-bank: true\nexercise-statement-visibility: open\n---\n::: {#exr-native difficulty="unknown"}\nBody\n:::\n',"Недопустимое значение учебного атрибута difficulty");
  await render('::: {#exr-native course-role="unknown"}\nBody\n:::\n',"Неизвестная учебная роль");
  await render('::: {.when-full}\nLegacy shorthand\n:::\n','Краткие классы when-/unless- не поддерживаются');
  const w=await render('---\ntitle: Work\nassessment:\n  id: checksum-lab\n  kind: lab\n---\n## Assignment\n\n::: {.task-items}\n1. @exr-first\n2. [@exr-second]{requirement="optional"}\n:::\n');
  assert(w?.assessment.id==="checksum-lab","work explicit ID must not require sec-* author heading");
  assert(JSON.stringify(w?.assessment.items)==='["exr-first","exr-second"]',"native task selection lost members");
  assert(w?.assessment.assignments?.["exr-first"].requirement==="required"&&w?.assessment.assignments?.["exr-second"].requirement==="optional","task requirement defaults/Span optionality lost");
  await render('---\ntitle: Work\nassessment: {id: practice}\n---\n::: {.task-items}\n- @exr-first\n:::\n',"CORE.ASSESSMENT_INVALID");
  await render('---\nassessment: {id: old, kind: lab}\n---\n::: {.assessment-items}\n- @exr-first\n:::\n',"CORE.ASSESSMENT_INVALID");
  await render('---\nassessment: {id: repeated, kind: lab}\n---\n::: {.task-items}\n- @exr-first\n- @exr-first\n:::\n',"CORE.ASSESSMENT_INVALID");
  console.log(`PASS native optional identity/metadata/solution; task-items explicit identity/defaults/optional/handout (${Math.round(performance.now()-started)}ms)`);
} finally {await Deno.remove(root,{recursive:true});}
