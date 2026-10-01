import { compile } from "./diagnostics/runtime.ts";
import { graphFacts, type Relation } from "./diagnostics/graph.ts";
import { style } from "./diagnostics/style.ts";

const fixtures = new URL("./diagnostics/fixtures/", import.meta.url);
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const cases = [
  ["required-field", "CORE.REQUIRED_FIELD", "difficulty"],
  ["unknown-field", "SOURCE.UNKNOWN_EDUCATIONAL_FIELD", "dificulty"],
  ["duplicate", "CORE.DUPLICATE_ID", "id"],
  ["unknown-reference", "REF.UNKNOWN_TARGET", "to"],
  ["relationship-conflict", "GRAPH.RELATION_CONFLICT", "kind"],
] as const;
for (const [name, code, field] of cases) {
  const result = await compile(new URL(name + ".json", fixtures).pathname);
  assert(result.exitCode === 1, `${name}: semantic error must block compilation (got ${result.exitCode})`);
  const diagnostic = result.report.diagnostics.find((d: any) => d.code === code);
  assert(diagnostic?.source.rootQmd && diagnostic.id === "exr-a" && diagnostic.field === field, `${name}: code/source/id/field missing`);
  assert(diagnostic.severity === "error" && diagnostic.phase === "validation", `${name}: shared message contract missing`);
  if (name === "duplicate" || name === "relationship-conflict") {
    assert(diagnostic.related.length === 1 && diagnostic.related[0].rootQmd !== diagnostic.source.rootQmd, `${name}: both original sources required`);
  }
  console.log(`PASS ${name}: ${code}`);
}
const valid = await compile(new URL("valid.json", fixtures).pathname);
assert(valid.exitCode === 0 && valid.report.diagnostics.length === 0, "valid report must be successful and empty");
for (const name of ["malformed-shape", "missing-provenance", "malformed-json"]) {
  const result = await compile(new URL(name + ".json", fixtures).pathname);
  assert(result.exitCode === 2 && result.report.status === "failure" && result.report.cause?.stderr, `${name}: structural bottom must preserve failure and cause`);
  assert(!("diagnostics" in result.report), `${name}: structural failure must never masquerade as semantic diagnostics`);
  console.log(`PASS ${name}: transport failure`);
}
console.log("PASS concrete CUE diagnostics and transport boundary");
for (const [name, nodes, pairs, kind, acyclic, sccSizes] of [
  ["isolated", ["a"], [], "required", true, [1]],
  ["diamond", ["a", "b", "c", "d"], [["a", "b"], ["a", "c"], ["b", "d"], ["c", "d"]], "required", true, [1, 1, 1, 1]],
  ["self-loop", ["a"], [["a", "a"]], "required", false, [1]],
  ["strong-cycle", ["a", "b"], [["a", "b"], ["b", "a"]], "required", false, [2]],
  ["strong-triangle", ["a", "b", "c"], [["a", "b"], ["b", "c"], ["c", "a"]], "required", false, [3]],
  ["recommended-cycle", ["a", "b"], [["a", "b"], ["b", "a"]], "recommended", false, [2]],
] as const) {
  const relations: Relation[] = pairs.map(([from, to], i) => ({from, to, kind, source: {rootQmd: `${name}/${i}.qmd`, owner: "tasks"}}));
  const facts = graphFacts([...nodes], relations);
  const group = facts.find(f => f.kind === kind);
  assert(group && group.acyclic === acyclic, `${name}: Graphlib acyclicity incorrect`);
  assert(JSON.stringify(group.scc.map((s: string[]) => s.length).sort()) === JSON.stringify([...sccSizes].sort()), `${name}: SCC incorrect`);
  assert(acyclic ? group.witness.length === 0 : group.witness.length > 0, `${name}: witness presence incorrect`);
  for (let i = 0; i < group.witness.length; i++) {
    const edge = group.witness[i];
    assert(relations.some(r => JSON.stringify(r) === JSON.stringify(edge)), `${name}: fabricated witness edge`);
    assert(edge.to === group.witness[(i + 1) % group.witness.length].from, `${name}: witness not a closed chain`);
  }
  const envelope = JSON.parse(await Deno.readTextFile(new URL("valid.json", fixtures)));
  envelope.input.declarations = nodes.map(id => ({id, source: {rootQmd: `${name}.qmd`, owner: "tasks"}, fields: {difficulty: "introductory"}}));
  envelope.input.relations = relations;
  envelope.input.graphFacts = facts.map(({kind, nodes, witness}) => ({kind, nodes, witness}));
  const path = await Deno.makeTempFile({suffix: ".json"});
  try {
    await Deno.writeTextFile(path, JSON.stringify(envelope));
    const result = await compile(path);
    const expectedBlock = kind === "required" && !acyclic;
    assert(result.exitCode === (expectedBlock ? 1 : 0), `${name}: CUE graph policy incorrect`);
    if (expectedBlock) assert(result.report.diagnostics[0].code === "GRAPH.STRONG_CYCLE", `${name}: graph code missing`);
  } finally { await Deno.remove(path); }
  console.log(`PASS ${name}: SCC, acyclicity, real closed witness, CUE policy`);
}
const cleanStyle = await style(new URL("style.qmd", fixtures).pathname);
assert(cleanStyle.exitCode === 0 && cleanStyle.report.diagnostics.length === 0, "native QMD corpus must survive style allowlist");
const before = await Deno.readTextFile(new URL("style-warning.qmd", fixtures));
const warning = await style(new URL("style-warning.qmd", fixtures).pathname);
assert(warning.exitCode === 0 && warning.report.diagnostics.some((d: any) => d.code === "STYLE.MD009" && d.severity === "warning"), "STYLE-only must warn and exit 0");
assert(await Deno.readTextFile(new URL("style-warning.qmd", fixtures)) === before, "style must not fix source");
const missingStyle = await style(new URL("style.qmd", fixtures).pathname, new URL("absent-linter.mjs", fixtures).href);
assert(missingStyle.exitCode === 2 && missingStyle.report.code === "INTERNAL.STYLE_TOOL_FAILURE", "linter failure must be distinct from STYLE warning");
console.log("PASS native QMD style allowlist, STYLE exit 0, tool failure exit 2, no fix");
const repeated: Relation = {from: "a", to: "b", kind: "required", source: {rootQmd: "a.qmd", owner: "tasks"}};
assert(graphFacts(["a", "b"], [repeated, repeated])[0].occurrenceCount === 2, "Graphlib multigraph must preserve duplicate occurrences");
const previousCue = Deno.env.get("CUE");
try {
  Deno.env.set("CUE", "/nonexistent/p0-cue");
  const unavailable = await compile(new URL("valid.json", fixtures).pathname);
  assert(unavailable.exitCode === 2 && unavailable.report.code === "INTERNAL.CUE_UNAVAILABLE", "missing CUE must be INTERNAL tool failure");
} finally {
  if (previousCue === undefined) Deno.env.delete("CUE"); else Deno.env.set("CUE", previousCue);
}
console.log("PASS duplicate graph occurrences retained; missing CUE is tool failure");
