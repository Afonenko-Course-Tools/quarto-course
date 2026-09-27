import { publishDownloads, starterFiles, zip } from "../_extensions/course-core/infrastructure/archive.ts";
import type { Course } from "../_extensions/course-core/domain/model.ts";
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
async function rejects(action: () => Promise<unknown>, reason: string) {
  try { await action(); } catch { return; }
  throw new Error(`Ожидался отказ: ${reason}`);
}
const root = await Deno.makeTempDir({prefix: "course-archive-"});
try {
  await Deno.mkdir(root + "/nested/project/student/src", {recursive: true});
  await Deno.mkdir(root + "/nested/project/student/build", {recursive: true});
  await Deno.mkdir(root + "/nested/project/reference", {recursive: true});
  await Deno.mkdir(root + "/nested/project/tests", {recursive: true});
  await Deno.writeTextFile(root + "/nested/project/student/build.gradle", "plugins { id 'java' }");
  await Deno.writeTextFile(root + "/nested/project/student/src/Пример.java", "class Example {}\n");
  await Deno.writeTextFile(root + "/nested/project/student/build/secret.class", "compiled");
  await Deno.writeTextFile(root + "/nested/project/reference/Solution.java", "private reference");
  await Deno.writeTextFile(root + "/nested/project/tests/Hidden.java", "private tests");
  const entries = await starterFiles(root, "/nested/project");
  assert(entries.length === 2 && entries.every(e=>!e.name.startsWith("student/")), "только полное содержимое стартового проекта без префикса");
  const archive = zip(entries);
  assert(archive.every((byte, i) => byte === zip(entries)[i]), "воспроизводимый ZIP");
  await Deno.writeFile(root + "/sample.zip", archive);
  await rejects(()=>starterFiles(root, "/../outside"), "traversal");
  await Deno.symlink(root + "/nested/project/reference/Solution.java", root + "/nested/project/student/symlink.java");
  await rejects(()=>starterFiles(root, "/nested/project"), "symlink to private reference");
  await Deno.remove(root + "/nested/project/student/symlink.java");
  await Deno.symlink(root + "/nested/project", root + "/alias");
  await rejects(()=>starterFiles(root, "/alias"), "symlink project path");
  const model = {exercises: [{id: "exr-1-demo", source: "nested/index.qmd", project: "/nested/project"}], downloads: [{exercise: "exr-1-demo", source: "nested/index.qmd"}]} as Course;
  await publishDownloads(root, "_book", model);
  assert((await Deno.stat(root + "/_book/_downloads/exr-1-demo.zip")).size > 0, "итоговый ZIP создан");
  await publishDownloads(root, "_book", {...model, downloads: []});
  await rejects(()=>Deno.stat(root + "/_book/_downloads/exr-1-demo.zip"), "stale archive deleted when request removed");
  console.log("Архивы: только student, воспроизводимость, отклонение выхода за корень и символических ссылок, удаление устаревших файлов — успешно.");
  // Если установлен unzip, дополнительно проверяется совместимость архива.
  try {
    const check = await new Deno.Command("unzip", {args: ["-t", root + "/sample.zip"], stdout: "piped", stderr: "piped"}).output();
    assert(check.success, "совместимость с программой чтения ZIP");
    console.log("Совместимость ZIP: CRC и имена файлов проверены unzip.");
  } catch (error) { if (!(error instanceof Deno.errors.NotFound)) throw error; }
} finally { await Deno.remove(root, {recursive: true}); }
