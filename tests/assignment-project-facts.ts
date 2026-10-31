// Ordinary standalone Pandoc transport parity; NOT a qualified assignment producer.
import { normalizeDocument } from "../_extensions/course-core/document/normalize.ts";
import { NativeProjectFactsCaptureSchema } from "../_extensions/course-core/document/project-facts.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const extension = join(
    dirname(dirname(fromFileUrl(import.meta.url))),
    "_extensions/course-core",
  ),
  root = await Deno.makeTempDir({ prefix: "project-facts-parity-" });
const canonical = (v: unknown): string =>
  JSON.stringify(
    v,
    (_k, x) =>
      x && typeof x === "object" && !Array.isArray(x)
        ? Object.fromEntries(
          Object.entries(x).sort(([a], [b]) => a.localeCompare(b)),
        )
        : x,
  );
async function pandoc(args: string[], input: string) {
  const p = new Deno.Command("quarto", {
    args: ["pandoc", ...args],
    env: { CANONICAL_EXTENSION: extension, FACT_ROOT: root },
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const writer = p.stdin.getWriter();
  await writer.write(new TextEncoder().encode(input));
  await writer.close();
  const r = await p.output();
  if (!r.success) throw Error(new TextDecoder().decode(r.stderr));
  return new TextDecoder().decode(r.stdout);
}
let success = false;
try {
  const source =
    '---\ncourse: {id: facts, view: full}\nexercise-bank: true\nproject-checks:\n  defaults: {runtime: java25-junit-v1, scoring: {mode: weighted}}\n  source-profiles:\n    main: {mode: implementation, root: student, include: ["*.java"]}\n  profiles:\n    junit: {source-profile: main, tests: ["tests/*Test.java"]}\ndefault-exercise-project-check: junit\nproject-materialization:\n  projects:\n    exr-demo: {common-files: [{source: common/Support.java, target: student/src/Support.java, audience: student}], include-git: true}\n---\n' +
    ["demonstration", "discussion", "independent-study", "control"].map((
      role,
      i,
    ) =>
      `::: {#exr-${i ? "role" + i : "demo"} project="/projects/p${i}" ${
        i === 0
          ? "project-check=junit target=prairielearn"
          : i === 1
          ? "target=other-adapter"
          : ""
      } difficulty=introductory statement-visibility=${
        i % 2 ? "restricted" : "open"
      } course-role=${role}${
        i === 3 ? " .content-visible when-profile=advanced" : ""
      }}\n## ${role}\nУсловие.\n:::\n`
    ).join("\n");
  const ast = JSON.parse(
    await pandoc(["-f", "markdown", "-t", "json"], source),
  );
  const lua = join(root, "probe.lua");
  await Deno.writeTextFile(
    lua,
    `package.path=os.getenv('CANONICAL_EXTENSION')..'/?.lua;'..package.path
quarto={project={directory=os.getenv('FACT_ROOT')},doc={input_file=os.getenv('FACT_ROOT')..'/bank.qmd'}}
return {{Pandoc=function(doc)
 local real_dofile=dofile
 local baseline=real_dofile(os.getenv('CANONICAL_EXTENSION')..'/projects.lua')
 local defaults=require('exercise-defaults')
 local expected=baseline.collect(doc,defaults.normalize(doc:clone()))
 local calls=0
 dofile=function(path)
  local value=real_dofile(path)
  if path:match('/projects%.lua$') then
   local collect=value.collect
   value.collect=function(...) calls=calls+1;return collect(...) end
  end
  return value
 end
 local context=pandoc.json.decode(assert(io.open(os.getenv('FACT_ROOT')..'/context.json')):read('*a'))
 local request={assignment={},capture=os.getenv('FACT_ROOT')..'/capture'}
 local transport=real_dofile(os.getenv('CANONICAL_EXTENSION')..'/native-ts/project-facts.lua')
 transport.capture(doc,request,context)
 assert(calls==1,'projects.collect call count '..calls)
 local frame=pandoc.json.decode(assert(io.open(request.capture..'.project-facts.json')):read('*a'))
 local out=assert(io.open(os.getenv('FACT_ROOT')..'/result.json','wb'));out:write(pandoc.json.encode({expected=expected,actual=frame,calls=calls}));out:close()
 return doc
end}}
`,
  );
  for (const bank of [true, false]) {
    const document = structuredClone(ast);
    document.meta["exercise-bank"] = { t: "MetaBool", c: bank };
    const context = {
      operation: crypto.randomUUID(),
      captureWitness: crypto.randomUUID(),
      input: join(root, "bank.qmd"),
      format: "revealjs",
      profiles: ["full"],
      projection: "author" as const,
      exerciseBank: bank,
      defaults: { "project-check": "junit" },
    };
    if (
      !bank &&
      Object.keys(normalizeDocument(document, context).definitions).length
    ) throw Error("Ordinary page behavior changed");
    const early = normalizeDocument(document, context, {
      source: "bank.qmd",
      assessments: [{ source: "work.qmd", id: "work" }],
      producerProfile: "standalone-transport-only",
    });
    if (!bank) {
      const duplicate = structuredClone(document);
      duplicate.blocks.push(structuredClone(document.blocks[0]));
      let rejected = false;
      try {
        normalizeDocument(duplicate, context, {
          source: "bank.qmd",
          assessments: [{ source: "work.qmd", id: "work" }],
          producerProfile: "standalone-transport-only",
        });
      } catch (e) {
        rejected = String(e).includes("DOCUMENT_DUPLICATE");
      }
      if (!rejected) throw Error("Duplicate page project accepted");
    }
    await Deno.writeTextFile(
      join(root, "context.json"),
      JSON.stringify(context),
    );
    await Deno.writeTextFile(
      join(root, "capture.early.json"),
      JSON.stringify(early),
    );
    await pandoc(
      ["-f", "json", "-t", "json", "--lua-filter", lua],
      JSON.stringify(document),
    );
    const result = JSON.parse(
        await Deno.readTextFile(join(root, "result.json")),
      ),
      actual = NativeProjectFactsCaptureSchema.parse(result.actual);
    if (
      result.calls !== 1 ||
      canonical(result.expected) !== canonical(actual.projects) ||
      actual.projects.length !== 4 || actual.projects.some((p) =>
        p.bankMember !== bank
      ) || !actual.projectMaterializations["exr-demo"]
    ) {
      throw Error(
        "Legacy collect parity/count/materialization lost " +
          canonical(result) + " actual=" + canonical(actual.projects),
      );
    }
    await Deno.remove(join(root, "capture.project-facts.json"));
  }
  success = true;
  console.log(
    "PASS existing Lua collect parity, EXACT one transport collect, bank/page, all four purposes, restricted/open policies, normalized checks/materialization, same capture context; standalone ordinary probe, no assignment profile qualification",
  );
} finally {
  if (success) await Deno.remove(root, { recursive: true });
  else console.error("Preserved failed parity fixture " + root);
}
