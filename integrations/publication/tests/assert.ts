export function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
export function assertEquals(actual: unknown, expected: unknown) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
  );
}
export function assertThrows(
  action: () => unknown,
  type: typeof Error,
  message: string,
) {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  assert(
    caught instanceof type && caught.message.includes(message),
    `expected ${message}, received ${caught}`,
  );
}
export async function assertRejects(
  action: () => Promise<unknown>,
  type: typeof Error,
  message: string,
) {
  let caught: unknown;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  assert(
    caught instanceof type && caught.message.includes(message),
    `expected ${message}, received ${caught}`,
  );
}
