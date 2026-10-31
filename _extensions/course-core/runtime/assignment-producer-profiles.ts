/** Данные только проверенной поставки. Caller/project metadata не дополняют этот набор. */
export type AssignmentProducerProfile = Readonly<{
  id: string;
  root: string;
  source: {
    files: readonly { path: string; sha256: string }[];
    memberships: Readonly<Record<string, readonly string[]>>;
  };
  runtime: {
    files: readonly { path: string; sha256: string }[];
    directories: readonly { path: string; names: readonly string[] }[];
    absent: readonly string[];
  };
  hostEnvironment: Readonly<Record<string, string | null>>;
  launcher: {
    entrypoint: string;
    executable: string;
    arguments: readonly string[];
    requestedProfiles: readonly string[];
  };
  native: {
    executable: string;
    environment: Readonly<Record<string, string>>;
    // Только точные argv квалифицированных child commands; correlation добавляет Core.
    renders: readonly (readonly string[])[];
    actualProfiles: readonly string[];
    producerEvidence: Readonly<
      Partial<
        Record<"html" | "revealjs", {
          filters: unknown;
          shortcodes: unknown;
          engine: string;
        }>
      >
    >;
    literalShortcodes: readonly ("xref" | "meta")[];
  };
}>;
// Java/SP записи появятся лишь после отдельной статической квалификации exact inputs.
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
export const assignmentProducerProfiles: readonly AssignmentProducerProfile[] =
  freeze([]);
