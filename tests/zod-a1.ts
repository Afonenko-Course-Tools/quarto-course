// @deno-types="../_extensions/course-core/vendor/zod/v4/index.d.ts"
import { z } from "../_extensions/course-core/vendor/zod/v4/index.js";
import {
  CoreContractError,
  decodeProjectValue,
} from "../_extensions/course-core/contracts/project.ts";
const assert = (v: unknown, m: string) => {
  if (!v) throw Error(m);
};
let visited = 0;
const bounded = z.array(
  z.unknown().transform((v) => {
    visited++;
    return v;
  }),
).max(2);
const result = bounded.safeParse(Array(10000).fill("entry"));
assert(
  !result.success && visited === 0,
  "Zod oversized collection выполнила validation элементов: " + visited,
);
let refused = false;
try {
  decodeProjectValue({
    testsets: Object.fromEntries(
      Array.from({ length: 10000 }, (_, i) => ["t" + i, { path: false }]),
    ),
  }, "fixture.yml");
} catch (e) {
  refused = e instanceof CoreContractError && e.code === "CONTRACT_LIMIT";
}
assert(refused, "Декодер накапливает большой список ошибок");
const schema = z.strictObject({ field: z.boolean().default(false) });
assert(schema.parse({}).field === false, "Runtime defaults не исполнены");
console.log(
  "PASS bundled exact Zod smoke, oversized collection visited=0, Core bounded diagnostics",
);
