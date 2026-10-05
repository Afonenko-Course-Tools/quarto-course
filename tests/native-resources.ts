import {
  cleanHiddenResourceOutputs,
  evaluateResources,
} from "../_extensions/course-core/infrastructure/resources.ts";
const root = await Deno.makeTempDir({ prefix: "native-resources-" });
const facts: any = [{
  source: "index.qmd",
  format: "html",
  view: "student",
  effectiveBase: root,
  outputDirectory: root + "/_site",
  outputFile: "index.html",
  rawUses: ["public.png", "private.png"],
  projectedUses: ["public.png"],
}];
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
try {
  for (const name of ["public.png", "private.png", "index.qmd"]) {
    await Deno.writeTextFile(root + "/" + name, name);
  }
  const result = await evaluateResources({
    facts,
    selected: ["public.png"],
    projectRoot: root,
  });
  assert(result.files[0].target === "public.png", "public resource missing");
  for (const name of ["private.png", "index.qmd", "../escape", "missing.png"]) {
    let failed = false;
    try {
      await evaluateResources({ facts, selected: [name], projectRoot: root });
    } catch {
      failed = true;
    }
    assert(failed, "invalid resource allowed: " + name);
  }
  await Deno.symlink("/etc/passwd", root + "/escape.txt");
  let failed = false;
  try {
    await evaluateResources({
      facts,
      selected: ["escape.txt"],
      projectRoot: root,
    });
  } catch {
    failed = true;
  }
  assert(failed, "symlink escaped");
  await Deno.symlink(root + "/private.png", root + "/alias.png");
  let leaked = false;
  try {
    await evaluateResources({
      facts,
      selected: ["alias.png"],
      projectRoot: root,
    });
    leaked = true;
  } catch {}
  assert(!leaked, "private resource symlink alias exposed");
  for (const name of ["starter.py", "setup.sh", "settings.yaml", "README.md"]) {
    await Deno.writeTextFile(root + "/" + name, "PUBLIC_STARTER");
    const payload = await evaluateResources({
      facts,
      selected: [name],
      projectRoot: root,
      publicPayload: true,
      authoredInputs: ["index.qmd"],
    });
    assert(
      payload.files[0].target === name,
      "explicit starter rejected: " + name,
    );
  }
  await Deno.writeTextFile(root + "/hook.py", "BUILD_HOOK");
  await Deno.writeTextFile(root + "/_quarto.yml", "project: default");
  await Deno.symlink(root + "/hook.py", root + "/hook-alias.txt");
  for (
    const name of [
      "hook.py",
      "hook-alias.txt",
      "_quarto.yml",
      "private.png",
      "index.qmd",
    ]
  ) {
    let rejected = false;
    try {
      await evaluateResources({
        facts,
        selected: [name],
        projectRoot: root,
        publicPayload: true,
        authoredInputs: ["index.qmd", "hook.py"],
      });
    } catch {
      rejected = true;
    }
    assert(rejected, "payload exemption exposed source/private file: " + name);
  }
  // Shared/public aliases protect bytes, while hidden output copies are removed.
  const out = root + "/_site";
  await Deno.mkdir(out);
  await Deno.writeTextFile(out + "/public.png", "public.png");
  await Deno.writeTextFile(out + "/private.png", "private.png");
  await Deno.symlink(out + "/public.png", out + "/shared.png");
  const hash = async (path: string) =>
    [
      ...new Uint8Array(
        await crypto.subtle.digest("SHA-1", await Deno.readFile(path)),
      ),
    ].map((b) => b.toString(16).padStart(2, "0")).join("");
  const capture = async (name: string, output = name) => ({
    source: root + "/" + name,
    output: out + "/" + output,
    sha1: await hash(out + "/" + output),
  });
  const cleanupFacts = {
    ...facts[0],
    rawUses: ["public.png", "private.png", "shared.png"],
    capturedFiles: [
      await capture("public.png"),
      await capture("private.png"),
      await capture("shared.png"),
    ],
  };
  await cleanHiddenResourceOutputs(root, [cleanupFacts]);
  assert(
    (await Deno.stat(out + "/public.png")).isFile &&
      (await Deno.stat(out + "/shared.png")).isFile,
    "shared public alias removed",
  );
  assert(
    (await Deno.stat(root + "/private.png")).isFile,
    "authored source removed",
  );
  let removed = false;
  try {
    await Deno.stat(out + "/private.png");
  } catch (e) {
    removed = e instanceof Deno.errors.NotFound;
  }
  assert(removed, "hidden native output retained");
  await Deno.symlink(root + "/private.png", out + "/escape.png");
  let escaped = false;
  try {
    await cleanHiddenResourceOutputs(root, [{
      ...cleanupFacts,
      projectedUses: [],
      capturedFiles: [await capture("private.png", "escape.png")],
    }]);
  } catch {
    escaped = true;
  }
  assert(
    escaped && (await Deno.stat(root + "/private.png")).isFile,
    "cleanup followed output symlink into source",
  );
  console.log(
    "PASS resource privacy, explicit selection, missing paths and containment",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
