// Real native inspect counts and current source bytes, with no fabricated completed proofs.
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const evidence = Deno.env.get("OWNER_VALIDATION_TEST_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "owner-validation-scope-" });
await Deno.mkdir(evidence, { recursive: true });
const native = Deno.env.get("QUARTO") || "quarto";
const calls = join(evidence, "native-calls.txt");
const wrapper = join(evidence, "quarto-counted");
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
await Deno.writeTextFile(
  wrapper,
  `#!/bin/sh\nprintf '%s\\n' "$*" >> ${quote(calls)}\nexec ${
    quote(native)
  } "$@"\n`,
);
await Deno.chmod(wrapper, 0o755);
Deno.env.set("QUARTO", wrapper);
const api = await import(
  toFileUrl(join(repo, "_extensions/course-core/owner-preflight/owner.ts")).href
);
// Missing API still executes real repeated validation to expose the RED count.
const scope = api.withOwnerValidationScope ||
  ((operation: () => Promise<unknown>) => operation());

async function copy(source: string, target: string) {
  await Deno.mkdir(target, { recursive: true });
  for await (const entry of Deno.readDir(source)) {
    const from = join(source, entry.name), to = join(target, entry.name);
    if (entry.isDirectory) await copy(from, to);
    else if (entry.isFile) await Deno.copyFile(from, to);
    else throw new Error("nonregular package fixture: " + from);
  }
}
let sequence = 0;
async function fixture(profile = "student") {
  const root = join(evidence, "owner-" + sequence++);
  await Deno.mkdir(root);
  await copy(
    join(repo, "_extensions"),
    join(root, "_extensions"),
  );
  const dependency = join(evidence, "external-" + sequence + ".css");
  await Deno.writeTextFile(dependency, "body { color: black; }\n");
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: _extensions/course-core/entrypoints/owner-freeze.ts\nformat:\n  html:\n    theme: none\n    css: ${
      JSON.stringify(dependency)
    }\nfilters: [course-core]\ncourse:\n  id: scoped-audit\n`,
  );
  for (const view of ["student", "full"]) {
    await Deno.writeTextFile(
      join(root, `_quarto-${view}.yml`),
      `course:\n  view: ${view}\n`,
    );
  }
  await Deno.writeTextFile(join(root, "index.qmd"), "# Current source\n");
  const audit = await api.auditOwner(root, "_extensions/course-core");
  assert(audit.dependencies[dependency], "external native dependency omitted");
  const session = {
    protocol: 1,
    root,
    attemptId: "attempt-" + sequence,
    profile,
    sessionId: "session-" + sequence,
    extension: "_extensions/course-core",
    quarto: wrapper,
    audit,
    files: await api.fingerprint(audit),
    validated: false,
    captures: {},
    captureHashes: {},
    captureProjections: {},
    captureProjectionHash: "",
    identities: {},
    identityHashes: {},
    identityReaders: {},
    identityReplays: {},
    readerInputs: {},
    readerInputHashes: {},
    headers: [],
  };
  await Deno.mkdir(join(root, ".course-owner"));
  const path = join(root, ".course-owner/preparation.json");
  await Deno.writeTextFile(path, JSON.stringify(session));
  return { root, path, session, dependency };
}
async function inspectCount() {
  return (await Deno.readTextFile(calls)).split("\n")
    .filter((line) => line.startsWith("inspect ")).length;
}
async function refuses(operation: () => Promise<unknown>, code?: string) {
  try {
    await operation();
  } catch (error) {
    assert(
      error instanceof api.OwnerFailure &&
        (!code || (error as { code: string }).code === code),
      "unexpected refusal: " + error,
    );
    return;
  }
  throw new Error("accepted mutation" + (code ? ": " + code : ""));
}
const selected = Deno.args[0];
async function test(name: string, operation: () => Promise<void>) {
  if (selected && selected !== name) return;
  await operation();
  console.log("PASS " + name);
}
const f = await fixture();
await test("nested", async () => {
  const before = await inspectCount();
  await scope(async () => {
    await api.assertFrozen(f.path);
    await scope(async () => {
      await api.assertFrozen(f.path);
      await api.assertFrozen(f.path);
    });
  });
  assert(
    await inspectCount() - before === 4,
    "nested source validation repeated native audit: wanted 4 inspect calls, got " +
      (await inspectCount() - before),
  );
});
await test("fresh", async () => {
  const before = await inspectCount();
  await api.assertFrozen(f.path);
  await api.assertFrozen(f.path);
  assert(
    await inspectCount() - before === 8,
    "separate operations shared audit",
  );
});
await test("closure-mutation", async () => {
  const source = join(f.root, "index.qmd"), bytes = await Deno.readFile(source);
  try {
    await refuses(
      () =>
        scope(async () => {
          await api.assertFrozen(f.path);
          await Deno.writeTextFile(source, "# Changed after validation\n");
          return "must never escape";
        }),
      "SOURCE.FROZEN_INPUT_CHANGED",
    );
    await refuses(
      () => api.assertFrozen(f.path),
      "SOURCE.FROZEN_INPUT_CHANGED",
    );
  } finally {
    await Deno.writeFile(source, bytes);
  }
});
await test("reuse-mutations", async () => {
  for (
    const path of [
      join(f.root, "index.qmd"),
      join(f.root, "_quarto.yml"),
      join(f.root, "_extensions/course-core/owner-preflight/owner/runtime.ts"),
      join(
        f.root,
        "_extensions/course-core/owner-preflight/owner/validation-scope.ts",
      ),
      join(
        f.root,
        "_extensions/course-core/owner-preflight/owner/async-hooks.d.ts",
      ),
      f.dependency,
    ]
  ) {
    const bytes = await Deno.readFile(path);
    await scope(async () => {
      await api.assertFrozen(f.path);
      try {
        const changed = new Uint8Array(bytes.length + 1);
        changed.set(bytes);
        changed[bytes.length] = 32;
        await Deno.writeFile(path, changed);
        await refuses(() => api.assertFrozen(f.path));
      } finally {
        await Deno.writeFile(path, bytes);
      }
      await api.assertFrozen(f.path);
    });
  }
});
await test("failure-disposal", async () => {
  const before = await inspectCount();
  await scope(async () => {
    await api.assertFrozen(f.path);
    try {
      await scope(async () => {
        throw new Error("caller failure");
      });
    } catch (error) {
      assert(String(error).includes("caller failure"), String(error));
    }
    await api.assertFrozen(f.path);
  });
  assert(
    await inspectCount() - before === 8,
    "caught nested failure retained success",
  );
});
await test("concurrent", async () => {
  const other = await fixture("full"), before = await inspectCount();
  await Promise.all([
    scope(async () => {
      await api.assertFrozen(f.path);
      await api.assertFrozen(f.path);
    }),
    scope(async () => {
      await api.assertFrozen(other.path);
      await api.assertFrozen(other.path);
    }),
    scope(async () => {
      await api.assertFrozen(f.path);
      await api.assertFrozen(f.path);
    }),
  ]);
  assert(
    await inspectCount() - before === 12,
    "concurrent operations shared audit or repeated it",
  );
});
await test("session-profile", async () => {
  const before = await inspectCount(), original = await Deno.readFile(f.path);
  await scope(async () => {
    await api.assertFrozen(f.path);
    try {
      await Deno.writeTextFile(
        f.path,
        JSON.stringify({
          ...f.session,
          profile: "full",
          sessionId: "other-session",
        }),
      );
      await api.assertFrozen(f.path);
    } finally {
      await Deno.writeFile(f.path, original);
    }
  });
  assert(
    await inspectCount() - before === 8,
    "profile/session boundary shared success",
  );
});
await test("invocation", async () => {
  const runtime = await import(
    toFileUrl(
      join(repo, "_extensions/course-core/owner-preflight/owner/runtime.ts"),
    ).href
  );
  const activePath = join(f.root, ".course-owner/active.json");
  const before = await inspectCount();
  await scope(async () => {
    await api.assertFrozen(f.path);
    try {
      for (const profile of ["student", "full"]) {
        await Deno.writeTextFile(
          activePath,
          JSON.stringify({
            protocol: 1,
            root: f.root,
            attemptId: f.session.attemptId,
            profile,
            sessionId: f.session.sessionId,
            sessionPath: f.path,
            sessionHash: await api.digestFile(f.path),
            invocationId: crypto.randomUUID(),
            phase: "capture",
            inputsHash: await runtime.objectHash(
              f.session.audit.profiles[profile].files.input,
            ),
            output: join(
              f.root,
              ".course-owner/native-capture-output",
              profile,
            ),
          }),
        );
        await api.assertFrozen(f.path);
        await api.assertFrozen(f.path);
      }
      const active = JSON.parse(await Deno.readTextFile(activePath));
      await Deno.writeTextFile(
        activePath,
        JSON.stringify({ ...active, phase: "render" }),
      );
      await refuses(() => api.assertFrozen(f.path), "SOURCE.INVALID_ATTEMPT");
    } finally {
      await Deno.remove(activePath);
    }
  });
  assert(
    await inspectCount() - before === 16,
    "invocation/profile/phase changes reused native audit",
  );
});
await test("environment", async () => {
  const before = await inspectCount();
  await scope(async () => {
    await api.assertFrozen(f.path);
    Deno.env.set("COURSE_VALIDATION_TEST_BINDING", "current");
    try {
      await api.assertFrozen(f.path);
      await api.assertFrozen(f.path);
    } finally {
      Deno.env.delete("COURSE_VALIDATION_TEST_BINDING");
    }
    await api.assertFrozen(f.path);
  });
  assert(
    await inspectCount() - before === 8,
    "native environment changed under a cached audit",
  );
});
await test("environment-closure", async () => {
  try {
    await refuses(() =>
      scope(async () => {
        await api.assertFrozen(f.path);
        Deno.env.set(
          "COURSE_VALIDATION_TEST_BINDING",
          "changed after last audit",
        );
        return "must never escape";
      }), "SOURCE.CONFIGURATION_CHANGED");
  } finally {
    Deno.env.delete("COURSE_VALIDATION_TEST_BINDING");
  }
});
await test("link-mutation", async () => {
  const source = join(f.root, "index.qmd"), saved = source + ".saved";
  await scope(async () => {
    await api.assertFrozen(f.path);
    await Deno.rename(source, saved);
    try {
      await Deno.symlink(saved, source);
      await refuses(
        () => api.assertFrozen(f.path),
        "SOURCE.SYMLINK_UNSUPPORTED",
      );
    } finally {
      await Deno.remove(source);
      await Deno.rename(saved, source);
    }
  });
});
await test("trace", async () => {
  const trace = join(evidence, "native-trace.jsonl");
  Deno.env.set("COURSE_BUILD_TRACE", trace);
  try {
    await api.assertFrozen(f.path);
    assert(await api.exists(trace), "native timing trace was not written");
    const events = (await Deno.readTextFile(trace)).trim().split("\n").map((
      line,
    ) => JSON.parse(line));
    assert(
      events.length === 4,
      "trace omitted or duplicated native inspect calls",
    );
    for (const event of events) {
      assert(
        event.kind === "inspect" && event.executable === wrapper &&
          event.cwd === f.root &&
          event.exitCode === 0 && typeof event.elapsedMs === "number" &&
          event.elapsedMs >= 0 &&
          JSON.stringify(Object.keys(event).sort()) ===
            '["args","cwd","elapsedMs","executable","exitCode","kind"]',
        "trace command fields/output changed: " + JSON.stringify(event),
      );
      assert(
        event.args.length === 3 && event.args[1] === "--profile",
        "trace exposed unsupported arguments",
      );
    }
    const result = await api.invoke("/usr/bin/true", [
      "render",
      ".",
      "--profile",
      "student",
      "--metadata",
      "PRIVATE_USER_TEXT",
    ], f.root);
    assert(
      result.exitCode === 0 && result.stdout === "" && result.stderr === "",
      "trace changed command result",
    );
    const render = JSON.parse(
      (await Deno.readTextFile(trace)).trim().split("\n").at(-1)!,
    );
    assert(
      render.kind === "render" &&
        JSON.stringify(render.args) === '[".","--profile","student"]',
      "trace exposed user arguments",
    );
    let threw = false;
    try {
      await api.invoke(join(evidence, "missing-executable"), [
        "inspect",
        f.root,
        "--profile",
        "student",
      ], f.root);
    } catch (error) {
      threw = error instanceof Deno.errors.NotFound;
    }
    assert(threw, "trace changed process-start failure");
    const failure = JSON.parse(
      (await Deno.readTextFile(trace)).trim().split("\n").at(-1)!,
    );
    assert(
      failure.kind === "inspect" && failure.exitCode === null,
      "process-start failure was not traced",
    );
    Deno.env.set("COURSE_BUILD_TRACE", evidence); // A directory is an unwritable trace destination.
    assert(
      (await api.invoke("/usr/bin/true", ["inspect", f.root], f.root))
        .exitCode === 0,
      "optional telemetry failure changed command success",
    );
  } finally {
    Deno.env.delete("COURSE_BUILD_TRACE");
  }
});
await test("render-boundary", async () => {
  const before = await inspectCount();
  await scope(async () => {
    await api.assertFrozen(f.path);
    const rendered = await api.invoke(native, ["render", "--help"], f.root);
    assert(rendered.exitCode === 0, rendered.stderr);
    await api.assertFrozen(f.path);
  });
  assert(
    await inspectCount() - before === 8,
    "native render retained pre-render source audit",
  );
});
await test("navigation-dedup", async () => {
  const root = join(evidence, "navigation");
  await Deno.mkdir(root);
  await copy(join(repo, "_extensions"), join(root, "_extensions"));
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project:\n  type: website\n  output-dir: .project-publish/native\n  render: []\n  pre-render: _extensions/course-core/entrypoints/owner-freeze.ts\nformat:\n  html:\n    theme: none\nfilters: [course-core]\ncourse:\n  id: scoped-navigation\n",
  );
  await Deno.writeTextFile(
    join(root, "_quarto-student.yml"),
    "course:\n  view: student\n",
  );
  const control = join(root, "_quarto-publish-portal.yml");
  await Deno.writeTextFile(control, "project:\n  render: [index.qmd]\n");
  await Deno.writeTextFile(join(root, "index.qmd"), "# Portal\n");
  await Deno.mkdir(join(root, "dormant"));
  await Deno.writeTextFile(
    join(root, "dormant/_quarto.yml"),
    "project:\n  type: default\n  output-dir: _site\nformat: html\n",
  );
  for (const name of ["one", "two", "three"]) {
    await Deno.writeTextFile(join(root, `dormant/${name}.qmd`), "# Dormant\n");
  }
  const configHashes = Object.fromEntries(
    await Promise.all(
      ["_quarto.yml", "_quarto-student.yml", "_quarto-publish-portal.yml"].map(
        async (
          path,
        ) => [join(root, path), await api.digestFile(join(root, path))],
      ),
    ),
  );
  const navigation = await import(
    toFileUrl(
      join(repo, "_extensions/course-core/owner-preflight/navigation.ts"),
    ).href
  );
  const before = (await Deno.readTextFile(calls)).split("\n").length;
  const audit = await navigation.auditNavigation(
    root,
    "_extensions/course-core",
    "student",
    {
      portal: {
        input: join(root, "index.qmd"),
        output: join(evidence, "portal-output"),
        renderProfiles: ["student", "publish-portal"],
        control,
        controlHash: configHashes[control],
        configHashes,
      },
      members: [],
    },
  );
  assert(
    audit.navigation?.dormant.length === 1,
    "dormant independent owner omitted",
  );
  const current = (await Deno.readTextFile(calls)).split("\n").slice(
    before - 1,
  );
  assert(
    current.filter((line) =>
      line === `inspect ${join(root, "dormant")} --profile student`
    ).length === 1,
    "owning dormant project inspected more than once",
  );
  for (const name of ["one", "two", "three"]) {
    assert(
      current.filter((line) =>
        line ===
          `inspect ${join(root, `dormant/${name}.qmd`)} --profile student`
      ).length === 1,
      "individual dormant document ownership omitted: " + name,
    );
  }
});
console.log("Evidence: " + evidence);
