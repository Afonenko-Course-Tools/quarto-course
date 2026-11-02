import { operationProjectContextReuse } from "../_extensions/course-core/infrastructure/project-context.ts";
import { dirname, join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "contract-guards-" }),
  actual = Deno.Command;
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const config = "project: {type: default, render: []}\nformat: html\n";
const metadata = "course-project:\n  starter: {path: starter}\n";
const base: Record<string, string> = {
  "_quarto.yml": config,
  "projects/a/_metadata.yml": metadata,
  "projects/a/starter/Main.txt": "SOURCE",
};
const results: any[] = [];
let native = 0;
try {
  for (
    const name of [
      "root-ojs",
      "inherited-execution",
      "format-namespace",
      "implicit-brand",
      "wrong-version",
      "general-policy",
      "authored-input",
      "noncanonical",
      "bad-marker",
    ]
  ) {
    const owner = join(root, name), files = { ...base };
    let effective: any = {
      project: { type: "default", render: [] },
      format: { html: {} },
    };
    if (name === "root-ojs") {
      files["_quarto.yml"] += "ojs-engine: true\n";
      effective["ojs-engine"] = true;
    }
    if (name === "inherited-execution") {
      files["projects/_metadata.yml"] = "execute: {enabled: true}\n";
    }
    if (name === "format-namespace") {
      files["projects/a/_metadata.yml"] =
        "format:\n  html:\n    course-project:\n      starter: {path: starter}\n";
    }
    if (name === "implicit-brand") {
      files["_brand.yml"] = "color: {primary: red}\n";
    }
    if (name === "authored-input") {
      files["projects/a/native-input.qmd"] = "# Authored\n";
    }
    if (name === "noncanonical") {
      files["projects/a/_metadata.yml"] = metadata.replace(
        "path: starter",
        "path: ./starter",
      );
    }
    const memberships: Record<string, string[]> = {};
    for (const [local, text] of Object.entries(files)) {
      await Deno.mkdir(dirname(join(owner, local)), { recursive: true });
      await Deno.writeTextFile(join(owner, local), text);
      let parts = local.split("/");
      while (parts.length) {
        const child = parts.pop()!, parent = parts.join("/");
        (memberships[parent] ??= []).push(child);
      }
    }
    for (const key of Object.keys(memberships)) {
      memberships[key] = [...new Set(memberships[key])].sort();
    }
    let commandArgs: string[][] = [];
    (Deno as any).Command = new Proxy(actual, {
      construct(t, a: any[]) {
        const argv = a[1].args;
        commandArgs.push(argv);
        if (name !== "bad-marker") throw Error("GENERAL_BEFORE_CHILD");
        const cmd = Reflect.construct(t, a);
        return new Proxy(cmd, {
          get(target, key) {
            if (key === "output") {
              return async () => {
                native++;
                const output = await target.output();
                assert(output.success, "actual carrier failed");
                const data = JSON.parse(
                  new TextDecoder().decode(output.stdout),
                );
                delete data.config._course_core_static_contracts_v1.p0
                  ._course_core_origins_a1;
                return {
                  ...output,
                  stdout: new TextEncoder().encode(JSON.stringify(data)),
                };
              };
            }
            const value = Reflect.get(target, key);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
      },
    });
    const reuse = operationProjectContextReuse({
      owner,
      profiles: [],
      generation: {},
      staticSources: name !== "general-policy",
      sync: () => {},
      ownerWitness: {
        quarto: { version: name === "wrong-version" ? "1.11.6" : "1.11.5" },
        config: effective,
        files: { config: ["_quarto.yml"] },
      },
      rows: Object.keys(files).map((path) => ({ path })),
      memberships,
      guard: async () => {},
      read: (path) => Deno.readFile(path),
      contractProbe: (_temp, _inputs, _format, use) => use(),
    });
    let error = "";
    try {
      await reuse([{
        owner,
        profiles: [],
        inputs: ["projects/a/native-input.qmd"],
        format: "html",
      }], async () => {
        throw Error("CALLBACK_UNEXPECTED");
      }, true);
    } catch (e) {
      error = String(e);
    }
    if (name === "format-namespace") {
      assert(
        commandArgs.length === 0 && error.includes("ORIGIN_UNQUALIFIED"),
        name + " " + error,
      );
      results.push({ name, error, argv: null });
      continue;
    }
    assert(
      commandArgs.length === 1,
      "Hidden retry/native count " + name + " " + error,
    );
    if (name === "bad-marker") {
      assert(error.includes("ORIGIN_UNPROVEN"), "Bad marker " + error);
      assert(!commandArgs[0][1].endsWith(".qmd"), "aggregate missing");
    } else {
      assert(error.includes("GENERAL_BEFORE_CHILD"), name + " " + error);
      assert(
        commandArgs[0][1].endsWith("native-input.qmd"),
        name + " wrongly fast",
      );
    }
    results.push({ name, argv: commandArgs[0], error });
  }
  console.log(
    JSON.stringify({
      kind:
        "Internal qualification controls; general path stopped before child, one genuine native malformed-marker carrier",
      native,
      results,
    }),
  );
  assert(native === 1, "Native proof count");
} finally {
  (Deno as any).Command = actual;
  await Deno.remove(root, { recursive: true });
}
