// Регрессия: конструктивная дизъюнкция не должна добавлять отсутствующее input/state/action.
// Запуск только штатным quarto run; используются настоящий CUE и validateRelease.
import { dirname, fromFileUrl, join } from "stdlib/path";
import { validateRelease } from "../_extensions/course-core/infrastructure/validate.ts";
import type { ReleaseResult } from "../_extensions/course-core/domain/model.ts";
const root = dirname(dirname(fromFileUrl(import.meta.url)));
const schema = join(root, "_extensions/course-core/spec/core.cue");
const manifestSchema = join(root, "_extensions/course-core/project-checks/manifest.cue");
const temp = await Deno.makeTempDir({ prefix: "core-public-cases-" });
const cue = Deno.env.get("CUE") || "cue";
const base = { id: "ordinary", name: "Обычный случай", test: "Checks#ordinary", expected: "" };
const check = (cases: unknown[]) => ({
  profile: "junit", runtime: "java25-junit-v1", "source-profile": "main",
  sourceProfile: { mode: "implementation", root: "student", include: ["*.java"] },
  tests: ["Checks.java"], scoring: { mode: "weighted" }, "public-cases": cases,
});
function release(cases: unknown[]): ReleaseResult {
  return { scope: "release", documents: [], model: {
    course: { id: "public-cases", view: "student" }, registeredTargets: [],
    exercises: [], assessments: [], projects: [{ exerciseId: "exr-example", source: "bank.qmd",
      projectRoot: "/projects/example", bankMember: true, statementVisibility: "open",
      artifactPolicy: { student: "starter", full: "full", conditions: true }, check: check(cases) }],
  } } as unknown as ReleaseResult;
}
// Синтетический manifest: реальные поля владельца, без NativeRun и без готовности к исполнению.
function manifest(cases: unknown[]) {
  const project = release(cases).model.projects![0];
  return { schemaVersion: 1, courseId: "public-cases", bookRoot: "/synthetic",
    sourceSnapshotHash: "a".repeat(64), inventoryHash: "b".repeat(64),
    projects: [{ ...project, qualifiedId: "public-cases/exr-example", sources: [],
      trustedTests: [], verificationTests: [], references: [], contractFixtures: [],
      readiness: { ready: false, missing: ["Синтетический пример без исходных файлов"] } }] };
}
async function vet(value: unknown, definition: string): Promise<boolean> {
  const file = await Deno.makeTempFile({ dir: temp, suffix: ".json" });
  try {
    await Deno.writeTextFile(file, JSON.stringify(value));
    const r = await new Deno.Command(cue, { args: ["vet", schema, ...(definition === "#ChecksManifest" ? [manifestSchema] : []), file, "-d", definition, "-c", "--all-errors"],
      cwd: temp, stdout: "piped", stderr: "piped" }).output();
    if (r.code !== 0 && r.code !== 1) throw Error("Ошибка инструмента CUE: " + new TextDecoder().decode(r.stderr));
    return r.success;
  } finally { await Deno.remove(file); }
}
let count = 0; const failures: string[] = [];
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); count++; console.log("PASS " + name); }
  catch (e) { failures.push(name); console.error("FAIL " + name + ": " + e); }
}
function equal(actual: boolean, expected: boolean, name: string) {
  if (actual !== expected) throw Error(name + ": ожидалось " + expected + ", получено " + actual);
}
const cases: { name: string; value: Record<string, unknown>; valid: boolean }[] = [];
for (let mask = 1; mask < 8; mask++) {
  const value: Record<string, unknown> = { ...base };
  ["input", "state", "action"].forEach((key, i) => { if (mask & (1 << i)) value[key] = ""; });
  cases.push({ name: "Непустое подмножество полей " + mask, value, valid: true });
}
cases.push({ name: "Нет ни одного поля", value: { ...base }, valid: false });
const withoutExpected: Record<string, unknown> = { ...base, input: "" }; delete withoutExpected.expected;
cases.push({ name: "Отсутствует обязательное expected", value: withoutExpected, valid: false });
for (const key of ["input", "state", "action", "expected", "id", "name", "test"]) {
  for (const value of [null, 42, false, {}]) cases.push({ name: key + " неверного типа " + JSON.stringify(value), value: { ...base, input: "", [key]: value }, valid: false });
}
for (const key of ["id", "name", "test"]) {
  const value: Record<string, unknown> = { ...base, input: "" }; delete value[key];
  cases.push({ name: "Нет " + key, value, valid: false });
  cases.push({ name: "Пустое " + key, value: { ...base, input: "", [key]: "" }, valid: false });
}
for (const key of ["unknown", "solution", "rubric", "private"]) cases.push({ name: "Закрытое поле " + key, value: { ...base, state: "", [key]: "секрет" }, valid: false });
try {
  for (const c of cases) await test(c.name, async () => {
    equal(await vet(c.value, "#PublicCase"), c.valid, "Прямой vet -c");
    equal(await vet(manifest([c.value]), "#ChecksManifest"), c.valid, "Реальный #ChecksManifest vet -c");
    const r = release([c.value]); const before = JSON.stringify(r);
    let accepted = true;
    try { await validateRelease(r, temp); } catch (e) {
      if (!(e instanceof Error) || e.name !== "ExternalToolFailure" || (e as Error & { exitCode?: number }).exitCode !== 1) throw e;
      accepted = false;
    }
    equal(accepted, c.valid, "validateRelease → #Course");
    if (JSON.stringify(r) !== before) throw Error("Проверка изменила авторские данные");
  });
  for (const n of [32, 33]) await test("Лимит случаев " + n, async () => {
    equal(await vet(check(Array.from({ length: n }, (_, i) => ({ ...base, id: "c" + i, input: "" }))), "#ResolvedProjectCheck"), n === 32, "MaxItems");
  });
  for (const mode of ["absent", "empty"]) await test("public-cases " + mode, async () => {
    const value: Record<string, unknown> = check([]);
    if (mode === "absent") delete value["public-cases"];
    equal(await vet(value, "#ResolvedProjectCheck"), true, "Отсутствие/пустой список");
  });
  for (const feedback of [{ requirement: "Условие", "what-check": "Проверка" }, { requirement: "Условие" }]) await test("Feedback " + JSON.stringify(feedback), async () => {
    equal(await vet({ ...check([{ ...base, input: "" }]), feedback }, "#ResolvedProjectCheck"), "what-check" in feedback, "Полнота feedback");
  });
  await test("Несовместимый runtime с api-precheck отвергается", async () => {
    equal(await vet({ ...check([{ ...base, input: "" }]), runtime: "fish-v1", "api-precheck": { files: ["Api.java"], entry: "api.Main" } }, "#ResolvedProjectCheck"), false, "Runtime gate");
  });
  // Соседние условные optional-ветви остаются конкретными без выдуманных значений.
  for (const extension of [{}, { java: { release: 25, encoding: "UTF-8" } }, { "api-precheck": { files: ["Api.java"], entry: "api.Main" } }, { "additional-java-sources": { archive: "api.zip", "max-files": 1, "max-file-bytes": 1, "max-total-bytes": 1, "max-archive-bytes": 1 } }]) {
    await test("Optional metadata " + JSON.stringify(extension), async () => equal(await vet({ ...check([{ ...base, state: "" }]), ...extension }, "#ResolvedProjectCheck"), true, "Условная ветвь"));
  }
} finally { await Deno.remove(temp, { recursive: true }); }
if (failures.length) throw Error(`Не пройдено ${failures.length}: ${failures.join("; ")}`);
console.log(`PASS public-cases: ${count}`);
