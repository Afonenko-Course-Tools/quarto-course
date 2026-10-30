import { copy } from "stdlib/fs";
import { dirname, fromFileUrl, join } from "stdlib/path";
import { collectProjectChecks } from "../_extensions/course-core/project-checks/collect.ts";
const repository = dirname(dirname(fromFileUrl(import.meta.url))),
  root = await Deno.makeTempDir({ prefix: "core-java-library-a4c-" });
try {
  await Deno.mkdir(join(root, "bank/projects/demo/student"), {
    recursive: true,
  });
  await Deno.mkdir(join(root, "bank/projects/demo/tests"), { recursive: true });
  await copy(
    join(repository, "_extensions/course-core"),
    join(root, "bank/_extensions/course-core"),
  );
  await Deno.writeTextFile(
    join(root, "_quarto.yml"),
    "project: {type: default, render: [index.qmd]}\ncourse: {id: checks-test}\n",
  );
  await Deno.writeTextFile(join(root, "index.qmd"), "# Root\n");
  await Deno.writeTextFile(
    join(root, "bank/_quarto.yml"),
    `project: {type: book}\nbook: {title: Checks, chapters: [index.qmd]}\ncourse: {id: checks-test}\nproject-checks:\n  defaults:\n    runtime: java25-gradle-junit-v1\n    java-build: {kind: gradle-jar-v1, artifact: gradeapp.jar}\n    scoring: {mode: weighted}\n  source-profiles:\n    main: {mode: implementation, root: student, include: ["*.java"]}\n  profiles:\n    junit: {source-profile: main, tests: ["tests/*.java"], api-precheck: {files: ["tests/Api.java"], entry: Api}, verification-tests: ["student/Public*.java"], verification-api-precheck: {files: ["student/PublicApi.java"], entry: PublicApi}, contract-cases: tests/contract-cases.json}\n`,
  );
  await Deno.writeTextFile(
    join(root, "bank/_quarto-full.yml"),
    "course: {view: full}\n",
  );
  await Deno.writeTextFile(
    join(root, "bank/index.qmd"),
    `# Manual demonstration {#sec-demo}\n\n::: {#exr-demo project="/projects/demo" project-check=junit course-role=demonstration statement-visibility=open}\n## Demo\nCondition\n:::\n\n::: {#exr-placeholder project="/projects/incomplete" project-check=junit}\n## Placeholder\nUnfinished\n:::\n`,
  );
  await Deno.writeTextFile(
    join(root, "bank/projects/demo/student/Demo.java"),
    "class Demo {}\n",
  );
  await Deno.writeTextFile(
    join(root, "bank/projects/demo/tests/DemoTest.java"),
    "class DemoTest {}\n",
  );
  await Deno.writeTextFile(
    join(root, "bank/projects/demo/tests/Api.java"),
    "class Api {}",
  );
  await Deno.writeTextFile(
    join(root, "bank/projects/demo/student/PublicApi.java"),
    "class PublicApi {}",
  );
  await Deno.writeTextFile(
    join(root, "bank/projects/demo/student/PublicTest.java"),
    "class PublicTest {}",
  );
  await Deno.mkdir(join(root, "bank/projects/demo/tests/fixtures/wrong"), {
    recursive: true,
  });
  await Deno.writeTextFile(
    join(root, "bank/projects/demo/tests/fixtures/wrong/Demo.java"),
    "class Demo { int wrong; }",
  );
  await Deno.writeTextFile(
    join(root, "bank/projects/demo/tests/contract-cases.json"),
    JSON.stringify({
      schemaVersion: 1,
      cases: [{
        id: "wrong",
        sources: [{
          fixture: "tests/fixtures/wrong/Demo.java",
          submission: "Demo.java",
        }],
        expected: {
          "student-compilation": "success",
          job: "complete",
          classification: "behavior-failure",
        },
      }],
    }),
  );
  const a = await collectProjectChecks(root, { book: "bank" });
  if (
    a.projects.length !== 2 || a.projects[0].bankMember ||
    a.projects[0].qualifiedId !== "checks-test/exr-demo"
  ) throw Error("declared_inventory_without_native_delivery failed");
  if (
    a.projects[1].readiness.ready ||
    !a.projects[1].readiness.missing.includes("sources")
  ) throw Error("declared_inventory_records_incomplete_project failed");
  if (
    a.projects[0].sources[0].submissionRelativePath !== "Demo.java" ||
    !a.projects[0].trustedTests.some((t) =>
      t.projectRelativePath === "tests/DemoTest.java"
    )
  ) throw Error("explicit selected sources lost");
  if (
    JSON.stringify(a.projects[0].apiPrecheck) !==
      JSON.stringify({ files: ["Api.java"], entry: "Api" })
  ) throw Error("private precheck mapping lost");
  if (
    JSON.stringify(a.projects[0].verificationApiPrecheck) !==
      JSON.stringify({ files: ["PublicApi.java"], entry: "PublicApi" })
  ) throw Error("public precheck mapping lost");
  if (
    a.projects[0].check?.["java-build"]?.kind !== "gradle-jar-v1" ||
    Object.hasOwn(a.projects[0].check?.["java-build"] ?? {}, "main-class") ||
    a.projects[0].check?.["java-build"]?.artifact !== "gradeapp.jar"
  ) throw Error("native java-build capture lost");
  const current = {
    projectRoot: join(root, "bank"),
    courseId: "checks-test",
    result: {
      model: { projects: [structuredClone(a.projects[0])] },
      documents: [],
    },
  } as any;
  const first = await collectProjectChecks(root, { book: "bank" }, current);
  current.result.model.projects[0].check["java-build"].artifact =
    "alternate.jar";
  const changed = await collectProjectChecks(root, { book: "bank" }, current);
  if (
    first.inventoryHash === changed.inventoryHash ||
    first.sourceSnapshotHash === changed.sourceSnapshotHash
  ) throw Error("java-build omitted from hash identity");
  for (
    const [runtime, build, mode] of [
      ["java25-gradle-junit-v1", undefined, "implementation"],
      ["java25-junit-v1", {
        kind: "gradle-jar-v1",
        "main-class": "grade.Main",
        artifact: "gradeapp.jar",
      }, "implementation"],
      ["java25-gradle-junit-v1", {
        kind: "gradle-jar-v1",
        "main-class": "grade.Main",
        artifact: "gradeapp.jar",
        command: "run",
      }, "implementation"],
      ["java25-gradle-junit-v1", {
        kind: "gradle-jar-v1",
        "main-class": "grade..Main",
        artifact: "../x.jar",
      }, "implementation"],
      ["java25-gradle-junit-v1", {
        kind: "gradle-jar-v1",
        "main-class": "grade.Main",
        artifact: "gradeapp.jar",
      }, "student-tests"],
    ] as const
  ) {
    const bad = structuredClone(current);
    Object.assign(bad.result.model.projects[0].check, {
      runtime,
      "java-build": build,
    });
    bad.result.model.projects[0].check.sourceProfile.mode = mode;
    let denied = false;
    try {
      await collectProjectChecks(root, { book: "bank" }, bad);
    } catch {
      denied = true;
    }
    if (!denied) throw Error("collector admitted invalid java-build coupling");
  }
  for (const main of [null, "", false, 23, "bad-name", "a..Main"]) {
    const bad = structuredClone(current);
    bad.result.model.projects[0].check["java-build"]["main-class"] = main;
    let rejected = false;
    try {
      await collectProjectChecks(root, { book: "bank" }, bad);
    } catch {
      rejected = true;
    }
    if (!rejected) throw Error("bad present main-class accepted");
  }
  const b = await collectProjectChecks(root, { book: "bank" });
  if (
    a.sourceSnapshotHash !== b.sourceSnapshotHash ||
    a.inventoryHash !== b.inventoryHash
  ) throw Error("determinism failed");
  await Deno.writeTextFile(
    join(root, "bank/projects/demo/student/Demo.java"),
    "class Demo { int value; }\n",
  );
  const c = await collectProjectChecks(root, { book: "bank" });
  if (
    c.sourceSnapshotHash === a.sourceSnapshotHash ||
    c.inventoryHash === a.inventoryHash
  ) throw Error("Java bytes omitted from identity");
  await Deno.writeTextFile(
    join(root, "bank/projects/demo/tests/fixtures/wrong/Demo.java"),
    "class Demo { int differentlyWrong; }",
  );
  const d = await collectProjectChecks(root, { book: "bank" });
  if (
    d.sourceSnapshotHash === c.sourceSnapshotHash ||
    d.inventoryHash === c.inventoryHash
  ) throw Error("contract_fixture_bytes_omitted_from_identity");
  await Deno.writeTextFile(join(root, "checks.json"), JSON.stringify(d));
  const vet = await new Deno.Command(Deno.env.get("CUE") ?? "cue", {
    args: [
      "vet",
      join(repository, "_extensions/course-core/spec/core.cue"),
      join(repository, "_extensions/course-core/project-checks/manifest.cue"),
      join(root, "checks.json"),
      "-d",
      "#ChecksManifest",
      "-c",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!vet.success) throw Error(new TextDecoder().decode(vet.stderr));
  const fish = {
    profile: "fish",
    runtime: "fish-git-v1",
    sourceProfile: {
      mode: "implementation",
      root: "student",
      include: ["*.fish"],
    },
    "source-profile": "fish",
    tests: ["tests/checks.py"],
    scoring: { mode: "weighted" },
  };
  await Deno.writeTextFile(join(root, "fish.json"), JSON.stringify(fish));
  const fishVet = await new Deno.Command(Deno.env.get("CUE") ?? "cue", {
    args: [
      "vet",
      join(repository, "_extensions/course-core/spec/core.cue"),
      join(root, "fish.json"),
      "-d",
      "#ResolvedProjectCheck",
      "-c",
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!fishVet.success) {
    throw Error(
      "Legacy fish profile rejected: " +
        new TextDecoder().decode(fishVet.stderr),
    );
  }
  for (
    const delta of [{ runtime: "java25-junit-v1" }, { "java-build": null }, {
      "java-build": {
        kind: "gradle-jar-v1",
        "main-class": "grade.Main",
        artifact: "../x.jar",
      },
    }, {
      "java-build": {
        kind: "gradle-jar-v1",
        "main-class": "grade.Main",
        artifact: "x.jar",
        unknown: true,
      },
    }]
  ) {
    const bad: Record<string, unknown> = { ...a.projects[0].check, ...delta };
    if (bad["java-build"] === null) delete bad["java-build"];
    await Deno.writeTextFile(join(root, "invalid.json"), JSON.stringify(bad));
    const vet = await new Deno.Command(Deno.env.get("CUE") ?? "cue", {
      args: [
        "vet",
        join(repository, "_extensions/course-core/spec/core.cue"),
        join(root, "invalid.json"),
        "-d",
        "#ResolvedProjectCheck",
        "-c",
      ],
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (vet.success) throw Error("CUE accepted invalid native build metadata");
  }
  const prior = d.sourceSnapshotHash;
  await Deno.writeTextFile(
    join(root, "bank/projects/demo/tests/Api.java"),
    "class Api {int changed;}",
  );
  const omitted: any = structuredClone(a.projects[0]);
  delete omitted.check["verification-api-precheck"];
  let publicRejected = false;
  try {
    await collectProjectChecks(
      root,
      { book: "bank" },
      {
        projectRoot: join(root, "bank"),
        courseId: "checks-test",
        result: { model: { projects: [omitted] }, documents: [] },
      } as any,
    );
  } catch {
    publicRejected = true;
  }
  if (!publicRejected) {
    throw Error("Public fixed-API verification omitted its API stage");
  }
  const e = await collectProjectChecks(root, { book: "bank" });
  if (e.sourceSnapshotHash === prior) throw Error("precheck bytes not hashed");
  const yaml = await Deno.readTextFile(join(root, "bank/_quarto.yml"));
  await Deno.writeTextFile(
    join(root, "bank/_quarto.yml"),
    yaml.replace("tests/Api.java", "../Api.java"),
  );
  let rejected = false;
  try {
    await collectProjectChecks(root, { book: "bank" });
  } catch {
    rejected = true;
  }
  if (!rejected) throw Error("unsafe precheck path accepted");
  console.log(
    "PASS library omission without fake Main, invalid present main-class, native/CUE/hash identity",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
