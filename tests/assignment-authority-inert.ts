const ActualRead = Deno.readTextFile, ActualCommand = Deno.Command;
let reads = 0, children = 0;
(Deno as any).readTextFile = (path: any, ...args: any[]) => {
  if (
    /assignment-authority-location\.json|\/(?:anchor|manifest|profiles)\.json$/
      .test(String(path))
  ) reads++;
  return (ActualRead as any)(path, ...args);
};
(Deno as any).Command = new Proxy(ActualCommand, {
  construct(t, a) {
    children++;
    return Reflect.construct(t, a);
  },
});
try {
  const capture = await import("../_extensions/course-core/capture.ts");
  await import("../_extensions/course-core/public.ts");
  if (reads || children) {
    throw Error("Ordinary import touched optional authority/native child");
  }
  const reader = await import(
    "../_extensions/course-core/runtime/assignment-authority.ts"
  );
  let error = "";
  try {
    await reader.openAssignmentAuthority("/unqualified/owner");
  } catch (e) {
    error = String(e);
  }
  if (
    !error.includes("BODY.PRODUCER_INPUT_UNQUALIFIED") || reads !== 0 ||
    children
  ) {
    throw Error(
      "Fixed missing location did not fail before source/child: " + error +
        " reads=" + reads,
    );
  }
  console.log(
    "PASS inert import zero optional reads; missing fixed L addressed metadata refusal/zero child (not native qualification)",
  );
} finally {
  (Deno as any).readTextFile = ActualRead;
  (Deno as any).Command = ActualCommand;
}
