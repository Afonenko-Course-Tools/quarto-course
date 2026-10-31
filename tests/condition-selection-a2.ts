import {
  CoreContractError,
  finalizeDocument,
  normalizeDocument,
  selectCondition,
} from "../_extensions/course-core/public.ts";
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
const refused = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (e) {
    assert(e instanceof CoreContractError && e.code === code, String(e));
    return;
  }
  throw Error("Accepted " + code);
};
const context = {
  operation: crypto.randomUUID(),
  input: "/owner/index.qmd",
  format: "html",
  projection: "student" as const,
  exerciseBank: true,
};
const body = (text: string) => [{ t: "Para", c: [{ t: "Str", c: text }] }];
const exercise = (text: string) => ({
  t: "Div",
  c: [["exr-repeat", [], [["difficulty", "introductory"], [
    "statement-visibility",
    "open",
  ], ["project", "code/input.qmd"]]], body(text)],
});
const early = normalizeDocument({
  "pandoc-api-version": [1, 23, 1, 2],
  meta: {},
  blocks: [exercise("EarlyA"), exercise("EarlyB")],
}, context);
const final = finalizeDocument(early, {
  context,
  occurrences: early.occurrences.map((r, i) => ({
    key: r.key,
    body: body("Late" + i),
    nativeKind: "Theorem",
    anchor: "exr-repeat",
  })),
});
refused(
  () => selectCondition(final, "exr-repeat", "student"),
  "CONDITION_OCCURRENCE",
);
const selected = selectCondition(final, "exr-repeat", {
  view: "student",
  occurrence: early.occurrences[1].key,
});
assert(
  JSON.stringify(selected).includes("Late1") &&
    !JSON.stringify(selected).includes("Early"),
  "early body used instead of actual occurrence",
);
assert(
  selected.project === "code/input.qmd" &&
    selected.pandocApiVersion.length === 4,
  "condition identity/actual Pandoc version lost",
);
assert(
  Object.isFrozen(selected) && Object.isFrozen(selected.body),
  "resolved condition mutable",
);
refused(
  () => selectCondition(final, "exr-repeat", "author"),
  "CONDITION_BINDING",
);
refused(
  () =>
    selectCondition({ ...final, status: "partial" }, "exr-repeat", "student"),
  "CONDITION_INCOMPLETE",
);
refused(
  () => selectCondition(final, "exr-absent", "student"),
  "CONDITION_OCCURRENCE",
);
console.log(
  "PASS A2 exact late occurrence, immutable condition, projection/partial/unknown refusals",
);
