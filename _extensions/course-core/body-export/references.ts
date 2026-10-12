import { dirname, resolve } from "stdlib/path";
import { command, quartoExecutable } from "../infrastructure/process.ts";
import { diagnostic, type DiagnosticContext } from "../domain/diagnostics.ts";

/** Resolve only a partitioned public fragment with the native bibliography engine.
 * Cite.content is supported only after citeproc and a matching generated entry.
 * A book's bibliography/nocite or another question never supplies public refs.
 */
export async function resolveReferences(
  blocks: any[],
  document: any,
  root: string,
  context: DiagnosticContext,
): Promise<any[]> {
  const citations = new Set<string>();
  const walk = (v: any, f: (n: any) => void) => {
    if (Array.isArray(v)) {
      v.forEach((n) => walk(n, f));
      return;
    }
    if (v && typeof v === "object") {
      f(v);
      Object.values(v).forEach((n) => walk(n, f));
    }
  };
  walk(blocks, (n) => {
    if (n.t === "Cite") { for (const c of n.c[0]) citations.add(c.citationId); }
  });
  let resolved = blocks;
  if (citations.size) {
    const cwd = dirname(resolve(root, context.source!));
    const meta = { ...document.meta };
    delete meta.nocite;
    const file = await Deno.makeTempFile({
      dir: cwd,
      prefix: ".course-citations-",
      suffix: ".json",
    });
    try {
      await Deno.writeTextFile(
        file,
        JSON.stringify({ ...document, meta, blocks }),
      );
      const output = JSON.parse(
        await command(quartoExecutable(), [
          "pandoc",
          file,
          "--from=json",
          "--to=json",
          "--citeproc",
        ], cwd),
      );
      const entries = new Set<string>();
      walk(output.blocks, (n) => {
        if (n.t === "Div" && n.c[0][1].includes("csl-entry")) {
          entries.add(n.c[0][0]);
        }
      });
      if ([...citations].some((id) => !entries.has("ref-" + id))) {
        throw diagnostic(
          "BODY.CITATION_UNRESOLVED",
          "Native citeproc не создал библиографическую запись",
          context,
        );
      }
      function translate(v: any): any {
        if (Array.isArray(v)) {
          return v.flatMap((n) =>
            n?.t === "Cite" ? translate(n.c[1]) : [translate(n)]
          );
        }
        if (!v || typeof v !== "object") return v;
        return Object.fromEntries(
          Object.entries(v).map(([k, n]) => [k, translate(n)]),
        );
      }
      resolved = translate(output.blocks);
    } finally {
      await Deno.remove(file);
    }
  }
  return resolved;
}

/** Fragment links must resolve inside the complete standalone public question. */
export function assertReferenceTargets(
  blocks: any[],
  context: DiagnosticContext,
) {
  const walk = (v: any, f: (n: any) => void) => {
    if (Array.isArray(v)) {
      v.forEach((n) => walk(n, f));
      return;
    }
    if (v && typeof v === "object") {
      f(v);
      Object.values(v).forEach((n) => walk(n, f));
    }
  };
  const ids = new Set<string>(), targets: string[] = [];
  walk(blocks, (n) => {
    const attr = n.t === "Header"
      ? n.c[1]
      : ["Div", "Span", "CodeBlock", "Code", "Link", "Image", "Table", "Figure"]
          .includes(n.t)
      ? n.c[0]
      : undefined;
    if (attr?.[0]) ids.add(attr[0]);
    if (n.t === "Link" && n.c[2][0].startsWith("#")) {
      targets.push(n.c[2][0].slice(1));
    }
  });
  if (targets.some((id) => !ids.has(id))) {
    throw diagnostic(
      "BODY.REFERENCE_TARGET_MISSING",
      "Ссылка не имеет цели в самостоятельном вопросе",
      context,
    );
  }
}
