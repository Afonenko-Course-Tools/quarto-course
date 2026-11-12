import { fixtureAt, fixtureRecord, fixtureString, required } from "./helpers/required.ts";
import type * as CoreType from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url))),
  sourceRoot = Deno.env.get("CORE_EARLY_FIXTURES") ??
    join(repo, "tests/fixtures/sources");
// Это происхождение сохранённых catalog bytes, а не выбор live checkout.
const catalogProvenance: unknown = JSON.parse(
  await Deno.readTextFile(join(repo, "tests/fixtures/early-layout/catalog-provenance.json")),
);
const roots = {
  java: join(sourceRoot, "java"),
  sp: join(sourceRoot, "sp"),
  download: join(sourceRoot, "download"),
  qrc: join(sourceRoot, "qrc"),
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
// Не изменяем source checkout и не принимаем незакоммиченные входы молча.
// Commit выбирает gitlink; фактический HEAD нужен только для archive и evidence.
async function sourceHead(source: string): Promise<string> {
  if ((await Deno.lstat(source)).isSymlink ||
    new TextDecoder().decode(await command("git", ["rev-parse", "--show-toplevel"], source)).trim() !==
      await Deno.realPath(source)) {
    throw Error("Не самостоятельный source checkout: " + source);
  }
  if (new TextDecoder().decode(await command("git", ["status", "--porcelain", "--untracked-files=all"], source)).trim()) {
    throw Error("Изменённые входы сохранены: " + source);
  }
  return new TextDecoder().decode(await command("git", ["rev-parse", "HEAD"], source)).trim();
}
const exact = {
  java: await sourceHead(roots.java),
  sp: await sourceHead(roots.sp),
  download: await sourceHead(roots.download),
  qrc: await sourceHead(roots.qrc),
};
function exercise(text: string, id: string) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) =>
    new RegExp("^:{3,}.*#" + id + "(?:\\s|})").test(l)
  );
  if (start < 0) throw Error("Missing authored " + id);
  let depth = 0;
  for (let i = start; i < lines.length; i++) {
    const match = required(lines[i]).match(/^(:{3,})(.*)$/);
    if (match) {
      if (required(match[2]).trim()) depth++;
      else depth--;
      if (depth === 0) return lines.slice(start, i + 1).join("\n");
    }
  }
  throw Error("Unclosed " + id);
}
async function digest(s: string) {
  return await digestBytes(new TextEncoder().encode(s));
}
async function digestBytes(bytes: Uint8Array) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
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
      exact.download,
      "project-download",
    ], [
      "qrc",
      exact.qrc,
      "reference-catalog",
    ]] as const
  ) {
    const temp = await Deno.makeTempDir();
    await archive(
      roots[name],
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
  const installed: typeof CoreType = await import(
    toFileUrl(join(ext, "course-core/public.ts")).href
  );
  const qrc: unknown = await import(
    toFileUrl(join(ext, "reference-catalog/public.ts")).href
  );
  const download: unknown = await import(
    toFileUrl(join(ext, "project-download/public.ts")).href
  );
  const selected = family === "java"
    ? [
      {
        id: "exr-arrays-reverse-array",
        source: "bank/arrays.qmd",
        project: "projects/arrays/reverse-array",
        authored: "tasks/bank/_conditions/exr-arrays-reverse-array.qmd",
        contextAuthored: "tasks/bank/arrays.qmd",
      },
      {
        id: "exr-objects-book-selection",
        source: "bank/objects.qmd",
        project: "projects/objects/book-selection",
        authored: "tasks/bank/_conditions/exr-objects-book-selection.qmd",
        contextAuthored: "tasks/bank/objects.qmd",
      },
    ]
    : [
      {
        id: "exr-version-control-local-history",
        source: "labs/version-control.qmd",
        project: "projects/version-control/local-history",
        authored: "tasks/labs/version-control.qmd",
        contextAuthored: "tasks/labs/version-control.qmd",
      },
      {
        id: "exr-version-control-restore-selected-state",
        source: "labs/version-control.qmd",
        project: "projects/version-control/restore-selected-state",
        authored: "tasks/labs/version-control.qmd",
        contextAuthored: "tasks/labs/version-control.qmd",
      },
    ];
  {
    const temp = await Deno.makeTempDir();
    await archive(roots[family], exact[family], "tasks/projects", temp);
    await command("cp", [
      "-R",
      join(temp, "tasks/projects"),
      join(owner, "projects"),
    ], owner);
    await Deno.remove(temp, { recursive: true });
  }
  if (family === "sp") {
    const temp = await Deno.makeTempDir();
    await archive(
      roots.sp,
      exact.sp,
      "tasks/labs/version-control-workspace.yml",
      temp,
    );
    await Deno.mkdir(join(owner, "labs"), { recursive: true });
    await command("cp", [
      join(temp, "tasks/labs/version-control-workspace.yml"),
      join(owner, "labs/version-control-workspace.yml"),
    ], owner);
    await Deno.remove(temp, { recursive: true });
    await Deno.mkdir(join(owner, "provenance"), { recursive: true });
    for (const key of ["spTheory", "spPractice", "spHandbook"]) {
      const catalog = fixtureRecord(fixtureAt(catalogProvenance,[key]));
      const bytes = await Deno.readFile(join(repo, fixtureString(catalog.path)));
      if (await digestBytes(bytes) !== fixtureString(catalog.sha256)) {
        throw Error("Public catalog fixture bytes изменились: " + key);
      }
      await Deno.writeFile(
        join(owner, "provenance", fixtureString(catalog.sourceProject) + ".catalog.json"),
        bytes,
      );
      rows.push({
        publicCatalog: fixtureString(catalog.path),
        sha256: fixtureString(catalog.sha256),
        origin: catalog,
      });
    }
  }
  const sources = new Map<string, string>();
  for (const item of selected) {
    const raw = new TextDecoder().decode(
      await command(
        "git",
        ["show", exact[family] + ":" + item.authored],
        roots[family],
      ),
    );
    const contextRaw = new TextDecoder().decode(
      await command("git", [
        "show",
        exact[family] + ":" + item.contextAuthored,
      ], roots[family]),
    );
    const chapterHeading = contextRaw.split("\n").find((line) =>
      /^# /.test(line)
    );
    if (!chapterHeading) {
      throw Error("Missing actual chapter heading " + item.authored);
    }
    if (!sources.has(item.source)) {
      const end = contextRaw.startsWith("---\n")
        ? contextRaw.indexOf("\n---\n", 4)
        : -1;
      if (contextRaw.startsWith("---\n") && end < 0) {
        throw Error("Незакрытый authored frontmatter");
      }
      const frontmatter = end < 0 ? "" : contextRaw.slice(0, end + 5);
      sources.set(
        item.source,
        family === "sp" ? contextRaw : frontmatter + chapterHeading + "\n\n",
      );
    }
    const selectedText = exercise(raw, item.id);
    const effective = selectedText;
    if (family === "java") {
      sources.set(
        item.source,
        (sources.get(item.source) ?? "") + effective + "\n\n",
      );
    }
    rows.push({
      family,
      id: item.id,
      sourceRef: exact[family],
      source: item.authored,
      sourceContext: item.contextAuthored,
      sourceContextSHA256: await digest(contextRaw),
      fragmentSHA256: await digest(selectedText),
      effectiveSHA256: await digest(effective),
      singleUrlReplacement: false,
      chapterHeadingSHA256: await digest(chapterHeading),
    });
  }
  for (const [path, text] of sources) await put(join(owner, path), text);
  await put(join(owner, "index.qmd"), "# Ранний native slice\n");
  const inputs = ["index.qmd", ...sources.keys()];
  const referenceCatalog = {
    namespace: family === "java" ? "java-tasks" : "system-practice-tasks",
    ...(family === "sp"
      ? {
        imports: {
          "system-practice-theory": {
            source: "provenance/theory.catalog.json",
            namespace: "system-practice-theory",
            "base-url":
              "https://bsu-rfct-afonenko-courses.github.io/System-Practice/theory/",
          },
          "system-practice-practice": {
            source: "provenance/practice.catalog.json",
            namespace: "system-practice-practice",
            "base-url":
              "https://bsu-rfct-afonenko-courses.github.io/System-Practice/practice/",
          },
          "system-practice-handbook": {
            source: "provenance/handbook.catalog.json",
            namespace: "system-practice-handbook",
            "base-url":
              "https://bsu-rfct-afonenko-courses.github.io/System-Practice/handbook/",
          },
        },
      }
      : {}),
  };
  await put(
    join(owner, "_quarto.yml"),
    `project:\n  type: book\n  output-dir: _output\n  pre-render: [quarto run _extensions/Afonenko-Course-Tools/course-core/entrypoints/native-pre.ts]\n  post-render: [quarto run _extensions/Afonenko-Course-Tools/course-core/entrypoints/native-post.ts]\nprofile:\n  default: student\n  group: [[student,full]]\nbook:\n  title: Ранний slice\n  chapters: ${
      JSON.stringify(inputs)
    }\nformat:\n  html:\n    theme: none\ncourse-core-runtime: native-ts\nexercise-bank: true\ndefault-exercise-statement-visibility: open\ncourse: {id: ${
      family === "java" ? "java-semester-one" : "system-practice"
    }, adapters: [prairielearn]}\nproject-download: {course-model: true}\nreference-catalog: ${
      JSON.stringify(referenceCatalog)
    }\nfilters: [course-core,project-download,reference-catalog]\n`,
  );
  for (const profile of ["student", "full"]) {
    await put(
      join(owner, "_quarto-" + profile + ".yml"),
      `project:\n  output-dir: _output/${profile}\ncourse:\n  view: ${profile}\n`,
    );
  }
  for (const profile of ["student", "full"] as const) {
    const began = performance.now();
    const render = new Deno.Command("quarto", {
      args: ["render", "--profile", profile, "--to", "html"],
      cwd: owner,
      env: {
        DENO_NO_PACKAGE_JSON: "1",
        QUARTO_RUN_NO_NETWORK: "true",
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
    const publicationBase = "https://bsu-rfct-afonenko-courses.github.io/" +
      (family === "java" ? "Java" : "System-Practice") + "/tasks/";
    const output = join(owner, "_output", profile);
    await callModule(qrc, "publishReferenceCatalog", {
      root: owner,
      stage: output,
      quarto: "1.11.5",
      config: { "reference-catalog": referenceCatalog },
      members: [{ namespace: referenceCatalog.namespace, format: "html" }],
      scope: "local",
      outputs: inputs.map((input) =>
        join(output, input.replace(/\.qmd$/, ".html"))
      ),
    });
    const catalogFile = join(output, "reference-catalog-local.json");
    const catalog: unknown = JSON.parse(await Deno.readTextFile(catalogFile));
    const loadedLinks: unknown = await callModule(qrc, "loadBodyLinks", {
      catalogFile,
      baseUrl: publicationBase,
      root: owner,
      namespace: referenceCatalog.namespace,
      imports: referenceCatalog.imports,
    });
    const bodyLinks = {
      resolve(key: string, style: string, source: string) {
        const result = fixtureRecord(callModule(loadedLinks, "resolve", key, style, source));
        return { href: fixtureString(result.href), label: fixtureString(result.label) };
      },
    };
    if (family === "sp") {
      const references = [...sources.values()].flatMap((source) =>
        [...source.matchAll(/\{\{<\s*xref\s+(\S+)\s+(\S+)/g)].map((match) =>
          match[1] + ":" + match[2]
        )
      );
      const resolved = [...new Set(references)].map((key) => ({
        key,
        ...bodyLinks.resolve(key, "default", "labs/version-control.qmd"),
      }));
      checks.push({
        name: profile + "/SP-full-chapter-catalog-closure",
        passed: resolved.length === 12 &&
          resolved.every((target) =>
            target.label.length > 0 && target.href.startsWith(
              "https://bsu-rfct-afonenko-courses.github.io/System-Practice/",
            )
          ),
      });
      rows.push({ family, profile, fullChapterReferences: resolved });
    }
    const projection = profile === "student" ? "student" : "author";
    await installed.withCurrentNativeOperation({
      root: owner,
      profiles: [profile],
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
        directories: selected.map((i) => i.project + ""),
        profiles: [profile],
        format: "html",
      }], async (fixtureGroups) => {
    const group = required(fixtureGroups[0]);
        for (const [itemIndex, item] of selected.entries()) {
          const condition = op.condition({
            source: item.source,
            exerciseId: item.id,
            view: projection,
          });
          const plan = await installed.planProject(required(group.contexts[itemIndex]), {
            audience: profile === "student" ? "student" : "full",
          });
          const closure = await installed.materializationClosure(
            plan,
            condition,
          );
          const linksBySource: Record<string, Record<string, string>> = {};
          const referencesBySource: Record<
            string,
            Record<string, { href: string; label: string }>
          > = {};
          const artifactNames = [
            item.id + "-" + (profile === "student" ? "starter" : "full") +
            ".zip",
            item.id + "-conditions.zip",
          ];
          const downloadLinks: string[] = [];
          for (const fragment of closure.fragments) {
            const references = Object.fromEntries(
              fragment.references.map((reference) => [
                reference.token,
                bodyLinks.resolve(
                  reference.key,
                  reference.style,
                  fragment.source,
                ),
              ]),
            );
            referencesBySource[fragment.source] = references;
            const urls = Object.fromEntries(
              Object.entries(references).map((
                [token, resolved],
              ) => [token, resolved.href]),
            );
            for (
              const link of fragment.links.filter((link) =>
                link.includes("_downloads/")
              )
            ) {
              const name = required(link.split(/[?#]/)[0]).split("/").pop()!;
              if (!artifactNames.includes(name)) {
                throw Error("Незапланированный Download artifact: " + link);
              }
              // Адреса принадлежат этому fixture publisher; оба ZIP записываются ниже.
              urls[link] = new URL("_downloads/" + name, publicationBase).href;
              downloadLinks.push(name);
            }
            linksBySource[fragment.source] = installed.MaterializationBindingsSchema.shape.links.parse(callModule(qrc, "bindConditionLinks", {
              context: { input: fragment.source },
              links: fragment.links.filter((link) =>
                !fragment.resources.includes(link)
              ),
            }, {
              catalog,
              baseUrl: publicationBase,
              sources: Object.fromEntries(
                op.catalog.documents.map((
                  document,
                ) => [document.source, document.output]),
              ),
              urls,
            }));
          }
          const binding = {
            linksBySource,
            referencesBySource,
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
          const zip = await packageArtifact(download, inventory);
          const conditionZip = await packageArtifact(download, conditionOnly);
          const downloadOutput = join(output, "_downloads");
          await Deno.mkdir(downloadOutput, { recursive: true });
          await Deno.writeFile(join(downloadOutput, required(artifactNames[0])), zip);
          await Deno.writeFile(
            join(downloadOutput, required(artifactNames[1])),
            conditionZip,
          );
          for (const name of downloadLinks) {
            if (!(await Deno.stat(join(downloadOutput, name))).isFile) {
              throw Error("Download link не получил фактический ZIP: " + name);
            }
          }
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
            const privateTest = item.id === "exr-arrays-reverse-array"
              ? "ReverseArrayTest.java"
              : "BookSelectionTest.java";
            const expectedTest = profile === "full"
              ? privateTest
              : item.id === "exr-arrays-reverse-array"
              ? "PublicReverseDemoTest.java"
              : "PublicBookDemoTest.java";
            checks.push({
              name: family + "/" + profile + "/" + item.id +
                "/actual-build-checks",
              passed: inventory.files.some((f) =>
                f.target === "build.gradle"
              ) && inventory.files.some((f) =>
                f.target === "settings.gradle"
              ) && inventory.files.some((f) =>
                f.target.endsWith("/ApiContract.java")
              ) && inventory.files.some((f) =>
                f.target.startsWith("src/test/") &&
                f.target.endsWith("/" + expectedTest)
              ) && (profile === "full" || !inventory.files.some((f) =>
                f.target.endsWith("/" + privateTest)
              )),
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
              size: f.bytes.length,
              audience: f.audience,
            })),
            conditionFiles: conditionOnly.files.map((f) => f.target),
            zipBytes: zip.length,
            conditionZipBytes: conditionZip.length,
            resolvedDownloadArtifacts: downloadLinks,
            projectMetrics: installed.projectPlanMetrics(plan),
            contextMetrics: group.metrics,
            actualDestination: join(destination, "fresh-root"),
            workspaceSeedQualified: false,
          });
        }
      });
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

/** Dynamic installed consumer: проверяется именно вызываемый runtime API. */
function callModule(module: unknown, name: string, ...args: unknown[]): unknown {
  const callable = fixtureRecord(module)[name];
  if (typeof callable !== "function") throw Error("Нет consumer callable " + name);
  return Reflect.apply(callable, module, args);
}
async function packageArtifact(module: unknown, inventory: CoreType.ArtifactFiles): Promise<Uint8Array> {
  const value: unknown = await callModule(module, "packageArtifact", inventory);
  if (!(value instanceof Uint8Array)) throw Error("Consumer не вернул ZIP bytes");
  return value;
}
