export class PublicationFailure extends Error {
  constructor(public code: string, detail: unknown) {
    super(
      `${code}: ${
        typeof detail === "string" ? detail : JSON.stringify(detail)
      }`,
    );
    this.name = "PublicationFailure";
  }
}
export function require(
  value: unknown,
  code: string,
  detail: unknown,
): asserts value {
  if (!value) throw new PublicationFailure(code, detail);
}
export function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
