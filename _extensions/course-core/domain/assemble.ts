import type { Adapter, Assessment, Body, Course, Exercise, Extracted, Fragment, Json } from "./model.ts";
function withBody<T>(item: Extracted<T>): Omit<Extracted<T>, "bodyJson"> & { body: Body } {
  const { bodyJson, ...rest } = item;
  return { ...rest, body: JSON.parse(bodyJson) };
}
/** Compose independent AST facts; no filesystem or platform rules belong here. */
export function assemble(selected: string[], fragments: Map<string, Fragment>, adapters: Adapter[]): Course {
  if (!selected.length) throw new Error("Course has no selected documents");
  const result: Course = { schema: "1.0", course: { id: "" }, registeredTargets: ["manual", ...adapters.map(a => a.contract.name)], exercises: [], assessments: [] };
  for (const source of selected) {
    const part = fragments.get(source);
    if (!part) throw new Error(`Render all selected documents with course-core: missing ${source}`);
    if (part.course.schema !== "1.0") throw new Error(`Only course.schema: "1.0" is accepted (${source})`);
    if (result.course.id && result.course.id !== part.course.id) throw new Error(`Inconsistent course identity in ${source}`);
    result.course = { id: part.course.id };
    for (const exercise of part.exercises) {
      const extensions: Record<string, Json> = {};
      for (const adapter of adapters) {
        const matches = (adapter.fragments.get(source)?.exercises ?? []).filter(e => e.id === exercise.id);
        if (matches.length > 1) throw new Error(`Duplicate adapter fragment: ${exercise.id}`);
        if (matches.length) extensions[adapter.contract.name] = matches[0].payload;
      }
      result.exercises.push({ ...withBody<Exercise>(exercise), source, extensions });
    }
    if (part.assessment) {
      const extensions: Record<string, Json> = {};
      for (const adapter of adapters) {
        const value = adapter.fragments.get(source)?.assessment;
        if (value != null) extensions[adapter.contract.name] = value;
      }
      result.assessments.push({ ...withBody<Assessment>(part.assessment), source, extensions });
    }
  }
  return result;
}
