/** Узкая CLI-граница: известные ошибки печатаются один раз, неизвестные сохраняют stack. */
export async function runCli(main: () => Promise<unknown>): Promise<void> {
  try { await main(); }
  catch (error) {
    if (!(error instanceof Error) || !["ExtensionDiagnostic", "ExternalToolFailure"].includes(error.name)) throw error;
    let current: unknown = error;
    while (current instanceof Error) {
      console.error(current.message);
      current = current.cause;
    }
    Deno.exit(1);
  }
}
