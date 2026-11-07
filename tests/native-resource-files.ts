import { required } from "./helpers/required.ts";
import { NativeResourceFilesSchema } from "../_extensions/course-core/runtime/contracts.ts";
const value = {
  audience: "student",
  files: [{
    source: "figures/diagram.svg",
    target: "assets/diagram.svg",
    bytes: new Uint8Array([1, 2]),
  }],
};
const parsed = NativeResourceFilesSchema.parse(value);
if (required(parsed.files[0]).source !== required(value.files[0]).source) {
  throw Error("Утеряна выбранная связь source/target");
}
for (
  const extra of [{ schema: "course-native-resource-inventory-v1" }, {
    operation: crypto.randomUUID(),
  }]
) {
  if (NativeResourceFilesSchema.safeParse({ ...value, ...extra }).success) {
    throw Error("Принят удалённый certificate");
  }
}
for (const source of ["../private", "/absolute", "a/../b"]) {
  if (
    NativeResourceFilesSchema.safeParse({
      ...value,
      files: [{ ...value.files[0], source }],
    }).success
  ) throw Error("Unsafe source принят");
}
console.log(
  "PASS resource files source/target/bytes, unsafe source and removed certificate refusal",
);
