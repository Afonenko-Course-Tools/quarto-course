const mode = Deno.env.get("INVENTORY_HOOK_MODE") || "guarded";
await Deno.writeTextFile(
  "hook.log",
  `${mode}:${Deno.env.get("INVENTORY_ACTIVE") || "normal"}\n`,
  { append: true },
);
if (Deno.env.get("INVENTORY_ACTIVE") === "1" && mode === "guarded") {
  Deno.exit(0);
}
await Deno.writeTextFile("hook-side-effect", "executed\n");
if (mode === "mutate") {
  await Deno.writeTextFile(
    "_metadata.yml",
    "description: mutated after snapshot\n",
  );
  await Deno.writeTextFile(
    "_quarto-full.yml",
    "project:\n  render: [index.qmd, full-only.qmd, python.qmd, r.qmd, late.qmd]\ncourse:\n  view: full\n",
  );
  await Deno.writeTextFile(
    "late.qmd",
    "# Late page\n\n::: {#exr-late}\nLate declaration\n:::\n",
  );
}
