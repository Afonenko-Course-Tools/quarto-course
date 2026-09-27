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
export type PedagogicalKind = "exercise" | "solution" | "hint" | "demonstration" | "prediction"
  | "discussion" | "self-check" | "objectives" | "prerequisites" | "reading"
  | "takeaway" | "limitation" | "misconception" | "criteria" | "deliverables";
export interface PedagogicalMetadata {
  difficulty?: "introductory" | "intermediate" | "advanced";
  time?: number;
  workMode?: "individual" | "pair" | "group";
  requirement?: "required" | "recommended" | "optional";
}
export interface PedagogicalElement {
  kind: PedagogicalKind; id?: string; exercise?: string; title?: string;
  metadata?: PedagogicalMetadata; order: number; body: Body; source: string;
}
export interface Pedagogy {
  elements: PedagogicalElement[];
  documents?: { source: string; defaults: PedagogicalMetadata }[];
}
export type Extracted<T> = Omit<T, "body" | "gradingNotes" | "source" | "extensions"> & { bodyJson: string; gradingNotesJson?: string[] };
export interface Fragment {
  source: string; course: { id: string; schema: string; view?: "student" | "full" };
  exercises: Extracted<Exercise>[]; assessment?: Extracted<Assessment> | null;
  downloads?: { exercise: string }[];
  pedagogy?: {
    elements: (Omit<PedagogicalElement, "body" | "source"> & { bodyJson: string })[];
    defaults?: PedagogicalMetadata;
  };
}
export interface AdapterFragment { source: string; exercises: { id: string; payload: Json }[]; assessment?: Json }
export interface Contract { name: string; version: string; requires_core: string; rules: string }
export interface Adapter { directory: string; contract: Contract; fragments: Map<string, AdapterFragment> }
export interface Course {
  schema: "1.0" | "1.1"; course: { id: string; view?: "student" | "full" }; registeredTargets: string[];
  exercises: Exercise[]; assessments: Assessment[];
  downloads?: { exercise: string; source: string }[];
  pedagogy?: Pedagogy;
}
