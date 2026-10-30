import { join } from "stdlib/path";
import {
  assertProjectContext,
  CoreContractError,
  decodeProjectContract,
  readProjectContexts,
} from "../_extensions/course-core/public.ts";
const root = await Deno.makeTempDir({ prefix: "a1-native-negative-" });
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const base =
  "project:\n  type: book\nbook:\n  title: Проверка\n  chapters: [index.qmd]\n";
await Deno.writeTextFile(join(root, "index.qmd"), "# Тест\n");
await Deno.mkdir(join(root, "code/src"), { recursive: true });
await Deno.writeTextFile(join(root, "code/input.qmd"), "# Код\n");
const requests = [{
  owner: root,
  inputs: ["code/input.qmd"],
  profiles: [] as string[],
  format: "html",
}];
const results: { name: string; code?: string }[] = [];
async function reject(
  name: string,
  code: string,
  action: () => Promise<unknown>,
) {
  try {
    await action();
  } catch (e) {
    assert(e instanceof CoreContractError && e.code === code, `${name}: ${e}`);
    results.push({ name, code });
    return;
  }
  throw Error("Ошибочно принят: " + name);
}
for (
  const [name, fragment, code] of [
    [
      "missing path",
      "course-project:\n  components:\n    absent: {path: missing}\n",
      "ORIGIN_MISSING",
    ],
    [
      "arrays",
      "course-project:\n  testsets: [demo, demo]\n",
      "ORIGIN_UNQUALIFIED",
    ],
    [
      "alias",
      "course-project:\n  components:\n    first: &a {path: code/src}\n    second: *a\n",
      "ORIGIN_UNQUALIFIED",
    ],
    ["marker collision", "_course_core_origins_a1: {}\n", "ORIGIN_COLLISION"],
    [
      "metadata contributor",
      "metadata-files: [extra.yml]\n",
      "ORIGIN_UNQUALIFIED",
    ],
    [
      "format contributor",
      "format:\n  html:\n    course-project: {components: {a: {path: code/src}}}\n",
      "ORIGIN_UNQUALIFIED",
    ],
  ] as const
) {
  await Deno.writeTextFile(join(root, "_quarto.yml"), base + fragment);
  await Deno.writeTextFile(join(root, "extra.yml"), "title: Contributor\n");
  await reject(name, code, () => readProjectContexts(requests, async () => {}));
}
await Deno.writeTextFile(
  join(root, "_quarto.yml"),
  base + "course-project:\n  components:\n    root: {path: code/src}\n",
);
await Deno.mkdir(join(root, "profile-src"));
await Deno.writeTextFile(
  join(root, "_quarto-active.yml"),
  "course-project:\n  components:\n    root: {path: profile-src}\n",
);
await readProjectContexts(
  [{ ...requests[0], profiles: ["active"] }],
  async ([group]) => {
    const c = group.contexts[0];
    assert(
      c.origins["components.root.path"].resolvedPath ===
        join(root, "profile-src"),
      "Профиль потерян",
    );
    assert(
      c.origins["components.root.path"].sourceFile ===
        join(root, "_quarto-active.yml"),
      "Profile origin потерян",
    );
    await reject(
      "forged context",
      "CONTEXT_EXPIRED",
      () => assertProjectContext({ ...c }),
    );
    results.push({ name: "active profile" });
  },
);
await reject(
  "metadata drift",
  "CONTEXT_CHANGED",
  () =>
    readProjectContexts(requests, async ([g]) => {
      await Deno.writeTextFile(join(root, "_quarto.yml"), base);
      await assertProjectContext(g.contexts[0]);
    }),
);
await Deno.writeTextFile(
  join(root, "_quarto.yml"),
  base + "course-project:\n  components:\n    root: {path: code/src}\n",
);
await reject(
  "membership drift",
  "CONTEXT_CHANGED",
  () =>
    readProjectContexts(requests, async ([g]) => {
      await Deno.writeTextFile(join(root, "code/src/new.txt"), "New");
      await assertProjectContext(g.contexts[0]);
    }),
);
// Квалификационная baseline/instrumented пара не входит в постоянный рабочий путь.
await Deno.writeTextFile(
  join(root, "_quarto-baseline.yml"),
  "project:\n  type: default\n  render: [code/input.qmd]\n",
);
const p = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
  args: ["inspect", join(root, "code/input.qmd"), "--profile", "baseline"],
  stdout: "piped",
  stderr: "piped",
}).output();
assert(p.success, new TextDecoder().decode(p.stderr));
const native = JSON.parse(new TextDecoder().decode(p.stdout)).formats.html
  .metadata["course-project"];
await readProjectContexts(requests, async ([g]) => {
  assert(
    JSON.stringify(native) ===
      JSON.stringify(g.contexts[0].effectiveMetadata["course-project"]),
    "Markers изменили native effective",
  );
  assert(
    decodeProjectContract(g.contexts[0]).components.root.path ===
      native.components.root.path,
    "Owner decoder изменил native effective",
  );
  results.push({ name: "baseline/instrumented native equivalence" });
});
console.log(JSON.stringify(results));
