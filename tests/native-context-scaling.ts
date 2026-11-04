import { dirname, join, relative } from "stdlib/path";
import {
  assertProjectContext,
  operationProjectContextReuse,
  projectContextFiles,
  readProjectContexts,
} from "../_extensions/course-core/infrastructure/project-context.ts";
import { assertSources, snapshot } from "../_extensions/course-core/runtime/source-snapshot.ts";
const assert = (value: unknown, message: string) => { if (!value) throw Error(message); };
const root = await Deno.makeTempDir({ prefix: "a1-scaling-" });
const put = async (path: string, text: string) => {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
};
const probes: any[] = [], ActualCommand = Deno.Command;
(Deno as any).Command = new Proxy(ActualCommand, {
  construct(target, args: any[]) {
    const command = Reflect.construct(target, args);
    const actual = command.output.bind(command);
    command.output = async () => {
      const result = await actual();
      if (result.success && args[1]?.args?.[0] === "inspect") {
        const value = JSON.parse(new TextDecoder().decode(result.stdout));
        if (value.project && args[1].args.some((a: string) => a.includes("course-a1-"))) {
          probes.push({
            input: relative(value.project.dir, args[1].args[1]),
            selected: value.project.files.input.map((p: string) => relative(value.project.dir, p)),
            populated: Object.keys(value.project.fileInformation),
          });
        }
      }
      return result;
    };
    return command;
  },
});
const normalize = (value: unknown): any => {
  if (typeof value === "string") return value.replaceAll(root, "<owner>");
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  return value;
};
const normalizeMetadata = (value: any): any => {
  if (Array.isArray(value)) return value.map(normalizeMetadata);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalizeMetadata(value[key])]));
  return value;
};
const snapshotContext = (context: any) => normalize({
  input: context.input, profiles: context.profiles, format: context.format,
  effectiveMetadata: context.effectiveMetadata, origins: context.origins,
});
const data: any = { direct: [], bound: [], original: [], probes, localGuardPaths: [] };
try {
  await put("_quarto.yml", `project: &native-project\n  type: default\n  render: [index.qmd, projects/a/native-input.qmd, projects/b/native-input.qmd, projects/c/native-input.qmd]\nnative-project-copy: *native-project\nformat:\n  html: {toc: true}\n  revealjs: {transition: slide}\ncourse-project:\n  components:\n    common: {path: shared}\n`);
  await put("_quarto-review.yml", "course-project:\n  components:\n    common: {path: shared-review}\n");
  await put("index.qmd", "# Начало\n");
  await put("shared/api.txt", "BASE\n");
  await put("shared-review/api.txt", "REVIEW\n");
  await put("projects/_metadata.yml", "# Общая настройка \u041f\ncourse-project:\n  starter: {path: student}\n");
  const inputs = ["a", "b", "c"].map((id) => "projects/" + id + "/native-input.qmd");
  for (const id of ["a", "b", "c"]) {
    await put(`projects/${id}/student/main.txt`, "PUBLIC_" + id);
    await put(`projects/${id}/local.md`, "Локальная инструкция " + id);
    await put(`projects/${id}/native-input.qmd`, `---\ncourse-project:\n  instructions:\n    local: {path: local.md}\n${id === "b" ? "format:\n  html: {toc: false}\n" : ""}---\n# ${id}\n`);
  }
  const request = (format: string) => ({ owner: root, inputs: format === "revealjs" ? inputs.filter((input) => !input.includes("/b/")) : inputs, profiles: ["review"], format });
  for (const input of inputs) {
    const inspected = await new ActualCommand(Deno.env.get("QUARTO") || "quarto", {
      args: ["inspect", join(root, input), "--profile", "review"],
      cwd: root, stdout: "piped", stderr: "piped",
    }).output();
    assert(inspected.success, new TextDecoder().decode(inspected.stderr));
    const actual = JSON.parse(new TextDecoder().decode(inspected.stdout));
    for (const format of ["html", "revealjs"]) {
      if (actual.formats?.[format]) data.original.push(normalize({
        input: join(root, input), format, effectiveMetadata: actual.formats[format].metadata,
      }));
    }
  }
  const validate = (context: any) => {
    assert(context.effectiveMetadata["course-project"].starter.path === "student", "Потерян native starter");
    assert(context.origins["starter.path"].sourceFile === join(root, "projects/_metadata.yml"), "Потерян inherited origin");
    assert(context.origins["starter.path"].resolvedPath === join(dirname(context.input), "student"), "Потеряна project base");
    assert(context.origins["components.common.path"].sourceFile === join(root, "_quarto-review.yml"), "Потерян profile origin");
    assert(context.origins["components.common.path"].resolvedPath === join(root, "shared-review"), "Потеряна definition base");
    assert(context.origins["instructions.local.path"].sourceFile === context.input, "Потерян document-local origin");
  };
  for (const format of ["html", "revealjs"]) {
    await readProjectContexts([request(format)], async ([group]) => {
      for (const context of group.contexts) { validate(context); data.direct.push(snapshotContext(context)); }
    });
  }
  const state: any = { root, outputDirectory: join(root, "_unused"), rows: [], memberships: {}, relevantInputs: [], metrics: { fullWalks: 0, sourceDirectoryReads: 0, sourceHashReads: 0, sourceHashBytes: 0, fullSourceFences: 0, localSourceFences: 0 } };
  await snapshot(state);
  const original = await new ActualCommand(Deno.env.get("QUARTO") || "quarto", { args: ["inspect", root, "--profile", "review"], cwd: root, stdout: "piped", stderr: "piped" }).output();
  assert(original.success, new TextDecoder().decode(original.stderr));
  const owner = JSON.parse(new TextDecoder().decode(original.stdout));
  let guardPaths: string[][] = [];
  const reuse = operationProjectContextReuse({
    owner: root, profiles: ["review"], generation: {}, outputDirectory: join(root,"_unused"),
    sync: () => {},
  });
  let retained: any;
  await reuse([request("html"), request("revealjs")], async (batch) => {
    const contexts = batch.groups.flatMap((group) => group.contexts);
    for (const context of contexts) { validate(context); data.bound.push(snapshotContext(context)); }
    retained = contexts[1];
    await projectContextFiles(contexts[0], join(root, "projects/a/student"));
    guardPaths = [];
    await assertProjectContext(contexts[1]);
    data.localGuardPaths = guardPaths.flat().map((p) => relative(root, p));
  });
  let expired = false;
  try { await assertProjectContext(retained); } catch (e) { expired = String(e).includes("CONTEXT_EXPIRED"); }
  assert(expired, "Контекст пережил callback");
  let cloned = false;
  try { await assertProjectContext(structuredClone(retained)); } catch (e) { cloned = String(e).includes("CONTEXT_EXPIRED"); }
  assert(cloned, "DTO получил authority");
  data.sourceMetrics = state.metrics;
  const output = Deno.env.get("CORE_PERFORMANCE_OBSERVATIONS");
  if (output) await Deno.writeTextFile(output, JSON.stringify(data, null, 2) + "\n");
  for (const context of [...data.direct, ...data.bound]) {
    const actual = data.original.find((value: any) => value.input === context.input && value.format === context.format);
    assert(actual, "Нет native-original format witness");
    assert(JSON.stringify(normalizeMetadata(actual.effectiveMetadata)) === JSON.stringify(normalizeMetadata(context.effectiveMetadata)), "A1 изменил genuine native-original metadata");
  }
  const baseline = Deno.env.get("CORE_PERFORMANCE_BASELINE");
  if (baseline) {
    const old = JSON.parse(await Deno.readTextFile(baseline));
    assert(JSON.stringify(old.direct) === JSON.stringify(data.direct), "Изменились actual native metadata/formats/origins direct");
    assert(JSON.stringify(old.bound) === JSON.stringify(data.bound), "Изменились actual native metadata/formats/origins bound");
  }
  assert(probes.length === 8, "Изменилось число genuine per-input inspect");
  assert(probes.every((probe) => probe.selected.length === 1 && probe.selected[0] === probe.input && probe.populated.length === 1), "A1 inspect повторно обрабатывает чужие inputs");
  // Current acquired A1 state проверяет собственные captured rows; pre-child guard callback удалён.
  console.log(JSON.stringify({ status: "PASS", probes: probes.length, populated: probes.map((p) => p.populated.length), direct: data.direct.length, bound: data.bound.length, localGuardPaths: data.localGuardPaths.length }));
} finally {
  (Deno as any).Command = ActualCommand;
  await Deno.remove(root, { recursive: true });
}
