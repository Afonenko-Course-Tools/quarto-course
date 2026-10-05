// Actual complete Core payload copies; no Core lifecycle or native facts invoked.
import { copy } from "stdlib/fs";
import { fromFileUrl, join } from "stdlib/path";
import { compatiblePackages } from "../_extensions/course-publication/internal/core.ts";
import { composition } from "../_extensions/course-publication/internal/config.ts";
import { assertRejects } from "./assert.ts";
Deno.test("preparation compatibility refuses changed whole Core bytes, modes and file set", async () => {
  const root = await Deno.makeTempDir({ prefix: "publication-core-layout-" });
  try {
    const sourceRoot = join(root, "source"),
      member = join(sourceRoot, "renamed");
    const source = fromFileUrl(
      new URL("../../../_extensions/course-core/", import.meta.url),
    );
    await copy(source, join(sourceRoot, "_extensions/course-core"));
    const installed = join(member, "_extensions/course-core");
    await copy(join(sourceRoot, "_extensions/course-core"), installed);
    const ctx = {
      root: join(root, "coordinator"),
      sourceRoot,
      attemptId: "layout",
      profiles: ["student"],
      config: {
        "course-publication": {
          "owned-members": ["renamed"],
          "core-extension": "_extensions/course-core",
        },
      },
      members: [{
        namespace: "renamed",
        path: member,
        mount: "renamed",
        format: "html",
      }],
      portal: {
        input: join(sourceRoot, "index.qmd"),
        output: join(root, "native"),
        renderProfiles: ["student", "publish-portal"],
        control: join(sourceRoot, "_quarto-publish-portal.yml"),
        controlHash: "a".repeat(64),
        configHashes: {},
      },
    };
    const plan = composition(ctx);
    await compatiblePackages(ctx, plan);
    const file = join(installed, "filter.lua"),
      bytes = await Deno.readFile(file),
      mode = (await Deno.stat(file)).mode! & 0o777;
    await Deno.writeTextFile(file, "changed installation");
    await assertRejects(
      () => compatiblePackages(ctx, plan),
      Error,
      "COURSE_PUBLICATION.CORE_MISMATCH",
    );
    await Deno.writeFile(file, bytes);
    await Deno.chmod(file, mode === 0o600 ? 0o644 : 0o600);
    await assertRejects(
      () => compatiblePackages(ctx, plan),
      Error,
      "COURSE_PUBLICATION.CORE_MISMATCH",
    );
    await Deno.chmod(file, mode);
    for (const name of ["unlisted-runtime.txt", "__proto__"]) {
      const extra = join(installed, name);
      await Deno.writeTextFile(extra, "extra");
      await assertRejects(
        () => compatiblePackages(ctx, plan),
        Error,
        "COURSE_PUBLICATION.CORE_MISMATCH",
      );
      await Deno.remove(extra);
    }
    // Bundled Deno removes this legacy setter. Exercise ordinary JS semantics
    // explicitly in this synthetic manifest test, then restore the global.
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.prototype,
      "__proto__",
    );
    try {
      Object.defineProperty(Object.prototype, "__proto__", {
        configurable: true,
        set(value: object | null) {
          Object.setPrototypeOf(this, value);
        },
      });
      await Deno.writeTextFile(join(installed, "__proto__"), "extra");
      await assertRejects(
        () => compatiblePackages(ctx, plan),
        Error,
        "COURSE_PUBLICATION.CORE_MISMATCH",
      );
      await Deno.remove(join(installed, "__proto__"));
    } finally {
      if (descriptor) {
        Object.defineProperty(Object.prototype, "__proto__", descriptor);
      } else delete (Object.prototype as Record<string, unknown>)["__proto__"];
    }
    await compatiblePackages(ctx, plan);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
