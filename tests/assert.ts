/** Keep the test suite offline, with no assertion-library dependency. */
export function assert(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

export function equal<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

export function throws(fn: () => unknown, message: string): void {
  try {
    fn();
  } catch (error: unknown) {
    assert(error instanceof TypeError, "Expected a TypeError");
    assert(error.message.includes(message), `Unexpected error: ${error.message}`);
    return;
  }
  throw new Error("Expected the function to throw");
}
