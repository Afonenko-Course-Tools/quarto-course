import { dirname, fromFileUrl, join } from "stdlib/path";
import {
  prepareNavigationOwner,
  type NavigationSelection,
} from "../_extensions/course-core/owner-preflight/navigation.ts";

// A reduced excluded-document envelope can name a subdirectory of its actual
// native project. Requiring equality here rejects a genuine dormant Book.
const repo = dirname(dirname(fromFileUrl(import.meta.url)));
const quarto = Deno.env.get("QUARTO") || "quarto";
const evidence = Deno.env.get("DORMANT_NAVIGATION_TEST_OUTPUT") ||
  await Deno.makeTempDir({ prefix: "dormant-navigation-context-" });
await Deno.mkdir(evidence, { recursive: true });
const observations: Record<string, unknown>[] = [];
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function command(root: string, args: string[]) {
  const result = await new Deno.Command(quarto, {
    args,
    cwd: root,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const stdout = new TextDecoder().decode(result.stdout);
  const stderr = new TextDecoder().decode(result.stderr);
  assert(result.code === 0, `${args.join(" ")}: ${stdout}${stderr}`);
  return stdout;
}
async function inspect(path: string) {
  return JSON.parse(await command(dirname(path), [
    "inspect",
    path,
    "--profile",
    "student",
  ]));
}
async function hash(path: string) {
  return [...new Uint8Array(
    await crypto.subtle.digest("SHA-256", await Deno.readFile(path)),
  )].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function fixture(name: string) {
  const root = join(evidence, name);
  await Deno.mkdir(root);
  await command(root, ["add", repo, "--no-prompt"]);
  const write = async (path: string, text: string) => {
    await Deno.mkdir(dirname(join(root, path)), { recursive: true });
    await Deno.writeTextFile(join(root, path), text);
  };
  await write(
    "_quarto.yml",
    "project:\n  type: website\n  output-dir: .project-publish/native\n  render: []\n  resources: [public.txt, '!active/**', '!examples/**', '!_partials/**']\n  pre-render: _extensions/course-core/entrypoints/owner-freeze.ts\nformat:\n  html:\n    theme: none\nfilters: [course-core]\ncourse:\n  id: dormant-native-context\n",
  );
  await write("_quarto-student.yml", "course:\n  view: student\n");
  await write(
    "_quarto-publish-portal.yml",
    "project:\n  render: [index.qmd]\n",
  );
  await write("index.qmd", "# Portal {#sec-portal}\n\n[Current](public.txt)\n");
  await write("public.txt", "CURRENT_RESOURCE\n");
  const portal: NavigationSelection = {
    input: join(root, "index.qmd"),
    output: join(evidence, `${name}-output`),
    renderProfiles: ["student", "publish-portal"],
    control: join(root, "_quarto-publish-portal.yml"),
    controlHash: await hash(join(root, "_quarto-publish-portal.yml")),
    configHashes: Object.fromEntries(await Promise.all(
      ["_quarto.yml", "_quarto-student.yml", "_quarto-publish-portal.yml"]
        .map(async (path) => [join(root, path), await hash(join(root, path))]),
    )),
  };
  const options = {
    attemptId: `dormant-context-${name}`,
    profile: "student" as const,
    extension: "_extensions/course-core",
    portal,
    members: [] as { path: string }[],
  };
  return { root, write, options };
}
async function book(f: Awaited<ReturnType<typeof fixture>>) {
  await f.write(
    "examples/book/_quarto.yml",
    "project:\n  type: book\n  output-dir: _book\nbook:\n  title: Dormant\n  chapters: [index.qmd]\nformat: html\n",
  );
  await f.write("examples/book/index.qmd", "# Dormant Book\n");
  await f.write(
    "examples/book/topics/contracts/_control.qmd",
    "## Excluded native Book partial\n",
  );
}
async function member(f: Awaited<ReturnType<typeof fixture>>, path: string) {
  await f.write(
    `${path}/_quarto.yml`,
    "project:\n  type: default\n  render: [index.qmd]\n  output-dir: _site\nformat: html\n",
  );
  await f.write(`${path}/index.qmd`, "# Active member\n");
  f.options.members.push({ path: join(f.root, path) });
}
async function rejects(
  name: string,
  f: Awaited<ReturnType<typeof fixture>>,
  code: string,
) {
  try {
    await prepareNavigationOwner(f.root, f.options);
  } catch (error) {
    observations.push({ name, accepted: false, error: String(error) });
    assert(String(error).includes(code), `expected ${code}: ${error}`);
    return;
  }
  throw new Error(`${name}: accepted ${code}`);
}

try {
  const positive = await fixture("native-book-ancestor");
  await book(positive);
  await member(positive, "active");
  const partial = join(
    positive.root,
    "examples/book/topics/contracts/_control.qmd",
  );
  const document = await inspect(partial);
  assert(
    document.project?.dir === dirname(partial),
    "fixture must exercise the excluded document's reduced directory envelope",
  );
  const native = await inspect(document.project.dir);
  const bookRoot = join(positive.root, "examples/book");
  assert(
    native.dir === bookRoot &&
      native.files.config.includes(join(bookRoot, "_quarto.yml")) &&
      !native.files.input.includes(partial),
    "native inspection must resolve the genuine ancestor Book and exclude the partial",
  );
  observations.push({
    name: "native-book-ancestor",
    documentProject: { dir: document.project.dir, files: document.project.files },
    nativeDir: native.dir,
    nativeConfig: native.files.config,
  });
  const handle = await prepareNavigationOwner(positive.root, positive.options);
  const session = JSON.parse(await Deno.readTextFile(handle.sessionPath));
  const dormant = session.audit.navigation.dormant;
  assert(
    dormant.length === 1 && dormant[0].path === "examples/book" &&
      dormant[0].native.dir === bookRoot &&
      dormant[0].configHashes[join(bookRoot, "_quarto.yml")] ===
        await hash(join(bookRoot, "_quarto.yml")),
    "prepare must use the resolved native Book root for the dormant identity",
  );
  assert(
    !session.audit.coverage["examples/book/topics/contracts/_control.qmd"],
    "dormant Book partial must not become root source coverage",
  );
  observations.push({ name: "native-book-ancestor", accepted: true });

  const orphan = await fixture("non-native-nested-excluded");
  await orphan.write("_partials/_orphan.qmd", "## Unowned partial\n");
  const orphanDocument = await inspect(join(orphan.root, "_partials/_orphan.qmd"));
  const orphanNative = await inspect(orphanDocument.project.dir);
  assert(
    orphanDocument.project.dir === join(orphan.root, "_partials") &&
      orphanNative.dir === orphan.root,
    "negative fixture must resolve the reduced envelope back to the portal root",
  );
  observations.push({
    name: "non-native-nested-excluded",
    documentProject: {
      dir: orphanDocument.project.dir,
      files: orphanDocument.project.files,
    },
    nativeDir: orphanNative.dir,
  });
  await rejects("non-native-nested-excluded", orphan, "SOURCE.UNCOVERED_QMD");

  const overlap = await fixture("overlapping-member");
  await book(overlap);
  await member(overlap, "examples/book/active");
  await rejects(
    "overlapping-member",
    overlap,
    "SOURCE.NAVIGATION_MEMBER_BOUNDARY_INVALID",
  );
  console.log("PASS dormant native Book context; root orphan and member overlap refused");
} catch (error) {
  observations.push({ failure: String(error) });
  throw error;
} finally {
  await Deno.writeTextFile(
    join(evidence, "observations.json"),
    JSON.stringify(observations, null, 2) + "\n",
  );
}
