import { required } from "./helpers/required.ts";
import { beginNativePreHook, finishNativePostHook } from "../_extensions/course-core/runtime/operation.ts";
function assert(v: unknown, message: string): asserts v {
  if (!v) throw Error(message);
}
const root = await Deno.makeTempDir({ prefix: "core-progress-" });
const cwd = Deno.cwd(),
  error = console.error,
  log = console.log,
  realPath = Deno.realPath;
const getEnv = Deno.env.get;
const env = {
  QUARTO_PROJECT_DIR: root,
  QUARTO_PROJECT_OUTPUT_DIR: root + "/_site",
  QUARTO_PROJECT_INPUT_FILES: "",
  QUARTO_PROJECT_OUTPUT_FILES: "",
  QUARTO_PROFILE: "student",
  QUARTO_PROJECT_SCRIPT_QUIET: "0",
};
const before = Object.fromEntries(Object.keys(env).map((k) => [k, Deno.env.get(k)]));
const results: unknown[] = [];
try {
  await Deno.mkdir(root + "/_site");
  Deno.chdir(root);
  for (const [k, v] of Object.entries(env)) Deno.env.set(k, v);
  for (const [name, hook, count] of [
    ["pre", beginNativePreHook, "inputs=0"],
    ["post", finishNativePostHook, "outputs=0"],
  ] as const) {
    for (const quiet of [false, true]) {
      Deno.env.set("QUARTO_PROJECT_SCRIPT_QUIET", quiet ? "1" : "0");
      const stderr: string[] = [],
        stdout: unknown[] = [];
      console.error = (...v: unknown[]) => {
        stderr.push(v.join(" "));
      };
      console.log = (...v: unknown[]) => {
        stdout.push(v);
      };
      let firstRead = false;
      Deno.realPath = async (path) => {
        if (!firstRead) {
          firstRead = true;
          assert(quiet || stderr[0]?.includes("начало"), "Progress must precede first preparation read");
        }
        return await realPath(path);
      };
      await hook(root);
      assert(stdout.length === 0, "No new stdout on no-work lifecycle");
      assert(
        quiet
          ? stderr.length === 0
          : stderr.some((v) => v.includes(count)) && /готово \([0-9.]+ с\)/.test(stderr.at(-1) ?? ""),
        "Stage/count/wall or quiet contract",
      );
      const sentinel = Error("original I/O error");
      stderr.length = 0;
      Deno.realPath = () => Promise.reject(sentinel);
      let caught: unknown;
      try {
        await hook(root);
      } catch (e) {
        caught = e;
      }
      assert(caught === sentinel, "Progress must preserve exact error identity");
      assert(
        quiet
          ? stderr.length === 0
          : stderr.length === 2 &&
              required(stderr[0]).includes("начало") &&
              /ошибка \([0-9.]+ с\)/.test(required(stderr[1])),
        "Timed failure or quiet contract",
      );
      Deno.realPath = realPath;
      results.push({ name, quiet, noWork: true, errorIdentity: true, stdoutBytes: 0 });
    }
  }
  const deniedMessages: unknown[] = [];
  console.error = (...v: unknown[]) => {
    deniedMessages.push(v);
  };
  Deno.env.get = (key) => {
    if (key === "QUARTO_PROJECT_SCRIPT_QUIET") throw Error("quiet env denied");
    return getEnv(key);
  };
  await beginNativePreHook(root);
  await finishNativePostHook(root);
  assert(deniedMessages.length === 0, "Reporting must not add env permission requirements");
  results.push({ quietEnvDenied: true, nativeCalls: 0 });
} finally {
  Deno.env.get = getEnv;
  Deno.realPath = realPath;
  console.error = error;
  console.log = log;
  Deno.chdir(cwd);
  for (const [k, v] of Object.entries(before)) v === undefined ? Deno.env.delete(k) : Deno.env.set(k, v);
  await Deno.remove(root, { recursive: true });
}
console.log(JSON.stringify({ status: "PASS", nativeCalls: 0, results }));
