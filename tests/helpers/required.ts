/** Явная предпосылка fixture: нужный результат обязан существовать. */
export function required<T>(value: T | undefined): T {
  if (value === undefined) throw Error("Нет обязательного значения тестовой fixture");
  return value;
}

export function fixtureArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw Error("Fixture требует массив");
  return value;
}

export function fixtureRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw Error("Fixture требует объект");
  }
  return value;
}

/** Доступ к raw JSON для отрицательных контролей без ложного DTO. */
export function fixtureAt(value: unknown, path: readonly (string | number)[]): unknown {
  let current = value;
  for (const key of path) {
    current = typeof key === "number" ? required(fixtureArray(current)[key]) : required(fixtureRecord(current)[key]);
  }
  return current;
}

export function fixtureSet(value: unknown, path: readonly (string | number)[], item: unknown): void {
  const key = required(path.at(-1)),
    parent = fixtureAt(value, path.slice(0, -1));
  if (typeof key === "number") fixtureArray(parent)[key] = item;
  else fixtureRecord(parent)[key] = item;
}
import { isRecord } from "../../_extensions/course-core/document/native-ast.ts";

export function fixtureString(value: unknown): string {
  if (typeof value !== "string") throw Error("Fixture требует строку");
  return value;
}
