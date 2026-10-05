import { finishNativeRun } from "../infrastructure/native-run.ts";
const run = await finishNativeRun(
  Deno.env.get("QUARTO_PROJECT_DIR") || Deno.cwd(),
);
console.log(`Course: ${run.documents.length} current native documents`);
