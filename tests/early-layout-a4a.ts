import type * as CoreType from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url))),
  E = Deno.env.get("CORE_EARLY_FIXTURES") ?? dirname(dirname(repo));
const fixtureManifest = JSON.parse(await Deno.readTextFile(
  join(repo, "tests/early-slice-inputs.json"),
)).fixtures;
const roots = {
  java: join(E, "repos/java-early-projects"),
  sp: join(E, "repos/system-practice-base"),
};
const exact = {
  java: fixtureManifest.java.commit,
  sp: fixtureManifest.sp.commit,
};
const coreSource = Deno.env.get("A4A_CORE_SOURCE") ??
  join(repo, "_extensions/course-core");
const stage = await Deno.makeTempDir({ prefix: "a4a-actual-layout-" }),
  checks: { name: string; passed: boolean }[] = [],
  rows: unknown[] = [];
async function put(path: string, text: string) {
  await Deno.mkdir(dirname(path), { recursive: true });
  await Deno.writeTextFile(path, text);
}
async function command(cmd: string, args: string[], cwd: string) {
  const r = await new Deno.Command(cmd, {
    args,
    cwd,
    env: { DENO_NO_PACKAGE_JSON: "1", QUARTO_RUN_NO_NETWORK: "true" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!r.success) throw Error(cmd + " " + new TextDecoder().decode(r.stderr));
  return r.stdout;
}
async function archive(
  source: string,
  ref: string,
  path: string,
  destination: string,
) {
  const tar = await Deno.makeTempFile({ suffix: ".tar" });
  try {
    await command("git", [
      "archive",
      "--format=tar",
      "--output",
      tar,
      ref,
      path,
    ], source);
    await command("tar", ["-xf", tar, "-C", destination], destination);
  } finally {
    await Deno.remove(tar);
  }
}
function exercise(text: string, id: string) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) =>
    new RegExp("^:{3,}.*#" + id + "(?:\\s|})").test(l)
  );
  if (start < 0) throw Error("Missing authored " + id);
  let depth = 0;
  for (let i = start; i < lines.length; i++) {
    const match = lines[i].match(/^(:{3,})(.*)$/);
    if (match) {
      if (match[2].trim()) depth++;
      else depth--;
      if (depth === 0) return lines.slice(start, i + 1).join("\n");
    }
  }
  throw Error("Unclosed " + id);
}
async function digest(s: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  ].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const coreSnapshot = join(stage, "input-core");
await command("cp", ["-R", coreSource, coreSnapshot], stage);
for (const family of ["java", "sp"] as const) {
  const outer = join(stage, family === "java" ? "Java" : "System-Practice"),
    owner = join(outer, "tasks");
  await Deno.mkdir(owner, { recursive: true });
  await put(
    join(outer, "_quarto.yml"),
    "project:\n  type: website\nformat:\n  html:\n    theme: none\nlang: ru\n",
  );
  const ext = join(owner, "_extensions/Afonenko-Course-Tools");
  await Deno.mkdir(ext, { recursive: true });
  await command("cp", ["-R", coreSnapshot, join(ext, "course-core")], owner);
  for (
    const [name, ref, packageName] of [[
      "download",
      fixtureManifest.download.commit,
      "project-download",
    ], [
      "qrc",
      fixtureManifest.qrc.commit,
      "reference-catalog",
    ]] as const
  ) {
    const temp = await Deno.makeTempDir();
    await archive(
      join(E, "repos/" + name + "-installed-java"),
      ref,
      "_extensions/" + packageName,
      temp,
    );
    await command("cp", [
      "-R",
      join(temp, "_extensions", packageName),
      join(ext, packageName),
    ], owner);
    await Deno.remove(temp, { recursive: true });
  }
  await put(
    join(ext, "course-prairielearn/contract.json"),
    JSON.stringify({ name: "prairielearn" }),
  );
  const installed = await import(
    toFileUrl(join(ext, "course-core/public.ts")).href
  ) as typeof CoreType;
  const qrc = await import(
    toFileUrl(join(ext, "reference-catalog/public.ts")).href
  );
  const download = await import(
    toFileUrl(join(ext, "project-download/public.ts")).href
  );
  const selected = family === "java"
    ? [
      {
        id: "exr-arrays-reverse-array",
        source: "bank/arrays.qmd",
        project: "projects/arrays/reverse-array",
        authored: "tasks/bank/arrays.qmd",
      },
      {
        id: "exr-objects-book-selection",
        source: "bank/objects.qmd",
        project: "projects/objects/book-selection",
        authored: "tasks/bank/objects.qmd",
      },
    ]
    : [
      {
        id: "exr-version-control-local-history",
        source: "labs/version-control.qmd",
        project: "projects/version-control/local-history",
        authored: "tasks/labs/version-control.qmd",
      },
      {
        id: "exr-version-control-restore-selected-state",
        source: "labs/version-control.qmd",
        project: "projects/version-control/restore-selected-state",
        authored: "tasks/labs/version-control.qmd",
      },
    ];
  if (family === "java") {
    await archive(roots.java, exact.java, "projects", owner);
  } else {for (const item of selected) {
      const temp = await Deno.makeTempDir();
      await archive(roots.sp, exact.sp, "tasks/" + item.project, temp);
      await Deno.mkdir(dirname(join(owner, item.project)), { recursive: true });
      await command("cp", [
        "-R",
        join(temp, "tasks", item.project),
        join(owner, item.project),
      ], owner);
      await Deno.remove(temp, { recursive: true });
      await put(
        join(owner, item.project, "_metadata.yml"),
        "course-project:\n  starter: {path: student}\n  instructions:\n    local: {path: student/README.md}\n",
      );
    }}
  const sources = new Map<string, string>();
  for (const item of selected) {
    const raw = new TextDecoder().decode(
      await command(
        "git",
        ["show", exact[family] + ":" + item.authored],
        roots[family],
      ),
    );
    const chapterHeading = raw.split("\n").find((line) => /^# /.test(line));
    if (!chapterHeading) {
      throw Error("Missing actual chapter heading " + item.authored);
    }
    if (!sources.has(item.source)) {
      sources.set(item.source, chapterHeading + "\n\n");
    }
    const selectedText = exercise(raw, item.id);
    let effective = selectedText;
    let replacement = false;
    if (item.id === "exr-objects-book-selection") {
      const before =
          "../../projects/objects/book-selection/starter/src/main/java/Book.java",
        after =
          "../projects/objects/book-selection/starter/src/main/java/Book.java";
      if (effective.split(before).length !== 2) {
        throw Error("Expected one Book mapping URL");
      }
      effective = effective.replace(before, after);
      replacement = true;
    }
    sources.set(
      item.source,
      (sources.get(item.source) ?? "") + effective + "\n\n",
    );
    rows.push({
      family,
      id: item.id,
      sourceRef: exact[family],
      source: item.authored,
      fragmentSHA256: await digest(selectedText),
      effectiveSHA256: await digest(effective),
      singleUrlReplacement: replacement,
      chapterHeadingSHA256: await digest(chapterHeading),
    });
  }
  for (const [path, text] of sources) await put(join(owner, path), text);
  await put(join(owner, "index.qmd"), "# Ранний native slice\n");
  const inputs = ["index.qmd", ...sources.keys()];
  await put(
    join(owner, "_quarto.yml"),
    `project:\n  type: book\n  output-dir: _output\n  pre-render: [quarto run _extensions/Afonenko-Course-Tools/course-core/entrypoints/native-pre.ts]\n  post-render: [quarto run _extensions/Afonenko-Course-Tools/course-core/entrypoints/native-post.ts]\nprofile:\n  default: student\n  group: [[student,full]]\nbook:\n  title: Ранний slice\n  chapters: ${
      JSON.stringify(inputs)
    }\nformat:\n  html:\n    theme: none\ncourse-core-runtime: native-ts\nexercise-bank: true\ndefault-exercise-statement-visibility: open\ncourse: {id: ${
      family === "java" ? "java-semester-one" : "system-practice"
    }, adapters: [prairielearn]}\nproject-download: {course-model: true}\nreference-catalog: {namespace: ${
      family === "java" ? "java-tasks" : "system-practice-tasks"
    }}\nfilters: [course-core,project-download,reference-catalog]\n`,
  );
  for (const profile of ["student", "full"]) {
    await put(
      join(owner, "_quarto-" + profile + ".yml"),
      `project:\n  output-dir: _output/${profile}\ncourse:\n  view: ${profile}\n`,
    );
  }
  let firstSourceHashes: number | undefined;
  for (const profile of ["student", "full"] as const) {
    const began = performance.now();
    const render = new Deno.Command("quarto", {
      args: ["render", "--profile", profile, "--to", "html"],
      cwd: owner,
      env: {
        DENO_NO_PACKAGE_JSON: "1",
        QUARTO_RUN_NO_NETWORK: "true",
        CUE: "/no-a4a-cue",
      },
      stdout: "piped",
      stderr: "piped",
    });
    const result = await render.output();
    const log = new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr);
    await put(join(owner, "_generated/qualification-" + profile + ".log"), log);
    if (!result.success) {
      throw Error(
        "Actual " + family + "/" + profile + ": " + owner +
          "/_generated/qualification-" + profile + ".log\n" + log,
      );
    }
    const projection = profile === "student" ? "student" : "author";
    await installed.withCurrentNativeOperation({
      root: owner,
      profiles: [profile],
      format: "html",
      projection,
      outputDirectory: join(owner, "_output", profile),
    }, async (op) => {
      checks.push({
        name: family + "/" + profile + "/profile-projection",
        passed: op.identity.projection === projection &&
          op.identity.profiles.join(",") === profile &&
          op.catalog.documents.length === inputs.length,
      });
      let gate = "";
      try {
        await op.validateRelease({ expectedSources: inputs });
      } catch (e) {
        gate = String(e);
      }
      rows.push({ family, profile, releaseGate: gate });
      checks.push({
        name: family + "/" + profile + "/PL-owner-gate",
        passed: gate.includes("RELEASE.ADAPTER_UNQUALIFIED"),
      });
      await installed.readProjectContexts([{
        owner,
        inputs: selected.map((i) => i.project + "/native-input.qmd"),
        profiles: [profile],
        format: "html",
      }], async ([group]) => {
        for (const [itemIndex, item] of selected.entries()) {
          const condition = op.condition({
            source: item.source,
            exerciseId: item.id,
            view: projection,
          });
          const plan = await installed.planProject(group.contexts[itemIndex], {
            audience: profile === "student" ? "student" : "full",
          });
          const closure = await installed.materializationClosure(
            plan,
            condition,
          );
          const linksBySource: Record<string, Record<string, string>> = {};
          for (const fragment of closure.fragments) {
            const references = Object.fromEntries(
              fragment.references.map(
                (r) => [r.token, { key: r.key, style: r.style }],
              ),
            );
            const targets = Object.fromEntries(fragment.references.map((r) => {
              const [namespace, id] = r.key.split(":");
              return [r.key, {
                namespace,
                id,
                page: namespace + "/index.html",
                fragment: id,
                label: id,
                labelHtml: id,
                number: "",
                numberHtml: "",
                baseUrl: "https://example.invalid/",
              }];
            }));
            const urls = Object.fromEntries(
              fragment.links.filter((l) => l.includes("_downloads/")).map(
                (l) => [
                  l,
                  "https://example.invalid/" + family + "/tasks/_downloads/" +
                  l.split("/").pop(),
                ],
              ),
            );
            linksBySource[fragment.source] = qrc.bindConditionLinks({
              context: { input: fragment.source },
              links: fragment.links.filter((l) =>
                !fragment.resources.includes(l)
              ),
            }, {
              catalog: {
                schema: "quarto-reference-catalog",
                generator: { quarto: "1.11.5" },
                targets: {},
              },
              importedTargets: Object.values(targets),
              baseUrl: "https://example.invalid/" + family + "/tasks/",
              references,
              urls,
            });
          }
          const binding = {
            linksBySource,
            submission: {
              files: [],
              instructions: "Сдайте решение по требованиям полного условия.",
            },
          };
          const inventory = await installed.materializeProject(
            plan,
            condition,
            binding,
          );
          const conditionOnly = await installed.materializeCondition(
            plan,
            condition,
            binding,
          );
          const zip = await download.packageArtifact(inventory);
          const destination = await Deno.makeTempDir({
              prefix: "a4a-extracted-",
            }),
            archive = join(destination, "starter.zip");
          await Deno.writeFile(archive, zip);
          await command("unzip", [
            "-q",
            archive,
            "-d",
            join(destination, "fresh-root"),
          ], destination);
          const readme = new TextDecoder().decode(
            inventory.files.find((f) => f.target === "README.md")!.bytes,
          );
          checks.push({
            name: family + "/" + profile + "/" + item.id + "/materialized",
            passed: inventory.files.length > 1 && readme.length > 500 &&
              conditionOnly.files.every((f) =>
                f.target === "README.md" || f.reason === "condition-resource"
              ),
          });
          checks.push({
            name: family + "/" + profile + "/" + item.id + "/no-raw-transport",
            passed: !readme.includes("qrc-unresolved") &&
              !readme.includes("data-course-core-occurrence") &&
              !readme.includes("project-download-request"),
          });
          if (family === "java") {
            checks.push({
              name: family + "/" + profile + "/" + item.id +
                "/actual-build-checks",
              passed: inventory.files.some((f) =>
                f.target === "build.gradle"
              ) && inventory.files.some((f) =>
                f.target === "settings.gradle"
              ) && inventory.files.some((f) =>
                f.target.includes("ApiCheck") ||
                f.target.includes("ApiPrecheck")
              ) && inventory.files.some((f) =>
                f.target.startsWith("src/test/")
              ),
            });
          } else {checks.push({
              name: family + "/" + profile + "/" + item.id + "/nongradle",
              passed: !inventory.files.some((f) =>
                f.target.includes("gradle")
              ) && readme.includes(
                item.id.includes("restore-selected")
                  ? "Workspace"
                  : "PowerShell",
              ),
            });}
          rows.push({
            family,
            profile,
            id: item.id,
            files: inventory.files.map((f) => ({
              target: f.target,
              size: f.size,
              sha256: f.sha256,
              audience: f.audience,
            })),
            conditionFiles: conditionOnly.files.map((f) => f.target),
            zipBytes: zip.length,
            projectMetrics: installed.projectPlanMetrics(plan),
            contextMetrics: group.metrics,
            actualDestination: join(destination, "fresh-root"),
            workspaceSeedQualified: false,
          });
        }
      });
      checks.push({
        name: family + "/" + profile + "/other-profile-output-not-input",
        passed: firstSourceHashes === undefined ||
          op.metrics.sourceHashReads === firstSourceHashes,
      });
      firstSourceHashes = op.metrics.sourceHashReads;
      rows.push({
        family,
        profile,
        operationMetrics: op.metrics,
        wallMs: performance.now() - began,
      });
    });
  }
}
console.log(
  JSON.stringify({
    status: checks.every((c) => c.passed) ? "PASS" : "FAIL",
    stage,
    checks,
    rows,
  }),
);
if (checks.some((c) => !c.passed)) throw Error("A4a actual early layout");
