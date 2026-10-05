import { evaluateResources } from "../_extensions/course-core/infrastructure/resources.ts";
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
  console.log(
    "PASS resource privacy, explicit selection, missing paths and containment",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
