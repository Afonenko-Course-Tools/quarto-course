import { join, toFileUrl } from "stdlib/path";
const evidence = Deno.args[0];
if (!evidence) {
  throw Error("usage: owner-body-api.ts completed-owner-bodies-evidence");
}
const h =
  JSON.parse(await Deno.readTextFile(join(evidence, "finished.json"))).report
    .body;
const p = {
  protocol: 1,
  root: h.root,
  attemptId: h.attemptId,
  profile: h.profile,
  sessionId: h.sessionId,
  sessionPath: join(h.root, ".course-owner/session.json"),
  sessionHash: h.sessionHash,
};
const api = await import(
  toFileUrl(join(h.root, "_extensions/course-core/owner-preflight/owner.ts"))
    .href
);
const errors: string[] = [];
try {
  await api.validateOwnerBodies(
    p,
    Object.fromEntries(Object.entries(h).reverse()),
  );
  console.log("PASS complete JSON handle accepts different object key order");
} catch (error) {
  errors.push("JSON handle key order wrongly refused: " + error);
}
for (const works of [null, false, "", 0]) {
  try {
    await api.validateOwnerBodies(p, h, { works });
    errors.push("Malformed works selection accepted: " + JSON.stringify(works));
  } catch (error) {
    if (!String(error).includes("BODY.WORK_SELECTION_INVALID")) throw error;
    console.log("PASS malformed runtime works value " + JSON.stringify(works));
  }
}
if (errors.length) throw Error(errors.join("\n"));
