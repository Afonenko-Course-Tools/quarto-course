import { join } from "stdlib/path";
import { installedNativeAdapters } from "../_extensions/course-core/infrastructure/installed-adapters.ts";
const root = await Deno.makeTempDir({ prefix: "installed-adapters-" });
try {
  for (
    const [path, name] of [["flat", "flat-adapter"], [
      "Org/nested",
      "nested-adapter",
    ]] as const
  ) {
    await Deno.mkdir(join(root, "_extensions", path), { recursive: true });
    await Deno.writeTextFile(
      join(root, "_extensions", path, "contract.json"),
      JSON.stringify({ name }),
    );
  }
  await Deno.mkdir(join(root, "unselected"));
  await Deno.symlink(root, join(root, "unselected/link"));
  await Deno.mkdir(join(root, "_extensions/flat/vendor/deep"), {
    recursive: true,
  });
  await Deno.writeTextFile(
    join(root, "_extensions/flat/vendor/deep/contract.json"),
    JSON.stringify({ name: "vendor-decoy" }),
  );
  const names = await installedNativeAdapters(root);
  if (names.sort().join(",") !== "flat-adapter,nested-adapter") {
    throw Error("Потеря layout или лишний обход: " + names);
  }
  await Deno.mkdir(join(root, "_extensions/duplicate"));
  await Deno.writeTextFile(
    join(root, "_extensions/duplicate/contract.json"),
    JSON.stringify({ name: "flat-adapter" }),
  );
  let refused = false;
  try {
    await installedNativeAdapters(root);
  } catch (e) {
    refused = String(e).includes("CORE.ADAPTER_INVALID");
  }
  if (!refused) throw Error("Повторный adapter принят");
  console.log(
    "PASS flat/namespaced installed adapters, no vendor/source tree inventory, duplicate refusal",
  );
} finally {
  await Deno.remove(root, { recursive: true });
}
