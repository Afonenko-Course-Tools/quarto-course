import { required } from "./helpers/required.ts";
import { join } from "stdlib/path";
import { operationProjectContextReuse } from "../_extensions/course-core/infrastructure/project-context.ts";
import { planProject } from "../_extensions/course-core/artifacts/plan.ts";
import { assignmentRoleIndex } from "../_extensions/course-core/runtime/assignment-roles.ts";
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error(message);
}
const root = await Deno.makeTempDir({ prefix: "course-project-roles-" });
const put = async (path: string, text: string) => {
  const target = join(root, path);
  await Deno.mkdir(target.slice(0, target.lastIndexOf("/")), {
    recursive: true,
  });
  await Deno.writeTextFile(target, text);
};
try {
  await put(
    "_quarto.yml",
    `course-project:\n  starter: {path: seed}\n  solutions: {golden: {path: closed/golden, base: config}}\n  testsets: {private: {path: closed/checks, base: config}}\n`,
  );
  await put("projects/a/seed/Main.java", "class Main {}");
  await put("closed/golden/Answer.java", "class Answer {}");
  await put("closed/checks/Hidden.java", "class Hidden {}");
  await put("assets/public.svg", "public");
  await Deno.link(
    join(root, "closed/golden/Answer.java"),
    join(root, "assets/alias.txt"),
  );
  const generation = {};
  const acquire = operationProjectContextReuse({
    owner: root,
    profiles: [],
    generation,
    outputDirectory: join(root, "_site"),
    sync: () => {},
  });
  await acquire([{
    owner: root,
    directories: ["projects/a"],
    profiles: [],
    format: "html",
  }], async (batch) => {
    const context = required(required(batch.groups[0]).contexts[0]);
    const student = await planProject(context, { audience: "student" }),
      full = await planProject(context, { audience: "full" });
    const info = await Deno.stat(join(root, "assets/alias.txt"));
    const roles = await assignmentRoleIndex({
      root: root,
      profiles: [],
      documents: [{ source: "index.qmd", format: "html" }],
      declared: [{ source: "index.qmd", id: "exr-a", project: "/projects/a" }],
      pairs: [{ source: "index.qmd", exerciseId: "exr-a", student, full }],
      resources: [{
        path: "assets/alias.txt",
        identity: JSON.stringify([info.dev, info.ino]),
      }],
      generation: generation,
    });
    roles.assertPath(join(root, "projects/a/seed/Main.java"));
    roles.assertPath(join(root, "assets/public.svg"));
    for (
      const path of [
        "closed/golden/Answer.java",
        "closed/checks/Hidden.java",
        "assets/alias.txt",
        "projects/a/unselected.txt",
      ]
    ) {
      let refused = false;
      try {
        roles.assertPath(join(root, path));
      } catch (e) {
        refused = /BODY.RESOURCE_(PRIVATE_ROLE|ROLE_UNPROVEN)/.test(String(e));
      }
      assert(refused, "Private/unselected source не отклонён: " + path);
    }
    let refused = false;
    try {
      roles.assertIdentity(JSON.stringify([info.dev, info.ino]));
    } catch (e) {
      refused = String(e).includes("BODY.RESOURCE_PRIVATE_ROLE");
    }
    assert(refused, "Private hardlink не отклонён при чтении actual resource");
  });
  await Deno.remove(join(root, "_quarto.yml"));
  await acquire([{
    owner: root,
    directories: ["projects/a"],
    profiles: [],
    format: "html",
  }], async (batch) => {
    assert(
      required(required(batch.groups[0]).contexts[0]).contract.starter?.path ===
        join(root, "projects/a/seed"),
      "Повторный batch потерял разобранную metadata операции",
    );
    assert(
      batch.metrics.yamlFileReads === 0,
      "Повторный batch перечитал YAML той же операции",
    );
  });
  console.log(
    "PASS actual declared roles and physical aliases without whole-owner snapshot",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
