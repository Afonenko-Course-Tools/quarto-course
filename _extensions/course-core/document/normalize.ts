import { isAlias, parseDocument } from "../body-export/vendor/libraries.js";
import { boundInput, fail } from "../contracts/project.ts";
import {
  boundDocument,
  decode,
  decodeDocumentContext,
  EarlyDocumentSchema,
  ExerciseDeclarationSchema,
  PandocDocumentSchema,
} from "./contracts.ts";
import type {
  DocumentContext,
  EarlyDocument,
  ExerciseDeclaration,
} from "./contracts.ts";
export const occurrenceAttribute = "data-course-core-occurrence";
export const bindingMetadata = "course-core-ts-binding";
const ownKeys = new Set([
  "difficulty",
  "statement-visibility",
  "course-role",
  "time",
  "project",
  "target",
]);
const object = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function attr(
  node: Record<string, any>,
  source: string,
): [string, string[], string[][]] {
  const a = node.c?.[0];
  if (
    !Array.isArray(a) || a.length !== 3 || typeof a[0] !== "string" ||
    !Array.isArray(a[1]) || a[1].some((x) => typeof x !== "string") ||
    !Array.isArray(a[2]) ||
    a[2].some((x) =>
      !Array.isArray(x) || x.length !== 2 ||
      x.some((y) => typeof y !== "string")
    )
  ) fail("DOCUMENT_AST", "Некорректный Attr", source);
  return a as [string, string[], string[][]];
}
function yamlMarker(text: string, source: string) {
  if (text.length > 65536) {
    fail("CONTRACT_LIMIT", "Слишком большой marker YAML", source);
  }
  const doc = parseDocument(text, { uniqueKeys: true, keepSourceTokens: true });
  if (!doc || doc.errors.length || doc.warnings.length) {
    fail("EXERCISE_CONTRACT", "Некорректный marker YAML", source);
  }
  function check(n: any) {
    if (isAlias(n) || n?.anchor || n?.tag) {
      fail(
        "EXERCISE_CONTRACT",
        "Aliases/tags marker YAML не поддержаны",
        source,
      );
    }
    if (Array.isArray(n?.items)) {
      for (const p of n.items) {
        if (p && "key" in p) {
          check(p.key);
          check(p.value);
        } else check(p);
      }
    }
  }
  check(doc.contents);
  const value = doc.toJSON();
  boundInput(value, source);
  if (!object(value)) {
    fail("EXERCISE_CONTRACT", "Marker YAML должен быть картой", source);
  }
  return value;
}
function isMarker(v: unknown): boolean {
  return object(v) && v.t === "CodeBlock" && Array.isArray(v.c?.[0]?.[1]) &&
    v.c[0][1].includes("course-exercise");
}
/** Валидация всех объявлений предшествует любой audience projection. */
export function normalizeDocument(
  value: unknown,
  rawContext: DocumentContext,
): EarlyDocument {
  boundDocument(value);
  const context = decodeDocumentContext(rawContext),
    ast = structuredClone(
      decode(PandocDocumentSchema, value, "DOCUMENT_AST", context.input),
    );
  if (Object.hasOwn(ast.meta, bindingMetadata)) {
    fail(
      "DOCUMENT_BINDING",
      "Вход уже имеет binding предыдущего прохода",
      context.input,
    );
  }
  const definitions: Record<string, ExerciseDeclaration> = {},
    occurrences: EarlyDocument["occurrences"] = [];
  const rows = new Map<
    object,
    {
      kind: "exercise" | "solution";
      exerciseId: string;
      publicSolution: boolean;
      remove: boolean;
      conditional: boolean;
      key?: string;
    }
  >();
  const acceptedMarkers = new Set<object>();
  let ordinal = 0;
  function collect(v: unknown, parent?: string, conditional = false) {
    if (Array.isArray(v)) {
      for (const item of v) collect(item, parent, conditional);
      return;
    }
    if (!object(v)) return;
    let next = parent;
    if (
      (v.t === "Div" || v.t === "Span" || v.t === "CodeBlock") &&
      Array.isArray(v.c)
    ) {
      const a = attr(v, context.input), [id, classes, pairs] = a;
      if (
        context.exerciseBank &&
        classes.some((c) =>
          ["answer", "answer-spec", "correct", "task-items"].includes(c)
        )
      ) {
        fail(
          "DOCUMENT_UNQUALIFIED",
          "Этот Core namespace ещё не перенесён в TS",
          context.input,
          id || classes.join(" "),
        );
      }
      conditional ||= classes.includes("content-visible") ||
        classes.includes("content-hidden");
      if (pairs.some(([k]) => k === occurrenceAttribute)) {
        fail(
          "DOCUMENT_BINDING",
          "Авторский occurrence marker запрещён",
          context.input,
          id,
        );
      }
      if (context.exerciseBank && v.t === "Div" && id.startsWith("exr-")) {
        if (parent) {
          fail(
            "EXERCISE_CONTRACT",
            "Вложенные упражнения не поддержаны",
            context.input,
            id,
          );
        }
        if (!/^exr-[a-z0-9][a-z0-9-]*$/.test(id)) {
          fail(
            "EXERCISE_CONTRACT",
            "Некорректный ID упражнения",
            context.input,
            id,
          );
        }
        const own: Record<string, unknown> = {};
        const seen = new Set<string>();
        for (const [key, text] of pairs) {
          if (seen.has(key)) {
            fail(
              "DOCUMENT_DUPLICATE",
              "Повторный атрибут " + key,
              context.input,
              id,
            );
          }
          seen.add(key);
          if (ownKeys.has(key)) {
            if (key === "time") {
              if (!/^[1-9][0-9]*$/.test(text)) {
                fail(
                  "EXERCISE_CONTRACT",
                  "time требует положительное целое",
                  context.input,
                  id,
                );
              }
              own[key] = Number(text);
            } else own[key] = text;
          }
        }
        const markers = v.c[1].filter(isMarker);
        if (markers.length > 1) {
          fail(
            "DOCUMENT_DUPLICATE",
            "Несколько marker blocks",
            context.input,
            id,
          );
        }
        if (markers.length) {
          acceptedMarkers.add(markers[0]);
          const marker = yamlMarker(markers[0].c[1], context.input);
          for (const [k, item] of Object.entries(marker)) {
            if (seen.has(k)) {
              fail(
                "DOCUMENT_DUPLICATE",
                "Attr и marker повторяют поле " + k,
                context.input,
                id,
              );
            }
            own[k] = item;
          }
        }
        const declaration = decode(
          ExerciseDeclarationSchema,
          { ...context.defaults, ...own },
          "EXERCISE_CONTRACT",
          context.input,
        );
        if (
          definitions[id] &&
          JSON.stringify(definitions[id]) !== JSON.stringify(declaration)
        ) {
          fail(
            "DOCUMENT_DUPLICATE",
            "Противоречащие определения одного ID",
            context.input,
            id,
          );
        }
        definitions[id] = declaration;
        rows.set(v, {
          kind: "exercise",
          exerciseId: id,
          publicSolution: false,
          remove: context.projection === "student" &&
            declaration["statement-visibility"] === "restricted",
          conditional,
        });
        next = id;
      } else if (
        context.exerciseBank && v.t === "Div" &&
        (classes.includes("solution") || id.startsWith("sol-"))
      ) {
        const exerciseId = id.startsWith("sol-")
          ? "exr-" + id.slice(4)
          : parent;
        if (!exerciseId) {
          fail(
            "EXERCISE_CONTRACT",
            "Решение без упражнения",
            context.input,
            id,
          );
        }
        rows.set(v, {
          kind: "solution",
          exerciseId,
          publicSolution: false,
          remove: false,
          conditional,
        });
      }
    }
    if (isMarker(v)) {
      if (!acceptedMarkers.has(v)) {
        fail(
          "EXERCISE_CONTRACT",
          "Marker допустим непосредственно в упражнении",
          context.input,
        );
      }
      return;
    }
    for (const child of Object.values(v)) collect(child, next, conditional);
  }
  collect(ast.blocks);
  for (const [node, row] of rows) {
    if (row.kind === "solution") {
      const declaration = definitions[row.exerciseId];
      if (!declaration) {
        fail(
          "EXERCISE_CONTRACT",
          "Решение ссылается на отсутствующее упражнение",
          context.input,
          row.exerciseId,
        );
      }
      row.publicSolution = declaration["course-role"] === "demonstration" &&
        declaration["statement-visibility"] === "open";
      row.remove = context.projection === "student" && !row.publicSolution;
    }
  }
  function project(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(project).filter((x) => x !== undefined);
    if (!object(v)) return v;
    const row = rows.get(v);
    if (row?.remove || isMarker(v)) return undefined;
    if (
      context.projection === "student" && v.t === "Div" &&
      Array.isArray(v.c?.[0]?.[1]) && v.c[0][1].includes("grading-notes")
    ) return undefined;
    if (row) {
      const key = context.operation + ":" + (++ordinal);
      row.key = key;
      const a = attr(v, context.input);
      a[2].push([occurrenceAttribute, key]);
      occurrences.push({
        key,
        kind: row.kind,
        exerciseId: row.exerciseId,
        required: row.kind === "exercise" || !row.conditional,
        publicSolution: row.publicSolution,
      });
    }
    return Object.fromEntries(
      Object.entries(v).map(([k, c]) => [k, project(c)]),
    );
  }
  ast.blocks = project(ast.blocks) as unknown[];
  ast.meta[bindingMetadata] = { t: "MetaString", c: JSON.stringify(context) };
  return decode(
    EarlyDocumentSchema,
    { context, ast, definitions, occurrences },
    "DOCUMENT_EARLY",
    context.input,
  );
}
