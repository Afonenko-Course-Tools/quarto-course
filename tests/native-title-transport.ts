import {
  fixtureOperation,
  renderFixture,
} from "./helpers/native-operation-a3.ts";
import { join } from "stdlib/path";
const root = await Deno.makeTempDir({ prefix: "native-title-transport-" });
try {
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project:\n  type: website\n  output-dir: _site\nformat: html\ntitle: Позднее имя\n",
  );
  await Deno.writeTextFile(
    join(root, "index.qmd"),
    "::: {#exr-one difficulty=introductory statement-visibility=open}\n## {{< meta title >}}\n\nУсловие.\n:::\n",
  );
  await renderFixture(root);
  await fixtureOperation(root, async (op) => {
    const doc = op.document({ source: "index.qmd" }),
      row = doc.occurrences.find((r) => r.exerciseId === "exr-one")!;
    if (
      !JSON.stringify(row.title ?? []).includes("Позднее") ||
      !JSON.stringify(row.title ?? []).includes("имя")
    ) throw Error("Actual native title absent/unresolved");
    if (JSON.stringify(row.body).includes("data-course-core-native-title")) {
      throw Error("Private title marker leaked");
    }
  });
  console.log(
    "PASS actual late native Theorem name after meta shortcode, no private marker in public body",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
