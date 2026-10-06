import { dirname, fromFileUrl, join, relative, resolve } from "stdlib/path";
import { assembleRelease } from "../domain/release.ts";
import type { ReleaseResult } from "../domain/model.ts";
import { command, quartoExecutable } from "../infrastructure/process.ts";
import { loadNativeRun } from "../infrastructure/native-run.ts";

/** One native source pass, from the logical root, over one explicitly chosen bank.
 * Quarto resolves includes, computations and functional profiles. Its JSON writer
 * does not publish a full HTML book. The short-lived profile only changes native
 * project/writer context; source QMD and the permanent project config stay intact.
 */
export async function collectExport(root: string, options: {
  book: string;
  work: string;
  profiles?: string[];
}): Promise<{result: ReleaseResult; projectRoot: string; courseId: string; work: string}> {
  root = await Deno.realPath(root);
  if (!options.book || !options.work) throw Error("EXPORT.BOOK_WORK_REQUIRED");
  const projectRoot = await Deno.realPath(resolve(root, options.book));
  const path = relative(root, projectRoot);
  if (path === ".." || path.startsWith("../") || path.startsWith("..\\")) throw Error("EXPORT.BOOK_OUTSIDE_COURSE");
  const quarto = quartoExecutable();
  const inspected = JSON.parse(await command(quarto, ["inspect", root], root));
  const courseId = inspected.config.course?.id;
  if (typeof courseId !== "string" || !/^[a-z][a-z0-9-]*$/.test(courseId)) throw Error("BODY.COURSE_ID_REQUIRED");
  const functional = options.profiles ?? [];
  if (functional.some(p => !/^[a-z][a-z0-9-]*$/.test(p) || ["student", "full"].includes(p))) throw Error("EXPORT.FUNCTIONAL_PROFILES_REQUIRED");
  const configs = await Promise.all(["_quarto.yml", "_quarto.yaml"].map(async name => {
    try { return (await Deno.stat(join(projectRoot, name))).isFile; }
    catch (e) { if (e instanceof Deno.errors.NotFound) return false; throw e; }
  }));
  if (!configs.some(Boolean)) throw Error("EXPORT.BOOK_PROJECT_REQUIRED");
  const bank = JSON.parse(await command(quarto, ["inspect", projectRoot, "--profile", ["full", ...functional].join(",")], projectRoot));
  if (bank.config.project?.type !== "book") throw Error("EXPORT.BOOK_PROJECT_REQUIRED");
  for (const p of functional) {
    const files = await Promise.all(["yml", "yaml"].map(async suffix => {
      try { return (await Deno.stat(join(projectRoot, "_quarto-" + p + "." + suffix))).isFile; }
      catch (e) { if (e instanceof Deno.errors.NotFound) return false; throw e; }
    }));
    if (!files.some(Boolean)) throw Error("EXPORT.PROFILE_MISSING: " + p);
  }
  const extension = dirname(dirname(fromFileUrl(import.meta.url)));
  const name = "course-export-" + crypto.randomUUID();
  const profile = join(projectRoot, "_quarto-" + name + ".yml");
  const output = join(projectRoot, "_generated/course-spec/export-output", name);
  await Deno.writeTextFile(profile, JSON.stringify({
    project: {
      type: "default",
      render: ["**/*.qmd", "!_extensions/**", "!_generated/**"],
      "output-dir": output,
      "pre-render": join(extension, "entrypoints/pre.ts"),
      "post-render": join(extension, "entrypoints/post.ts"),
    },
    course: {id: courseId, view: "full"},
    "course-export-context": true,
    format: {json: {}},
    filters: ["course-core"],
    crossref: false,
  }));
  try {
    const profiles = [name, "full", ...functional];
    await command(quarto, ["render", ".", "--profile", profiles.join(","), "--to", "json", "--output-dir", output], projectRoot, {}, false);
    const run = await loadNativeRun(projectRoot, {profiles, view: "full", outputDirectory: output});
    // Bank identity conflicts are source errors, but capabilities and membership
    // of unrelated works are outside this explicitly selected export.
    const exerciseIds = new Set<string>(), workIds = new Set<string>();
    for (const d of run.documents) {
      for (const e of d.exercises) {
        if (exerciseIds.has(e.id)) throw Error("CORE.DUPLICATE_EXERCISE: " + e.id);
        exerciseIds.add(e.id);
      }
      if (d.assessment) {
        if (workIds.has(d.assessment.id)) throw Error("CORE.DUPLICATE_ASSESSMENT: " + d.assessment.id);
        workIds.add(d.assessment.id);
      }
    }
    const workId = options.work.startsWith(courseId + "/") ? options.work.slice(courseId.length + 1) : options.work;
    const selected = run.documents.find(d => d.assessment?.id === workId)?.assessment;
    if (!selected) throw Error("BODY.WORK_MISSING: " + workId);
    const ids = new Set(selected.items);
    const documents = run.documents.filter(d => d.assessment?.id === workId || d.exercises.some(e => ids.has(e.id))).map(d => ({
      ...d,
      exercises: d.exercises.filter(e => ids.has(e.id)),
      assessment: d.assessment?.id === workId ? d.assessment : null,
      body: d.body ? {...d.body, publicExercises: d.body.publicExercises.filter(e => ids.has(e.id)), publicAssessment: d.assessment?.id === workId ? d.body.publicAssessment : null} : undefined,
    }));
    // The native writer resolves shortcodes after Core's pre-ast capture. Read
    // native JSON nodes, preserving Core's independent public projection and
    // normalized keys instead of parsing authored shortcode syntax ourselves.
    for (const d of documents) {
      const ast = JSON.parse(await Deno.readTextFile(join(output, d.document.output)));
      const wrapper = ast.blocks.find((n: any) => n.t === "Div" && n.c[0][2].some((p: string[]) => p[0] === "data-course-export-projection" && p[1] === "public"));
      if (!wrapper) throw Error("EXPORT.PUBLIC_PROJECTION_MISSING: " + d.source);
      const fullNodes = new Map<string, any>(), publicNodes = new Map<string, any>();
      function index(value: any, nodes: Map<string, any>) {
        if (Array.isArray(value)) { for (const child of value) index(child, nodes); return; }
        if (!value || typeof value !== "object") return;
        if (value.t === "Div" && value.c[0][0]?.startsWith("exr-")) nodes.set(value.c[0][0], value);
        for (const child of Object.values(value)) index(child, nodes);
      }
      index(ast.blocks.filter((n: any) => n !== wrapper), fullNodes);
      index(wrapper.c[1], publicNodes);
      const body = (node: any) => JSON.stringify({"pandoc-api-version": ast["pandoc-api-version"], meta: {}, blocks: node.c[1]});
      for (const e of d.exercises) {
        const node = fullNodes.get(e.id);
        if (!node) throw Error("EXPORT.SOURCE_EXERCISE_MISSING: " + d.source + "/" + e.id);
        e.bodyJson = body(node);
      }
      for (const e of d.body?.publicExercises ?? []) {
        const node = publicNodes.get(e.id);
        if (!node) throw Error("EXPORT.PUBLIC_EXERCISE_MISSING: " + d.source + "/" + e.id);
        e.bodyJson = body(node);
      }
    }
    const result = assembleRelease(documents.map(d => d.source), documents, run.adapters, {view: "full", profiles});
    return {result, projectRoot, courseId, work: workId};
  } finally {
    await Deno.remove(profile);
  }
}
