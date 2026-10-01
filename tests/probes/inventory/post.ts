if (Deno.env.get("INVENTORY_ACTIVE") === "1") Deno.exit(0);
await Deno.writeTextFile("post-side-effect", "executed\n");
