// Настоящий Quarto reader/pre-ast transport; это не qualified assignment/P.
import { qualifyAssignmentProducer } from "../_extensions/course-core/document/assignment-producer.ts";
import type { AssignmentProducerProfile } from "../_extensions/course-core/runtime/assignment-producer-profiles.ts";
import type { DocumentContext } from "../_extensions/course-core/document/contracts.ts";
const root = await Deno.makeTempDir({ prefix: "literal-shortcodes-" });
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const evidence = {
  filters: [],
  shortcodes: [],
  engine: "markdown",
  format: "html",
};
// Только вход конкретной чистой функции, не schema-valid authority или operation.
const profile = {
  native: {
    literalShortcodes: ["xref", "meta"],
    producerEvidence: {
      html: { filters: [], shortcodes: [], engine: "markdown" },
    },
  },
} as unknown as AssignmentProducerProfile;
const context = { format: "html" } as DocumentContext;
let checks = 0;
function accepts(ast: any) {
  qualifyAssignmentProducer(ast, context, profile, evidence);
  checks++;
}
function refuses(ast: any, e = evidence) {
  let rejected = false;
  try {
    qualifyAssignmentProducer(ast, context, profile, e);
  } catch (error) {
    rejected = String(error).includes("BODY.DELIVERY_PHASE_UNSUPPORTED");
  }
  assert(rejected, "Недопустимый literal producer принят");
  checks++;
}
try {
  await Deno.mkdir(`${root}/_extensions/observer`, { recursive: true });
  await Deno.writeTextFile(
    `${root}/_quarto.yml`,
    "project: {type: default}\nformat: {html: {theme: none}}\nfilters: [observer]\n",
  );
  await Deno.writeTextFile(
    `${root}/_extensions/observer/_extension.yml`,
    "title: Наблюдатель reader\nversion: 1.0.0\ncontributes:\n  filters:\n    - at: pre-ast\n      path: observe.lua\n",
  );
  await Deno.writeTextFile(
    `${root}/_extensions/observer/observe.lua`,
    `return {{Pandoc=function(doc)\n local f=assert(io.open(${
      JSON.stringify(`${root}/observed.json`)
    },'wb'));f:write(pandoc.write(doc,'json'));f:close()\n return doc\nend}}\n`,
  );
  await Deno.writeTextFile(
    `${root}/index.qmd`,
    `---\ntitle: Обычный заголовок\n---\n
::: {#quoted}\n{{< xref tasks sec-j25-labs "Лабораторные работы" >}}\n:::\n
::: {#named}\n{{< xref tasks sec-j25-bank 'Банк заданий' style = "link" >}}\n:::\n
::: {#multiline}\n{{< xref\n tasks\n sec-j25-theory\n >}}\n:::\n
::: {#meta}\n{{< meta title >}}\n:::\n
::: {#dynamic}\n{{< xref tasks {{< meta title >}} >}}\n:::\n
::: {#unknown}\n{{< env USER >}}\n:::\n`,
  );
  const r = await new Deno.Command(Deno.env.get("QUARTO") ?? "quarto", {
    args: ["render", "index.qmd"],
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(r.success, new TextDecoder().decode(r.stderr));
  const raw = await Deno.readTextFile(`${root}/observed.json`);
  const output = Deno.env.get("SHORTCODE_EVIDENCE");
  if (output) {
    await Deno.mkdir(output, { recursive: true });
    await Deno.writeTextFile(`${output}/native-ast.json`, raw);
    await Deno.writeFile(`${output}/quarto.stderr`, r.stderr);
  }
  const ast = JSON.parse(raw), cases = new Map<string, any>();
  for (const block of ast.blocks) {
    if (block.t === "Div") {
      cases.set(block.c[0][0], { ...ast, blocks: [block] });
    }
  }
  assert(cases.size === 6, "Не получены реальные pre-ast cases");
  const first = cases.get("quoted").blocks[0].c[1][0].c[0];
  assert(
    first.c[1].some((n: any) => n.t === "Space"),
    "Потеряны native разделители",
  );
  assert(
    first.c[1][0].c[0][2].some((p: any[]) =>
      p[0] === "data-is-shortcode" && p[1] === "1"
    ),
    "Нет native marker",
  );
  for (const name of ["quoted", "named", "multiline", "meta"]) {
    accepts(cases.get(name));
  }
  for (const name of ["dynamic", "unknown"]) refuses(cases.get(name));
  const mutate = (fn: (span: any, ast: any) => void) => {
    const v = structuredClone(cases.get("quoted"));
    fn(v.blocks[0].c[1][0].c[0], v);
    return v;
  };
  const param = (s: any) => s.c[1].find((n: any) => n.t === "Span");
  const attr = (s: any, k: string, v: any) => {
    const a = param(s).c[0][2];
    const row = a.find((r: any[]) => r[0] === k);
    if (row) row[1] = v;
    else a.push([k, v]);
  };
  refuses(mutate((s) => attr(s, "data-value", "{{< env SECRET >}}")));
  refuses(mutate((s) => attr(s, "data-raw", "{{< env SECRET >}}")));
  refuses(mutate((s) => attr(s, "data-is-shortcode", "0")));
  refuses(mutate((s) => attr(s, "data-extra", "unsafe")));
  refuses(mutate((s) => attr(s, "data-value", { t: "Str", c: "xref" })));
  refuses(mutate((s) => attr(s, "data-key", "")));
  refuses(mutate((s) => attr(s, "data-key", 5)));
  refuses(mutate((s) => attr(s, "data-raw", 5)));
  refuses(mutate((s) => {
    param(s).c[0][2] = param(s).c[0][2].filter((a: any[]) =>
      a[0] !== "data-raw"
    );
  }));
  refuses(
    mutate((s) =>
      attr(s, "data-raw", "b58fc729-690b-4000-b19f-365a4093b2ff;7B7B;")
    ),
  );
  refuses(mutate((s) => {
    s.c[1][1].c = "unexpected";
  }));
  refuses(mutate((s) => {
    param(s).c[1].push({ t: "Str", c: "dynamic" });
  }));
  refuses(mutate((s) => {
    param(s).c[0][2].push(["data-value", "xref"]);
  }));
  refuses(mutate((s) => {
    s.c[1].splice(1, 0, { t: "Str", c: "unexpected" });
  }));
  refuses(mutate((s) => {
    s.c[1].splice(1, 0, { t: "RawInline", c: ["html", "<b>x</b>"] });
  }));
  refuses(cases.get("quoted"), { ...evidence, engine: "foreign" });
  const metadata = structuredClone(cases.get("meta"));
  metadata.meta.title = {
    t: "MetaInlines",
    c: [{ t: "Emph", c: [{ t: "Str", c: "title" }] }],
  };
  refuses(metadata);
  const observed = Deno.env.get("SHORTCODE_NATIVE_AST");
  if (observed) accepts(JSON.parse(await Deno.readTextFile(observed)));
  console.log(
    JSON.stringify({
      status: "PASS",
      checks,
      actualReader: true,
      qualifiedAssignment: false,
    }),
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
