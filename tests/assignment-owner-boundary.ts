// Чистые existing owner guards: без native inspect, snapshot, render или чтения bytes.
import { CoreContractError } from "../_extensions/course-core/contracts/project.ts";
import {
  bindOwner,
  decodeNativeOwnerInspection,
} from "../_extensions/course-core/runtime/operation.ts";
const root = "/owner";
function observed() {
  return {
    dir: root,
    quarto: { version: "1.11.5", extra: "сохранить" },
    config: {
      "course-core-runtime": "native-ts",
      "course-core-projection": "author",
      "course-core-source-policy": "static",
      course: { view: "full", extra: { arbitrary: [1, null] } },
      project: { "output-dir": "_site" },
      extension: { arbitrary: [1, null, { nested: "данные" }] },
    },
    files: {
      input: [root + "/index.qmd"],
      config: [],
      resource: ["extra.txt"],
    },
    engines: ["markdown"],
    fileInformation: {
      "index.qmd": {
        includeMap: [],
        codeCells: [{ language: "mermaid" }],
        metadata: { arbitrary: { nested: "метаданные" } },
      },
    },
    extensions: [{ arbitrary: "полный payload" }],
  };
}
function state(): Parameters<typeof bindOwner>[0] {
  return {
    schema: "course-native-operation-private-v2",
    operation: "1d15846a-d704-4ecd-80d8-711fb69f9a58",
    root,
    directory: root + "/_generated/generation",
    outputDirectory: root + "/_site",
    profiles: ["full"],
    projection: "author",
    captureWitnesses: {},
    invocation: "",
    localInvocation: "",
    inputs: ["index.qmd"],
    sourcePolicy: "general",
    relevantInputs: [],
    ownerInputs: [],
    configurationInputs: [],
    documentInputs: {},
    memberships: {},
    rows: [{ path: "index.qmd", signature: "not-read", sha256: "not-read" }],
    metrics: {
      inspectCalls: 0,
      fullSourceFences: 0,
      localSourceFences: 0,
      sourceDirectoryReads: 0,
      runtimeHashReads: 0,
      runtimeHashBytes: 0,
      runtimePathReads: 0,
      runtimeDirectoryReads: 0,
      outputHashReads: 0,
      nativeMetadataBytes: 0,
      childRenders: 0,
      fullWalks: 0,
      sourceHashReads: 0,
      sourceHashBytes: 0,
      resourceHashReads: 0,
      nativeResourceHashReads: 0,
    },
  };
}
function rejected(name: string, value: unknown, code: string) {
  let error: unknown;
  try {
    bindOwner(state(), decodeNativeOwnerInspection(value, root), true);
  } catch (cause) {
    error = cause;
  }
  if (!(error instanceof CoreContractError) || error.code !== code) {
    throw Error(name + ": " + String(error));
  }
}
const raw = observed(), owner = decodeNativeOwnerInspection(raw, root);
if (JSON.stringify(owner) !== JSON.stringify(raw)) {
  throw Error("Урезан inspect payload");
}
const bound = state();
bindOwner(bound, owner, true);
if (
  bound.projection !== "author" || bound.sourcePolicy !== "static" ||
  bound.ownerInputs[0] !== "index.qmd" ||
  JSON.stringify(bound.ownerWitness?.config) !== JSON.stringify(raw.config)
) throw Error("Потеря owner binding/config metadata");
for (
  const [name, value, code] of [
    ["null owner", null, "OPERATION_BINDING"],
    ["array owner", [], "OPERATION_BINDING"],
    ["missing files", { ...raw, files: null }, "OPERATION_BINDING"],
    [
      "nonstring input",
      { ...raw, files: { input: [12] } },
      "OPERATION_BINDING",
    ],
    ["missing inputs", { ...raw, files: {} }, "OPERATION_BINDING"],
    ["nonstring config", {
      ...raw,
      files: { input: raw.files.input, config: [12] },
    }, "OPERATION_BINDING"],
    ["empty inputs", { ...raw, files: { input: [] } }, "OPERATION_BINDING"],
    ["duplicate inputs", {
      ...raw,
      files: { input: [...raw.files.input, ...raw.files.input] },
    }, "OPERATION_BINDING"],
    [
      "outside inputs",
      { ...raw, files: { input: ["/other/input.qmd"] } },
      "OPERATION_BINDING",
    ],
    [
      "old version",
      { ...raw, quarto: { version: "1.10.0" } },
      "OPERATION_UNQUALIFIED",
    ],
    ["wrong dir", { ...raw, dir: "/other" }, "OPERATION_UNQUALIFIED"],
    ["array config", { ...raw, config: [] }, "OPERATION_UNQUALIFIED"],
    ["unknown projection", {
      ...raw,
      config: { ...raw.config, "course-core-projection": "other" },
    }, "OPERATION_UNQUALIFIED"],
    ["view mismatch", {
      ...raw,
      config: { ...raw.config, course: { view: "student" } },
    }, "OPERATION_UNQUALIFIED"],
    ["reservation mismatch", {
      ...raw,
      config: {
        ...raw.config,
        course: { view: "student" },
        "course-core-projection": "student",
      },
    }, "OPERATION_BINDING"],
    ["runtime mismatch", {
      ...raw,
      config: { ...raw.config, "course-core-runtime": "lua" },
    }, "OPERATION_UNQUALIFIED"],
    ["null policy", {
      ...raw,
      config: { ...raw.config, "course-core-source-policy": null },
    }, "OPERATION_SOURCE_POLICY"],
    ["nonstring output", {
      ...raw,
      config: { ...raw.config, project: { "output-dir": 7 } },
    }, "OPERATION_BINDING"],
    [
      "static executable engine",
      { ...raw, engines: ["jupyter"] },
      "OPERATION_SOURCE_POLICY",
    ],
    ["static malformed cell", {
      ...raw,
      fileInformation: {
        "index.qmd": { ...raw.fileInformation["index.qmd"], codeCells: [null] },
      },
    }, "OPERATION_SOURCE_POLICY"],
    ["static format ojs", {
      ...raw,
      config: { ...raw.config, format: [{ "ojs-engine": true }] },
    }, "OPERATION_SOURCE_POLICY"],
    ["missing includeMap", {
      ...raw,
      fileInformation: { "index.qmd": { codeCells: [], metadata: {} } },
    }, "OPERATION_UNQUALIFIED"],
    ["malformed include edge", {
      ...raw,
      fileInformation: {
        "index.qmd": {
          ...raw.fileInformation["index.qmd"],
          includeMap: [null],
        },
      },
    }, "OPERATION_UNQUALIFIED"],
  ] satisfies [string, unknown, string][]
) rejected(name, value, code);
const general = decodeNativeOwnerInspection({
  ...raw,
  config: {
    project: { "output-dir": "_site" },
    extension: raw.config.extension,
  },
  files: { input: raw.files.input },
}, root);
const ordinary = state();
bindOwner(ordinary, general, false);
if (ordinary.projection !== "student" || ordinary.sourcePolicy !== "general") {
  throw Error("Изменены ordinary defaults");
}
console.log(
  "PASS полный owner DTO; malformed/version/input/projection/static/include guards и ordinary defaults",
);
