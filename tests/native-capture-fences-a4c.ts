import { fixtureArray, fixtureAt, fixtureRecord, fixtureString } from "./helpers/required.ts";
import * as Core from "../_extensions/course-core/public.ts";
import { join } from "stdlib/path";
import { captureFixture, childRender } from "./helpers/native-capture-a4c.ts";
import { EarlyDocumentSchema } from "../_extensions/course-core/document/contracts.ts";
const results: {
  name: string;
  passed: boolean;
  error?: string;
  root?: string;
}[] = [];
const check = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
type Scope = Parameters<Parameters<typeof Core.withNativeCaptureScope>[2]>[0];
async function refusal(
  name: string,
  use: (scope: Scope, root: string) => Promise<void>,
  options: Parameters<typeof captureFixture>[0] = {},
  codes = /OPERATION_BINDING|OPERATION_INCOMPLETE|OPERATION_CHANGED/,
) {
  const reservation = await captureFixture(options);
  let error = "";
  try {
    await Core.withNativeCaptureScope(reservation, {
      expectedSources: ["index.qmd", "slides.qmd"],
    }, (scope) => use(scope, reservation.root));
  } catch (e) {
    error = String(e);
  }
  let complete = false;
  try {
    await Core.withCurrentNativeOperation({
      ...reservation,
      profiles: ["student"],
    }, async () => {
      complete = true;
    });
  } catch {}
  const passed = codes.test(error) && !complete;
  results.push({
    name,
    passed,
    error: error.slice(0, 900),
    root: reservation.root,
  });
  check(passed, name + ": " + error);
}
await refusal("valid reservation without children", async () => {});
await refusal("empty child set", async (scope) => {
  await scope.captureInputs([], async () => {});
});
await refusal("unexpected child source", async (scope) => {
  await scope.captureInputs(["foreign.qmd"], async () => {});
});
await refusal("failure before first native pre is sticky", async (scope) => {
  try {
    await scope.captureInputs(["index.qmd"], async () => {
      throw Error("before pre");
    });
  } catch {}
  await scope.captureInputs(["slides.qmd"], async () => {});
});
await refusal("caught child failure still refuses seal", async (scope) => {
  try {
    await scope.captureInputs(["index.qmd"], async () => {
      throw Error("before pre");
    });
  } catch {}
});
await refusal("native command exit zero without post", async (scope) => {
  await scope.captureInputs(["index.qmd"], async () => {});
});
await refusal("empty actual input set", async (scope, root) => {
  await scope.captureInputs(["index.qmd"], async (token) => {
    const pre = await import("../_extensions/course-core/runtime/operation.ts");
    const previous = {
      token: Deno.env.get("COURSE_CORE_CAPTURE_TOKEN"),
      inputs: Deno.env.get("QUARTO_PROJECT_INPUT_FILES"),
    };
    try {
      Deno.env.set("COURSE_CORE_CAPTURE_TOKEN", token);
      Deno.env.set("QUARTO_PROJECT_INPUT_FILES", "");
      await pre.beginNativeOperation(root);
    } finally {
      for (
        const [key, v] of [["COURSE_CORE_CAPTURE_TOKEN", previous.token], [
          "QUARTO_PROJECT_INPUT_FILES",
          previous.inputs,
        ]] as const
      ) {
        if (v === undefined) Deno.env.delete(key);
        else Deno.env.set(key, v);
      }
    }
  });
});
await refusal("wrong one-time join token", async (scope, root) => {
  await scope.captureInputs(
    ["index.qmd"],
    (token) => childRender(root, "index.qmd", crypto.randomUUID()),
  );
});
await refusal("actual extra source is not a new slot", async (scope, root) => {
  await scope.captureInputs(
    ["index.qmd"],
    (token) => childRender(root, "slides.qmd", token),
  );
});
await refusal(
  "preparation failure leaves no complete",
  async (scope, root) => {
    await scope.captureInputs(
      ["index.qmd"],
      (token) => childRender(root, "index.qmd", token),
    );
  },
  { preparationFailure: true },
  /A4C_PREPARATION_FAILURE/,
);
await refusal("missing second source", async (scope, root) => {
  await scope.captureInputs(
    ["index.qmd"],
    (token) => childRender(root, "index.qmd", token),
  );
});
await refusal(
  "double native child cannot replay token",
  async (scope, root) => {
    await scope.captureInputs(["index.qmd"], async (token) => {
      await childRender(root, "index.qmd", token);
      await childRender(root, "index.qmd", token);
    });
  },
);
await refusal(
  "duplicate source cannot overwrite capture",
  async (scope, root) => {
    await scope.captureInputs(
      ["index.qmd"],
      (token) => childRender(root, "index.qmd", token),
    );
    await scope.captureInputs(
      ["index.qmd"],
      (token) => childRender(root, "index.qmd", token),
    );
  },
);
await refusal("second child profiles drift", async (scope, root) => {
  await scope.captureInputs(
    ["index.qmd"],
    (token) => childRender(root, "index.qmd", token),
  );
  await scope.captureInputs(
    ["slides.qmd"],
    (token) =>
      childRender(root, "slides.qmd", token, {}, ["--profile", "full"]),
  );
});
{
  const r = await captureFixture();
  const marker = "AFTERFIRSTCHILDMARKER";
  await Core.withNativeCaptureScope(r, {
    expectedSources: ["index.qmd", "slides.qmd"],
  }, async (scope) => {
    await scope.captureInputs(
      ["index.qmd"],
      (token) => childRender(r.root, "index.qmd", token),
    );
    await Deno.writeTextFile(join(r.root, "index.qmd"), "# " + marker + "\n");
    await scope.captureInputs(
      ["slides.qmd"],
      (token) => childRender(r.root, "slides.qmd", token),
    );
  });
  let operation = "", captured = "";
  await Core.withCurrentNativeOperation({ ...r, profiles: ["student"] }, async (op) => {
    operation = op.identity.operation;
    const pointer = fixtureRecord(JSON.parse(await Deno.readTextFile(join(r.root, "_generated/course-spec/native-ts/active.json"))));
    const state = fixtureRecord(JSON.parse(await Deno.readTextFile(join(fixtureString(pointer.directory), "state.json"))));
    const early = EarlyDocumentSchema.parse(JSON.parse(await Deno.readTextFile(
      join(fixtureString(pointer.directory), fixtureArray(state.inputs).indexOf("index.qmd") + ".early.json"),
    )));
    captured = JSON.stringify(early.ast.blocks);
    check(op.catalog.documents.length === 2 && op.metrics.childRenders === 2 && op.metrics.inspectCalls === 1,
      "Потеряны два исходных children/documents либо один inspect");
    check(pointer.operation === operation && early.context.operation === operation &&
      early.context.captureWitness === fixtureAt(state, ["captureWitnesses", "index.qmd"]) && !!early.context.captureWitness,
      "Первый captured body потерял identity/witness correlation");
    check(captured.includes('"Native"') && !captured.includes(marker), "Source drift переписал первый capture");
    check((await Deno.readTextFile(join(r.root, "index.qmd"))).includes(marker), "Source mutation не выполнилась");
    await op.assertCurrent();
  });
  const rendered = await new Deno.Command("quarto", {
    args: ["render", "index.qmd", "--to", "html"], cwd: r.root,
    env: { QUARTO_RUN_NO_NETWORK: "true", DENO_NO_PACKAGE_JSON: "1" }, stdout: "piped", stderr: "piped",
  }).output();
  await Deno.writeTextFile(join(r.root, "_generated/source-drift-new-render.log"),
    new TextDecoder().decode(rendered.stdout) + new TextDecoder().decode(rendered.stderr));
  check(rendered.success, "Обычный новый render source drift отказал");
  await Core.withCurrentNativeOperation({ ...r, profiles: ["student"] }, async (op) => {
    const pointer = fixtureRecord(JSON.parse(await Deno.readTextFile(join(r.root, "_generated/course-spec/native-ts/active.json"))));
    const early = EarlyDocumentSchema.parse(JSON.parse(await Deno.readTextFile(join(fixtureString(pointer.directory), "0.early.json"))));
    check(op.identity.operation !== operation && op.metrics.inspectCalls === 1 &&
      early.context.operation === op.identity.operation && JSON.stringify(early.ast.blocks).includes(marker) && !captured.includes(marker),
      "Новые bytes не попали в новую generation либо изменили прежний capture");
  });
  results.push({ name: "Source drift сохраняет первый capture; новый render наблюдает новые bytes", passed: true, root: r.root });
}
{
  const r = await captureFixture();
  await Deno.writeTextFile(join(r.root, "index.md"), "# Collision slides\n");
  await Deno.writeTextFile(
    join(r.root, "_quarto.yml"),
    (await Deno.readTextFile(join(r.root, "_quarto.yml"))).replace(
      "render: [index.qmd, slides.qmd]",
      "render: [index.qmd, index.md]",
    ),
  );
  let error = "";
  try {
    await Core.withNativeCaptureScope(r, {
      expectedSources: ["index.qmd", "index.md"],
    }, async (scope) => {
      for (const source of ["index.qmd", "index.md"]) {
        await scope.captureInputs(
          [source],
          (token) => childRender(r.root, source, token),
        );
      }
    });
  } catch (e) {
    error = String(e);
  }
  check(
    error.includes("output collision"),
    "actual successful children must reach Core output collision: " + error,
  );
  results.push({ name: "output collision", passed: true, error, root: r.root });
}
// The empty expected set refuses before invalidating an existing current pointer.
{
  const r = await captureFixture();
  let before = "", after = "", error = "";
  try {
    await Core.withNativeCaptureScope(
      r,
      { expectedSources: [] },
      async () => {},
    );
  } catch (e) {
    error = String(e);
  }
  try {
    before = await Deno.readTextFile(
      join(r.root, "_generated/course-spec/native-ts/active.json"),
    );
  } catch {}
  check(
    error.includes("OPERATION_BINDING") && !before,
    "empty expected sources has no reservation",
  );
  results.push({
    name: "invalid empty expected set does not reserve",
    passed: true,
  });
}
// Real native group expansion is authority, including order, with no requested profiles in reservation.
{
  const r = await captureFixture({ group: true });
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
  await Core.withCurrentNativeOperation({
    ...r,
    profiles: ["student", "extra"],
  }, async (op) => {
    check(
      op.catalog.documents.length === 2 &&
        op.identity.profiles.join(",") === "student,extra",
      "native group profiles",
    );
  });
  results.push({
    name: "actual native group expansion/order",
    passed: true,
    root: r.root,
  });
}
console.log(JSON.stringify({ status: "PASS", results }));
