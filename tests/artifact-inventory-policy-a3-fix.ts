import { ArtifactFilesSchema } from "../_extensions/course-core/public.ts";
const bytes = new TextEncoder().encode("Обычный материал\n");
const inventory = (
  target: string,
  audience: "student" | "full" = "student",
) => ({
  exerciseId: "exr-policy",
  audience,
  files: [{
    target,
    bytes,
    audience,
    reason: "contract-control",
  }],
});
const assert = (v: unknown, message: string) => {
  if (!v) throw Error(message);
};
const legal = [
  "README.md",
  "build.gradle",
  "settings.gradle",
  "src/main/java/Main.java",
  "assets/diagram.svg",
  ".gitignore",
  "assets/.gitignore",
];
for (const target of legal) {
  assert(
    ArtifactFilesSchema.safeParse(inventory(target)).success,
    "Legal public target refused: " + target,
  );
}
const refused = [
  ".git/config",
  "_quarto.yml",
  "_metadata.yml",
  ".env",
  "build/marker.txt",
  "target/result.txt",
  "out/a.txt",
  ".mvn/settings.xml",
  "check.sh",
  "cached.pyc",
  "guide.qmd",
  "reference/Main.java",
];
for (const target of refused) {
  assert(
    !ArtifactFilesSchema.safeParse(inventory(target)).success,
    "Public semantic target accepted: " + target,
  );
}
assert(
  !ArtifactFilesSchema.safeParse(
    inventory("author/reference/.git/config", "full"),
  ).success,
  "Full git seed silently admitted",
);
assert(
  ArtifactFilesSchema.safeParse(
    inventory("author/reference/src/main/java/Main.java", "full"),
  ).success,
  "Declared full source group refused",
);
const collision = inventory("file");
collision.files.push({ ...collision.files[0], target: "file/nested" });
assert(
  !ArtifactFilesSchema.safeParse(collision).success,
  "File/directory collision accepted",
);
const wrongAudience = inventory("README.md");
wrongAudience.files[0].audience = "full";
assert(
  !ArtifactFilesSchema.safeParse(wrongAudience).success,
  "File audience differs from inventory",
);
console.log(
  JSON.stringify({
    status: "PASS",
    legal,
    refused,
    checks: legal.length + refused.length + 4,
  }),
);
