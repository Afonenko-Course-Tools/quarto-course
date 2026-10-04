// Native lifecycle probe for Core's finite adapter boundary. The local adapter
// emits its exact native fragment; each real adapter owns its payload/CUE tests.
import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "adapter-owner-" });
const adapter = Deno.args[0] || "cloud";
if (!["cloud", "prairielearn"].includes(adapter)) {
  throw new Error("Unknown native adapter probe");
}
const quarto = Deno.env.get("QUARTO") || "quarto";
const old = Deno.env.get("QUARTO_PROFILE");
Deno.env.set("QUARTO_PROFILE", "full");
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function command(args: string[]) {
  const result = await new Deno.Command(quarto, {
    cwd: root,
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(
    result.success,
    new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr),
  );
}
try {
  await copy(
    join(repo, "_extensions/course-core"),
    join(root, "_extensions/course-core"),
  );
  const extension = join(root, "_extensions/course-" + adapter);
  await Deno.mkdir(extension);
  await Deno.writeTextFile(
    join(extension, "_extension.yml"),
    "title: Native adapter boundary probe\nversion: 0.0.0\ncontributes:\n  filters: [filter.lua]\n",
  );
  await Deno.writeTextFile(
    join(extension, "contract.json"),
    JSON.stringify({ name: adapter, rules: "rules.cue" }),
  );
  await Deno.writeTextFile(
    join(extension, "rules.cue"),
    "package course\n#Course: {}\n",
  );
  await Deno.writeTextFile(
    join(extension, "filter.lua"),
    `return {{Pandoc=function(doc)
    assert(doc.meta['course-core-processed'], 'Core order required')
    if doc.meta['course-core-capture'] then return doc end
    local root=quarto.project.directory
    local input=quarto.doc.input_file
    if not pandoc.path.is_absolute(input) then input=pandoc.path.join({root,input}) end
    local source=pandoc.path.make_relative(input,root)
    local directory=pandoc.path.join({root,'_generated/course-spec/${adapter}'})
    pandoc.system.make_directory(directory,true)
    local file=assert(io.open(pandoc.path.join({directory,pandoc.utils.sha1(source)..'.json'}),'w'))
    file:write(pandoc.json.encode({source=source,exercises=pandoc.List()}));file:close()
    return doc
  end}}`,
  );
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    `project:\n  type: default\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: [_extensions/course-core/entrypoints/pre.ts, _extensions/course-core/entrypoints/owner-freeze.ts]\nformat:\n  html:\n    theme: none\ncourse:\n  id: adapter-owner\n  adapters: [${adapter}]\nfilters: [course-core, course-${adapter}]\n`,
  );
  for (const profile of ["student", "full"]) {
    await Deno.writeTextFile(
      join(root, `_quarto-${profile}.yml`),
      `course:\n  view: ${profile}\n`,
    );
  }
  await Deno.writeTextFile(
    join(root, "index.qmd"),
    '---\ncourse-core-capture: true\n---\n\n## Topic {#sec-topic}\n\n::: {#exr-task course-role="demonstration" difficulty="introductory"}\nCANONICAL_ADAPTER_CONDITION\n:::\n',
  );
  const api = await import(
    toFileUrl(join(root, "_extensions/course-core/owner-preflight/owner.ts"))
      .href
  );
  await command(["run", "_extensions/course-core/entrypoints/pre.ts"]);
  const prepared = await api.prepareOwner(root, {
    attemptId: crypto.randomUUID(),
    profile: "full",
  });
  let captured = false;
  try {
    await Deno.stat(join(root, "_generated/course-spec", adapter));
    captured = true;
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
  assert(!captured, "Private captures emitted adapter fragments");
  console.log("PASS validated captures are passive for downstream adapter");
  const metadata = await api.activateOwner(prepared);
  const file = join(root, ".course-owner/render-metadata.json");
  await Deno.writeTextFile(file, JSON.stringify(metadata));
  await command([
    "render",
    ".",
    "--profile",
    "full",
    "--to",
    "html",
    "--execute",
    "--no-cache",
    "--no-execute-daemon",
    "--fail-if-warnings",
    "--metadata-file",
    file,
  ]);
  const { check } = await import(
    toFileUrl(join(root, "_extensions/course-core/application/check.ts")).href
  );
  const { runtime } = await import(
    toFileUrl(join(root, "_extensions/course-core/infrastructure/runtime.ts"))
      .href
  );
  const checked = await check(runtime(root, [], false));
  assert(
    checked.model.exercises.length === 1 &&
      checked.model.exercises[0].sourceTopic.id === "sec-topic",
    "Actual canonical model lost source proof",
  );
  const finished = await api.finishOwner(prepared);
  assert(finished.exitCode === 0, JSON.stringify(finished));
  await api.validateOwnerResources(prepared);
  const fragments = [];
  for await (
    const item of Deno.readDir(join(root, "_generated/course-spec", adapter))
  ) fragments.push(item.name);
  assert(
    fragments.length === 1 &&
      fragments[0] === await api.sha("index.qmd") + ".json",
    "Actual adapter fragment identity changed",
  );
  console.log(
    "PASS actual " + adapter +
      " render, non-render canonical check, finish, and current resource proof",
  );
} finally {
  if (old === undefined) Deno.env.delete("QUARTO_PROFILE");
  else Deno.env.set("QUARTO_PROFILE", old);
  await Deno.remove(root, { recursive: true });
}
