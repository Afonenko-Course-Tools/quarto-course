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
  console.log(
    "PASS fresh capture, missing outputs, failed/removed results, audience expectations",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
