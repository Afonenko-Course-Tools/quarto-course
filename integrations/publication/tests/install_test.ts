// Genuine passive quarto add and installed callback loading; no native render.
import { dirname, fromFileUrl, join, toFileUrl } from "stdlib/path";
import { assert, assertEquals, assertRejects } from "./assert.ts";
const distribution = fromFileUrl(new URL("../", import.meta.url));
const payload = join(distribution, "_extensions/course-publication");
async function files(
  root: string,
): Promise<
  Record<string, { sha256: string; bytes: number; mode: number | null }>
> {
  const entries: Record<
    string,
    { sha256: string; bytes: number; mode: number | null }
  > = Object.create(null);
  async function visit(directory: string, prefix = "") {
    for await (const entry of Deno.readDir(directory)) {
      const path = join(directory, entry.name),
        name = prefix + entry.name,
        info = await Deno.lstat(path);
      assert(!info.isSymlink, `linked payload: ${name}`);
      if (info.isDirectory) await visit(path, name + "/");
      else {
        assert(info.isFile, `non-file payload: ${name}`);
        const bytes = await Deno.readFile(path);
        entries[name] = {
          sha256: [
            ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          ].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
          bytes: bytes.length,
          mode: info.mode === null ? null : info.mode & 0o777,
        };
      }
    }
  }
  await visit(root);
  return Object.fromEntries(
    Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)),
  );
}
for (const layout of ["short", "organization"]) {
  Deno.test(`whole passive install and public callback surface (${layout} layout)`, async () => {
    const root = await Deno.makeTempDir({ prefix: "publication-add-" });
    try {
      const config = "project:\n  type: website\nformat: html\n";
      await Deno.writeTextFile(join(root, "_quarto.yml"), config);
      const quarto = Deno.env.get("QUARTO") || "quarto";
      const result = await new Deno.Command(quarto, {
        cwd: root,
        args: ["add", distribution, "--no-prompt"],
        stdout: "piped",
        stderr: "piped",
      }).output();
      assert(
        result.success,
        new TextDecoder().decode(result.stdout) +
          new TextDecoder().decode(result.stderr),
      );
      let installed = join(root, "_extensions/course-publication");
      if (layout === "organization") {
        // Local add uses short paths. Move its complete unchanged directory to
        // the documented GitHub organization layout; no partial payload edits.
        const namespaced = join(root, "_extensions/org/course-publication");
        await Deno.mkdir(dirname(namespaced), { recursive: true });
        await Deno.rename(installed, namespaced);
        installed = namespaced;
      }
      assertEquals(await files(installed), await files(payload));
      assertEquals(await Deno.readTextFile(join(root, "_quarto.yml")), config);
      assertEquals(
        [...Deno.readDirSync(root)].map((entry) => entry.name).sort(),
        [".quarto", "_extensions", "_quarto.yml"],
      );
      const publicApi = await import(
        toFileUrl(join(installed, "publication.ts")).href
      );
      assertEquals(Object.keys(publicApi).sort(), [
        "finish",
        "metadata",
        "prepare",
        "readPublicationStatus",
        "verify",
      ]);
      const prepare = (await import(
        toFileUrl(join(installed, "entrypoints/prepare.ts")).href
      )).default;
      assertEquals(Object.keys(prepare).sort(), ["beforeRender", "metadata"]);
      for (const leaf of ["finish", "verify"]) {
        assertEquals(
          Object.keys(
            (await import(
              toFileUrl(join(installed, `entrypoints/${leaf}.ts`)).href
            )).default,
          ),
          ["finalize"],
        );
      }
      // An installed adapter without its explicitly selected Core cannot prepare.
      const extension = layout === "short"
        ? "_extensions/course-core"
        : "_extensions/org/course-core";
      const ctx = {
        root,
        sourceRoot: root,
        attemptId: "missing-core",
        profiles: ["student"],
        config: {
          "course-publication": {
            "owned-members": [],
            "core-extension": extension,
          },
        },
        members: [],
        portal: {
          input: join(root, "index.qmd"),
          output: join(root, "native"),
          renderProfiles: ["student", "publish-portal"],
          control: join(root, "_quarto-publish-portal.yml"),
          controlHash: "a".repeat(64),
          configHashes: {},
        },
      };
      await assertRejects(
        () => prepare.beforeRender(ctx),
        Error,
        "COURSE_PUBLICATION.CORE_REQUIRED",
      );
      assertEquals(await Deno.readTextFile(join(root, "_quarto.yml")), config);
      const installedSources = await files(installed);
      assert(
        !Object.keys(installedSources).some((path) =>
          path.includes("test") || path.includes("fixture")
        ),
        "tests/fixtures stay outside installed payload",
      );
    } finally {
      await Deno.remove(root, { recursive: true });
    }
  });
}
