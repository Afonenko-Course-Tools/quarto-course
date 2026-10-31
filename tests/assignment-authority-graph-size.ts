import { createHash } from "node:crypto";
import { toFileUrl } from "stdlib/path";
const core = new URL("../_extensions/course-core/", import.meta.url),
  text = await Deno.readTextFile(
    new URL("runtime/assignment-authority.ts", core),
  ),
  start = text.indexOf("const sha ="),
  end = text.indexOf("export const AssignmentAuthorityIdentitySchema"),
  modulePath = await Deno.makeTempFile({
    prefix: "authority-size-schema-",
    suffix: ".ts",
  });
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
assert(start >= 0 && end > start, "Private schema extraction boundary changed");
const segment = text.slice(start, end),
  shaText = (v: string) => createHash("sha256").update(v).digest("hex");
await Deno.writeTextFile(
  modulePath,
  `import {z} from ${
    JSON.stringify(new URL("vendor/zod/v4/index.js", core).href)
  };\nimport {resolve} from "stdlib/path";\nimport {AssignmentProducerProfileSchema} from ${
    JSON.stringify(
      new URL("runtime/assignment-producer-profiles.ts", core).href,
    )
  };\n` + segment + "\nexport {E,M};\n",
);
try {
  const { E, M } = await import(toFileUrl(modulePath).href),
    rows: any[] = [],
    expected = [
      {
        path: "/opt/quarto/bin/tools/x86_64/deno",
        size: 124242912,
        sha256:
          "83ae80d34812cb7a4f246a21f707901b71fa937461500f5f0a2e19865115f3fb",
      },
      {
        path: "/opt/quarto/bin/tools/x86_64/pandoc",
        size: 162316016,
        sha256:
          "8fedc028b2314cd649b6cabf363c94a7c940aff352a1c20753ffb0875f083cac",
      },
      {
        path: "/opt/quarto/bin/quarto",
        size: 8061,
        sha256:
          "72632b5b855ffec9db28a098cf62b9b83a80c57174bfa733b2b399a7bdef037f",
      },
    ];
  const signature = (s: Deno.FileInfo) =>
    JSON.stringify([
      s.dev,
      s.ino,
      s.mode,
      s.size,
      s.mtime?.getTime(),
      s.ctime?.getTime(),
      s.isFile,
      s.isSymlink,
    ]);
  for (const frozen of expected) {
    const before = await Deno.lstat(frozen.path);
    assert(before.isFile && !before.isSymlink, "Nonregular actual binary");
    const file = await Deno.open(frozen.path),
      hash = createHash("sha256"),
      buffer = new Uint8Array(1024 * 1024);
    let bytes = 0;
    try {
      while (true) {
        const n = await file.read(buffer);
        if (n === null) break;
        bytes += n;
        hash.update(buffer.subarray(0, n));
      }
    } finally {
      file.close();
    }
    const sha256 = hash.digest("hex");
    assert(
      signature(before) === signature(await Deno.lstat(frozen.path)),
      "Actual binary changed during hash",
    );
    assert(
      before.size === frozen.size && bytes === frozen.size &&
        sha256 === frozen.sha256,
      "Exact actual inventory changed " + frozen.path,
    );
    rows.push({
      path: frozen.path,
      size: bytes,
      sha256,
      mode: before.mode! & 0o777,
    });
  }
  const sha = "a".repeat(64),
    documentMax = 64 * 1024 * 1024,
    graphMax = 256 * 1024 * 1024,
    base = {
      schema: "course-assignment-authority-anchor-v1",
      epoch: "schema-only-no-authority",
      root: "/own-capsule",
      manifest: { sha256: sha, size: 1 },
      graph: { files: [rows[2]], directories: [], absent: [] },
      launches: [{
        entrypoint: "file:///own-entry.ts",
        executable: rows[0].path,
        cwd: "/own-owner",
        arguments: [],
        runtimeArguments: [],
        environment: {},
      }],
    },
    manifest = {
      schema: "course-assignment-authority-manifest-v1",
      epoch: base.epoch,
      files: ["anchor.json", "manifest.json", "profiles.json"],
      mode: 292,
      profiles: { sha256: sha, size: 1 },
    };
  const actual = rows.map((row) => ({
    path: row.path,
    size: row.size,
    success:
      E.safeParse({ ...base, graph: { ...base.graph, files: [row] } }).success,
  }));
  console.log(JSON.stringify({
    scope:
      "exact inert private E/M schema extraction; real stat/fullSHA; no capsule/P/admission/child",
    sourceSHA256: shaText(text),
    segmentSHA256: shaText(segment),
    actualFiles: rows,
    actual,
  }));
  assert(
    actual.every((row) => row.success),
    "ACTUAL_RUNTIME_GRAPH_SIZE_REFUSED",
  );
  const badGraph = [
      0,
      -1,
      1.25,
      NaN,
      Infinity,
      -Infinity,
      graphMax + 1,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER + 1,
      "162316016",
      null,
      undefined,
    ],
    badDocument = [
      0,
      -1,
      1.25,
      NaN,
      Infinity,
      documentMax + 1,
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER + 1,
      "1",
      null,
      undefined,
    ];
  for (const size of badGraph) {
    assert(
      !E.safeParse({
        ...base,
        graph: { ...base.graph, files: [{ ...rows[2], size }] },
      }).success,
      "Invalid graph size accepted " + String(size),
    );
  }
  for (const size of badDocument) {
    assert(
      !E.safeParse({ ...base, manifest: { sha256: sha, size } }).success,
      "Invalid E document digest accepted",
    );
    assert(
      !M.safeParse({ ...manifest, profiles: { sha256: sha, size } }).success,
      "Invalid M document digest accepted",
    );
  }
  assert(
    E.safeParse({
      ...base,
      graph: { ...base.graph, files: [{ ...rows[2], size: graphMax }] },
    }).success,
    "Finite graph boundary refused",
  );
  assert(
    E.safeParse({ ...base, manifest: { sha256: sha, size: documentMax } })
      .success &&
      M.safeParse({ ...manifest, profiles: { sha256: sha, size: documentMax } })
        .success,
    "Document boundary changed",
  );
  for (
    const mutant of [{ ...base, extra: true }, {
      ...base,
      graph: { ...base.graph, extra: true },
    }, {
      ...base,
      graph: { ...base.graph, files: [{ ...rows[2], extra: true }] },
    }, { ...base, manifest: { ...base.manifest, extra: true } }]
  ) assert(!E.safeParse(mutant).success, "Unknown field accepted");
  assert(
    !M.safeParse({
      ...manifest,
      profiles: { ...manifest.profiles, extra: true },
    }).success,
    "Unknown digest field accepted",
  );
  console.log(JSON.stringify({
    graphMax,
    documentMax,
    invalidGraphSizes: badGraph.length,
    invalidDocumentSizesEach: badDocument.length,
    unknownFieldControls: 5,
    nativeChildCount: 0,
    authorityCreated: false,
  }));
  console.log(
    "PASS actual Deno/Pandoc/Quarto graph rows; graph256MiB/document64MiB distinct; malformed/overflow/unknown fields refused; no P/authority/admission",
  );
} finally {
  await Deno.remove(modulePath);
}
