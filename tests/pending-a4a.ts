import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
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
if(Deno.env.get('A4A_PENDING_MODE')==='source-before-entry')await Deno.writeTextFile(root+'/index.qmd',(await Deno.readTextFile(root+'/index.qmd'))+'\nИзменённый entry input.');
let escaped;
const checks=[];
const expectation={root,profiles:[],format:'html',projection:'student',outputDirectory:root+'/_site'};
for(const [name,change] of [['profile',{profiles:['other']}],['projection',{projection:'author'}],['format',{format:'latex'}],['owner',{root:root+'/missing'}]]){
 let error='';try{await Core.withPendingNativeOperation({...expectation,...change},async()=>{});}catch(e){error=String(e);}checks.push({name,passed:/OPERATION_BINDING|NotFound/.test(error)});
}
const wholeCalls={},wholeOriginals=new Map();
const wholeMethods=['readDir','lstat','stat','realPath','readFile','readTextFile','readLink','open','writeFile','writeTextFile','mkdir','rename','remove','copyFile','symlink','truncate','chmod','utime'];
for(const method of wholeMethods)for(const api of [method,method+'Sync'])if(typeof Deno[api]==='function'){const fn=Deno[api];wholeCalls[api]=0;wholeOriginals.set(api,fn);Deno[api]=(...args)=>{wholeCalls[api]++;return fn(...args);};}
let wholeDigest=0;const wholeDigestFn=crypto.subtle.digest;crypto.subtle.digest=(...args)=>{wholeDigest++;return wholeDigestFn.apply(crypto.subtle,args);};
await Core.withPendingNativeOperation({root,profiles:[],format:'html',projection:'student',outputDirectory:root+'/_site'},async op=>{
 escaped=op;
 const calls={};const originals=new Map();const methods=['readDir','lstat','stat','realPath','readFile','readTextFile','readLink','open','writeFile','writeTextFile','mkdir','rename','remove','copyFile','symlink','truncate','chmod','utime'];
 for(const method of methods)for(const api of [method,method+'Sync'])if(typeof Deno[api]==='function'){const fn=Deno[api];calls[api]=0;originals.set(api,fn);Deno[api]=(...args)=>{calls[api]++;return fn(...args);};}
 let digestCalls=0;const digest=crypto.subtle.digest;crypto.subtle.digest=(...args)=>{digestCalls++;return digest.apply(crypto.subtle,args);};
 try{for(let i=0;i<100;i++){void op.identity;void op.inputs;}}finally{for(const [api,fn]of originals)Deno[api]=fn;crypto.subtle.digest=digest;}
 checks.push({name:'pending-getter-complete-IO-zero',passed:Object.values(calls).every(n=>n===0)&&digestCalls===0,calls,digestCalls});
 const mode=Deno.env.get('A4A_PENDING_MODE');
 if(mode==='source-change')await Deno.writeTextFile(root+'/index.qmd',(await Deno.readTextFile(root+'/index.qmd'))+'\nИзменение источника.');
 if(mode==='switch'){const r=await new Deno.Command('quarto',{args:['run',${
    JSON.stringify(join(core, "entrypoints/native-pre.ts"))
  }],cwd:root,stdout:'piped',stderr:'piped'}).output();if(!r.success)throw Error('switch pre');}
 await Deno.mkdir(root+'/_generated/c-fixture' ,{recursive:true});
 await Deno.writeTextFile(root+'/_generated/c-fixture/pending.json',JSON.stringify({identity:op.identity,inputs:op.inputs}));
});
for(const[api,fn]of wholeOriginals)Deno[api]=fn;crypto.subtle.digest=wholeDigestFn;
checks.push({name:'pending-whole-call-IO',passed:wholeCalls.readTextFile===4&&wholeCalls.readFile===2&&wholeDigest===2,calls:wholeCalls,digestCalls:wholeDigest,callerWrites:{mkdir:1,writeTextFile:1},inspectCalls:0,discoveryWalks:0,sourceHashReads:0,fullValidationFences:2});
let expired='';try{void escaped.inputs;}catch(e){expired=String(e);}checks.push({name:'expired-pending-getter',passed:expired.includes('OPERATION_EXPIRED')});
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
 if not os.getenv('A4A_KEEP_RAW') then local output=assert(io.open(root..'/_generated/c-fixture/raw.json','wb'));output:write(pandoc.json.encode({identity=p.identity,source=source,captureWitness=binding.captureWitness,ids=ids}));output:close() end
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
  format: "html",
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
const raw = () =>
  JSON.parse(
    Deno.readTextFileSync(join(root, "_generated/c-fixture/raw.json")),
  );
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
    captured.identity.format !== input.origin.format
  ) throw Error("C.CAPTURE_CHANGED");
  if (!captured.ids.includes("exr-restricted")) {
    throw Error("C.CAPTURE_AFTER_PROJECTION");
  }
  return { sources: [] };
};
await Core.withCurrentNativeOperation(expectation, async (op) => {
  const proof = await op.validateRelease({ expectedSources: ["index.qmd"] }, [{
    name: "fixture",
    validate,
  }]);
  const effective = seenInputs[0].declarations.find((d) =>
    d.id === "exr-open"
  )!.attributes;
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
  const required = await op.validateRelease(
    { expectedSources: ["index.qmd"] },
    [{
      name: "fixture",
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
    passed: required.validatedAdapters.includes("fixture"),
  });
  const goodRaw = raw();
  for (
    const [name, change] of [
      ["source", { source: "foreign.qmd" }],
      ["format", { identity: { ...goodRaw.identity, format: "latex" } }],
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
      ["wrong-type", "index.qmd", "directory"],
    ] as const
  ) {
    await refusal(
      "adapter-source-" + name,
      () =>
        op.validateRelease({ expectedSources: ["index.qmd"] }, [{
          name: "fixture",
          validate: () => ({ sources: [{ path, kind }] }),
        }]),
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
  ...JSON.parse(
    await Deno.readTextFile(join(root, "_generated/c-fixture/probe.json")),
  ),
);
const originalIndex = await Deno.readTextFile(join(root, "index.qmd"));
await refusal(
  "adapter-source-symlink",
  () =>
    Core.withCurrentNativeOperation(expectation, async (op) => {
      await op.validateRelease({ expectedSources: ["index.qmd"] }, [{
        name: "fixture",
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
        validate,
      }]),
    "C.CAPTURE_CHANGED",
  );
});
await refusal(
  "adapter-source-final-fence",
  () =>
    Core.withCurrentNativeOperation(expectation, async (op) => {
      await refusal("adapter-source-currentness-before-proof", () =>
        op.validateRelease({ expectedSources: ["index.qmd"] }, [{
          name: "fixture",
          validate: async () => {
            await Deno.writeTextFile(
              join(root, "source.txt"),
              "Изменённый source adapter.",
            );
            return { sources: [{ path: "source.txt", kind: "file" }] };
          },
        }]), "OPERATION_CHANGED");
    }),
  "OPERATION_CHANGED",
);
const switched = await render({ A4A_PENDING_MODE: "switch" });
checks.push({
  name: "switch-inside-pending-final-fence",
  passed: !switched.success &&
    new TextDecoder().decode(switched.stderr).includes("OPERATION_CHANGED"),
});
const beforeEntry = await render({ A4A_PENDING_MODE: "source-before-entry" });
checks.push({
  name: "needed-source-pending-entry-fence",
  passed: !beforeEntry.success &&
    new TextDecoder().decode(beforeEntry.stderr).includes("OPERATION_CHANGED"),
});
await Deno.writeTextFile(join(root, "index.qmd"), originalIndex);
const changed = await render({ A4A_PENDING_MODE: "source-change" });
checks.push({
  name: "needed-source-pending-final-fence",
  passed: !changed.success &&
    new TextDecoder().decode(changed.stderr).includes("OPERATION_CHANGED"),
});
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
