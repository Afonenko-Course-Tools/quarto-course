import * as Core from "../_extensions/course-core/public.ts";
import { captureFixture } from "./helpers/native-capture-a4c.ts";
const r = await captureFixture();
let pending: Promise<unknown> | undefined,
  callbackAfterReturn = false,
  outerReturned = false,
  error = "";
try {
  await Core.withNativeCaptureScope(
    r,
    { expectedSources: ["index.qmd"] },
    async (scope) => {
      pending = scope.captureInputs(["index.qmd"], async () => {
        if (outerReturned) callbackAfterReturn = true;
      }).catch((e) => String(e));
      outerReturned = true;
    },
  );
} catch (e) {
  error = String(e);
}
await pending;
if (callbackAfterReturn || !error.includes("OPERATION_INCOMPLETE")) {
  throw Error(
    "native command callback started after scope lifetime: " +
      JSON.stringify({ callbackAfterReturn, error }),
  );
}
console.log(
  JSON.stringify({ status: "PASS", root: r.root, callbackAfterReturn }),
);
