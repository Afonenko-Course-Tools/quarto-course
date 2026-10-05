// Test support for the existing installed author lifecycle. One native actual render;
// capture, source identity, projection and finish remain owned by the installed Core.
import { join, toFileUrl } from "stdlib/path";

export async function renderOwner(root: string, profile: "student" | "full") {
  const quarto = Deno.env.get("QUARTO") || "quarto";
  const extension = join(root, "_extensions/course-core");
  const previousProfile = Deno.env.get("QUARTO_PROFILE");
  Deno.env.set("QUARTO_PROFILE", profile);
  async function command(args: string[]) {
    const result = await new Deno.Command(quarto, {
      args,
      cwd: root,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const text = new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr);
    if (!result.success) throw new Error(text);
    return text;
  }
  try {
    // Run the existing cleanup before preflight, so an early contract refusal also
    // invalidates a stale published model. Never manually delete that model here.
    await command(["run", join(extension, "entrypoints/pre.ts")]);
    const api = await import(
      toFileUrl(join(extension, "owner-preflight/owner.ts")).href
    );
    const prepared = await api.prepareOwner(root, {
      attemptId: crypto.randomUUID(),
      profile,
    });
    const metadata = await api.activateOwner(prepared);
    const metadataPath = join(root, ".course-owner/render-metadata.json");
    await Deno.writeTextFile(metadataPath, JSON.stringify(metadata));
    const text = await command([
      "render",
      ".",
      "--profile",
      profile,
      "--to",
      "html",
      "--execute",
      "--no-cache",
      "--no-execute-daemon",
      "--fail-if-warnings",
      "--metadata-file",
      metadataPath,
    ]);
    // The owner's pre/post hooks are passive during its actual render. Reuse
    // the existing assembler/validator on those actual fragments, without render.
    const { check } = await import(
      toFileUrl(join(extension, "application/check.ts")).href
    );
    const { runtime } = await import(
      toFileUrl(join(extension, "infrastructure/runtime.ts")).href
    );
    await check(runtime(root, [], false));
    // Seal the assembled private model together with the actual native fragments.
    const finished = await api.finishOwner(prepared);
    if (finished.exitCode !== 0) throw new Error(JSON.stringify(finished));
    await api.validateOwnerResources(prepared);
    return { success: true, text };
  } catch (error) {
    return {
      success: false,
      text: String(error) + "\n" + JSON.stringify(error),
    };
  } finally {
    // Every test call is a fresh attempt, including deliberate author mutations.
    // Only its private session is disposable; stale model cleanup is Core's hook.
    try {
      await Deno.remove(join(root, ".course-owner"), { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    if (previousProfile === undefined) Deno.env.delete("QUARTO_PROFILE");
    else Deno.env.set("QUARTO_PROFILE", previousProfile);
  }
}
