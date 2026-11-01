/** Настоящий cached preview: zero hooks не создают пустую/старую authority. */
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const root = await Deno.makeTempDir({ prefix: "core901-preview-" });
const quarto = Deno.env.get("QUARTO") || "quarto";
function assert(v: unknown, m: string): asserts v {
  if (!v) throw Error(m);
}
const results: unknown[] = [];
async function install(owner: string, alias: boolean) {
  await Deno.mkdir(join(owner, "_extensions"), { recursive: true });
  const r = await new Deno.Command("cp", {
    args: [
      "-R",
      join(repo, "_extensions/course-core"),
      join(owner, "_extensions/course-core"),
    ],
  }).output();
  assert(r.success, "install");
  const pre = alias ? "native-pre" : "pre",
    post = alias ? "native-post" : "post";
  await Deno.writeTextFile(
    join(owner, "_quarto.yml"),
    `project:\n  type: website\n  output-dir: _site-student\n  render: [index.qmd]\n  resources: [public.txt]\n  pre-render: [quarto run _extensions/course-core/entrypoints/${pre}.ts]\n  post-render: [quarto run _extensions/course-core/entrypoints/${post}.ts]\nprofile:\n  default: student\nformat:\n  html:\n    theme: none\nfilters: [course-core]\ncourse: {id: preview-native}\n`,
  );
  await Deno.writeTextFile(join(owner, "public.txt"), "PUBLIC_STATIC_RESOURCE");
  await Deno.writeTextFile(
    join(owner, "_quarto-student.yml"),
    "course: {view: student}\n",
  );
  await Deno.writeTextFile(
    join(owner, "index.qmd"),
    `---\nexercise-bank: true\n---\n# Preview\n\n::: {#exr-native difficulty=introductory statement-visibility=open}\n## Public\nPublic preview text.\n\n::: {.solution}\nPRIVATE_PREVIEW_SOLUTION\n:::\n:::\n`,
  );
}
async function current(owner: string, expected: boolean) {
  const Core = await import(
    toFileUrl(join(owner, "_extensions/course-core/public.ts")).href
  );
  let code = "";
  try {
    await Core.withCurrentNativeOperation({
      root: owner,
      profiles: ["student"],
      projection: "student",
      outputDirectory: join(owner, "_site-student"),
    }, async () => {});
  } catch (e) {
    code = (e as { code?: string }).code ?? String(e);
  }
  assert(
    expected
      ? code === ""
      : ["OPERATION_BINDING", "OPERATION_INCOMPLETE"].includes(code),
    "current scope: " + code,
  );
}
async function generations(owner: string) {
  const dirs: string[] = [];
  for await (
    const e of Deno.readDir(join(owner, "_generated/course-spec/native-ts"))
  ) if (e.isDirectory) dirs.push(e.name);
  return dirs.sort();
}
async function preview(owner: string, cold = false) {
  const socket = Deno.listen({ hostname: "127.0.0.1", port: 0 }),
    port = (socket.addr as Deno.NetAddr).port;
  socket.close();
  const before = cold ? [] : await generations(owner);
  const child = new Deno.Command("setsid", {
    args: [
      "--wait",
      quarto,
      "preview",
      "--no-browser",
      "--no-watch-inputs",
      "--port",
      String(port),
      "--profile",
      "student",
    ],
    cwd: owner,
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  let text = "", exited = false;
  const status = child.status.then((r) => {
    exited = true;
    return r;
  });
  async function consume(stream: ReadableStream<Uint8Array>) {
    const dec = new TextDecoder();
    for await (const chunk of stream) text += dec.decode(chunk);
  }
  const streams = Promise.all([consume(child.stdout), consume(child.stderr)]);
  let served = false;
  try {
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline && !exited) {
      if (/Browse at|Listening on/.test(text)) {
        await current(owner, cold);
        if (!cold) {
          assert(
            JSON.stringify(await generations(owner)) === JSON.stringify(before),
            "zero hooks created generation",
          );
        }
        // GET страницы может законно вызвать настоящий on-demand render; static
        // resource проверяет serving, не запускает новую бизнес-операцию.
        const response = await fetch(`http://127.0.0.1:${port}/public.txt`),
          text = await response.text();
        assert(
          response.ok && text === "PUBLIC_STATIC_RESOURCE",
          "preview static HTTP",
        );
        served = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    assert(served, "cached preview did not serve: " + text);
    try {
      await current(owner, cold);
    } catch (e) {
      throw Error(String(e) + " owner=" + owner + " native output=" + text);
    }
    if (!cold) {
      assert(
        JSON.stringify(await generations(owner)) === JSON.stringify(before),
        "cached preview created generation",
      );
    }
    results.push({
      owner: cold ? "clean" : owner === root ? "root" : "child",
      served: true,
      noNewGeneration: !cold,
      noCurrentCompletion: !cold,
    });
  } finally {
    await new Deno.Command("kill", {
      args: ["-TERM", "--", `-${child.pid}`],
      stdout: "null",
      stderr: "null",
    }).output();
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      status,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, 3000);
      }),
    ]);
    clearTimeout(timer);
    await new Deno.Command("kill", {
      args: ["-KILL", "--", `-${child.pid}`],
      stdout: "null",
      stderr: "null",
    }).output();
    await status;
    await streams;
  }
}
async function hook(
  owner: string,
  phase: string,
  input: string | undefined,
  output: string | undefined,
  file?: string,
  token?: string,
  changes?: Record<string, string>,
) {
  const env = Deno.env.toObject();
  for (
    const key of [
      "QUARTO_PROJECT_INPUT_FILES",
      "QUARTO_PROJECT_OUTPUT_FILES",
      "QUARTO_USE_FILE_FOR_PROJECT_INPUT_FILES",
      "QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES",
      "COURSE_CORE_CAPTURE_TOKEN",
    ]
  ) delete env[key];
  Object.assign(env, {
    QUARTO_PROJECT_DIR: owner,
    QUARTO_PROJECT_OUTPUT_DIR: join(owner, "_site-student"),
    QUARTO_PROFILE: "student",
  });
  if (input !== undefined) env.QUARTO_PROJECT_INPUT_FILES = input;
  if (output !== undefined) env.QUARTO_PROJECT_OUTPUT_FILES = output;
  if (file !== undefined) {
    env[
      phase === "pre"
        ? "QUARTO_USE_FILE_FOR_PROJECT_INPUT_FILES"
        : "QUARTO_USE_FILE_FOR_PROJECT_OUTPUT_FILES"
    ] = file;
  }
  if (token !== undefined) env.COURSE_CORE_CAPTURE_TOKEN = token;
  Object.assign(env, changes ?? {});
  return await new Deno.Command(quarto, {
    args: [
      "run",
      join(owner, `_extensions/course-core/entrypoints/${phase}.ts`),
    ],
    cwd: owner,
    clearEnv: true,
    env,
    stdout: "piped",
    stderr: "piped",
  }).output();
}
try {
  await install(root, false);
  const child = join(root, "part");
  await install(child, true);
  for (const owner of [root, child]) {
    const rendered = await new Deno.Command(quarto, {
      args: ["render", "--profile", "student"],
      cwd: owner,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(rendered.success, new TextDecoder().decode(rendered.stderr));
    const html = await Deno.readTextFile(
      join(owner, "_site-student/index.html"),
    );
    assert(
      html.includes("Public preview text.") &&
        !html.includes("PRIVATE_PREVIEW_SOLUTION"),
      "cold student privacy",
    );
    await current(owner, true);
    const Runtime = await import(
      toFileUrl(join(owner, "_extensions/course-core/runtime/operation.ts"))
        .href
    );
    const saved = new Map(
      [
        "QUARTO_PROJECT_INPUT_FILES",
        "QUARTO_PROJECT_OUTPUT_FILES",
        "QUARTO_PROFILE",
      ].map((key) => [key, Deno.env.get(key)]),
    );
    try {
      Deno.env.set("QUARTO_PROJECT_INPUT_FILES", "");
      Deno.env.set("QUARTO_PROJECT_OUTPUT_FILES", "");
      Deno.env.set("QUARTO_PROFILE", "student");
      let pre = "", post = "";
      try {
        await Runtime.beginNativeOperation(owner);
      } catch (e) {
        pre = (e as { code?: string }).code ?? String(e);
      }
      try {
        await Runtime.finishNativeOperation(owner);
      } catch (e) {
        post = (e as { code?: string }).code ?? String(e);
      }
      assert(
        pre === "OPERATION_BINDING" && post === "OPERATION_INCOMPLETE",
        "strict begin/finish API weakened: " + pre + "/" + post,
      );
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) Deno.env.delete(key);
        else Deno.env.set(key, value);
      }
    }
    await current(owner, true);
    await preview(owner);
  }
  for (const phase of ["pre", "post"]) {
    assert(
      !(await hook(root, phase, undefined, undefined)).success,
      "missing native list accepted",
    );
    assert(
      !(await hook(
        root,
        phase,
        phase === "pre" ? "\n" : undefined,
        phase === "post" ? "\n" : undefined,
      )).success,
      "malformed empty list accepted",
    );
    assert(
      !(await hook(root, phase, "", "", undefined, "invalid-token")).success,
      "empty token scope accepted",
    );
    const file = await Deno.makeTempFile();
    try {
      assert(
        (await hook(root, phase, undefined, undefined, file)).success,
        "native empty file transport refused",
      );
    } finally {
      await Deno.remove(file);
    }
  }
  assert(
    !(await hook(root, "pre", "", undefined, undefined, undefined, {
      QUARTO_PROJECT_DIR: child,
      QUARTO_PROJECT_OUTPUT_DIR: join(child, "_site-student"),
    })).success,
    "foreign native cwd accepted",
  );
  const link = join(root, "_generated/foreign-output");
  await Deno.symlink(join(child, "_site-student"), link);
  try {
    assert(
      !(await hook(root, "pre", "", undefined, undefined, undefined, {
        QUARTO_PROJECT_OUTPUT_DIR: link,
      })).success,
      "aliased native output accepted",
    );
  } finally {
    await Deno.remove(link);
  }
  const Core = await import(
    toFileUrl(join(root, "_extensions/course-core/public.ts")).href
  );
  let reservedRefused = false;
  try {
    await Core.withNativeCaptureScope(
      {
        root,
        projection: "student",
        outputDirectory: join(root, "_site-student"),
      },
      { expectedSources: ["index.qmd"] },
      async () => {
        reservedRefused = !(await hook(root, "pre", "", undefined)).success;
        assert(reservedRefused, "active reservation invalidated by zero hook");
      },
    );
  } catch (e) {
    if (!reservedRefused) throw e;
  }
  assert(reservedRefused, "reservation control absent");
  results.push({
    missingRefused: true,
    malformedRefused: true,
    tokenRefused: true,
    emptyFileTransport: true,
    activeReservationRefused: true,
  });
  const clean = await Deno.makeTempDir({ prefix: "core901-clean-preview-" });
  try {
    await install(clean, false);
    await preview(clean, true);
    const html = await Deno.readTextFile(
      join(clean, "_site-student/index.html"),
    );
    assert(
      html.includes("Public preview text.") &&
        !html.includes("PRIVATE_PREVIEW_SOLUTION"),
      "clean preview privacy",
    );
  } finally {
    await Deno.remove(clean, { recursive: true });
  }
  console.log(JSON.stringify({ fixture: root, results }));
} finally {
  await Deno.remove(root, { recursive: true });
}
