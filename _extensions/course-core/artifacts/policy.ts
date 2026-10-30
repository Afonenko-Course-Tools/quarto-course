export const excluded = new Set([
  ".git",
  ".gradle",
  ".mvn",
  ".quarto",
  "_generated",
  "node_modules",
  "build",
  "target",
  "out",
  "__pycache__",
]);
export const privateNames = new Set([
  "private",
  "reference",
  "solution",
  "solutions",
  "grading-notes",
  "rubric.md",
  "contract.md",
]);
// Existing materializer policy also applies to direct build/resource entries.
export const publicExcluded = (name: string) =>
  /\.(?:qmd|rmd|ipynb|class|jar|pyc)$/i.test(name) ||
  /^(?:_quarto(?:[-.].*)?|_metadata\.ya?ml)$/i.test(name) ||
  name === "check.sh" || name.startsWith(".") && name !== ".gitignore";
export function artifactTargetIssue(
  target: string,
  audience: "student" | "full",
): { code: string; message: string } | undefined {
  const parts = target.split("/");
  if (parts.some((p) => excluded.has(p))) {
    return {
      code: "ARTIFACT_TARGET",
      message: "Служебный/generated target в выдаче",
    };
  }
  if (audience === "student") {
    if (parts.some((p) => privateNames.has(p))) {
      return {
        code: "ARTIFACT_PRIVATE",
        message: "Закрытый target partition в student",
      };
    }
    if (parts.some(publicExcluded)) {
      return {
        code: "ARTIFACT_TARGET",
        message: "Source/config/generated target в student",
      };
    }
  }
}
