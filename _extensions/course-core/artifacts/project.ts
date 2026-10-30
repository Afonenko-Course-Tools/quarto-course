import { dirname, join, relative, resolve } from "stdlib/path";
import { boundInput, fail } from "../contracts/project.ts";
import {
  assertProjectContext,
  projectContextFiles,
  readProjectContextFile,
} from "../infrastructure/project-context.ts";
import { quartoExecutable } from "../infrastructure/process.ts";
import { boundDocument, decode } from "../document/contracts.ts";
import {
  ArtifactDestinationSchema,
  ArtifactInventorySchema,
  ArtifactTargetSchema,
  ArtifactWriteResultSchema,
  MaterializationBindingsSchema,
  ResolvedConditionSchema,
} from "./contracts.ts";
import type {
  ArtifactFile,
  ArtifactInventory,
  ArtifactWriteResult,
  MaterializationBindings,
  ProjectPlan,
  ResolvedCondition,
} from "./contracts.ts";
import { projectPlanState } from "./plan.ts";
import type { PlanState } from "./plan.ts";
import { absent, hash, inside, real, safeParent } from "./files.ts";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const excluded = new Set([
  ".git",
  ".gradle",
  ".quarto",
  "_generated",
  "node_modules",
  "build",
  "target",
  "out",
  "__pycache__",
]);
const privateNames = new Set([
  "private",
  "reference",
  "solution",
  "solutions",
  "grading-notes",
  "rubric.md",
  "contract.md",
]);
function cloneInventory(value: ArtifactInventory): ArtifactInventory {
  return {
    ...value,
    files: value.files.map((f) => ({ ...f, bytes: new Uint8Array(f.bytes) })),
  };
}
async function pandoc(
  state: PlanState,
  from: string,
  to: string,
  input: string,
) {
  state.metrics.pandocCalls++;
  const child = new Deno.Command(quartoExecutable(), {
    args: ["pandoc", "--from", from, "--to", to, "--wrap=none"],
    cwd: state.context.owner,
    env: { QUARTO_RUN_NO_NETWORK: "true" },
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const writer = child.stdin.getWriter();
  await writer.write(encoder.encode(input));
  await writer.close();
  const result = await child.output();
  if (!result.success) {
    fail("CONDITION_WRITER", "Native Pandoc " + decoder.decode(result.stderr));
  }
  if (result.stdout.length > 16 * 1024 * 1024) {
    fail("CONDITION_LIMIT", "Слишком большой writer output");
  }
  return decoder.decode(result.stdout);
}
/** One writer for the complete late condition and every origin-bearing fragment. */
export async function materializeProject(
  plan: ProjectPlan,
  conditionValue: ResolvedCondition,
  bindingsValue: MaterializationBindings,
): Promise<ArtifactInventory> {
  const state = await projectPlanState(plan), context = state.context;
  boundDocument(conditionValue);
  boundInput(bindingsValue);
  const condition = decode(
    ResolvedConditionSchema,
    conditionValue,
    "CONDITION_CONTRACT",
  );
  const bindings = decode(
    MaterializationBindingsSchema,
    bindingsValue,
    "ARTIFACT_BINDINGS",
  );
  if (
    context.format !== condition.context.format ||
    condition.view !== condition.context.projection ||
    (plan.audience === "student" && condition.view !== "student")
  ) fail("CONDITION_BINDING", "Condition/project format/projection отличаются");
  if (condition.context.format !== "html" || condition.view !== "student") {
    fail(
      "CONDITION_UNQUALIFIED",
      "Native condition materialization квалифицирована только для HTML/student",
    );
  }

  // The code-project identity must be the actual exercise declaration binding.
  const conditionSource = resolve(condition.context.input);
  if (!inside(context.owner, conditionSource)) {
    fail("CONDITION_BINDING", "Condition input вне owner");
  }
  const declaredProject = condition.project
    ? resolve(
      condition.project.startsWith("/")
        ? context.owner
        : dirname(conditionSource),
      condition.project.replace(/^\//, ""),
    )
    : undefined;
  if (
    !declaredProject ||
    (declaredProject !== context.input &&
      declaredProject !== dirname(context.input))
  ) fail("CONDITION_BINDING", "Condition ссылается на другой code-project");
  const key = JSON.stringify({ condition, bindings });
  const cached = state.cache.get(key);
  if (cached) {
    state.metrics.cacheHits++;
    await assertProjectContext(context);
    return cloneInventory(cached);
  }
  state.metrics.fileReads++;
  await readProjectContextFile(context, conditionSource);
  const files = new Map<string, ArtifactFile>();
  const provenance = new Map<string, string>();
  const add = async (
    target: string,
    bytes: Uint8Array,
    reason: string,
    source?: string,
  ) => {
    decode(ArtifactTargetSchema, target, "ARTIFACT_CONTRACT");
    if (
      plan.audience === "student" &&
      target.split("/").some((p) => privateNames.has(p))
    ) fail("ARTIFACT_PRIVATE", "Закрытый target partition в student");
    if (files.size >= 4096 || bytes.length > 128 * 1024 * 1024) {
      fail("ARTIFACT_LIMIT", "Превышен лимит файлов/байтов");
    }
    if (
      files.has(target) ||
      [...files.keys()].some((p) =>
        p.startsWith(target + "/") || target.startsWith(p + "/")
      )
    ) fail("ARTIFACT_COLLISION", "Два владельца target " + target);
    state.metrics.hashReads++;
    files.set(target, {
      target,
      bytes: new Uint8Array(bytes),
      size: bytes.length,
      sha256: await hash(bytes),
      audience: plan.audience,
      reason,
    });
    if (source) provenance.set(target, source);
  };
  const read = async (path: string) => {
    if (
      plan.audience === "student" &&
      relative(context.owner, path).split("/").some((p) => privateNames.has(p))
    ) fail("ARTIFACT_PRIVATE", "Закрытый source partition в student");
    state.metrics.fileReads++;
    return await readProjectContextFile(context, path);
  };
  for (const file of state.files) {
    await add(file.target, await read(file.path), file.reason, file.path);
  }
  for (const tree of state.trees) {
    if (
      plan.audience === "student" &&
      relative(context.owner, tree.path).split("/").some((p) =>
        privateNames.has(p)
      )
    ) fail("ARTIFACT_PRIVATE", "Закрытый source partition в student");
    const paths = await projectContextFiles(context, tree.path);
    for (const path of paths) {
      const name = relative(tree.path, path), parts = name.split("/");
      if (path === state.local && name === "README.md") continue;
      if (parts.some((p) => privateNames.has(p))) {
        fail("ARTIFACT_PRIVATE", "Закрытый partition внутри выдаваемого tree");
      }
      if (
        parts.some((p) =>
          excluded.has(p) || p.startsWith(".") && p !== ".gitignore"
        )
      ) continue;
      if (
        /\.(qmd|rmd|ipynb|class|jar|pyc)$/i.test(name) ||
        parts.some((p) => /^_quarto|^_metadata\.ya?ml$/.test(p))
      ) continue;
      await add(tree.prefix + name, await read(path), tree.reason, path);
    }
  }
  const resources = new Map<string, string>();
  const anchors = new Set<string>();
  const localLinks = new Set<string>();
  const mapUrl = async (
    url: string,
    base: string | undefined,
    image: boolean,
  ): Promise<string> => {
    if (url.startsWith("#")) {
      localLinks.add(url.slice(1));
      return url;
    }
    if (!image && Object.hasOwn(bindings.links, url)) {
      return checkedLink(bindings.links[url]);
    }
    if (/^(https?:|mailto:)/.test(url) && !image) return checkedLink(url);
    if (!base) {
      fail(
        "FRAGMENT_BASE",
        "Для относительной ссылки фрагмента нужна явная база: " + url,
      );
    }
    if (/[?#]/.test(url)) {
      fail(
        "RESOURCE_MISSING",
        "Для ссылки с query/anchor нужен явный link binding: " + url,
      );
    }
    const expected = resolve(dirname(base), url);
    if (!inside(context.owner, expected)) {
      fail("RESOURCE_PATH", "Resource выходит из owner: " + url);
    }
    const canonical = relative(context.owner, expected);
    const resource = bindings.resources[canonical] ?? bindings.resources[url];
    if (!resource) {
      fail("RESOURCE_MISSING", "Нет конечного binding ресурса: " + canonical);
    }
    const path = resolve(context.owner, resource.path);
    if (path !== expected) {
      fail(
        "RESOURCE_BASE",
        "Binding не соответствует собственной базе фрагмента: " + canonical,
      );
    }
    const previous = resources.get(resource.target);
    if (previous && previous !== path) {
      fail(
        "ARTIFACT_COLLISION",
        "Resource target имеет разные origins: " + resource.target,
      );
    }
    if (!previous) {
      resources.set(resource.target, path);
      if (files.has(resource.target)) {
        if (provenance.get(resource.target) !== path) {
          fail(
            "ARTIFACT_COLLISION",
            "Resource target уже принадлежит другому source: " +
              resource.target,
          );
        }
      } else {await add(
          resource.target,
          await read(path),
          "condition-resource",
          path,
        );}
    }
    return resource.target;
  };
  function checkedLink(url: string) {
    if (url.startsWith("#")) {
      localLinks.add(url.slice(1));
      return url;
    }
    if (/^(https?:|mailto:)/.test(url) && !/[\u0000-\u0020<>]/.test(url)) {
      return url;
    }
    if (
      url.startsWith("#") ||
      (!url.startsWith("/") && !/[\\\0:\u0000-\u0020<>]/.test(url) &&
        !url.split("/").some((p) => p === ".." || p === "."))
    ) return url;
    fail("CONDITION_LINK", "Недопустимый конечный link target");
  }
  const transform = async (
    value: any,
    base: string | undefined,
  ): Promise<any> => {
    if (Array.isArray(value)) {
      const out = [];
      for (const v of value) out.push(await transform(v, base));
      return out;
    }
    if (!value || typeof value !== "object") return value;
    if (typeof value.t === "string" && value.t.startsWith("Raw")) {
      // Native figure wrappers have no independent URLs and remain ordinary late AST.
      if (
        value.c?.[0] !== "html" ||
        !/^<\/?(?:figure|figcaption|div|span|i|b|em|strong|br)(?:\s+(?:class|aria-hidden|role)="[^"<>]*")*\s*\/?>$/
          .test(value.c[1])
      ) {
        fail(
          "CONDITION_UNQUALIFIED",
          "Непереносимый raw/native node: " + value.t,
        );
      }
    }
    const result: any = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = await transform(v, base);
    }
    if (result.t === "Link" || result.t === "Image") {
      result.c[2][0] = await mapUrl(result.c[2][0], base, result.t === "Image");
    }
    if (["Header", "Div", "Span", "CodeBlock"].includes(result.t)) {
      const attr = result.t === "Header" ? result.c[1] : result.c[0];
      if (Array.isArray(attr) && typeof attr[0] === "string" && attr[0]) {
        if (!attr[0] || /[\u0000-\u0020'"<>&]/u.test(attr[0])) {
          fail("CONDITION_ANCHOR", "Непереносимый anchor");
        }
        if (anchors.has(attr[0])) {
          fail("CONDITION_ANCHOR", "Повторный anchor " + attr[0]);
        }
        anchors.add(attr[0]);
        // Explicit anchors survive Pandoc GFM even when its heading identifier differs.
        const anchor = '<a id="' + attr[0] + '"></a>';
        attr[0] = "";
        if (result.t === "Span") {
          return {
            t: "Span",
            c: [["", [], []], [
              { t: "RawInline", c: ["html", anchor] },
              result,
            ]],
          };
        }
        return {
          t: "Div",
          c: [["", [], []], [{ t: "RawBlock", c: ["html", anchor] }, result]],
        };
      }
    }
    return result;
  };
  const blocks = await transform(condition.body, conditionSource);
  if (condition.anchor) {
    if (
      /[\u0000-\u0020'"<>&]/u.test(condition.anchor) ||
      anchors.has(condition.anchor)
    ) {
      fail(
        "CONDITION_ANCHOR",
        "Некорректный/повторный native occurrence anchor",
      );
    }
    anchors.add(condition.anchor);
    blocks.unshift({
      t: "RawBlock",
      c: ["html", '<a id="' + condition.anchor + '"></a>'],
    });
  }
  const fragment = async (path: string) => {
    const text = decoder.decode(await read(path));
    if (text.includes("{{<") || text.includes("{{%")) {
      fail(
        "CONDITION_UNQUALIFIED",
        "Quarto shortcode в Markdown fragment требует отдельного native разрешения",
      );
    }
    const doc = JSON.parse(await pandoc(state, "markdown", "json", text));
    return await transform(doc.blocks, path);
  };
  blocks.push(...await fragment(state.gradle));
  if (state.local) blocks.push(...await fragment(state.local));
  const submissionDoc = JSON.parse(
    await pandoc(state, "markdown", "json", bindings.submission.instructions),
  );
  blocks.push(
    await transform({
      t: "Header",
      c: [2, ["submission", [], []], [{ t: "Str", c: "Сдача" }]],
    }, undefined),
  );
  blocks.push(
    ...await transform(
      submissionDoc.blocks,
      bindings.submissionBase
        ? resolve(context.owner, bindings.submissionBase)
        : undefined,
    ),
  );
  for (const item of bindings.submission.files) {
    if (item.starterPath && !files.has(item.starterPath)) {
      fail(
        "SUBMISSION_STARTER",
        "Нет реального starter mapping: " + item.starterPath,
      );
    }
    blocks.push({
      t: "Para",
      c: [
        { t: "Code", c: [["", [], []], item.name] },
        ...(item.starterPath
          ? [{ t: "Str", c: " — " }, {
            t: "Code",
            c: [["", [], []], item.starterPath],
          }]
          : []),
      ],
    });
  }
  const gfm = await pandoc(
    state,
    "json",
    "gfm",
    JSON.stringify({
      "pandoc-api-version": condition.pandocApiVersion,
      meta: {},
      blocks,
    }),
  );
  for (const anchor of anchors) {
    if (
      !gfm.includes('id="' + anchor + '"') && !gfm.includes("{#" + anchor + "}")
    ) {
      // Pandoc drops Div/Span attributes in GFM; refusal is safer than a broken link.
      fail("CONDITION_ANCHOR", "GFM writer потерял anchor " + anchor);
    }
  }
  for (const anchor of localLinks) {
    if (!anchors.has(anchor)) {
      fail("CONDITION_ANCHOR", "Не найден anchor конечного README: " + anchor);
    }
  }
  await add(
    "README.md",
    encoder.encode(gfm),
    "resolved-condition+gradle+local+submission",
  );
  for (const group of plan.groups) {
    // Every independent author build gets the same resource closure and one owner-written README.
    for (const [target, path] of resources) {
      const groupTarget = "author/" + group + "/" + target;
      if (files.has(groupTarget)) {
        if (provenance.get(groupTarget) !== path) {
          fail(
            "ARTIFACT_COLLISION",
            "Author resource target принадлежит другому source: " + groupTarget,
          );
        }
        continue;
      }
      await add(
        groupTarget,
        await read(path),
        "condition-resource",
        path,
      );
    }
    await add(
      "author/" + group + "/README.md",
      encoder.encode(gfm),
      "resolved-condition+gradle+local+submission",
    );
  }
  await assertProjectContext(context);
  const inventory = decode(ArtifactInventorySchema, {
    schema: "course-artifact-inventory-v1",
    operation: condition.context.operation,
    exerciseId: condition.exerciseId,
    audience: plan.audience,
    files: [...files.values()].sort((a, b) => a.target.localeCompare(b.target)),
  }, "ARTIFACT_CONTRACT");
  if (state.cache.size >= 16) {
    fail("ARTIFACT_LIMIT", "Не более 16 вариантов на один явный plan");
  }
  state.cache.set(key, cloneInventory(inventory));
  return inventory;
}
/** Final consumer IO boundary accepts the public bytes DTO, not a private receipt. */
export async function writeArtifactInventory(
  value: ArtifactInventory,
  destination: string,
): Promise<ArtifactWriteResult> {
  if (!value || !Array.isArray(value.files) || value.files.length > 4096) {
    fail("ARTIFACT_CONTRACT", "Некорректный inventory");
  }
  const decoded = decode(ArtifactInventorySchema, value, "ARTIFACT_CONTRACT");
  const inventory = cloneInventory(decoded);
  const targets = new Set<string>();
  let total = 0, hashReads = 0;
  for (const file of inventory.files) {
    if (
      file.audience !== inventory.audience || targets.has(file.target) ||
      [...targets].some((t) =>
        t.startsWith(file.target + "/") || file.target.startsWith(t + "/")
      )
    ) fail("ARTIFACT_COLLISION", "Inventory target/audience collision");
    targets.add(file.target);
    total += file.bytes.length;
    if (total > 512 * 1024 * 1024) {
      fail("ARTIFACT_LIMIT", "Inventory превышает лимит");
    }
    hashReads++;
    if (
      file.size !== file.bytes.length || await hash(file.bytes) !== file.sha256
    ) {
      fail(
        "ARTIFACT_DIGEST",
        "Inventory bytes/digest отличаются: " + file.target,
      );
    }
  }
  const output = resolve(
    decode(ArtifactDestinationSchema, destination, "ARTIFACT_OUTPUT"),
  );
  await safeParent(output);
  if (!await absent(output)) {
    fail("ARTIFACT_OUTPUT", "Выходной каталог должен быть новым");
  }
  await Deno.mkdir(dirname(output), { recursive: true });
  await real(dirname(output));
  await Deno.mkdir(output);
  try {
    for (const file of inventory.files) {
      const path = join(output, file.target);
      await Deno.mkdir(dirname(path), { recursive: true });
      await Deno.writeFile(path, file.bytes, { createNew: true });
    }
  } catch (error) {
    await Deno.remove(output, { recursive: true });
    throw error;
  }
  return ArtifactWriteResultSchema.parse({
    files: inventory.files.length,
    bytes: total,
    hashReads,
  });
}
