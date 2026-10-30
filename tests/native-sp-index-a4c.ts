import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { captureFixture } from "./helpers/native-capture-a4c.ts";
const bytes = await Deno.readFile(
  join(
    dirname(fromFileUrl(import.meta.url)),
    "fixtures/native-a4c/sp-practice-index.qmd",
  ),
);
const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
  .map((v) => v.toString(16).padStart(2, "0")).join("");
if (
  digest !== "bc2fb10f50ca54c7d57673065225470be412d860eec75585aad4cb53321020b1"
) throw Error("Exact SP input drift");
const results: {
  projection: string;
  selected: string;
  actual: string;
  root: string;
  metrics: Core.NativeOperationMetrics;
}[] = [];
for (const projection of ["student", "author"] as const) {
  for (const selected of ["default", "html", "revealjs"] as const) {
    const r = await captureFixture();
    await Deno.writeFile(join(r.root, "index.qmd"), bytes);
    const args = [
      "render",
      "index.qmd",
      ...(selected === "default" ? [] : ["--to", selected]),
      "--profile",
      projection === "author" ? "full" : "student",
    ];
    const native = await new Deno.Command("quarto", {
      args,
      cwd: r.root,
      env: { QUARTO_RUN_NO_NETWORK: "true", DENO_NO_PACKAGE_JSON: "1" },
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!native.success) {
      throw Error(new TextDecoder().decode(native.stderr));
    }
    const format = selected === "revealjs" ? "revealjs" : "html";
    await Core.withCurrentNativeOperation({
      ...r,
      projection,
      profiles: [projection === "author" ? "full" : "student"],
      expectedDocuments: [{ source: "index.qmd", format }],
    }, async (op) => {
      const d = op.document({ source: "index.qmd" });
      const proof = await op.validateRelease({
        expectedSources: ["index.qmd"],
      });
      if (
        d.context.format !== format ||
        op.catalog.documents[0].format !== format ||
        proof.documents[0].format !== format
      ) throw Error("SP format/origin mismatch");
      results.push({
        projection,
        selected,
        actual: format,
        root: r.root,
        metrics: op.metrics,
      });
    });
  }
}
console.log(JSON.stringify({ status: "PASS", sha256: digest, results }));
