import { ArtifactInventorySchema } from "../_extensions/course-core/public.ts";
const bytes = new TextEncoder().encode("Обычный материал\n");
const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
  .map((v) => v.toString(16).padStart(2, "0")).join("");
const inventory = (
  target: string,
  audience: "student" | "full" = "student",
) => ({
  schema: "course-artifact-inventory-v1",
  operation: crypto.randomUUID(),
  exerciseId: "exr-policy",
  audience,
  files: [{
    target,
    bytes,
    size: bytes.length,
    sha256,
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
    ArtifactInventorySchema.safeParse(inventory(target)).success,
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
    !ArtifactInventorySchema.safeParse(inventory(target)).success,
    "Public semantic target accepted: " + target,
  );
}
assert(
  !ArtifactInventorySchema.safeParse(
    inventory("author/reference/.git/config", "full"),
  ).success,
  "Full git seed silently admitted",
);
assert(
  ArtifactInventorySchema.safeParse(
    inventory("author/reference/src/main/java/Main.java", "full"),
  ).success,
  "Declared full source group refused",
);
const collision = inventory("file");
collision.files.push({ ...collision.files[0], target: "file/nested" });
assert(
  !ArtifactInventorySchema.safeParse(collision).success,
  "File/directory collision accepted",
);
const wrongAudience = inventory("README.md");
wrongAudience.files[0].audience = "full";
assert(
  !ArtifactInventorySchema.safeParse(wrongAudience).success,
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
