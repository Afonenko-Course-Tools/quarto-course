const revision = new Deno.Command("git", {
  args: ["rev-parse", "HEAD"],
  stdout: "piped",
  stderr: "null",
}).outputSync();
const commit = Deno.env.get("DEMO_SOURCE_COMMIT") ||
  (revision.success ? new TextDecoder().decode(revision.stdout).trim() : "");
const status = new Deno.Command("git", {
  args: ["status", "--porcelain"],
  stdout: "piped",
}).outputSync();
const version = new Deno.Command("quarto", {
  args: ["--version"],
  stdout: "piped",
}).outputSync();
if (!version.success) throw new Error("Cannot record Quarto version");
Deno.writeTextFileSync(
  "_book-full/BUILD.json",
  JSON.stringify(
    {
      producer: "Afonenko-Course-Tools/quarto-course",
      commit,
      sourceDirty: Deno.env.get("DEMO_SOURCE_DIRTY") === "true" ||
        (status.success &&
          new TextDecoder().decode(status.stdout).trim().length > 0),
      dependencies: {
        "quarto-course": "v3.0.0",
        quarto: new TextDecoder().decode(version.stdout).trim(),
      },
      commands: ["task install", "task render"],
    },
    null,
    2,
  ) + "\n",
);
