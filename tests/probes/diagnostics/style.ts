import { terminal } from "./runtime.ts";
const config = JSON.parse(await Deno.readTextFile(new URL("./markdownlint.json", import.meta.url)));
export async function style(path: string, moduleUrl = new URL("./vendor/markdownlint.mjs", import.meta.url).href): Promise<{exitCode: number; report: any}> {
  try {
    const {lint} = await import(moduleUrl) as {lint: (options: unknown) => Record<string, any[]>};
    const text = await Deno.readTextFile(path);
    const results = lint({strings: {[path]: text}, config});
    if (!results) throw new Error("markdownlint did not return a report");
    const diagnostics = results[path].map((result: any) => ({
      code: `STYLE.${result.ruleNames[0]}`, classification: "STYLE", severity: "warning", phase: "style", component: "markdownlint", message: result.ruleDescription,
      source: {rootQmd: path, line: result.lineNumber}, field: result.ruleNames[1], related: [],
    }));
    return {exitCode: 0, report: {schemaVersion: "p0-diagnostic-probe-1", tools: {markdownlint: "0.41.1", deno: Deno.version.deno}, diagnostics}};
  } catch (error) {
    return {exitCode: 2, report: {schemaVersion: "p0-diagnostic-probe-1", status: "failure", code: "INTERNAL.STYLE_TOOL_FAILURE", classification: "INTERNAL", component: "markdownlint", phase: "style", tools: {deno: Deno.version.deno, expectedMarkdownlint: "0.41.1"}, cause: {message: String(error)}}};
  }
}
if (import.meta.main) {
  const result = await style(Deno.args[0]);
  console.log(JSON.stringify(result.report, null, 2));
  if (Deno.args.includes("--terminal")) console.error(terminal(result.report));
  Deno.exit(result.exitCode);
}
