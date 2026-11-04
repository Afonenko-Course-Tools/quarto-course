// Existing internal scope guards; нет Native child/render или qualification policy.
import { operationProjectContextReuse } from "../_extensions/course-core/infrastructure/project-context.ts";
const acquire = operationProjectContextReuse({
  owner: "/owner",
  profiles: ["full"],
  generation: {},
  outputDirectory: "/owner/_site",
  sync: () => {},
});
for (
  const request of [{
    owner: "/foreign",
    profiles: ["full"],
    format: "html",
    inputs: ["projects/a/native-input.qmd"],
  }, {
    owner: "/owner",
    profiles: ["student"],
    format: "html",
    inputs: ["projects/a/native-input.qmd"],
  }]
) {
  let error = "";
  try {
    await acquire([request], async () => {
      throw Error("CALLBACK_UNEXPECTED");
    }, true);
  } catch (e) {
    error = String(e);
  }
  if (!error.includes("CONTEXT_REQUEST")) {
    throw Error("Чужой scope допущен: " + error);
  }
}
let nested = "";
await acquire([], async () => {
  try {
    await acquire([], async () => {});
  } catch (e) {
    nested = String(e);
  }
});
if (!nested.includes("CONTEXT_REQUEST")) {
  throw Error("Пересекающаяся A1 batch допущена");
}
console.log("PASS owner/profiles/overlap A1 guards; zero Native children");
