import { assignmentRolePredicate } from "../_extensions/course-core/runtime/assignment-roles.ts";
const roles = [{
  path: "/owner/materials/golden",
  tree: true,
  public: false,
  reason: "solutions.golden.path",
}];
const rows = [{
  path: "/owner/materials/golden/Answer.java",
  identity: "dev1:ino2",
}, { path: "/owner/assets/public-helper.java", identity: "dev1:ino2" }];
const predicate = (assignmentRolePredicate as any)(roles, [], rows);
let error = "";
try {
  predicate("/owner/assets/public-helper.java");
} catch (e) {
  error = String(e);
}
if (!error.includes("BODY.RESOURCE_PRIVATE_ROLE")) {
  throw Error("Hardlink alias раскрыл закрытый solution origin: " + error);
}
console.log("PASS source-snapshot inode alias остаётся закрытым");
