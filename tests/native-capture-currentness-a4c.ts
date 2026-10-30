import * as Core from "../_extensions/course-core/public.ts";
import { join } from "stdlib/path";
import { captureFixture, childRender } from "./helpers/native-capture-a4c.ts";
const check = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const results: { name: string; passed: boolean; root?: string }[] = [];
{
  const r = await captureFixture();
  const n = await new Deno.Command("quarto", {
    args: ["render", "index.qmd", "--to", "html"],
    cwd: r.root,
    env: { QUARTO_RUN_NO_NETWORK: "true", DENO_NO_PACKAGE_JSON: "1" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  check(n.success, "baseline native complete");
  const path = join(r.root, "_generated/course-spec/native-ts/active.json"),
    before = await Deno.readTextFile(path);
  let error = "";
  try {
    await Core.withNativeCaptureScope(
      r,
      { expectedSources: [] },
      async () => {},
    );
  } catch (e) {
    error = String(e);
  }
  check(
    error.includes("OPERATION_BINDING") &&
      await Deno.readTextFile(path) === before,
    "empty plan changed existing current",
  );
  await Core.withCurrentNativeOperation(
    { ...r, profiles: ["student"] },
    async (op) => check(op.catalog.documents.length === 1, "current lost"),
  );
  try {
    await Core.withNativeCaptureScope(
      r,
      { expectedSources: ["index.qmd"] },
      async () => {
        let oldRead = false;
        try {
          await Core.withCurrentNativeOperation(
            { ...r, profiles: ["student"] },
            async () => {
              oldRead = true;
            },
          );
        } catch {}
        check(!oldRead, "old complete reused before bind");
      },
    );
  } catch {}
  check(
    await Deno.readTextFile(path) !== before,
    "valid reservation did not replace current",
  );
  let oldRead = false;
  try {
    await Core.withCurrentNativeOperation(
      { ...r, profiles: ["student"] },
      async () => {
        oldRead = true;
      },
    );
  } catch {}
  check(!oldRead, "failed empty reservation restored old complete");
  results.push({
    name:
      "invalid empty plan preserves current; valid empty execution invalidates old",
    passed: true,
    root: r.root,
  });
}
for (const mutate of [false, true]) {
  const r = await captureFixture();
  await Deno.mkdir(join(r.root, "assets"));
  await Deno.writeTextFile(
    join(r.root, "assets/shared.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" /></svg>',
  );
  for (const source of ["index.qmd", "slides.qmd"]) {
    await Deno.writeTextFile(
      join(r.root, source),
      (await Deno.readTextFile(join(r.root, source))) +
        "\n![Ресурс](assets/shared.svg)\n",
    );
  }
  let error = "";
  try {
    await Core.withNativeCaptureScope(r, {
      expectedSources: ["index.qmd", "slides.qmd"],
    }, async (scope) => {
      for (const source of ["index.qmd", "slides.qmd"]) {
        await scope.captureInputs(
          [source],
          (token) => childRender(r.root, source, token),
        );
      }
      if (mutate) {
        await Deno.writeTextFile(
          join(r.root, "assets/shared.svg"),
          "<svg>changed</svg>",
        );
      }
    });
  } catch (e) {
    error = String(e);
  }
  if (mutate) {
    check(error.includes("OPERATION_CHANGED"), "stale shared resource sealed");
  } else {
    check(!error, error);
    let finalError = "";
    try {
      await Core.withCurrentNativeOperation(
        { ...r, profiles: ["student"] },
        async (op) => {
          const inventory = await op.resourceInventory({
            files: [{
              source: "assets/shared.svg",
              target: "images/shared.svg",
            }],
          });
          check(inventory.files.length === 1, "shared resource unavailable");
          await op.validateRelease({
            expectedSources: ["index.qmd", "slides.qmd"],
          });
          await Deno.writeTextFile(
            join(r.root, "slides.qmd"),
            "# Mutated before consumer return\n",
          );
        },
      );
    } catch (e) {
      finalError = String(e);
    }
    check(
      finalError.includes("OPERATION_CHANGED"),
      "final consumer source fence missing",
    );
  }
  results.push({
    name: mutate
      ? "shared resource mutation refuses seal"
      : "shared resources and final source consumer fence",
    passed: true,
    root: r.root,
  });
}
// A genuinely empty native profile list stays empty within a scope.
{
  const r = await captureFixture();
  await Deno.writeTextFile(
    join(r.root, "_quarto.yml"),
    (await Deno.readTextFile(join(r.root, "_quarto.yml"))).replace(
      "profile:\n  default: student\n",
      "",
    ),
  );
  await Core.withNativeCaptureScope(r, {
    expectedSources: ["index.qmd", "slides.qmd"],
  }, async (scope) => {
    for (const source of ["index.qmd", "slides.qmd"]) {
      await scope.captureInputs(
        [source],
        (token) => childRender(r.root, source, token),
      );
    }
  });
  await Core.withCurrentNativeOperation(
    { ...r, profiles: [] },
    async (op) =>
      check(
        op.identity.profiles.length === 0,
        "empty native profiles invented",
      ),
  );
  results.push({
    name: "native empty profiles accepted",
    passed: true,
    root: r.root,
  });
}
// A registered native child may cover several planned inputs in one actual render.
{
  const r = await captureFixture();
  await Core.withNativeCaptureScope(r, {
    expectedSources: ["index.qmd", "slides.qmd"],
  }, async (scope) => {
    await scope.captureInputs(["slides.qmd", "index.qmd"], async (token) => {
      const n = await new Deno.Command("quarto", {
        args: ["render"],
        cwd: r.root,
        env: {
          COURSE_CORE_CAPTURE_TOKEN: token,
          QUARTO_RUN_NO_NETWORK: "true",
          DENO_NO_PACKAGE_JSON: "1",
        },
        stdout: "piped",
        stderr: "piped",
      }).output();
      check(n.success, new TextDecoder().decode(n.stderr));
    });
  });
  await Core.withCurrentNativeOperation(
    { ...r, profiles: ["student"] },
    async (op) => {
      check(
        op.catalog.documents.length === 2 && op.metrics.childRenders === 1 &&
          op.metrics.inspectCalls === 1,
        "multi-input child coverage",
      );
      await op.validateRelease({
        expectedSources: ["index.qmd", "slides.qmd"],
      });
    },
  );
  results.push({
    name: "one native child covers exact unordered input set",
    passed: true,
    root: r.root,
  });
}
// A token registered for one owner cannot join another owner's reservation.
{
  const own = await captureFixture(), foreign = await captureFixture();
  let ownError = "", foreignError = "";
  try {
    await Core.withNativeCaptureScope(foreign, {
      expectedSources: ["index.qmd"],
    }, async () => {
      try {
        await Core.withNativeCaptureScope(own, {
          expectedSources: ["index.qmd"],
        }, async (scope) => {
          await scope.captureInputs(
            ["index.qmd"],
            (token) => childRender(foreign.root, "index.qmd", token),
          );
        });
      } catch (e) {
        ownError = String(e);
      }
    });
  } catch (e) {
    foreignError = String(e);
  }
  check(
    ownError.includes("OPERATION_BINDING") &&
      foreignError.includes("OPERATION_INCOMPLETE"),
    "foreign owner joined token",
  );
  for (const r of [own, foreign]) {
    let complete = false;
    try {
      await Core.withCurrentNativeOperation(
        { ...r, profiles: ["student"] },
        async () => {
          complete = true;
        },
      );
    } catch {}
    check(!complete, "foreign owner completed");
  }
  results.push({
    name: "foreign owner rejects registered join token",
    passed: true,
    root: own.root,
  });
}
console.log(JSON.stringify({ status: "PASS", results }));
