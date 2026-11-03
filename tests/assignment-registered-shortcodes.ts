// Pure guard на reader форме фактического SP literal; не live producer/handler execution.
import type { AssignmentProducerObservation } from "../_extensions/course-core/document/assignment-producer.ts";
import { qualifyAssignmentProducer } from "../_extensions/course-core/document/assignment-producer.ts";
import type { DocumentContext } from "../_extensions/course-core/document/contracts.ts";
const file =
  "/owner/_extensions/Afonenko-Course-Tools/project-download/shortcodes.lua";
const evidence: AssignmentProducerObservation = {
  format: "html",
  engine: "markdown",
  filters: [],
  shortcodes: [file],
  shortcodeHandlers: [{ name: "project-download", file }],
};
const context: DocumentContext = {
  operation: "11111111-1111-4111-8111-111111111111",
  input: "/owner/labs/work-environment.qmd",
  format: "html",
  projection: "author",
  exerciseBank: true,
};
type Literal = {
  value: string;
  key?: string;
  raw?: string;
  content?: readonly unknown[];
};
function document(
  name: string,
  args: readonly Literal[],
  title: unknown = { t: "MetaString", c: "Работа" },
) {
  const parameters = [{ value: name }, ...args].map((arg: Literal) => {
    const attrs: [string, string][] = [["data-is-shortcode", "1"], [
      "data-value",
      arg.value,
    ], ["data-raw", arg.raw ?? arg.value]];
    if (arg.key !== undefined) attrs.push(["data-key", arg.key]);
    return {
      t: "Span",
      c: [["", ["quarto-shortcode__-param"], attrs], arg.content ?? []],
    };
  });
  return {
    meta: { title },
    blocks: [{
      t: "Para",
      c: [{ t: "Span", c: [["", ["quarto-shortcode__"], []], parameters] }],
    }],
  };
}
function refuses(
  ast: ReturnType<typeof document>,
  observed: typeof evidence = evidence,
) {
  let error = "";
  try {
    qualifyAssignmentProducer(ast, context, observed);
  } catch (cause) {
    error = String(cause);
  }
  if (!error.includes("BODY.DELIVERY_PHASE_UNSUPPORTED")) {
    throw Error("Неподтверждённый/dynamic shortcode принят: " + error);
  }
}
const plain = document("project-download", [{
  value: "exr-work-environment-file-state",
}]);
const conditions = document("project-download", [
  { value: "exr-work-environment-file-state" },
  { key: "kind", value: "conditions" },
  { key: "text", value: "Скачать условие для локального просмотра" },
]);
qualifyAssignmentProducer(plain, context, evidence);
qualifyAssignmentProducer(conditions, context, evidence);
refuses(plain, { ...evidence, shortcodeHandlers: [] });
refuses(plain, { ...evidence, shortcodes: ["/foreign/shortcodes.lua"] });
refuses(document("unknown-handler", [{ value: "literal" }]));
refuses(document("env", [{ value: "USER" }]));
refuses(
  document("project-download", [{ value: "exr-one" }, {
    key: "text",
    value: "{{< meta title >}}",
  }]),
);
refuses(
  document("project-download", [{
    value: "exr-one",
    raw: "b58fc729-690b-4000-b19f-365a4093b2ff;7B7B;",
  }]),
);
refuses(
  document("project-download", [{
    value: "exr-one",
    content: [{ t: "Str", c: "dynamic" }],
  }]),
);
refuses(document("{{< meta title >}}", [{ value: "literal" }]));
qualifyAssignmentProducer(
  document("meta", [{ value: "title" }]),
  context,
  evidence,
);
refuses(document("meta", [{ value: "private.key" }]));
refuses(
  document("meta", [{ value: "title" }], {
    t: "MetaInlines",
    c: [{ t: "Emph", c: [] }],
  }),
);
qualifyAssignmentProducer(
  document("xref", [{ value: "tasks" }, { value: "sec-one" }, {
    key: "style",
    value: "link",
  }]),
  context,
  evidence,
);
refuses(
  document("xref", [{ value: "tasks" }, { value: "sec-one" }, {
    key: "unrecognised",
    value: "literal",
  }]),
);
console.log(
  "PASS pure registered project-download literal/conditions, file binding, unknown/dynamic refusals and special meta/xref guards",
);
