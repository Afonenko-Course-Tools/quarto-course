const perfSpecs:any[]=[];
Deno.env.set('COURSE_PERF_MODE','summary');
const perfKey=Symbol.for('course.performance.agent.v1');
const perfWrap=(spec:any,fn:Function)=>{perfSpecs.push(spec);return fn};
(globalThis as any)[perfKey]={abiVersion:1,metrics:{wrapSync:perfWrap,wrapAsync:perfWrap,wrapWalk:perfWrap,childEnv:(env:any)=>env}};
import { join } from "stdlib/path";
const path = new URL(
  "../_extensions/course-core/infrastructure/native-run.ts",
  import.meta.url,
);
try {
  await Deno.stat(path);
} catch {
  throw Error("native current-run bridge is missing");
}
const { beginNativeRun, finishNativeRun, loadNativeRun } = await import(
  path.href
);
const root = await Deno.makeTempDir({ prefix: "native-run-" });
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
async function refuses(f: () => Promise<unknown>, message: string) {
  let failed = false;
  try {
    await f();
  } catch {
    failed = true;
  }
  assert(failed, message);
}
try {
  await Deno.mkdir(join(root, "_site"));
  await Deno.writeTextFile(join(root, "index.qmd"), "source");
  await Deno.writeTextFile(join(root,"_quarto.yml"),"project: {type: default, output-dir: _site, render: [index.qmd]}\nformat: {html: {}, pdf: {}}\n");
  await Deno.writeTextFile(join(root,"_quarto-student.yml"),"course: {view: student}\n");
  const inputs = join(root, "inputs.txt"), outputs = join(root, "outputs.txt");
  await Deno.writeTextFile(inputs, join(root, "index.qmd"));
  await Deno.writeTextFile(outputs, join(root, "_site/index.html"));
  Deno.env.set("QUARTO_PROJECT_INPUT_FILES", join(root, "index.qmd"));
  Deno.env.set("QUARTO_PROJECT_OUTPUT_FILES", join(root, "_site/index.html"));
  Deno.env.set("QUARTO_PROJECT_OUTPUT_DIR", "_site");
  Deno.env.set("QUARTO_PROFILE", "student");
  const doc = {
    scope: "document",
    source: "index.qmd",
    course: { id: "test", view: "student" },
    document: {
      source: "index.qmd",
      output: "index.html",
      format: "html",
      profiles: ["student"],
    },
    exercises: [],
  };
  const run = await beginNativeRun(root);
  // Public no-output hook notifications must not invent a completed run.
  const post = new URL(
    "../_extensions/course-core/entrypoints/post.ts",
    import.meta.url,
  );
  for (const fileMode of [false, true]) {
    const emptyList = join(root, "empty-outputs.txt");
    await Deno.writeTextFile(emptyList, "");
    const hook = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
      args: ["run", post.pathname],
      cwd: root,
      env: {
        QUARTO_PROJECT_DIR: root,
        QUARTO_PROJECT_OUTPUT_FILES: "",
        QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES: fileMode ? emptyList : "",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(
      hook.success,
      "empty public hook failed: " + new TextDecoder().decode(hook.stderr),
    );
    await refuses(
      () => loadNativeRun(root),
      "empty hook fabricated completion",
    );
  }
  await Deno.writeTextFile(
    join(run.directory, "documents/current.json"),
    JSON.stringify(doc),
  );
  await refuses(() => finishNativeRun(root), "missing output accepted");
  await refuses(() => loadNativeRun(root), "failed run loaded");
  await Deno.writeTextFile(join(root, "_site/index.html"), "current");
  const completed = await finishNativeRun(root);
  const {commonPathDocument}=await import('../_extensions/course-core/infrastructure/native-run.ts');
  await commonPathDocument(root,'index.qmd','html');
  assert(perfSpecs.some(spec=>spec.id==='course-core.infrastructure.native-run.commonPathDocument' && spec.document_id==='index.qmd' && spec.attributes.extension_id==='course-core'),'per-document native context missing');
  assert(perfSpecs.filter(spec=>/\.(beginNativeRun|finishNativeRun|saveNativeRun)$/.test(spec.id)).every(spec=>spec.document_id===undefined),'batch boundary selected arbitrary document');
  assert(completed.documents.length === 1, "current document missing");
  assert(
    (await loadNativeRun(root, { view: "student", profiles: ["student"] }))
      .documents.length === 1,
    "completed run not loaded",
  );
  await refuses(
    () => loadNativeRun(root, { view: "full" }),
    "wrong audience accepted",
  );
  await Deno.writeTextFile(join(root, "_site/unrecorded.html"), "unrecorded");
  Deno.env.set(
    "QUARTO_PROJECT_OUTPUT_FILES",
    join(root, "_site/index.html") + "\n" + join(root, "_site/unrecorded.html"),
  );
  await refuses(
    () => finishNativeRun(root),
    "unrecorded Course output accepted",
  );
  Deno.env.set("QUARTO_PROJECT_OUTPUT_FILES", join(root, "_site/index.html"));
  const next = await beginNativeRun(root);
  assert(next.directory !== run.directory, "reused run directory");
  await refuses(() => loadNativeRun(root), "previous completion accepted");
  await Deno.writeTextFile(
    join(next.directory, "documents/stale.json"),
    JSON.stringify({
      ...doc,
      source: "removed.qmd",
      document: {
        ...doc.document,
        source: "removed.qmd",
        output: "removed.html",
      },
    }),
  );
  await refuses(
    () => finishNativeRun(root),
    "removed output document accepted",
  );
  const adapterRun = await beginNativeRun(root);
  await Deno.writeTextFile(
    join(adapterRun.directory, "documents/html.json"),
    JSON.stringify(doc),
  );
  const adapterDirectory = join(root, "adapter"),
    fragmentsDirectory = join(adapterRun.directory, "adapters/demo");
  await Deno.mkdir(adapterDirectory);
  await Deno.mkdir(fragmentsDirectory);
  await Deno.writeTextFile(
    join(fragmentsDirectory, "contract.json"),
    JSON.stringify({
      name: "demo",
      directory: adapterDirectory,
      rules: "rules.cue",
    }),
  );
  const fragment = { ...doc, adapter: "demo", document: { ...doc.document } };
  delete (fragment.document as any).output;
  await Deno.writeTextFile(
    join(fragmentsDirectory, "fragment.json"),
    JSON.stringify(fragment),
  );
  await refuses(
    () => finishNativeRun(root),
    "missing adapter output context filled from unrelated document",
  );
  const pdfRun = await beginNativeRun(root);
  await Deno.writeTextFile(
    join(pdfRun.directory, "documents/pdf.json"),
    JSON.stringify({
      ...doc,
      document: { ...doc.document, format: "latex", output: "index.tex" },
    }),
  );
  await Deno.writeTextFile(join(root, "_site/index.pdf"), "current PDF");
  await Deno.writeTextFile(join(root, "_site/other.pdf"), "other PDF");
  Deno.env.set("QUARTO_PROJECT_OUTPUT_FILES", join(root, "_site/other.pdf"));
  await refuses(
    () => finishNativeRun(root),
    "unlisted/stale or wrong-stem PDF accepted",
  );
  Deno.env.set("QUARTO_PROJECT_OUTPUT_FILES", join(root, "_site/index.pdf"));
  assert(
    (await finishNativeRun(root)).documents[0].document.output === "index.pdf",
    "current PDF final context missing",
  );
  const pdfAdapterDirectory = join(pdfRun.directory, "adapters/demo");
  await Deno.mkdir(pdfAdapterDirectory);
  await Deno.writeTextFile(
    join(pdfAdapterDirectory, "contract.json"),
    JSON.stringify({
      name: "demo",
      directory: adapterDirectory,
      rules: "rules.cue",
    }),
  );
  await Deno.writeTextFile(
    join(pdfAdapterDirectory, "fragment.json"),
    JSON.stringify({
      ...doc,
      adapter: "demo",
      document: { ...doc.document, format: "latex", output: "index.tex" },
    }),
  );
  const finalPdf = await finishNativeRun(root);
  assert(
    (finalPdf.adapters[0].fragments.get("index.qmd") as any).document.output ===
      "index.pdf",
    "PDF adapter context was not bound to exact current output",
  );
  console.log(
    "PASS fresh capture, missing outputs, failed/removed results, audience expectations",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}

const {assessmentTime}=await import("../_extensions/course-core/entrypoints/preview.ts");
const facts=new Map([['exr-demo',{time:10}],['exr-required',{time:25}],['exr-optional',{time:40}]] as any);
const timed:any={slots:[{id:'exr-demo',selection:'fixed',candidates:['exr-demo'],assignment:{stage:'demonstration',requirement:'required',workMode:'individual'}},{id:'exr-required',selection:'fixed',candidates:['exr-required'],assignment:{requirement:'required',workMode:'pair'}},{id:'exr-optional',selection:'fixed',candidates:['exr-optional'],assignment:{requirement:'optional',workMode:'group'}}],theoryTime:15};
assert(JSON.stringify(assessmentTime(timed,facts as any))===JSON.stringify({required:{min:35,max:35},all:{min:75,max:75},theory:15,sessionRequired:{min:50,max:50},sessionAll:{min:90,max:90}}),'required/all times must include demonstration and add theory once without work-mode scaling');
const random={...timed,slots:[{id:'alt-time',selection:'random',candidates:['exr-demo','exr-required'],assignment:{requirement:'required',workMode:'individual'}}]};
assert(JSON.stringify(assessmentTime(random,facts as any))===JSON.stringify({required:{min:10,max:25},all:{min:10,max:25},theory:15,sessionRequired:{min:25,max:40},sessionAll:{min:25,max:40}}),'random time must be a candidate range');
assert(assessmentTime(timed,new Map())===undefined,'partial current run fabricated zero or a partial sum');
console.log('PASS current-run four totals and unavailable partial time');
