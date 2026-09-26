export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface Body { "pandoc-api-version": number[]; meta: Record<string, Json>; blocks: Json[] }
export interface Exercise {
  id: string; target: string; project: string;
  head: { kind: string; level: number; title: string };
  nested: number; unknownAttributes: string[];
  body: Body; gradingNotes?: Body[]; source: string; extensions: Record<string, Json>;
}
export interface Assessment {
  id: string; kind: string; title: string; body: Body; items: string[];
  memberContainers: number; memberKinds: string[]; memberSizes: number[];
  source: string; extensions: Record<string, Json>;
}
export type Extracted<T> = Omit<T, "body" | "gradingNotes" | "source" | "extensions"> & { bodyJson: string; gradingNotesJson?: string[] };
export interface Fragment {
  source: string; course: { id: string; schema: string; view?: "student" | "full" };
  exercises: Extracted<Exercise>[]; assessment?: Extracted<Assessment> | null;
  downloads?: { exercise: string }[];
}
export interface AdapterFragment { source: string; exercises: { id: string; payload: Json }[]; assessment?: Json }
export interface Contract { name: string; version: string; requires_core: string; rules: string }
export interface Adapter { directory: string; contract: Contract; fragments: Map<string, AdapterFragment> }
export interface Course {
  schema: "1.0"; course: { id: string; view?: "student" | "full" }; registeredTargets: string[];
  exercises: Exercise[]; assessments: Assessment[];
  downloads?: { exercise: string; source: string }[];
}
