import { join } from "stdlib/path";
import { assertBodyPackage } from "../_extensions/course-core/body-export/producer.ts";
import { resolveReferences } from "../_extensions/course-core/body-export/references.ts";
import { withAssignmentExecution } from "../_extensions/course-core/runtime/assignment-execution.ts";
const assert = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const root = await Deno.makeTempDir({ prefix: "core-fixed-stdin-" }),
  base = join(root, "chapters/deep");
const quarto = Deno.env.get("QUARTO") || "/opt/quarto/bin/quarto",
  cue = Deno.env.get("CUE") || "/usr/bin/cue";
const schema =
  new URL("../_extensions/course-core/body-export/package.cue", import.meta.url)
    .pathname;
const cueArgs = ["vet", schema, "-c", "-"],
  pandocArgs = [
    "pandoc",
    "--from=json",
    "--to=json",
    "--citeproc",
    "--resource-path=" + base,
  ];
const environment: Record<string, string> = {
  CUE: cue,
  QUARTO: quarto,
  QUARTO_RUN_NO_NETWORK: "true",
};
for (
  const key of [
    "XDG_CACHE_HOME",
    "JAVA_HOME",
    "GRADLE_USER_HOME",
    "PATH",
    "HOME",
    "DENO_DIR",
  ]
) {
  const value = Deno.env.get(key);
  if (value !== undefined) environment[key] = value;
}
// Только synthetic private execution fixture: не admission, authority или priorP.
const profile: any = {
  root,
  runtime: { files: [{ path: quarto }, { path: cue }] },
  native: {
    executable: quarto,
    environment,
    actualProfiles: [],
    renders: [cueArgs, pandocArgs],
  },
};
const pkg: any = {
  schema: "course-body-package-v2",
  owner: "fixture",
  release: "native",
  apiVersion: [1, 23, 1],
  questions: [{
    owner: "fixture",
    id: "exr-test",
    key: "fixture/exr-test",
    source: "bank.qmd",
    visibility: "public",
    statementVisibility: "open",
    hasPublicSolution: false,
    condition: [],
    publicAnswer: [],
    answerType: "manual",
    closedKey: null,
    solution: [],
    gradingNotes: [],
  }],
  works: [{
    owner: "fixture",
    id: "sec-work",
    key: "fixture/sec-work",
    source: "work.qmd",
    kind: "lab",
    title: "Работа",
    slots: [{
      id: "fixture/sec-work/exr-test",
      selection: "fixed",
      candidates: ["fixture/exr-test"],
      assignment: { requirement: "required", workMode: "individual" },
    }],
  }],
  resources: [],
};
const cite = (id: string) => ({
  t: "Para",
  c: [{
    t: "Cite",
    c: [[{
      citationId: id,
      citationPrefix: [],
      citationSuffix: [],
      citationMode: { t: "NormalCitation" },
      citationNoteNum: 0,
      citationHash: 0,
    }], [{ t: "Str", c: "[@" + id + "]" }]],
  }],
});
const metaText = (c: string) => ({ t: "MetaString", c });
const doc: any = {
  "pandoc-api-version": [1, 23, 1],
  meta: {
    bibliography: metaText("refs/source.bib"),
    csl: metaText("styles/numeric.csl"),
    "link-citations": { t: "MetaBool", c: true },
    nocite: metaText("@private"),
    abstract: { t: "MetaBlocks", c: [cite("private")] },
  },
};
const context = { source: "chapters/deep/input.qmd", id: "exr-test" };
const original = Deno.Command, seen: any[] = [];
let guards = 0, success = false;
(Deno as any).Command = new Proxy(original, {
  construct(t, a: any[]) {
    seen.push({
      executable: a[0],
      args: a[1].args,
      cwd: a[1].cwd,
      clearEnv: a[1].clearEnv,
    });
    return Reflect.construct(t, a);
  },
});
const run = <T>(use: () => Promise<T>) =>
  withAssignmentExecution(profile, use, async () => {
    guards++;
  });
async function refuses(use: () => Promise<unknown>, code: string) {
  let error: any;
  try {
    await use();
  } catch (e) {
    error = e;
  }
  assert(
    String(error).includes(code),
    "Ожидаемый отказ " + code + ": " + error,
  );
  return error;
}
try {
  await Deno.mkdir(join(base, "refs"), { recursive: true });
  await Deno.mkdir(join(base, "styles"), { recursive: true });
  await Deno.writeTextFile(
    join(base, "refs/source.bib"),
    "@book{public,title={PUBLIC_ATTRIBUTION},year={2024}}\n@book{private,title={PRIVATE_ATTRIBUTION},year={2023}}",
  );
  const style =
    '<style xmlns="http://purl.org/net/xbiblio/csl" version="1.0" class="in-text"><info><title>Fixture</title><id>https://example.org/test</id><updated>2026-10-31T00:00:00Z</updated></info><citation><layout prefix="[" suffix="]"><text variable="citation-number"/></layout></citation><bibliography><layout><text variable="title"/></layout></bibliography></style>';
  await Deno.writeTextFile(join(base, "styles/numeric.csl"), style);
  await Deno.mkdir(join(root, "refs"));
  await Deno.mkdir(join(root, "styles"));
  await Deno.writeTextFile(
    join(root, "refs/source.bib"),
    "@book{public,title={ROOT_WRONG_BIB},year={2024}}",
  );
  await Deno.writeTextFile(
    join(root, "styles/numeric.csl"),
    style.replace('variable="citation-number"', 'value="ROOT_WRONG_STYLE"'),
  );
  const failures: string[] = [];
  try {
    await run(() => assertBodyPackage(pkg, root));
  } catch (e) {
    failures.push("package: " + e);
  }
  let resolved: any;
  try {
    resolved = await run(() =>
      resolveReferences([cite("public")], doc, root, context, base)
    );
  } catch (e) {
    failures.push("references: " + e);
  }
  if (failures.length) {
    throw Error(
      JSON.stringify({
        scope: "SYNTHETIC_ONLY_NOT_P",
        failures,
        spawns: seen,
        guards,
      }),
    );
  }
  const text = JSON.stringify(resolved);
  assert(
    text.includes("PUBLIC_ATTRIBUTION") &&
      !/ROOT_WRONG|PRIVATE_ATTRIBUTION|"Cite"/.test(text),
    "Citation root/resource/privacy binding нарушен",
  );
  const bad = structuredClone(pkg);
  bad.works[0].kind = "test";
  const rejected = await refuses(
    () => run(() => assertBodyPackage(bad, root)),
    "ExternalToolFailure",
  );
  console.log(
    JSON.stringify({
      invalidPolicy: { exitCode: rejected.exitCode, stderr: rejected.stderr },
    }),
  );
  assert(
    rejected.exitCode === 1 && rejected.stderr.includes("restricted"),
    "CUE invalid policy потерял exit/stderr",
  );
  await refuses(
    () =>
      run(() => resolveReferences([cite("unknown")], doc, root, context, base)),
    "BODY.CITATION_UNRESOLVED",
  );
  const before = seen.length;
  await refuses(
    () =>
      run(() =>
        resolveReferences(
          [cite("unknown"), {
            t: "Div",
            c: [["ref-unknown", ["csl-entry"], []], []],
          }],
          doc,
          root,
          context,
          base,
        )
      ),
    "BODY.BIBLIOGRAPHY_COLLISION",
  );
  const poisoned = structuredClone(doc);
  poisoned.meta.references = { t: "MetaBlocks", c: [cite("private")] };
  await refuses(
    () =>
      run(() =>
        resolveReferences([cite("public")], poisoned, root, context, base)
      ),
    "BODY.CITATION_UNRESOLVED",
  );
  assert(seen.length === before, "Ранние guards запустили инструмент");
  const beforeForeign = seen.length;
  await refuses(
    () =>
      run(() =>
        resolveReferences(
          [cite("public")],
          doc,
          root,
          context,
          join(root, "foreign"),
        )
      ),
    "BODY.PRODUCER_INPUT_CHANGED",
  );
  assert(seen.length === beforeForeign, "Чужой sourceBase достиг native spawn");
  const both = await Promise.all([
    run(() => resolveReferences([cite("public")], doc, root, context, base)),
    run(() => resolveReferences([cite("public")], doc, root, context, base)),
  ]);
  assert(
    both.every((x) => JSON.stringify(x) === text),
    "Параллельные JSON stdin смешались",
  );
  assert(
    seen.every((x) => x.cwd === root && x.clearEnv),
    "Child cwd/env не закрыт",
  );
  assert(seen.length + 1 === guards, "Перед каждым actual child нужен fence");
  console.log(
    JSON.stringify({
      scope: "synthetic execution only, not producer admission/P",
      spawns: seen.length,
      guards,
      commands: seen,
    }),
  );
  success = true;
  console.log(
    "PASS fixed CUE/Pandoc stdin, policy/unknown/forged metadata guards, nested resource collision, concurrent isolation",
  );
} finally {
  (Deno as any).Command = original;
  if (success) await Deno.remove(root, { recursive: true });
  else console.error("Preserved fixture " + root);
}
