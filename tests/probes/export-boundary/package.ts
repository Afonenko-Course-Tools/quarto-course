// EXPERIMENTAL P0 fixture bridge, deliberately outside production Core.
import { isAlias, parseDocument } from "./vendor/libraries.js";
export type Node = { t: string; c?: any };
export type Question = {
  key: string;
  owner: string;
  id: string;
  source: string;
  visibility: "public" | "closed";
  condition: Node[];
  publicAnswer: Node[];
  answerType: string;
  closedKey: any;
  solution: Node[];
  gradingNotes: Node[];
};
export type Package = {
  experimental: "p0-native-ast-v1";
  owner: string;
  release: string;
  apiVersion: number[];
  questions: Question[];
  works: {
    key: string;
    owner: string;
    id: string;
    source: string;
    kind: string;
    title: string;
    items: string[];
  }[];
  resources: {
    owner: string;
    source: string;
    effectiveBase: string;
    target: string;
    sha256: string;
    data: string;
    visibility: "public";
  }[];
};
const decoder = new TextDecoder();
export async function run(
  cmd: string,
  args: string[],
  input?: string,
): Promise<string> {
  const p = new Deno.Command(cmd, {
    args,
    stdin: input === undefined ? "null" : "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  if (input !== undefined) {
    const w = p.stdin.getWriter();
    await w.write(new TextEncoder().encode(input));
    await w.close();
  }
  const out = await p.output();
  if (!out.success) throw new Error(decoder.decode(out.stderr));
  return decoder.decode(out.stdout);
}
const para = (s: string): Node => ({ t: "Para", c: [{ t: "Str", c: s }] });
async function vet(answer: any) {
  const dir = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(dir + "/input.json", JSON.stringify({ answer }));
    await run("cue", [
      "vet",
      new URL("answer.cue", import.meta.url).pathname,
      dir + "/input.json",
    ]);
  } catch {
    throw new Error("ANSWER_INVALID: CUE rejected answer contract");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}
export async function validateAnswer(
  source: string,
): Promise<{ publicAnswer: Node[]; closedKey: any; answerType: string }> {
  let data: any;
  try {
    const doc = parseDocument(source, { uniqueKeys: true, version: "1.2" });
    if (!doc || doc.errors.length || doc.warnings.length) {
      throw Error("invalid YAML");
    }
    const inspect = (v: any) => {
      if (!v || typeof v !== "object") return;
      if (isAlias(v) || v.tag) throw Error("aliases/tags unsupported");
      for (const x of v.items ?? []) {
        inspect(x);
        inspect(x.key);
        inspect(x.value);
      }
    };
    inspect(doc.contents);
    data = doc.toJS({ maxAliasCount: 0 });
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw Error("mapping required");
    }
  } catch {
    throw new Error(
      "ANSWER_YAML: single mapping, no duplicate keys, aliases or custom tags",
    );
  }
  await vet(data);
  const project = (a: any): Node[] =>
    a.type === "numeric"
      ? [para("Answer: ____________________")]
      : a.type === "manual"
      ? [para("Response: ________________________________________")]
      : a.type === "multipart"
      ? a.parts.flatMap((p: any) => [para(p.label), ...project(p)])
      : a.type === "matching"
      ? [
        para("Prompts"),
        { t: "BulletList", c: a.prompts.map((p: string) => [para(p)]) },
        para("Options"),
        { t: "BulletList", c: a.options.map((p: string) => [para(p)]) },
        para("Matches: ____________________"),
      ]
      : [];
  return {
    publicAnswer: project(data),
    closedKey: data,
    answerType: data.type,
  };
}
export function publicQuestion(q: Question) {
  if (q.visibility !== "public") {
    throw new Error(
      "PACKAGE_PRIVATE: closed condition has no public projection",
    );
  }
  assertPublicTree(q.condition);
  assertPublicTree(q.publicAnswer);
  const { closedKey, solution, gradingNotes, ...p } = q;
  return p;
}
// Keep source occurrences until CUE validates cardinality and canonical ownership.
async function vetSource(value: unknown, file: string, code: string) {
  const tmp = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(tmp + "/input.json", JSON.stringify(value));
    await run("cue", [
      "vet",
      new URL(file, import.meta.url).pathname,
      tmp + "/input.json",
    ]);
  } catch {
    throw Error(code + ": CUE rejected source occurrences");
  } finally {
    await Deno.remove(tmp, { recursive: true });
  }
}
function attr(node: any): any[] | undefined {
  if (!node || typeof node !== "object") return;
  if (node.t === "Header") return node.c[1];
  if (
    ["Div", "Span", "Code", "CodeBlock", "Link", "Image", "Table", "Figure"]
      .includes(node.t)
  ) return node.c[0];
}
function checkProfile(node: any) {
  const a = attr(node);
  if (
    a && (a[1].some((s: string) =>
      /^(when-|unless-)/.test(s) ||
      ["content-visible", "content-hidden", "full", "full-only"].includes(s)
    ) || a[2].some(([k]: string[]) => /^(when-|unless-)/.test(k)))
  ) {
    throw Error(
      "PACKAGE_INVALID: profile-conditioned source is outside this public P0 subset",
    );
  }
}
function visit(value: any, f: (node: any) => void) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((v) => visit(v, f));
    return;
  }
  if (value.t) f(value);
  for (const v of Object.values(value)) {
    if (v && typeof v === "object") visit(v, f);
  }
}
function assertPublicTree(value: any) {
  visit(value, (node) => {
    checkProfile(node);
    const a = attr(node);
    if (
      a &&
      (a[0].startsWith("sol-") ||
        a[1].some((s: string) =>
          ["grading-notes", "answer-spec", "correct", "solution", "demo-sol"]
            .includes(s)
        ))
    ) {
      throw Error("PACKAGE_PRIVATE: unsplit closed marker in public content");
    }
  });
}
async function projectChoice(b: Node) {
  if (
    !b.c[0][2].some((x: any) => x[0] === "type" && x[1] === "single-choice") ||
    b.c[1].length !== 1 || b.c[1][0].t !== "BulletList"
  ) throw Error("ADAPTER: unsupported answer body");
  let correct = -1, count = 0;
  const strip = (v: any, index: number): any => {
    if (Array.isArray(v)) {
      return v.flatMap((x) => {
        if (x?.t === "Span" && x.c[0][1].includes("correct")) {
          correct = index;
          count++;
          return strip(x.c[1], index);
        }
        return [strip(x, index)];
      });
    }
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, strip(x, index)]),
      );
    }
    return v;
  };
  const clean = b.c[1][0].c.map((c: any, i: number) => strip(c, i));
  await vet({
    type: "single-choice",
    count: clean.length,
    correct,
    markedCount: count,
  });
  return {
    answerType: "single-choice",
    closedKey: { correct },
    publicAnswer: [{ t: "BulletList", c: clean }],
  };
}
export async function buildPackage(
  input: URL | URL[],
  owner: string,
  provenance?: string,
  answersModule = true,
): Promise<Package> {
  const sources = Array.isArray(input) ? input : [input];
  if (!sources.length) throw Error("PACKAGE_INVALID: no explicit source pages");
  const result: Package = {
    experimental: "p0-native-ast-v1",
    owner,
    release: "fixture-1",
    apiVersion: [],
    questions: [],
    works: [],
    resources: [],
  };
  const pending: {
    q: Question;
    source: URL;
    answers: Node[];
    solutions: { id: string }[];
  }[] = [];
  const assessments: any[] = [];
  for (const [sourceIndex, source] of sources.entries()) {
    // Disabling automatic heading identifiers preserves evidence of explicit author IDs.
    const doc = JSON.parse(
      await run("quarto", [
        "pandoc",
        "--from=markdown-auto_identifiers",
        "--to=json",
        source.pathname,
      ]),
    );
    result.apiVersion = doc["pandoc-api-version"];
    const origin = sourceIndex === 0 && provenance
      ? provenance
      : source.pathname.split("/").pop()!;
    const local: typeof pending = [];
    const siblings: Node[] = [];
    const omitted = Symbol("removed-private-node");
    const discover = (v: any) => {
      if (!v || typeof v !== "object") return;
      if (Array.isArray(v)) {
        v.forEach(discover);
        return;
      }
      checkProfile(v);
      if (v.t === "Div" && v.c[0][0].startsWith("assessment-")) {
        throw Error(
          "PACKAGE_INVALID: legacy assessment containers are unsupported; use assessment.kind and sec-ID",
        );
      }
      if (v.t === "Div" && v.c[0][0].startsWith("exr-")) {
        const id = v.c[0][0];
        const q: Question = {
          key: owner + "/" + id,
          owner,
          id,
          source: origin,
          visibility: v.c[0][1].includes("control") ? "closed" : "public",
          condition: [],
          publicAnswer: [],
          answerType: "manual",
          closedKey: null,
          solution: [],
          gradingNotes: [],
        };
        const entry = {
          q,
          source,
          answers: [] as Node[],
          solutions: [] as { id: string }[],
        };
        const split = (
          node: any,
          mode: "condition" | "solution" | "notes" = "condition",
        ): any => {
          if (!node || typeof node !== "object") return node;
          if (Array.isArray(node)) {
            return node.map((n) => split(n, mode)).filter((n) => n !== omitted);
          }
          checkProfile(node);
          const a = attr(node);
          if (node.t === "Div" && a![0].startsWith("exr-")) {
            throw Error(
              "PACKAGE_INVALID: nested question declaration unsupported",
            );
          }
          if (node.t === "Div" && a![0].startsWith("sol-")) {
            if (mode !== "condition") {
              throw Error(
                "PACKAGE_INVALID: solution nested inside private component",
              );
            }
            entry.solutions.push({ id: a![0] });
            q.solution.push(...split(node.c[1], "solution"));
            return omitted;
          }
          if (a?.[1].includes("grading-notes")) {
            if (node.t !== "Div" || mode === "notes") {
              throw Error("PACKAGE_INVALID: unsupported grading-notes nesting");
            }
            q.gradingNotes.push(...split(node.c[1], "notes"));
            return omitted;
          }
          if (
            (node.t === "CodeBlock" && a![1].includes("answer-spec")) ||
            (node.t === "Div" && a![1].includes("answer"))
          ) {
            if (mode !== "condition") {
              throw Error(
                "PACKAGE_INVALID: answer declaration inside private component",
              );
            }
            entry.answers.push(structuredClone(node));
            return omitted;
          }
          return Object.fromEntries(
            Object.entries(node).map(([k, v]) => [k, split(v, mode)]),
          );
        };
        q.condition = split(v.c[1]);
        // The same split is used for accepted sibling solutions after discovery.
        Object.defineProperty(entry, "split", { value: split });
        local.push(entry);
        return;
      }
      if (v.t === "Div" && v.c[0][0].startsWith("sol-")) {
        siblings.push(v);
        return;
      }
      for (const child of Object.values(v)) {
        if (child && typeof child === "object") discover(child);
      }
    };
    discover(doc.blocks);
    for (const solution of siblings) {
      const matches = local.filter((e) =>
        e.q.id.slice(4) === solution.c[0][0].slice(4)
      );
      if (matches.length !== 1) {
        throw Error(
          "PACKAGE_INVALID: sibling solution requires one same-page canonical owner",
        );
      }
      (matches[0] as any).split(solution);
    }
    pending.push(...local);
    const containers: any[] = [];
    visit(doc.blocks, (n) => {
      if (n.t === "Div" && n.c[0][1].includes("assessment-items")) {
        containers.push(n);
      }
    });
    if (doc.meta.assessment || containers.length) {
      const heading = doc.blocks.find((n: Node) => n.t === "Header");
      const plain = async (inlines: any[]) =>
        (await run(
          "quarto",
          ["pandoc", "--from=json", "--to=plain", "--wrap=none"],
          JSON.stringify({
            "pandoc-api-version": result.apiVersion,
            meta: {},
            blocks: [{ t: "Plain", c: inlines }],
          }),
        )).trim();
      const kindNode = doc.meta.assessment?.c?.kind;
      const kind = kindNode?.t === "MetaInlines"
        ? await plain(kindNode.c)
        : kindNode?.t === "MetaString"
        ? kindNode.c
        : "";
      const items: string[] = [];
      const memberKinds: string[] = [];
      const memberSizes: number[] = [];
      for (const container of containers) {
        for (const block of container.c[1]) {
          memberKinds.push(block.t);
          const rows = block.t === "BulletList"
            ? block.c
            : block.t === "OrderedList"
            ? block.c[1]
            : [];
          for (const row of rows) {
            let count = 0;
            visit(row, (n) => {
              if (n.t === "Cite") {
                for (const cite of n.c[0]) {
                  items.push(owner + "/" + cite.citationId);
                  count++;
                }
              }
            });
            memberSizes.push(count);
          }
        }
      }
      assessments.push({
        declared: !!doc.meta.assessment,
        id: heading?.c[1][0] ?? "",
        kind,
        title: heading ? await plain(heading.c[2]) : "",
        source: origin,
        containers: containers.length,
        memberKinds,
        memberSizes,
        items,
      });
    }
  }
  await vetSource(
    {
      declarations: pending.map((e) => ({
        id: e.q.id,
        answers: e.answers.map((n) => ({
          form: n.t === "CodeBlock" ? "yaml" : "choice",
        })),
        solutions: e.solutions,
      })),
    },
    "declarations.cue",
    "ANSWER_DECLARATIONS",
  );
  await vetSource({ assessments }, "assessments.cue", "PACKAGE_INVALID");
  for (const a of assessments) {
    result.works.push({
      key: owner + "/" + a.id,
      owner,
      id: a.id,
      source: a.source,
      kind: a.kind,
      title: a.title,
      items: a.items,
    });
  }
  for (const entry of pending) {
    const { q, answers, source } = entry;
    if (answers.length) {
      const a = answers[0];
      if (a.t === "CodeBlock") {
        if (!answersModule) {
          throw Error(
            "ANSWER_MODULE_REQUIRED: selected package needs common answer module",
          );
        }
        Object.assign(q, await validateAnswer(a.c[1]));
      } else Object.assign(q, await projectChoice(a));
    } else {q.publicAnswer = [
        para("Response: ________________________________________"),
      ];}
    assertPublicTree(q.condition);
    assertPublicTree(q.publicAnswer);
    const nodes: any[] = [];
    visit([q.condition, q.publicAnswer], (n) => {
      if (n.t === "Image" || n.t === "Link") nodes.push(n);
    });
    for (const node of nodes) {
      const target = node.c[2][0];
      if (/^(https?:|#)/.test(target)) continue;
      if (
        !/^[A-Za-z0-9._/-]+$/.test(target) ||
        target.split("/").some((c: string) =>
          c === "" || c === "." || c === ".."
        )
      ) throw Error("RESOURCE: noncanonical source path");
      const bytes = await Deno.readFile(new URL(target, source));
      const sha256 = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ).map((x) => x.toString(16).padStart(2, "0")).join("");
      const out = `resources/${owner}/${target}`;
      const existing = result.resources.find((r) => r.target === out);
      if (existing && existing.sha256 !== sha256) {
        throw Error("RESOURCE: destination collision");
      }
      if (!existing) {
        result.resources.push({
          owner,
          source: target,
          effectiveBase: ".",
          target: out,
          sha256,
          data: btoa(String.fromCharCode(...bytes)),
          visibility: "public",
        });
      }
      node.c[2][0] = out;
    }
    result.questions.push(q);
  }
  await vetSource({ packageData: result }, "package.cue", "PACKAGE_INVALID");
  return result;
}
if (import.meta.main) {
  const [src, out, ...additional] = Deno.args;
  if (!src || !out) {
    throw Error(
      "usage: package.ts source.qmd output.json [additional-source.qmd ...]",
    );
  }
  const p = await buildPackage(
    await Promise.all(
      [src, ...additional].map(async (path) =>
        new URL("file://" + await Deno.realPath(path))
      ),
    ),
    "course-a",
  );
  await Deno.writeTextFile(out, JSON.stringify(p, null, 2) + "\n");
}
