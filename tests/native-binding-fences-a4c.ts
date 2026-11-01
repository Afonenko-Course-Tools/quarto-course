import { join } from "stdlib/path";
import { captureFixture } from "./helpers/native-capture-a4c.ts";
const results: { name: string; passed: boolean; root: string }[] = [];
for (
  const mutation of [
    "format",
    "captureWitness",
    "profiles",
    "input",
    "operation",
    "projection",
    "html-alias",
  ]
) {
  const r = await captureFixture();
  if (mutation !== "html-alias") {
    const value = mutation === "format"
      ? "'revealjs'"
      : mutation === "profiles"
      ? "{'foreign'}"
      : mutation === "input"
      ? "quarto.project.directory..'/slides.qmd'"
      : mutation === "projection"
      ? "'author'"
      : JSON.stringify(crypto.randomUUID());
    await Deno.writeTextFile(
      join(r.root, "mutate-binding.lua"),
      `return {{Pandoc=function(doc) local key='course-core-ts-binding';local c=pandoc.json.decode(pandoc.utils.stringify(doc.meta[key]));c[${
        JSON.stringify(mutation)
      }]=${value};doc.meta[key]=pandoc.MetaString(pandoc.json.encode(c));return doc end}}`,
    );
    let config = await Deno.readTextFile(join(r.root, "_quarto.yml"));
    config = config.replace(
      "  - at: post-render\n",
      `  - at: post-quarto\n    path: mutate-binding.lua\n  - at: post-render\n`,
    );
    await Deno.writeTextFile(join(r.root, "_quarto.yml"), config);
  }
  const n = await new Deno.Command("quarto", {
    args: [
      "render",
      "index.qmd",
      "--to",
      mutation === "html-alias" ? "html4" : "html",
    ],
    cwd: r.root,
    env: { QUARTO_RUN_NO_NETWORK: "true", DENO_NO_PACKAGE_JSON: "1" },
    stdout: "piped",
    stderr: "piped",
  }).output();
  const log = new TextDecoder().decode(n.stdout) +
    new TextDecoder().decode(n.stderr);
  if (n.success || !log.includes("DOCUMENT_BINDING")) {
    throw Error(
      "native binding mutation admitted or wrong refusal: " + mutation + " " +
        log,
    );
  }
  results.push({ name: mutation, passed: true, root: r.root });
}
console.log(JSON.stringify({ status: "PASS", results }));
