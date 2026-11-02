import { operationProjectContextReuse } from "../_extensions/course-core/infrastructure/project-context.ts";
import { parseDocument } from "../_extensions/course-core/body-export/vendor/libraries.js";
import { join } from "stdlib/path";
const owner = "/qualified/owner";
const text =
  "course-project:\n  starter: {path: starter}\n  components:\n    helper: {path: common}\n";
const files: Record<string, string> = {
  "_quarto.yml": "project: {type: default, render: []}\nformat: html\n",
};
for (const n of ["a", "b"]) {
  files[`projects/${n}/_metadata.yml`] = text;
  files[`projects/${n}/starter/Main.txt`] = "starter";
  files[`projects/${n}/common/Helper.txt`] = n;
}
const memberships: Record<string, string[]> = {};
for (const path of Object.keys(files)) {
  let parts = path.split("/");
  while (parts.length) {
    const child = parts.pop()!, parent = parts.join("/");
    (memberships[parent] ??= []).push(child);
  }
}
for (const k of Object.keys(memberships)) {
  memberships[k] = [...new Set(memberships[k])];
}
const actual = Deno.Command;
let children = 0;
for (const mode of ["valid", "swap-entries", "swap-leaf", "field-shape"]) {
  children = 0;
  (Deno as any).Command = class {
    constructor(_exe: any, readonly opts: any) {}
    async output() {
      children++;
      const temp = this.opts.args[1];
      const config = parseDocument(
        await Deno.readTextFile(join(temp, "_quarto.yml")),
      )!.toJS();
      const agg = config._course_core_static_contracts_v1;
      if (mode === "swap-entries") {
        [agg.p0._course_core_origins_a1, agg.p1._course_core_origins_a1] = [
          agg.p1._course_core_origins_a1,
          agg.p0._course_core_origins_a1,
        ];
      }
      if (mode === "swap-leaf") {
        agg.p0._course_core_origins_a1.components.helper.path =
          agg.p1._course_core_origins_a1.components.helper.path;
      }
      if (mode === "field-shape") {
        agg.p0._course_core_origins_a1.components.helper = {
          wrong: agg.p0._course_core_origins_a1.components.helper.path,
        };
      }
      return {
        success: true,
        code: 0,
        signal: null,
        stdout: new TextEncoder().encode(
          JSON.stringify({
            dir: temp,
            quarto: { version: "1.11.5" },
            files: { input: [] },
            config,
          }),
        ),
        stderr: new Uint8Array(),
      };
    }
  };
  try {
    const use = operationProjectContextReuse({
      owner,
      profiles: [],
      generation: {},
      staticSources: true,
      sync: () => {},
      ownerWitness: {
        quarto: { version: "1.11.5" },
        config: {
          project: { type: "default", render: [] },
          format: { html: {} },
        },
        files: { config: ["_quarto.yml"] },
      },
      rows: Object.keys(files).map((path) => ({ path })),
      memberships,
      guard: async () => {},
      read: async (path) =>
        new TextEncoder().encode(files[path.slice(owner.length + 1)]),
      contractProbe: (_t, _i, _f, use) => use(),
    });
    let error = "", observed: any;
    try {
      await use([{
        owner,
        profiles: [],
        format: "html",
        inputs: ["projects/a/native-input.qmd", "projects/b/native-input.qmd"],
      }], async (batch) => {
        observed = batch.groups[0].contexts.map((c) => ({
          input: c.input,
          origin: c.origins["components.helper.path"],
        }));
      }, true);
    } catch (e) {
      error = String(e);
    }
    if (
      children !== 1 || (mode === "valid"
        ? !!error ||
          observed.some((c: any) =>
            c.origin.sourceFile !==
              c.input.replace("/native-input.qmd", "/_metadata.yml")
          )
        : !error.includes("ORIGIN_UNPROVEN"))
    ) {
      throw Error(
        "Cross-entry marker swap was accepted: " +
          JSON.stringify({ error, children, observed }),
      );
    }
    console.log(
      JSON.stringify(
        {
          mode,
          scope:
            "Pure adversarial aggregate-output structural control; no actual Native run or runtime authority",
          children,
          error,
          observed,
        },
        null,
        2,
      ),
    );
  } finally {
    (Deno as any).Command = actual;
  }
}
