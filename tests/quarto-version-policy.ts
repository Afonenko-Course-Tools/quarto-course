import { SupportedQuartoVersionSchema } from "../_extensions/course-core/infrastructure/quarto-version.ts";
import { NativeOperationIdentitySchema } from "../_extensions/course-core/runtime/contracts.ts";
for (const value of ["1.11.5", "1.11.6", "1.12.0", "2.0.0", "1.11.5+build.42", "1.11.6-rc.1"]) {
  const result = SupportedQuartoVersionSchema.parse(value);
  if (result !== value) throw Error("Подменена actual version " + value);
}
for (const value of [
  "0.99.0",
  "1.11.4",
  "1.11.5-rc.1",
  "1.11.5foo",
  "1.11.5.0",
  "01.11.5",
  "1.11",
  "1.11.5\n",
  "1.11.6-01",
  "1.11.6+",
  "999999999999999999.0.0",
  "latest",
  1116,
  null,
  undefined,
]) {
  if (SupportedQuartoVersionSchema.safeParse(value).success) {
    throw Error("Принята неподдерживаемая/неверная version " + value);
  }
}
// Эта строка — прежний технический ABI, а не подмена версии программы.
NativeOperationIdentitySchema.parse({
  operation: crypto.randomUUID(),
  profiles: [],
  projection: "student",
  runtime: "quarto-1.11.5",
});
console.log("PASS minimum/newer/invalid/SemVer versions preserve actual string and existing native ABI");
