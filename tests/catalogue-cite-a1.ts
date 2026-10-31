import * as Core from "../_extensions/course-core/public.ts";
import {
  fixtureOperation,
  renderFixture,
} from "./helpers/native-operation-a3.ts";
import { dirname, join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "catalogue-a1-" }),
  assert = (v: unknown, s: string) => {
    if (!v) throw Error(s);
  };
const put = async (path: string, text: string) => {
  await Deno.mkdir(dirname(join(root, path)), { recursive: true });
  await Deno.writeTextFile(join(root, path), text);
};
try {
  await put(
    "_quarto.yml",
    "project:\n  type: website\n  output-dir: _site\nformat: {html: {theme: none}}\ncourse-project:\n  starter: {path: starter}\n",
  );
  await put("project/input.qmd", "# Project");
  await put("project/starter/Main.java", "class Main {}");
  await put(
    "index.qmd",
    '::: {#exr-demo project="project/input.qmd" difficulty=introductory statement-visibility=open}\nСм. [у @tasks:sec-bank-text-input; -@tasks:exr-text-compress-character-runs, далее].\n\n[Явная подпись](#qrc-unresolved){.qrc-link data-qrc-ref="tasks:sec-explicit" data-qrc-custom="true"}\n:::\n',
  );
  await renderFixture(root);
  await fixtureOperation(root, async (op) => {
    await Core.readProjectContexts([{
      owner: root,
      inputs: ["project/input.qmd"],
      profiles: [],
      format: "html",
    }], async ([group]) => {
      const plan = await Core.planProject(group.contexts[0], {
          audience: "student",
        }),
        condition = op.condition({
          source: "index.qmd",
          exerciseId: "exr-demo",
          view: "student",
        }),
        closure = await Core.materializationClosure(plan, condition),
        refs = closure.fragments[0].references;
      assert(
        refs.length === 3 &&
          refs.some((r) =>
            r.key === "tasks:exr-text-compress-character-runs" &&
            r.style === "number"
          ),
        "Native Cite omitted from closure",
      );
      const referencesBySource = {
        "index.qmd": Object.fromEntries(
          refs.filter((r) => r.key !== "tasks:sec-explicit").map(
            (r) => [r.token, {
              href: "https://example.test/" + encodeURIComponent(r.key),
              label: r.style === "number" ? "17" : "Правила ввода",
            }],
          ),
        ),
      };
      const explicit = refs.find((r) => r.key === "tasks:sec-explicit")!;
      const bindings = {
        referencesBySource,
        linksBySource: {
          "index.qmd": { [explicit.token]: "https://example.test/explicit" },
        },
        submission: { files: [], instructions: "Сдайте исходники" },
      };
      const inventory = await Core.materializeProject(
          plan,
          condition,
          bindings,
        ),
        readme = new TextDecoder().decode(
          inventory.files.find((f) => f.target === "README.md")!.bytes,
        );
      assert(
        readme.includes("Правила ввода") && readme.includes("17") &&
          readme.includes("Явная подпись") && readme.includes("далее") &&
          !readme.includes("@tasks:"),
        "Standalone Cite link/label/prefix/suffix lost",
      );
      let failed = false;
      try {
        await Core.materializeProject(plan, condition, {
          ...bindings,
          referencesBySource: {},
        });
      } catch (e) {
        failed = String(e).includes("CONDITION_REFERENCE_UNRESOLVED");
      }
      assert(failed, "URL-only catalog Cite silently retained");
    });
  });
  console.log(
    "PASS actual native A1 catalogue Cite closure, structured owner labels, legacy explicit labels and missing structured binding refusal",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
