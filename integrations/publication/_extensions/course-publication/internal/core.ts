import { join, relative, resolve, toFileUrl } from "stdlib/path";
import { canonical, inside } from "./config.ts";
import { PublicationFailure, require } from "./failure.ts";
import type {
  BeforeRenderContext,
  OwnerHandle,
  Plan,
  Portal,
} from "./types.ts";
interface CoreOwner {
  withOwnerValidationScope<T>(action: () => Promise<T>): Promise<T>;
  prepareOwner(
    root: string,
    options: {
      attemptId: string;
      profile: "student" | "full";
      extension: string;
      publicationAddresses: { navigation: OwnerHandle };
    },
  ): Promise<OwnerHandle>;
  activateOwner(
    handle: OwnerHandle,
    options: { output: string },
  ): Promise<Record<string, unknown>>;
  finishOwner(
    handle: OwnerHandle,
    options: {
      publicationAddresses: {
        output: string;
        members: {
          path: string;
          mount: string;
          format: string;
          output: string;
        }[];
      };
    },
  ): Promise<{ exitCode: number }>;
  validateOwnerResources(handle: OwnerHandle): Promise<unknown>;
}
interface CoreNavigation {
  prepareNavigationOwner(
    root: string,
    options: {
      attemptId: string;
      profile: "student" | "full";
      extension: string;
      portal: Portal;
      members: BeforeRenderContext["members"];
    },
  ): Promise<OwnerHandle>;
  activateNavigationOwner(
    handle: OwnerHandle,
  ): Promise<Record<string, unknown>>;
  finishNavigationOwner(
    handle: OwnerHandle,
    options: { output: string },
  ): Promise<{ exitCode: number }>;
}
interface CoreResources {
  sealNavigationPublicationResources(
    handle: OwnerHandle,
    options: {
      output: string;
      members: {
        path: string;
        mount: string;
        format: string;
        output: string;
        owner?: OwnerHandle;
      }[];
    },
  ): Promise<{ profile: "student" | "full"; receiptHash: string }>;
  validateNavigationPublicationResources(
    handle: OwnerHandle,
  ): Promise<{ profile: "student" | "full"; receiptHash: string }>;
}
async function regular(root: string, path: string, directory = false) {
  require(
    inside(root, path),
    "COURSE_PUBLICATION.CORE_REQUIRED",
    "Core outside Source",
  );
  const base = await Deno.lstat(root);
  require(
    base.isDirectory && !base.isSymlink && await Deno.realPath(root) === root,
    "COURSE_PUBLICATION.CORE_REQUIRED",
    "canonical Source directory required",
  );
  let current = root;
  for (const part of relative(root, path).split("/")) {
    current = join(current, part);
    const info = await Deno.lstat(current);
    require(
      !info.isSymlink,
      "COURSE_PUBLICATION.CORE_REQUIRED",
      "linked Core installation",
    );
  }
  const info = await Deno.lstat(path);
  require(
    directory ? info.isDirectory : info.isFile,
    "COURSE_PUBLICATION.CORE_REQUIRED",
    path,
  );
}
async function payload(directory: string) {
  const files: Record<
    string,
    { sha256: string; bytes: number; mode: number | null }
  > = Object.create(null);
  async function visit(path: string, prefix = "") {
    for await (const entry of Deno.readDir(path)) {
      const target = join(path, entry.name),
        name = prefix + entry.name,
        info = await Deno.lstat(target);
      require(
        !info.isSymlink,
        "COURSE_PUBLICATION.CORE_MISMATCH",
        `linked Core payload: ${name}`,
      );
      if (info.isDirectory) await visit(target, name + "/");
      else {
        require(
          info.isFile,
          "COURSE_PUBLICATION.CORE_MISMATCH",
          `non-file Core payload: ${name}`,
        );
        const bytes = await Deno.readFile(target);
        files[name] = {
          sha256: [
            ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          ].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
          bytes: bytes.length,
          mode: info.mode === null ? null : info.mode & 0o777,
        };
      }
    }
  }
  await visit(directory);
  return canonical(files);
}
/** Whole installed version compatibility once at preparation, not each callback. */
export async function compatiblePackages(ctx: BeforeRenderContext, plan: Plan) {
  const expected = await payload(resolve(ctx.sourceRoot, plan.coreExtension));
  for (const name of plan.ownedMembers) {
    const member = ctx.members.find((member) => member.namespace === name)!;
    require(
      await payload(resolve(member.path, plan.coreExtension)) === expected,
      "COURSE_PUBLICATION.CORE_MISMATCH",
      `whole installed Core differs: ${name}`,
    );
  }
}
/** Load only the configured whole installed Core in this actual Source snapshot. */
export async function core(ctx: BeforeRenderContext, plan: Plan) {
  const paths = [
    ctx.sourceRoot,
    ...plan.ownedMembers.map((name) =>
      ctx.members.find((member) => member.namespace === name)!.path
    ),
  ];
  try {
    for (const owner of paths) {
      const extension = resolve(owner, plan.coreExtension);
      await regular(ctx.sourceRoot, extension, true);
      await regular(ctx.sourceRoot, join(extension, "_extension.yml"));
      for (
        const path of ["owner.ts", "navigation.ts", "publication-resources.ts"]
      ) {
        await regular(ctx.sourceRoot, join(extension, "owner-preflight", path));
      }
    }
    const extension = resolve(
      ctx.sourceRoot,
      plan.coreExtension,
      "owner-preflight",
    );
    const owner: CoreOwner = await import(
      toFileUrl(join(extension, "owner.ts")).href
    );
    const navigation: CoreNavigation = await import(
      toFileUrl(join(extension, "navigation.ts")).href
    );
    const resources: CoreResources = await import(
      toFileUrl(join(extension, "publication-resources.ts")).href
    );
    for (
      const [api, names] of [[owner, [
        "withOwnerValidationScope",
        "prepareOwner",
        "activateOwner",
        "finishOwner",
        "validateOwnerResources",
      ]], [navigation, [
        "prepareNavigationOwner",
        "activateNavigationOwner",
        "finishNavigationOwner",
      ]], [resources, [
        "sealNavigationPublicationResources",
        "validateNavigationPublicationResources",
      ]]] as const
    ) {
      for (const name of names) {
        require(
          typeof (api as unknown as Record<string, unknown>)[name] ===
            "function",
          "COURSE_PUBLICATION.CORE_REQUIRED",
          name,
        );
      }
    }
    return { owner, navigation, resources };
  } catch (error) {
    if (error instanceof PublicationFailure) throw error;
    throw new PublicationFailure(
      "COURSE_PUBLICATION.CORE_REQUIRED",
      error instanceof Error ? error.message : "Core import failed",
    );
  }
}
