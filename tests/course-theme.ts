import assert from "node:assert/strict";
import { dirname, fromFileUrl, join } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "course-theme-" });
try {
  await Deno.mkdir(join(root, "_extensions"));
  const add = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
    args: ["add", repo, "--no-prompt"],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert.equal(add.code, 0, new TextDecoder().decode(add.stderr));
  await Deno.writeTextFile(
    join(root, "index.qmd"),
    "---\ntitle: Проверка темы\nformat: course-theme-html\n---\n\nМатериал курса.\n",
  );
  const result = await new Deno.Command(Deno.env.get("QUARTO") || "quarto", {
    args: ["render", "index.qmd", "--fail-if-warnings"],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert.equal(result.code, 0, new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr));
  async function css(path: string): Promise<string> {
    let text = "";
    for await (const entry of Deno.readDir(path)) {
      const file = join(path, entry.name);
      if (entry.isDirectory) text += await css(file);
      else if (file.endsWith(".css")) text += await Deno.readTextFile(file);
    }
    return text;
  }
  const styles = await css(root);
  assert.ok(styles.includes("system-ui"));
  assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(styles), "Тема не загружает Google Fonts");
  assert.ok(styles.includes("--course-nav-foreground"), "Тема задаёт общую палитру навигации");
  console.log("PASS course-theme-html: установленный формат, системные шрифты, общая палитра, без Google Fonts");
} finally {
  await Deno.remove(root, { recursive: true });
}
