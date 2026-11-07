import type {
  AnswerFacts,
  Assignment,
  AssessmentSlot,
  AssessmentComposition,
  BodyResource,
  PublicBodyPackage,
  NativeResponseSlot,
} from "../_extensions/course-core/public.ts";
import { NativeResponseSlotSchema } from "../_extensions/course-core/public.ts";

type Expect<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
export type PublicAnswerKinds = Expect<Equal<AnswerFacts["type"],
  "manual" | "numeric" | "multipart" | "matching" | "single-choice">>;
export type PublicSlotKinds = Expect<Equal<NativeResponseSlot["type"],
  "manual" | "numeric" | "matching" | "single-choice">>;
export type PublicNames = [Assignment, AssessmentSlot, AssessmentComposition,
  BodyResource, PublicBodyPackage];
const slot: NativeResponseSlot = NativeResponseSlotSchema.parse({
  name: "answer", type: "numeric", anchor: "response-anchor",
});
if (slot.type !== "numeric") throw Error("Публичный response slot потерял тип");
