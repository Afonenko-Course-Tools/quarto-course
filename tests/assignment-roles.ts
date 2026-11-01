import { assignmentRolePredicate } from "../_extensions/course-core/runtime/assignment-roles.ts";
const assert = (v: unknown, s: string) => {
  if (!v) throw Error(s);
};
const gate = assignmentRolePredicate([
  {
    path: "/owner/materials/golden",
    tree: true,
    public: false,
    reason: "solutions.golden.path",
  },
  {
    path: "/owner/assets/verify",
    tree: true,
    public: false,
    reason: "testsets.verifier.path",
  },
  {
    path: "/owner/project/seed",
    tree: true,
    public: true,
    reason: "starter.path",
  },
  {
    path: "/owner/project/public-tests",
    tree: true,
    public: true,
    reason: "testsets.public.path",
  },
  {
    path: "/owner/shared/dependency",
    tree: true,
    public: true,
    reason: "components.shared.path",
  },
], ["/owner/project"]);
for (
  const path of [
    "/owner/materials/golden/Answer.java",
    "/owner/assets/verify/Helper.txt",
    "/owner/project/unknown.txt",
  ]
) {
  let error = "";
  try {
    gate(path);
  } catch (e) {
    error = String(e);
  }
  assert(
    /BODY.RESOURCE_(PRIVATE_ROLE|ROLE_UNPROVEN)/.test(error),
    "Role leak " + path,
  );
}
for (
  const path of [
    "/owner/project/seed/Main.java",
    "/owner/project/public-tests/Data.txt",
    "/owner/shared/dependency/Shared.java",
    "/owner/public/diagram.svg",
  ]
) gate(path);
let conflict = "";
try {
  assignmentRolePredicate([{
    path: "/owner/materials",
    tree: true,
    public: true,
    reason: "starter",
  }, {
    path: "/owner/materials/golden",
    tree: true,
    public: false,
    reason: "solution",
  }], []);
} catch (e) {
  conflict = String(e);
}
assert(
  conflict.includes("BODY.ASSIGNMENT_PROJECT_PLANS"),
  "Overlapping public/closed origin accepted",
);
console.log(
  "PASS custom solution/verifier roots, unknown project subtree, selected public dependency, conflicting origins",
);
