import type { Relation } from "./graph.ts";
export interface Diagnostic {code: string; classification: string; severity: string; phase: string; component: string; message: string; source: {rootQmd: string}; id?: string; field?: string; related?: unknown[]; witness?: Relation[]}
export interface Result {exitCode: number; report: any}
const decoder = new TextDecoder();
const schema = new URL("./report.cue", import.meta.url).pathname;
export async function invoke(command: string, args: string[]) {
  const result = await new Deno.Command(command, {args, stdout: "piped", stderr: "piped"}).output();
  return {exitCode: result.code, stdout: decoder.decode(result.stdout), stderr: decoder.decode(result.stderr)};
}
function failure(code: string, cause: unknown, tools: unknown): Result {
  return {exitCode: 2, report: {schemaVersion: "p0-diagnostic-probe-1", status: "failure", code, classification: "SOURCE", component: "cue", phase: "transport", tools, cause}};
}
export async function compile(path: string): Promise<Result> {
  const cue = Deno.env.get("CUE") || "cue";
  try {
    const version = await invoke(cue, ["version"]);
    const tools = {cue: version.stdout.trim(), deno: Deno.version.deno, bundledGraphlib: "4.0.5"};
    if (version.exitCode !== 0) return {exitCode: 2, report: {schemaVersion: "p0-diagnostic-probe-1", status: "failure", code: "INTERNAL.CUE_VERSION_FAILED", classification: "INTERNAL", component: "cue", phase: "transport", tools, cause: version}};
    // Required: checking only -e report can omit errors elsewhere in the input.
    const vetted = await invoke(cue, ["vet", schema, path, "-d", "#Transport", "-c", "--all-errors"]);
    if (vetted.exitCode !== 0) return failure("SOURCE.INVALID_TRANSPORT", vetted, tools);
    const exported = await invoke(cue, ["export", schema, path, "-e", "report", "--out", "json"]);
    if (exported.exitCode !== 0) return failure("SOURCE.REPORT_EXPORT_FAILED", exported, tools);
    const report = JSON.parse(exported.stdout);
    report.tools = tools;
    return {exitCode: report.diagnostics.length ? 1 : 0, report};
  } catch (error) {
    return {exitCode: 2, report: {schemaVersion: "p0-diagnostic-probe-1", status: "failure", code: "INTERNAL.CUE_UNAVAILABLE", classification: "INTERNAL", phase: "transport", component: "cue", tools: {deno: Deno.version.deno}, cause: {message: String(error)}}};
  }
}
function terminalWitness(witness?: Relation[]): string {
  if (!witness?.length) return "";
  const chain = [witness[0].from, ...witness.map(edge => edge.to)].join(" → ");
  const provenance = witness.map(edge => `    ${edge.from} → ${edge.to} [${edge.kind}] ${edge.source.owner}:${edge.source.rootQmd}`).join("\n");
  return `\n  witness: ${chain}\n${provenance}`;
}
export function terminal(report: any): string {
  if (report.status === "failure") return `${report.code}: ${JSON.stringify(report.cause)}`;
  return report.diagnostics.map((d: Diagnostic) => `${d.severity} ${d.code}: ${d.message}\n  ${d.source.rootQmd}${d.id ? ` #${d.id}` : ""}${d.field ? ` field=${d.field}` : ""}${d.related?.length ? `\n  related: ${JSON.stringify(d.related)}` : ""}${terminalWitness(d.witness)}`).join("\n");
}
if (import.meta.main) {
  const result = await compile(Deno.args[0]);
  console.log(JSON.stringify(result.report, null, 2));
  if (Deno.args.includes("--terminal")) console.error(terminal(result.report));
  Deno.exit(result.exitCode);
}
