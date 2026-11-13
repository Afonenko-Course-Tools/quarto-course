import { required } from "./helpers/required.ts";
// Ordinary standalone Pandoc transport parity; NOT a qualified assignment producer.
import { normalizeDocument } from "../_extensions/course-core/document/normalize.ts";
import { collectNativeProjectFacts } from "../_extensions/course-core/document/project-capture.ts";
import { NativeProjectMaterializationInputSchema } from "../_extensions/course-core/document/project-facts.ts";
import { buildAssignmentProvenance } from "../_extensions/course-core/runtime/assignment-provenance.ts";
import { NativeProjectFactsCaptureSchema } from "../_extensions/course-core/document/project-facts.ts";
import { PandocDocumentSchema } from "../_extensions/course-core/document/contracts.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const extension = join(dirname(dirname(fromFileUrl(import.meta.url))), "_extensions/course-core"),
  root = await Deno.makeTempDir({ prefix: "project-facts-parity-" });
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k: string, x: unknown): unknown =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );
async function pandoc(args: string[], input: string) {
  const p = new Deno.Command("quarto", {
    args: ["pandoc", ...args],
    env: { CANONICAL_EXTENSION: extension, FACT_ROOT: root },
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const writer = p.stdin.getWriter();
  await writer.write(new TextEncoder().encode(input));
  await writer.close();
  const r = await p.output();
  if (!r.success) throw Error(new TextDecoder().decode(r.stderr));
  return new TextDecoder().decode(r.stdout);
}
let success = false;
try {
  const source =
    '---\ncourse: {id: facts, view: full}\nexercise-bank: true\nproject-checks:\n  defaults: {runtime: java25-junit-v1, scoring: {mode: weighted}}\n  source-profiles:\n    main: {mode: implementation, root: student, include: ["*.java"]}\n  profiles:\n    junit: {source-profile: main, tests: ["tests/*Test.java"]}\ndefault-exercise-project-check: junit\nproject-materialization:\n  projects:\n    exr-demo: {common-files: [{source: common/Support.java, target: student/src/Support.java, audience: student}], include-git: true}\n---\n' +
    ["demonstration", "discussion", "independent-study", "control"]
      .map(
        (role, i) =>
          `::: {#exr-${i ? "role" + i : "demo"} project="/projects/p${i}" ${
            i === 0 ? "project-check=junit target=prairielearn" : i === 1 ? "target=other-adapter" : ""
          } difficulty=introductory statement-visibility=${i % 2 ? "restricted" : "open"} course-role=${role}${
            i === 3 ? " .content-visible when-profile=advanced" : ""
          }}\n## ${role}\nУсловие.\n:::\n`,
      )
      .join("\n");
  const ast = PandocDocumentSchema.parse(JSON.parse(await pandoc(["-f", "markdown", "-t", "json"], source)));
  for (const bank of [true, false]) {
    const document = structuredClone(ast);
    document.meta["exercise-bank"] = { t: "MetaBool", c: bank };
    const context = {
      operation: crypto.randomUUID(),
      captureWitness: crypto.randomUUID(),
      input: join(root, "bank.qmd"),
      format: "revealjs",
      profiles: ["full"],
      projection: "author" as const,
      exerciseBank: bank,
      defaults: { "project-check": "junit" },
    };
    if (!bank && Object.keys(normalizeDocument(document, context).definitions).length)
      throw Error("Ordinary page behavior changed");
    const early = normalizeDocument(document, context, {
      source: "bank.qmd",
      assessments: [{ source: "work.qmd", id: "work" }],
    });
    if (!bank) {
      const duplicate = structuredClone(document);
      duplicate.blocks.push(structuredClone(required(document.blocks[0])));
      let rejected = false;
      try {
        normalizeDocument(duplicate, context, {
          source: "bank.qmd",
          assessments: [{ source: "work.qmd", id: "work" }],
        });
      } catch (e) {
        rejected = String(e).includes("DOCUMENT_DUPLICATE");
      }
      if (!rejected) throw Error("Duplicate page project accepted");
    }
    const originalCommand = required(Object.getOwnPropertyDescriptor(Deno, "Command"));
    let frame: ReturnType<typeof collectNativeProjectFacts>;
    Object.defineProperty(Deno, "Command", {
      configurable: originalCommand.configurable ?? false,
      enumerable: originalCommand.enumerable ?? false,
      writable: true,
      value: class {
        constructor() {
          throw Error("Pure projection не запускает child");
        }
      },
    });
    try {
      frame = collectNativeProjectFacts(early, root);
    } finally {
      Object.defineProperty(Deno, "Command", originalCommand);
    }
    const actual = NativeProjectFactsCaptureSchema.parse(frame);
    const identity = {
      operation: context.operation,
      projection: context.projection,
      profiles: context.profiles,
      runtime: "quarto-1.11.5" as const,
    };
    const { captureWitness, format } = early.context;
    if (!captureWitness || (format !== "html" && format !== "revealjs")) {
      throw Error("Native provenance requires captured witness/web format");
    }
    const capturedEarly: Parameters<typeof buildAssignmentProvenance>[3][number]["early"] = {
      ...early,
      context: { ...early.context, captureWitness, format },
    };
    const provenance = buildAssignmentProvenance(
      identity,
      ["bank.qmd"],
      ["bank.qmd"],
      [{ source: "bank.qmd", early: capturedEarly, projectFacts: actual }],
    );
    if (
      actual.projects.length !== 4 ||
      actual.projects.some((p) => p.bankMember !== bank || p.projectCheck !== "junit" || "check" in p) ||
      !actual.projectMaterializations["exr-demo"] ||
      required(provenance.documents[0]).projects.length !== 4 ||
      canonical(required(provenance.documents[0]).projectChecks) !==
        canonical(required(early.release).nativeMetadata.projectChecks)
    ) {
      throw Error("Полные generic facts/raw checks потеряны");
    }
    for (const [i, p] of actual.projects.entries()) {
      if (
        p.purpose !== ["demonstration", "discussion", "independent-study", "control"][i] ||
        p.artifactPolicy.conditions !== (i % 2 === 0)
      ) {
        throw Error("Purpose/policy parity");
      }
    }
    for (const mutate of [
      (v: typeof actual) => (required(v.projects[0]).projectCheck = "foreign"),
      (v: typeof actual) => (v.context.operation = crypto.randomUUID()),
      (v: typeof actual) => (v.context.captureWitness = crypto.randomUUID()),
      (v: typeof actual) => v.projects.pop(),
      (v: typeof actual) => (v.source = "foreign.qmd"),
    ]) {
      const bad = structuredClone(actual);
      mutate(bad);
      let refused = false;
      try {
        buildAssignmentProvenance(
          identity,
          ["bank.qmd"],
          ["bank.qmd"],
          [{ source: "bank.qmd", early: capturedEarly, projectFacts: bad }],
        );
      } catch (e) {
        refused = String(e).includes("BODY.PROVENANCE_UNQUALIFIED");
      }
      if (!refused) throw Error("Чужой selector/context/coverage принят");
    }
    for (const raw of [
      {
        projects: {
          "exr-demo": {
            "common-files": [
              {
                source: "../secret",
                target: "student/x",
                audience: "student",
              },
            ],
          },
        },
      },
      {
        projects: {
          "exr-demo": {
            "common-files": [
              {
                source: "common/x",
                target: "reference/x",
                audience: "student",
              },
            ],
          },
        },
      },
      { projects: { "exr-demo": { "common-files": [], unknown: true } } },
      {
        projects: {
          "exr-demo": {
            "common-files": [
              {
                source: "common/x",
                target: "student/x",
                audience: "student",
              },
              {
                source: "common/y",
                target: "student/x",
                audience: "student",
              },
            ],
          },
        },
      },
    ]) {
      if (NativeProjectMaterializationInputSchema.safeParse(raw).success)
        throw Error("Небезопасный materialization принят");
    }
    await Deno.writeTextFile(join(root, `result-${bank}.json`), JSON.stringify({ early, actual, provenance }));
  }
  success = true;
  console.log(
    "PASS actual TS producer, zero child projection, bank/page/all4 purposes/hidden/nonPL generic selectors/raw checks/materialization, same context and negative guards; not qualified assignment",
  );
} finally {
  if (success && !Deno.env.get("CORE_PROJECT_FACTS_KEEP")) {
    await Deno.remove(root, { recursive: true });
  } else if (success) console.log("PROJECT_FACTS_FIXTURE=" + root);
  else console.error("Preserved failed parity fixture " + root);
}
