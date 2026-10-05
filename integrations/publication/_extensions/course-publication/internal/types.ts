/** Structural callback contract. No Publisher implementation is imported. */
export interface Member {
  namespace: string;
  path: string;
  mount: string;
  format: string;
}
export interface Portal {
  input: string;
  output: string;
  renderProfiles: string[];
  control: string;
  controlHash: string;
  configHashes: Record<string, string>;
}
export interface BeforeRenderContext {
  root: string;
  sourceRoot: string;
  attemptId: string;
  profiles: string[];
  config: Record<string, unknown>;
  members: Member[];
  portal?: Portal;
}
export interface RenderContext extends BeforeRenderContext {
  output: string;
  namespace?: string;
  format: string;
}
export interface PublicationContext extends BeforeRenderContext {
  stage: string;
  quarto: string;
}
/** Existing public Core protocol, validated again by Core at every use. */
export interface OwnerHandle {
  protocol: 1;
  root: string;
  attemptId: string;
  profile: "student" | "full";
  sessionId: string;
  sessionPath: string;
  sessionHash: string;
}
export interface Plan {
  profile: "student" | "full";
  coreExtension: string;
  ownedMembers: string[];
  binding: string;
}
export interface ReceiptSummary {
  profile: "student" | "full";
  receiptHash: string;
  stage: string;
}
export interface State {
  protocol: 1;
  binding: string;
  navigation: OwnerHandle;
  owners: Record<string, OwnerHandle>;
  nativeMembers: Record<string, { output: string; format: string }>;
  publication?: ReceiptSummary;
}
export interface PublicationStatus {
  attemptId: string;
  sourceRoot: string;
  profile: "student" | "full";
  ownedMembers: string[];
  publication?: ReceiptSummary;
}
