import { assertFrozen, OwnerFailure } from "../owner-preflight/owner.ts";
const session = Deno.env.get("COURSE_OWNER_SESSION");
if (session) {
  try {
    await assertFrozen(session);
  } catch (error) {
    const report = {
      status: "failure",
      code: error instanceof OwnerFailure ? error.code : "INTERNAL.OWNER_GUARD",
      cause: error instanceof OwnerFailure ? error.cause : String(error),
    };
    await Deno.writeTextFile(
      ".course-owner/guard-failure.json",
      JSON.stringify(report),
    );
    console.error(JSON.stringify(report));
    Deno.exit(2);
  }
}
