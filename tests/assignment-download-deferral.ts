// Только чистая квалификация command/env; child, inspect и producer не запускаются.
import { CoreContractError } from "../_extensions/course-core/contracts/project.ts";
import {
  assignmentChild,
  withAssignmentCaptureChild,
  withAssignmentExecution,
} from "../_extensions/course-core/runtime/assignment-execution.ts";
const root = "/owner", token = "capture-token";
const runtime = {
  executable: "/native/quarto",
  profiles: ["full"],
  environment: { COURSE_SITE_DEFER_DOWNLOADS: "0", KEEP: "value" },
  outputDirectory: root + "/_generated/out",
  inputs: ["index.qmd"],
  implementationFiles: [],
};
const render = [
  "render", "--output-dir", "_generated/out", "--profile", "full",
];
const assert = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
assert(
  assignmentChild("quarto", render, root) === undefined,
  "Ordinary caller получил assignment env override",
);
await withAssignmentExecution(runtime, root, async () => {
  for (
    const args of [
      ["inspect", root, "--profile", "full"],
      ["pandoc", "--from", "markdown", "--to", "json", "--wrap=none"],
    ]
  ) {
    const child = assignmentChild("quarto", args, root);
    assert(
      child?.options.env.COURSE_SITE_DEFER_DOWNLOADS === "0",
      "Nonrender command изменил site publication intent",
    );
  }
  let unbound: unknown;
  try {
    assignmentChild("quarto", render, root);
  } catch (cause) {
    unbound = cause;
  }
  assert(
    unbound instanceof CoreContractError &&
      unbound.code === "BODY.PRODUCER_INPUT_CHANGED",
    "Render без live child token принят",
  );
  await withAssignmentCaptureChild(token, async () => {
    let override: unknown;
    try {
      assignmentChild("quarto", render, root, {
        COURSE_SITE_DEFER_DOWNLOADS: "1",
      });
    } catch (cause) {
      override = cause;
    }
    assert(
      override instanceof CoreContractError &&
        override.code === "BODY.PRODUCER_INPUT_CHANGED",
      "Caller получил право менять закрытый env",
    );
    const child = assignmentChild("quarto", render, root, {
      COURSE_CORE_CAPTURE_TOKEN: token,
      QUARTO_PROFILE: "full",
    });
    assert(
      child?.options.env.COURSE_SITE_DEFER_DOWNLOADS === "1",
      "Private assignment render запускает лишний site Download finalizer",
    );
    assert(
      child?.options.env.COURSE_CORE_CAPTURE_TOKEN === token &&
        child.options.env.QUARTO_PROFILE === "full" &&
        child.options.env.KEEP === "value" && child.options.clearEnv === true,
      "Потеря existing correlation/profiles/closed environment",
    );
  });
});
assert(
  runtime.environment.COURSE_SITE_DEFER_DOWNLOADS === "0" &&
    assignmentChild("quarto", render, root) === undefined,
  "Assignment defer изменил исходный env или пережил scope",
);
console.log("PASS assignment render deferred; nonrender/ordinary/env guards сохранены");
