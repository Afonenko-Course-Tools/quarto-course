import { fixtureArray, fixtureAt, fixtureRecord, fixtureString, required } from "./helpers/required.ts";
import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
import { EarlyDocumentSchema } from "../_extensions/course-core/document/contracts.ts";
const core = join(
  dirname(dirname(fromFileUrl(import.meta.url))),
  "_extensions/course-core",
);
const root = await Deno.makeTempDir({ prefix: "a4a-pending-" });
async function put(p: string, text: string) {
  await Deno.mkdir(dirname(join(root, p)), { recursive: true });
  await Deno.writeTextFile(join(root, p), text);
}
await put(
  "_quarto.yml",
  `project:\n  type: website\n  output-dir: _site\n  pre-render: [quarto run ${core}/entrypoints/native-pre.ts, quarto run capture-pending.ts]\n  post-render: [quarto run ${core}/entrypoints/native-post.ts]\nformat:\n  html:\n    theme: none\ncourse: {id: pending-course, view: student, adapters: [fixture]}\ncourse-core-runtime: native-ts\nexercise-bank: true\ndefault-exercise-statement-visibility: open\ndefault-exercise-target: fixture\ndefault-exercise-project-check: fixture-check\ndefault-exercise-difficulty: introductory\ndefault-exercise-time: 7\ndefault-exercise-course-role: false\nfilters:\n  - at: pre-ast\n    path: raw-capture.lua\n  - at: pre-ast\n    path: ${core}/native-ts/early-context.lua\n  - at: post-quarto\n    path: ${core}/native-ts/late-kind.lua\n  - at: post-render\n    path: ${core}/native-ts/late-filter.lua\n`,
);
await put(
  "_extensions/fixture/contract.json",
  JSON.stringify({ name: "fixture" }),
);
await put(
  "index.qmd",
  "::: {#exr-open project=project fixture-extra=preserved name=Native}\n## Открытая задача\n\nОткрытая часть.\n:::\n\n::: {#exr-restricted project=project difficulty=introductory statement-visibility=restricted target=fixture}\n## Закрытая задача\n\nУсловие ограниченного назначения.\n:::\n",
);
await put("source.txt", "fixture source");
await put("project/input.txt", "Core-owned project input");
await put(
  "capture-pending.ts",
  String.raw`import * as Core from ${
    JSON.stringify(toFileUrl(join(core, "public.ts")).href)
  };
const root=Deno.cwd();
const pointerBefore:unknown=JSON.parse(await Deno.readTextFile(root+'/_generated/course-spec/native-ts/active.json'));
if(!pointerBefore||typeof pointerBefore!=='object'||!('operation' in pointerBefore)||typeof pointerBefore.operation!=='string')throw Error('Некорректный pending pointer');
if(Deno.env.get('A4A_PENDING_MODE')==='source-before-entry')await Deno.writeTextFile(root+'/index.qmd',(await Deno.readTextFile(root+'/index.qmd'))+'\nPENDINGBEFOREENTRYMARKER');
const retained:{operation?:Core.NativePendingOperation}={};
const checks:{name:string;passed:boolean}[]=[];
const expectation:Core.NativePendingOperationExpectation={root,profiles:[],projection:'student',outputDirectory:root+'/_site'};
const cases:[string,Partial<Core.NativePendingOperationExpectation>&{format?:string}][]=[['profile',{profiles:['other']}],['projection',{projection:'author'}],['format',{format:'latex'}],['owner',{root:root+'/missing'}]];
for(const [name,change] of cases){
 let error='';try{await Core.withPendingNativeOperation({...expectation,...change},async()=>{});}catch(e){error=String(e);}checks.push({name,passed:/OPERATION_BINDING|NotFound/.test(error)});
}
await Core.withPendingNativeOperation({root,profiles:[],projection:'student',outputDirectory:root+'/_site'},async op=>{
 retained.operation=op;
 const mode=Deno.env.get('A4A_PENDING_MODE');
 const identityBefore=JSON.stringify(op.identity),inputsBefore=JSON.stringify(op.inputs);
 if(mode==='source-change')await Deno.writeTextFile(root+'/index.qmd',(await Deno.readTextFile(root+'/index.qmd'))+'\nPENDINGCALLBACKMARKER');
 if(mode==='source-change'||mode==='source-before-entry')checks.push({name:'source-change-keeps-pending-correlation',passed:identityBefore===JSON.stringify(op.identity)&&inputsBefore===JSON.stringify(op.inputs)&&op.identity.operation===pointerBefore.operation});
 if(mode==='switch'){const r=await new Deno.Command('quarto',{args:['run',${
    JSON.stringify(join(core, "entrypoints/native-pre.ts"))
  }],cwd:root,stdout:'piped',stderr:'piped'}).output();if(!r.success)throw Error('switch pre');}
 await Deno.mkdir(root+'/_generated/c-fixture' ,{recursive:true});
 await Deno.writeTextFile(root+'/_generated/c-fixture/pending.json',JSON.stringify({identity:op.identity,inputs:op.inputs}));
});
if(!retained.operation)throw Error('Нет captured pending operation');
let expired='';try{void retained.operation.inputs;}catch(e){expired=String(e);}checks.push({name:'expired-pending-getter',passed:expired.includes('OPERATION_EXPIRED')});
await Deno.writeTextFile(root+'/_generated/c-fixture/probe.json',JSON.stringify(checks));`,
);
await put(
  "raw-capture.lua",
  `return {{Pandoc=function(doc)
 local root=quarto.project.directory
 local f=assert(io.open(root..'/_generated/c-fixture/pending.json','rb'));local p=pandoc.json.decode(f:read('*a'));f:close()
 local source=pandoc.path.make_relative(quarto.doc.input_file,root)
 local binding;for _,input in ipairs(p.inputs) do if input.source==source then binding=input end end
 assert(binding,'C.CAPTURE_MISSING')
 local ids=pandoc.List();doc:walk({Div=function(div)if div.identifier:match('^exr%-')then ids:insert(div.identifier)end end})
 if not os.getenv('A4A_KEEP_RAW') then local output=assert(io.open(root..'/_generated/c-fixture/raw.json','wb'));output:write(pandoc.json.encode({identity=p.identity,format=quarto.format.format_identifier()['target-format'],source=source,captureWitness=binding.captureWitness,ids=ids}));output:close() end
 return doc
end}}`,
);
const result = await new Deno.Command("quarto", {
  args: ["render", "index.qmd", "--to", "html"],
  cwd: root,
  env: { QUARTO_RUN_NO_NETWORK: "true", DENO_NO_PACKAGE_JSON: "1" },
  stdout: "piped",
  stderr: "piped",
}).output();
const log = new TextDecoder().decode(result.stdout) +
  new TextDecoder().decode(result.stderr);
await Deno.writeTextFile(
  join(root, "_generated/qualification-pending-render.log"),
  log,
);
if (!result.success) {
  throw Error(
    "Pending actual pre phase: " + root +
      "/_generated/qualification-pending-render.log\n" + log,
  );
}
const checks: { name: string; passed: boolean }[] = [];
const expectation: Core.NativeOperationExpectation = {
  root,
  profiles: [],
  projection: "student",
  outputDirectory: join(root, "_site"),
};
async function refusal(name: string, use: () => unknown, code: string) {
  let e = "";
  try {
    await use();
  } catch (error) {
    e = String(error);
  }
  checks.push({ name, passed: e.includes(code) });
}
function raw() {
  const captured: unknown = JSON.parse(Deno.readTextFileSync(join(root, "_generated/c-fixture/raw.json")));
  const value = fixtureRecord(captured);
  return {
    identity: Core.NativeOperationIdentitySchema.parse(value.identity),
    captureWitness: fixtureString(value.captureWitness), source: fixtureString(value.source),
    format: fixtureString(value.format), ids: fixtureArray(value.ids).map(fixtureString),
  };
}
function probeRows(value: unknown): {name: string; passed: boolean}[] {
  return fixtureArray(value).map((item) => {
    const row = fixtureRecord(item);
    if (typeof row.name !== "string" || typeof row.passed !== "boolean") throw Error("Некорректная строка probe fixture");
    return {name: row.name, passed: row.passed};
  });
}
const seenInputs: Core.NativeAdapterValidationInput[] = [];
const validate: Core.NativeAdapterValidator["validate"] = (input) => {
  seenInputs.push(input);
  const captured = raw();
  if (
    captured.captureWitness !== input.origin.captureWitness ||
    captured.identity.operation !== input.origin.operation ||
    captured.source !== input.origin.source ||
    JSON.stringify(captured.identity.profiles) !==
      JSON.stringify(input.origin.profiles) ||
    captured.identity.projection !== input.origin.projection ||
    captured.format !== input.origin.format
  ) throw Error("C.CAPTURE_CHANGED");
  if (!captured.ids.includes("exr-restricted")) {
    throw Error("C.CAPTURE_AFTER_PROJECTION");
  }
  return { sources: [] };
};
await Core.withCurrentNativeOperation(expectation, async (op) => {
  const proof = await op.validateRelease({ expectedSources: ["index.qmd"] }, [{
    name: "fixture",
    nativeMetadataReadSet: [],
    validate,
  }]);
  const effective = required(required(seenInputs[0]).declarations.find((d) =>
    d.id === "exr-open"
  )).attributes;
  checks.push({
    name: "actual-effective-Core-fields-overlay",
    passed: effective.target === "fixture" &&
      effective["project-check"] === "fixture-check" &&
      effective.difficulty === "introductory" && effective.time === "7" &&
      effective["statement-visibility"] === "open" &&
      effective["course-role"] === undefined &&
      effective.project === "project" &&
      effective["fixture-extra"] === "preserved" && effective.name === "Native",
  });
  checks.push({
    name: "actual-raw-before-projection-with-witness",
    passed: proof.exerciseIds.includes("exr-restricted") &&
      !op.document({ source: "index.qmd" }).definitions["exr-restricted"],
  });
  const requiredProof = await op.validateRelease(
    { expectedSources: ["index.qmd"] },
    [{
      name: "fixture",
      nativeMetadataReadSet: [],
      validate: (input) => {
        validate(input);
        return {
          sources: [{ path: "source.txt", kind: "file" }, {
            path: "project",
            kind: "directory",
          }],
        };
      },
    }],
  );
  checks.push({
    name: "captured-adapter-required-file-and-directory",
    passed: requiredProof.validatedAdapters.includes("fixture"),
  });
  const goodRaw = raw();
  for (
    const [name, change] of [
      ["source", { source: "foreign.qmd" }],
      ["format", { format: "latex" }],
      ["profiles", {
        identity: { ...goodRaw.identity, profiles: ["foreign"] },
      }],
      ["projection", {
        identity: { ...goodRaw.identity, projection: "author" },
      }],
    ] as const
  ) {
    await Deno.writeTextFile(
      join(root, "_generated/c-fixture/raw.json"),
      JSON.stringify({ ...goodRaw, ...change }),
    );
    await refusal(
      "foreign-raw-capture-" + name,
      () =>
        op.validateRelease({ expectedSources: ["index.qmd"] }, [{
          name: "fixture",
          nativeMetadataReadSet: [],
          validate,
        }]),
      "C.CAPTURE_CHANGED",
    );
  }
  await Deno.writeTextFile(
    join(root, "_generated/c-fixture/raw.json"),
    JSON.stringify(goodRaw),
  );
  await refusal(
    "adapter-missing-owner-validator",
    () => op.validateRelease({ expectedSources: ["index.qmd"] }),
    "RELEASE.ADAPTER_UNQUALIFIED",
  );
  for (
    const [name, path, kind] of [
      ["outside", "../escape", "file"],
      ["cache", ".cache/codex-tools/marker", "file"],
      ["missing", "missing.txt", "file"],
      ["excluded", "_generated/c-fixture/pending.json", "file"],
      ["wrong-type", "index.qmd", "directory"],
    ] as const
  ) {
    const use = () => op.validateRelease({ expectedSources: ["index.qmd"] }, [{
          name: "fixture",
          nativeMetadataReadSet: [],
          validate: () => ({ sources: [{ path, kind }] }),
        }]);
    if (name === "missing") {
      let error: unknown;
      try { await use(); } catch (caught) { error = caught; }
      checks.push({ name: "adapter-source-missing", passed: error instanceof Deno.errors.NotFound &&
        error.message.includes(join(root, "missing.txt")) });
      continue;
    }
    await refusal(
      "adapter-source-" + name,
      use,
      name === "outside"
        ? "RELEASE.ADAPTER_UNQUALIFIED"
        : name === "wrong-type"
        ? "RESOURCE.PROJECT_MISSING"
        : name === "cache"
        ? "RESOURCE.PROJECT_PATH_INVALID"
        : "RELEASE.SOURCE_POLICY",
    );
  }
});
await refusal(
  "completed-pending-refused",
  () => Core.withPendingNativeOperation(expectation, async () => {}),
  "OPERATION_COMPLETED",
);
checks.push(
  ...probeRows(JSON.parse(
    await Deno.readTextFile(join(root, "_generated/c-fixture/probe.json")),
  )),
);
const originalIndex = await Deno.readTextFile(join(root, "index.qmd"));
await refusal(
  "adapter-source-symlink",
  () =>
    Core.withCurrentNativeOperation(expectation, async (op) => {
      await op.validateRelease({ expectedSources: ["index.qmd"] }, [{
        name: "fixture",
        nativeMetadataReadSet: [],
        validate: async () => {
          await Deno.remove(join(root, "index.qmd"));
          await Deno.symlink("source.txt", join(root, "index.qmd"));
          return { sources: [{ path: "index.qmd", kind: "file" }] };
        },
      }]);
    }),
  "OPERATION_CHANGED",
);
await Deno.remove(join(root, "index.qmd"));
await Deno.writeTextFile(join(root, "index.qmd"), originalIndex);
const first = raw();
async function render(env: Record<string, string> = {}) {
  return await new Deno.Command("quarto", {
    args: ["render", "index.qmd", "--to", "html"],
    cwd: root,
    env: { QUARTO_RUN_NO_NETWORK: "true", DENO_NO_PACKAGE_JSON: "1", ...env },
    stdout: "piped",
    stderr: "piped",
  }).output();
}
const again = await render({ A4A_KEEP_RAW: "1" });
if (!again.success) throw Error(new TextDecoder().decode(again.stderr));
await Core.withCurrentNativeOperation(expectation, async (op) => {
  checks.push({
    name: "new-generation-with-equal-source",
    passed: op.identity.operation !== first.identity.operation,
  });
  await refusal(
    "old-raw-witness-new-generation",
    () =>
      op.validateRelease({ expectedSources: ["index.qmd"] }, [{
        name: "fixture",
        nativeMetadataReadSet: [],
        validate,
      }]),
    "C.CAPTURE_CHANGED",
  );
});
await Core.withCurrentNativeOperation(expectation, async (op) => {
  const proof = await op.validateRelease({ expectedSources: ["index.qmd"] }, [{
    name: "fixture",
    nativeMetadataReadSet: [],
    validate: async () => {
      await Deno.writeTextFile(
        join(root, "source.txt"),
        "Изменённый source adapter.",
      );
      return { sources: [{ path: "source.txt", kind: "file" }] };
    },
  }]);
  checks.push({
    name: "adapter-current-physical-source",
    passed: proof.validatedAdapters.includes("fixture"),
  });
});
const switched = await render({ A4A_PENDING_MODE: "switch" });
checks.push({
  name: "switch-inside-pending-final-fence",
  passed: !switched.success &&
    new TextDecoder().decode(switched.stderr).includes("OPERATION_CHANGED"),
});
for (const [mode, marker] of [
  ["source-before-entry", "PENDINGBEFOREENTRYMARKER"],
  ["source-change", "PENDINGCALLBACKMARKER"],
] as const) {
  await Deno.writeTextFile(join(root, "index.qmd"), originalIndex);
  const changed = await render({ A4A_PENDING_MODE: mode });
  await Deno.writeTextFile(join(root, "_generated/qualification-" + mode + ".log"),
    new TextDecoder().decode(changed.stdout) + new TextDecoder().decode(changed.stderr));
  if (!changed.success) throw Error(mode + ": " + new TextDecoder().decode(changed.stderr));
  await Core.withCurrentNativeOperation(expectation, async (op) => {
    const pointer = fixtureRecord(JSON.parse(await Deno.readTextFile(join(root, "_generated/course-spec/native-ts/active.json"))));
    const state = fixtureRecord(JSON.parse(await Deno.readTextFile(join(fixtureString(pointer.directory), "state.json"))));
    const early = EarlyDocumentSchema.parse(JSON.parse(await Deno.readTextFile(join(fixtureString(pointer.directory), "0.early.json"))));
    const pending = Core.NativePendingOperationSchema.parse(JSON.parse(await Deno.readTextFile(join(root, "_generated/c-fixture/pending.json"))));
    const captured = raw();
    const probe = probeRows(JSON.parse(await Deno.readTextFile(join(root, "_generated/c-fixture/probe.json"))));
    checks.push({ name: mode + "-actual-body-and-stable-correlation", passed:
      (await Deno.readTextFile(join(root, "index.qmd"))).includes(marker) && JSON.stringify(early.ast.blocks).includes(marker) &&
      pointer.operation === op.identity.operation && pending.identity.operation === op.identity.operation &&
      early.context.operation === op.identity.operation && captured.identity.operation === op.identity.operation &&
      pending.inputs.length === 1 && required(pending.inputs[0]).source === "index.qmd" &&
      required(pending.inputs[0]).captureWitness === early.context.captureWitness &&
      captured.captureWitness === early.context.captureWitness && early.context.captureWitness === fixtureAt(state, ["captureWitnesses", "index.qmd"]) &&
      op.metrics.inspectCalls === 1 && probe.every((c) => c.passed) &&
      probe.some((c) => c.name === "expired-pending-getter" && c.passed) &&
      probe.some((c) => c.name === "source-change-keeps-pending-correlation" && c.passed) });
    await op.assertCurrent();
  });
}
const missing = await Deno.makeTempDir({ prefix: "a4a-pending-missing-" });
await refusal(
  "missing-generation",
  () =>
    Core.withPendingNativeOperation({
      ...expectation,
      root: missing,
      outputDirectory: join(missing, "_site"),
    }, async () => {}),
  "OPERATION_INCOMPLETE",
);
console.log(
  JSON.stringify({
    status: checks.every((c) => c.passed) ? "PASS" : "FAIL",
    root,
    checks,
  }),
);
if (checks.some((c) => !c.passed)) throw Error("A4a pending lifecycle");
