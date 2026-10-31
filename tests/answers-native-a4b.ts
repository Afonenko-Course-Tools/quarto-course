import * as Core from "../_extensions/course-core/public.ts";
import { dirname, fromFileUrl, join } from "stdlib/path";
const extension = join(
  dirname(dirname(fromFileUrl(import.meta.url))),
  "_extensions/course-core",
);
const checks: { name: string; passed: boolean }[] = [];
const check = (name: string, passed: boolean) => {
  checks.push({ name, passed });
  if (!passed) throw Error(name);
};
const yaml =
  `type: numeric\nkey: {value: 18273.25, tolerance: {absolute: 0.125}}`;
for (const projection of ["student", "author"] as const) {
  const root = await Deno.makeTempDir({ prefix: "a4b-answers-native-" });
  const put = async (p: string, s: string) => {
    await Deno.mkdir(dirname(join(root, p)), { recursive: true });
    await Deno.writeTextFile(join(root, p), s);
  };
  await put(
    "_quarto.yml",
    `project:\n  type: website\n  output-dir: _site\n  render: [index.qmd]\n  pre-render: [quarto run ${extension}/entrypoints/native-pre.ts]\n  post-render: [quarto run ${extension}/entrypoints/native-post.ts]\nformat:\n  html:\n    theme: none\nmetadata-files: [settings.yml]\ncourse: {id: answers-course, view: ${
      projection === "student" ? "student" : "full"
    }, adapters: [adapter-a, adapter-b]}\ncourse-core-runtime: native-ts\ncourse-core-role: exercise-bank\ncourse-core-projection: ${projection}\nexercise-defaults: {difficulty: introductory, statement-visibility: open, target: adapter-a}\nfilters:\n  - at: pre-ast\n    path: ${extension}/native-ts/early-context.lua\n  - at: post-quarto\n    path: ${extension}/native-ts/late-kind.lua\n  - at: post-render\n    path: ${extension}/native-ts/late-filter.lua\n`,
  );
  await put(
    "settings.yml",
    "adapter-a: &policy\n  question-defaults:\n    submission: upload\n  list: [one, two]\ncopy-of-policy: *policy\nother-secret: NEVER_ALL_NAMESPACE\n",
  );
  await put("_metadata.yml", "adapter-a:\n  inherited: directory\n");
  await put(
    "_quarto-qualified.yml",
    "adapter-a:\n  question-defaults:\n    submission: editor\n",
  );
  for (const name of ["adapter-a", "adapter-b"]) {
    await put(`_extensions/${name}/contract.json`, JSON.stringify({ name }));
  }
  await put("project/starter/source.txt", "source");
  await put("project/input.qmd", "# Проект\n");
  await put(
    "project/_metadata.yml",
    "course-project:\n  starter: {path: starter}\n",
  );
  const source =
    `::: {#exr-number project=project/input.qmd}\n## Число\n\nУсловие.\n\n~~~{.yaml .answer-spec}\n${yaml}\n~~~\n:::\n\n::: {#exr-choice project=project/input.qmd}\n## Выбор\n\n::: {.answer type=single-choice}\n- [Первый]{.correct}\n- Второй\n:::\n:::\n\n::: {#exr-parts project=project/input.qmd}\n## Части\n\n~~~{.yaml .answer-spec}\ntype: multipart\nparts:\n  - {name: cost, label: Цена, type: numeric, key: {value: 18273.25, tolerance: {absolute: 0.125}}}\n  - {name: explanation, label: Причина, type: manual, submission: text}\n~~~\n:::\n\n::: {#exr-matching project=project/input.qmd}\n## Сопоставление\n\n~~~{.yaml .answer-spec}\ntype: matching\nprompts: [Процесс, Поток]\noptions: [Свой, Общий, Лишний]\nkey: {pairs: {Процесс: Свой, Поток: Общий}}\n~~~\n:::\n\n::: {#exr-private project=project/input.qmd statement-visibility=restricted}\n## Закрыто\n\nRESTRICTED_CONDITION\n\n~~~{.yaml .answer-spec}\ntype: manual\nsubmission: text\n~~~\n:::\n`;
  await put("index.qmd", source);
  const render = async () => {
    const result = await new Deno.Command("quarto", {
      args: ["render", "--profile", "qualified", "--to", "html"],
      cwd: root,
      env: {
        DENO_NO_PACKAGE_JSON: "1",
        QUARTO_RUN_NO_NETWORK: "true",
        CUE: "/nonexistent-a4b-cue",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const log = new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr);
    await Deno.writeTextFile(
      join(root, "_generated/qualification-render.log"),
      log,
    );
    return { result, log };
  };
  const { result, log } = await render();
  check(
    projection + ": actual-native",
    result.success || (console.error(log), false),
  );
  const expectation = {
    root,
    profiles: ["qualified"],
    projection,
    outputDirectory: join(root, "_site"),
  };
  let captured: Core.NativeAdapterValidationInput | undefined;
  const a: Core.NativeAdapterValidator = {
    name: "adapter-a",
    nativeMetadataReadSet: ["configuration"],
    validate(input) {
      const config = input.nativeMetadata.values.configuration as any;
      if (
        config?.["question-defaults"]?.submission !== "editor" ||
        config.inherited !== "directory" || config.list.join(",") !== "one,two"
      ) throw Error("Native config inheritance");
      for (const d of input.declarations) {
        const answer = Core.AnswerFactsSchema.parse(d.answer);
        if (
          d.id === "exr-number" &&
          (answer.type !== "numeric" || answer.key.value !== 18273.25)
        ) throw Error("Numeric semantics lost");
        if (
          d.id === "exr-choice" &&
          (answer.type !== "single-choice" || answer.correct !== 0 ||
            answer.count !== 2)
        ) throw Error("Choice semantics lost");
      }
      captured = input;
      return { sources: [{ path: "project", kind: "directory" }] };
    },
  };
  const b: Core.NativeAdapterValidator = {
    name: "adapter-b",
    nativeMetadataReadSet: ["configuration"],
    validate(input) {
      if (
        Object.hasOwn(input.nativeMetadata.values, "configuration") ||
        input.declarations.length
      ) throw Error("Foreign metadata leak");
      return { sources: [] };
    },
  };
  let escaped: Core.NativeOperation | undefined;
  await Core.withCurrentNativeOperation(expectation, async (op) => {
    escaped = op;
    const proof = await op.validateRelease({ expectedSources: ["index.qmd"] }, [
      a,
      b,
    ]);
    check(
      projection + ": callback-origin",
      captured?.origin.operation === op.identity.operation &&
        captured.origin.projection === projection &&
        captured.origin.profiles[0] === "qualified",
    );
    check(
      projection + ": closed-not-in-proof",
      !JSON.stringify(proof).includes("18273.25") &&
        !JSON.stringify(proof).includes("configuration"),
    );
    const document = op.document({ source: "index.qmd" });
    const condition = op.condition({
      source: "index.qmd",
      exerciseId: "exr-number",
      view: projection,
    });
    const publicValue = JSON.stringify({
      catalog: op.catalog,
      document,
      condition,
    });
    check(
      projection + ": no-answer-key-or-metadata-leak",
      !publicValue.includes("18273.25") && !publicValue.includes("correct") &&
        !publicValue.includes("NEVER_ALL_NAMESPACE") &&
        !publicValue.includes("question-defaults"),
    );
    check(
      projection + ": restricted-only-author",
      JSON.stringify(document).includes("RESTRICTED_CONDITION") ===
        (projection === "author"),
    );
    check(
      projection + ": immutable-native-config",
      Object.isFrozen(captured) &&
        Object.isFrozen(captured!.nativeMetadata.values.configuration),
    );
    const before = op.metrics;
    for (let n = 0; n < 10; n++) {
      op.document({ source: "index.qmd" });
      op.condition({
        source: "index.qmd",
        exerciseId: "exr-choice",
        view: projection,
      });
    }
    check(
      projection + ": getter-no-io",
      JSON.stringify(before) === JSON.stringify(op.metrics),
    );
  });
  let error = "";
  try {
    await escaped!.validateRelease({ expectedSources: ["index.qmd"] }, [a, b]);
  } catch (e) {
    error = String(e);
  }
  check(projection + ": expired-refusal", error.includes("OPERATION_EXPIRED"));
  const html = await Deno.readTextFile(join(root, "_site/index.html"));
  check(
    projection + ": html-no-closed-key",
    !html.includes("18273.25") && !html.includes("answer-spec") &&
      !html.includes('class="correct"'),
  );
  const settings = await Deno.readTextFile(join(root, "settings.yml"));
  let drift = "";
  try {
    await Core.withCurrentNativeOperation(expectation, async (op) => {
      await op.validateRelease({ expectedSources: ["index.qmd"] }, [a, b]);
      await Deno.writeTextFile(
        join(root, "settings.yml"),
        settings + "\nchanged: true\n",
      );
    });
  } catch (e) {
    drift = String(e);
  }
  check(
    projection + ": native-config-source-drift-refused",
    drift.includes("OPERATION_CHANGED"),
  );
  await Deno.writeTextFile(join(root, "settings.yml"), settings);
  // Новый restricted invalid answer обязан остановить producer до audience projection.
  await put(
    "index.qmd",
    source.replace("submission: text", "submission: unsupported"),
  );
  const negative = await render();
  check(
    projection + ": restricted-invalid-before-projection",
    !negative.result.success && negative.log.includes("ANSWER_INVALID"),
  );
  console.log(JSON.stringify({ projection, root }));
}
console.log(JSON.stringify({ status: "PASS", checks }));
