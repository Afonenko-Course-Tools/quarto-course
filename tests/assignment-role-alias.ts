import { required } from "./helpers/required.ts";
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
const predicate = assignmentRolePredicate(roles, [], rows);
let error = "";
try {
  predicate("/owner/assets/public-helper.java");
} catch (e) {
  error = String(e);
}
if (!error.includes("BODY.RESOURCE_PRIVATE_ROLE")) {
  throw Error("Hardlink alias раскрыл закрытый solution origin: " + error);
}

// Копия в output не должна скрывать закрытый hardlink исходного пути.
for (const identities of [["dev1:ino2", "dev1:ino3"], ["dev1:ino3", "dev1:ino2"]]) {
  const gate = assignmentRolePredicate(roles, [], [
    required(rows[0]),
    ...identities.map((identity) => ({ path: "/owner/assets/copied.svg", identity })),
  ]);
  let refused = false;
  try {
    gate("/owner/assets/copied.svg");
  } catch (error) {
    refused = String(error).includes("BODY.RESOURCE_PRIVATE_ROLE");
  }
  if (!refused) throw Error("Output copy скрыла закрытый source alias");
}
// Первое чтение сравнивает actual inode с закрытыми ролями, а не с прежним inode.
predicate.assertIdentity("dev1:ino4");
let privateRead = false;
try {
  predicate.assertIdentity("dev1:ino2");
} catch (error) {
  privateRead = String(error).includes("BODY.RESOURCE_PRIVATE_ROLE");
}
if (!privateRead) throw Error("Первое чтение разрешило private physical alias");

console.log("PASS source/output aliases и первое чтение сохраняют закрытые роли");
