import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "operation-a1-boundaries-" }),
  extension = join(
    dirname(dirname(fromFileUrl(import.meta.url))),
    "_extensions/course-core",
  ),
  results: any[] = [];
let success = false;
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const actualCommand = Deno.Command;
let commands = 0, a1Temps = 0;
const actualTemp = Deno.makeTempDir;
(Deno as any).makeTempDir = async (options: Deno.MakeTempOptions = {}) => {
  if (options.prefix === "course-bound-context-") a1Temps++;
  return await actualTemp(options);
};
(Deno as any).Command = new Proxy(actualCommand, {
  construct(t, a: any[]) {
    commands++;
    return Reflect.construct(t, a);
  },
});
try {
  for (
    const name of [
      "empty-directory-symlink",
      "existing-input",
      "marker",
      "alias",
      "excluded-S",
      "missing-format",
      "callback-source",
      "callback-membership",
      "parent-final",
      "child-owner",
      "child-S",
    ]
  ) {
    if (Deno.env.get("ONLY_CASE") && Deno.env.get("ONLY_CASE") !== name) {
      continue;
    }
    const owner = join(root, name);
    const put = async (path: string, text: string) => {
      await Deno.mkdir(dirname(join(owner, path)), { recursive: true });
      await Deno.writeTextFile(join(owner, path), text);
    };
    await put(".gitignore", "/.quarto/\n**/*.quarto_ipynb\n");
    await put(
      "_quarto.yml",
      `project:\n  type: website\n  render: [index.qmd]\n  output-dir: _site\n  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts]\n  post-render: [quarto run ${extension}/entrypoints/native-post.ts]\nformat:\n  html: {theme: none}\ncourse: {id: boundaries, view: student}\ncourse-core-runtime: native-ts\ncourse-core-role: exercise-bank\ncourse-core-projection: student\nfilters:\n  - at: pre-ast\n    path: ${extension}/native-ts/early-context.lua\n  - at: post-quarto\n    path: ${extension}/native-ts/late-kind.lua\n  - at: post-render\n    path: ${extension}/native-ts/late-filter.lua\ncourse-project:\n  starter: {path: student}\n${
        name === "excluded-S"
          ? "  build:\n    files: {secret.txt: .gradle/secret.txt}\n"
          : ""
      }`,
    );
    await put(
      "index.qmd",
      '::: {#exr-one project="/projects/a" difficulty=introductory statement-visibility=open}\nУсловие.\n:::\n',
    );
    await put("projects/a/student/Main.txt", "RAW_BYTES");
    if (name === "empty-directory-symlink") {
      await Deno.remove(join(owner, "projects/a/student/Main.txt"));
    }
    if (name === "existing-input") {
      await put(
        "projects/a/native-input.qmd",
        "---\ncourse-project:\n  starter: {path: actual-input}\n---\n# Оригинальный input\n",
      );
      await put("projects/a/actual-input/Main.txt", "INPUT_BOUND_BYTES");
    }
    if (name === "marker") {
      await put(
        "projects/a/_metadata.yml",
        "_course_core_origins_a1: {bad: 1}\n",
      );
    }
    if (name === "alias") {
      await put(
        "projects/a/_metadata.yml",
        "course-project:\n  starter: &starter {path: student}\n  components: {duplicate: *starter}\n",
      );
    }
    if (name === "excluded-S") {
      await put(".gradle/secret.txt", "MUST_NOT_ENTER_A1_COPY");
    }
    if (name === "missing-format") {
      await put(
        "projects/a/native-input.qmd",
        "---\nformat: revealjs\n---\n# Native format mismatch\n",
      );
    }
    const render = async (token?: string) => {
      const r = await new Deno.Command("quarto", {
        args: ["render", "index.qmd", "--to", "html"],
        cwd: owner,
        env: {
          QUARTO_RUN_NO_NETWORK: "true",
          ...(token ? { COURSE_CORE_CAPTURE_TOKEN: token } : {}),
        },
        stdout: "piped",
        stderr: "piped",
      }).output();
      assert(r.success, new TextDecoder().decode(r.stderr));
    };
    let error = "", retained: any, context: any, called = false;
    const before = commands;
    if (name.startsWith("child-")) {
      try {
        await Core.withNativeCaptureScope(
          {
            root: owner,
            projection: "student",
            outputDirectory: join(owner, "_site"),
          },
          { expectedSources: ["index.qmd"] },
          async (scope) => {
            await scope.captureInputs(["index.qmd"], async (token) => {
              await render(token);
              const active = JSON.parse(
                  await Deno.readTextFile(
                    join(owner, "_generated/course-spec/native-ts/active.json"),
                  ),
                ),
                child = join(active.directory, "child-" + token + ".json"),
                value = JSON.parse(await Deno.readTextFile(child));
              if (name === "child-owner") {
                value.state.ownerWitness.config["foreign-owner-witness"] = true;
              } else value.state.rows[0].sha256 = "0".repeat(64);
              await Deno.writeTextFile(child, JSON.stringify(value));
            });
          },
        );
      } catch (e) {
        error = String(e);
      }
      assert(
        error.includes("OPERATION_BINDING"),
        "Foreign child owner/S accepted " + error,
      );
      results.push({ name, error, commands: commands - before });
      continue;
    }
    await render();
    if (name === "empty-directory-symlink") {
      const foreign = join(root, "foreign-empty");
      await Deno.mkdir(foreign);
      await Deno.remove(join(owner, "projects/a/student"));
      await Deno.symlink(foreign, join(owner, "projects/a/student"));
    }
    const afterRender = commands, tempsBefore = a1Temps;
    try {
      await Core.withCurrentNativeOperation({
        root: owner,
        profiles: [],
        projection: "student",
        outputDirectory: join(owner, "_site"),
      }, async (op) => {
        await op.withProjectContexts([{
          owner,
          inputs: ["projects/a/native-input.qmd"],
          profiles: [],
          format: "html",
        }], async (batch) => {
          called = true;
          retained = batch;
          context = batch.groups[0].contexts[0];
          if (name === "existing-input") {
            assert(
              context.origins["starter.path"].sourceFile ===
                  join(owner, "projects/a/native-input.qmd") &&
                context.origins["starter.path"].resolvedPath ===
                  join(owner, "projects/a/actual-input"),
              "Existing input bytes/frontmatter ignored",
            );
          }
          if (name === "callback-source") {
            await put("projects/a/student/Main.txt", "CHANGED_DURING_CALLBACK");
          }
          if (name === "callback-membership") {
            await put("projects/a/student/new.txt", "NEW_MEMBER");
          }
        });
        if (name === "parent-final") {
          await put(
            "projects/a/student/Main.txt",
            "CHANGED_BEFORE_PARENT_FINAL",
          );
        }
      });
    } catch (e) {
      error = String(e);
    }
    if (name === "empty-directory-symlink") {
      assert(
        !called && error.includes("OPERATION_CHANGED"),
        "Empty directory symlink accepted " + error,
      );
      assert(commands === afterRender, "Changed directory executed A1 child");
      assert(
        a1Temps === tempsBefore,
        "Changed directory created disposable copy",
      );
    } else if (name === "existing-input") {
      assert(!error, "Existing lawful input refused " + error);
    } else if (["marker", "alias"].includes(name)) {
      assert(
        !called && /ORIGIN_COLLISION|ORIGIN_UNQUALIFIED/.test(error),
        "Unqualified marker/alias accepted " + error,
      );
      assert(
        commands === afterRender,
        "Invalid instrumentation executed child",
      );
    } else if (name === "excluded-S") {
      assert(
        !called && error.includes("ORIGIN_MISSING"),
        "Excluded physical file silently copied " + error,
      );
    } else if (name === "missing-format") {
      assert(
        !called && error.includes("CONTEXT_FORMAT"),
        "Missing native format borrowed HTML " + error,
      );
    } else {
      assert(
        error.includes("OPERATION_CHANGED"),
        "Closing/parent source change accepted " + error,
      );
      assert(
        retained.metrics.fullFences === 2,
        "Closing attempt cost unavailable",
      );
      let expired = false;
      try {
        await Core.planProject(context, { audience: "student" });
      } catch (e) {
        expired = String(e).includes("CONTEXT_EXPIRED");
      }
      assert(expired, "Failure revived context");
    }
    results.push({
      name,
      error,
      commands: commands - before,
      called,
      terminal: retained?.metrics,
    });
  }
  console.log(JSON.stringify({ root, results }));
  success = true;
  console.log(
    "PASS genuine input/marker/alias/excluded-S/native-format/closing-source-membership/parent-final/foreign-child-owner-S controls; no fallback owner inspect or source discovery",
  );
} finally {
  (Deno as any).Command = actualCommand;
  (Deno as any).makeTempDir = actualTemp;
  if (success) await Deno.remove(root, { recursive: true });
  else console.error("Preserved boundary fixtures " + root);
}
