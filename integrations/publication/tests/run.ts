const share = Deno.env.get("QUARTO_SHARE_PATH");
if (!share) {
  throw new Error("Use quarto run to select the bundled runtime/cache");
}
const result = await new Deno.Command(Deno.execPath(), {
  args: [
    "test",
    "--allow-all",
    "--cached-only",
    "--no-config",
    `--import-map=${share}/deno_std/run_import_map.json`,
    ...Deno.args,
    new URL("./", import.meta.url).pathname,
  ],
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
}).spawn().status;
Deno.exit(result.code);
