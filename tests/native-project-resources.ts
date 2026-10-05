import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "native-project-resources-" }),
  repo = dirname(dirname(fromFileUrl(import.meta.url))),
  quarto = Deno.env.get("QUARTO") || "quarto";
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
async function run(args: string[]) {
  const p = await new Deno.Command(quarto, {
    args,
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(
    p.success,
    new TextDecoder().decode(p.stdout) + new TextDecoder().decode(p.stderr),
  );
}
try {
  await run(["add", repo, "--no-prompt"]);
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    `project:
  type: default
  output-dir: _site-default
  render: [index.qmd]
  resources: ['!projects/**', '!data/**']
  pre-render: _extensions/course-core/entrypoints/pre.ts
  post-render: _extensions/course-core/entrypoints/post.ts
format: html
course: {id: raw-project-policy}
filters: [course-core]
`,
  );
  for (const view of ["student", "full"]) {
    await Deno.writeTextFile(
      join(root, `_quarto-${view}.yml`),
      `project: {output-dir: _site-${view}}\ncourse: {view: ${view}}\n`,
    );
  }
  await Deno.writeTextFile(
    join(root, "index.qmd"),
    `# Public course {#sec-public}

:::: {.when-full}
::: {#exr-hidden course-role="control" target="manual" difficulty="introductory" project="/projects/hidden"}
## Private assessment task
PRIVATE_CONDITION
:::
::::
`,
  );
  const contents: Record<string, string> = {
    "student/main.py": "PUBLIC_STARTER",
    "student/tests/Open.py": "PUBLIC_TEST",
    "tests/Closed.py": "PRIVATE_TEST",
    "closed-tests/Hidden.txt": "PRIVATE_TEST",
    "reference/Answer.java": "PRIVATE_SOLUTION",
    "solution/Answer.txt": "PRIVATE_SOLUTION",
    "solutions/Answer.txt": "PRIVATE_SOLUTION",
    "check.sh": "PRIVATE_CHECKER",
  };
  for (const [name, bytes] of Object.entries(contents)) {
    const path = join(root, "projects/hidden", name);
    await Deno.mkdir(dirname(path), { recursive: true });
    await Deno.writeTextFile(path, bytes);
  }
  await Deno.mkdir(join(root, "data"));
  await Deno.symlink(
    join(root, "projects/hidden/tests/Closed.py"),
    join(root, "data/alias.txt"),
  );
  await Deno.symlink(
    join(root, "projects/hidden/tests"),
    join(root, "data/directory-alias"),
  );
  await Deno.symlink(
    join(root, "projects/hidden/check.sh"),
    join(root, "data/check-alias.txt"),
  );
  await Deno.rename(
    join(root, "projects/hidden/solutions"),
    join(root, "data/closed-solutions"),
  );
  await Deno.symlink(
    join(root, "data/closed-solutions"),
    join(root, "projects/hidden/solutions"),
  );
  const { loadNativeRun } = await import(
    toFileUrl(
      join(root, "_extensions/course-core/infrastructure/native-run.ts"),
    ).href
  );
  const { evaluateResources } = await import(
    toFileUrl(join(root, "_extensions/course-core/infrastructure/resources.ts"))
      .href
  );
  for (const view of ["default", "student", "full"]) {
    await run(view === "default" ? ["render"] : ["render", "--profile", view]);
    const current = await loadNativeRun(root),
      facts = current.documents.map((d: any) => d.resources);
    for (
      const name of [
        ...Object.keys(contents).filter((n) => !n.startsWith("student/")).map(
          (n) => "projects/hidden/" + n,
        ),
        "data/alias.txt",
        "data/directory-alias/Closed.py",
        "data/check-alias.txt",
        "data/closed-solutions/Answer.txt",
      ]
    ) {
      let denied = false;
      try {
        await evaluateResources({
          facts,
          selected: [name],
          projectRoot: root,
          publicPayload: true,
          authoredInputs: current.inputFiles,
        });
      } catch (e) {
        denied = String(e).includes("RESOURCE.PRIVATE_OR_SOURCE");
      }
      assert(
        denied,
        "raw hidden project service bytes accepted: " + view + "/" + name,
      );
    }
    const publicFiles = await evaluateResources({
      facts,
      selected: [
        "projects/hidden/student/main.py",
        "projects/hidden/student/tests/Open.py",
      ],
      projectRoot: root,
      publicPayload: true,
      authoredInputs: current.inputFiles,
    });
    assert(publicFiles.files.length === 2, "student starter/open tests denied");
    assert(
      facts[0].rawProjectRoots?.[0] === join(root, "projects/hidden"),
      "raw project root policy fact missing",
    );
    assert(
      !JSON.stringify(facts).includes("PRIVATE_CONDITION"),
      "policy fact contains private body",
    );
    console.log(
      "PASS raw project roots protect closed files and aliases, preserving explicit student payload",
      view,
    );
  }
} finally {
  await Deno.remove(root, { recursive: true });
}
