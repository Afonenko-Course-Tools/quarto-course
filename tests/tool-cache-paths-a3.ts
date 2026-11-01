import { toolCachePath } from "../_extensions/course-core/infrastructure/tool-cache.ts";
const owner = "/synthetic-course",
  configured = "/synthetic-course/tool-state/cache";
const cases: [string, boolean, boolean][] = [
  ["configured cache root", toolCachePath(owner, configured, configured), true],
  [
    "configured descendant",
    toolCachePath(owner, configured + "/marker", configured),
    true,
  ],
  [
    "configured ancestor is not wholly cache",
    toolCachePath(owner, "/synthetic-course/tool-state", configured),
    false,
  ],
  [
    "configured boundary sibling",
    toolCachePath(
      owner,
      "/synthetic-course/tool-state/cache-lesson",
      configured,
    ),
    false,
  ],
  [
    "stable cache",
    toolCachePath(owner, ".cache/codex-tools/marker", configured),
    true,
  ],
  [
    "ordinary educational cache",
    toolCachePath(owner, ".cache/course-data/lesson", configured),
    false,
  ],
  [
    "similar educational name",
    toolCachePath(owner, ".cache/codex-tools-lesson/input", configured),
    false,
  ],
  [
    "configured outside owner",
    toolCachePath(owner, "lesson", "/synthetic-global-cache"),
    false,
  ],
  [
    "source owner inside tool cache",
    toolCachePath(configured + "/repos/source", "input.qmd", configured),
    false,
  ],
  [
    "relative XDG does not rebase inputs",
    toolCachePath(owner, "lesson", "lesson"),
    false,
  ],
];
for (const [name, actual, expected] of cases) {
  if (actual !== expected) throw Error(name);
}
console.log(
  JSON.stringify({
    status: "PASS",
    purePathCases: cases.length,
    filesystemReads: 0,
    xdgUnchanged:
      Deno.env.get("XDG_CACHE_HOME") === "/home/tolya/Java/.cache/codex-tools",
  }),
);
