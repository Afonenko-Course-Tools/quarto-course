import { dirname, join } from "stdlib/path";
import {
  assignmentChild,
  runAssignmentCaptureChild,
  withAssignmentExecution,
} from "../_extensions/course-core/runtime/assignment-execution.ts";
const root = await Deno.makeTempDir({ prefix: "assignment-child-native-" });
let success = false, spawns = 0, guards = 0;
const original = Deno.Command;
let observed: any;
try {
  let executable: string | undefined;
  for (const directory of (Deno.env.get("PATH") ?? "").split(":")) {
    try {
      const path = join(directory, "quarto");
      if ((await Deno.stat(path)).isFile) {
        executable = await Deno.realPath(path);
        break;
      }
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) throw e;
    }
  }
  if (!executable) throw Error("No installed ordinary Quarto fixture");
  const args = ["render", "index.qmd", "--to", "html"],
    token = crypto.randomUUID(),
    environment: Record<string, string> = { QUARTO_RUN_NO_NETWORK: "true" };
  for (
    const key of [
      "XDG_CACHE_HOME",
      "JAVA_HOME",
      "GRADLE_USER_HOME",
      "PATH",
      "HOME",
    ]
  ) {
    const value = Deno.env.get(key);
    if (value !== undefined) environment[key] = value;
  }
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project:\n  type: default\n  output-dir: _site\nformat:\n  html: {theme: none}\n",
  );
  await Deno.writeTextFile(
    join(root, "index.qmd"),
    "# Exact command\n\nОбычный native fixture.\n",
  );
  // Synthetic fixture describes this one helper invocation, never authority/admission/P.
  const profile: any = {
    root,
    runtime: { files: [{ path: executable }] },
    native: { executable, environment, actualProfiles: [], renders: [args] },
  };
  (Deno as any).Command = new Proxy(original, {
    construct(t, a: any[]) {
      spawns++;
      observed = {
        executable: a[0],
        args: a[1].args,
        cwd: a[1].cwd,
        clearEnv: a[1].clearEnv,
        environmentKeys: Object.keys(a[1].env),
      };
      return Reflect.construct(t, a);
    },
  });
  let error = "";
  try {
    await withAssignmentExecution(
      profile,
      () => runAssignmentCaptureChild(token, { args: [...args, "--execute"] }),
    );
  } catch (e) {
    error = String(e);
  }
  if (!error.includes("BODY.PRODUCER_INPUT_CHANGED") || spawns !== 0) {
    throw Error("Foreign command reached native constructor " + error);
  }
  const output = await withAssignmentExecution(
    profile,
    () => runAssignmentCaptureChild(token, { args, timeoutMs: 60000 }),
    async () => {
      guards++;
    },
  );
  if (
    !output.success || spawns !== 1 || guards !== 1 || !observed.clearEnv ||
    observed.executable !== executable || observed.cwd !== root
  ) throw Error("Exact wire command/guard mismatch");
  const html = await Deno.readTextFile(join(root, "_site/index.html"));
  if (!html.includes("Exact command")) {
    throw Error("Actual native output missing");
  }
  console.log(JSON.stringify({
    scope:
      "one actual ordinary Quarto child through internal execution helper with synthetic profile; NO authority/admission/P-positive",
    spawns,
    guards,
    negativeSpawns: 0,
    actual: observed,
    outputBytes: new TextEncoder().encode(html).length,
  }));
  success = true;
  console.log(
    "PASS actual exact guarded native command; foreign argv zero-spawn; not qualified assignment",
  );
} finally {
  (Deno as any).Command = original;
  if (success) await Deno.remove(root, { recursive: true });
  else console.error("Preserved fixture " + root);
}
