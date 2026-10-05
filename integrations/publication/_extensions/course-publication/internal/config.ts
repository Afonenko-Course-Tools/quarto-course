import { isAbsolute, relative, resolve } from "stdlib/path";
import { object, require } from "./failure.ts";
import type { BeforeRenderContext, Plan } from "./types.ts";
export function inside(root: string, path: string) {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith("../") && !isAbsolute(rel);
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value)) {
    return `{${
      Object.keys(value).sort().map((key) =>
        `${JSON.stringify(key)}:${canonical(value[key])}`
      ).join(",")
    }}`;
  }
  require(
    value === null || typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value)),
    "COURSE_PUBLICATION.CONFIG_INVALID",
    "non-JSON context value",
  );
  return JSON.stringify(value);
}
export function composition(ctx: BeforeRenderContext): Plan {
  const code = "COURSE_PUBLICATION.CONFIG_INVALID";
  require(
    isAbsolute(ctx.root) && isAbsolute(ctx.sourceRoot) &&
      resolve(ctx.root) === ctx.root &&
      resolve(ctx.sourceRoot) === ctx.sourceRoot,
    code,
    "absolute canonical context roots required",
  );
  require(/^[A-Za-z0-9_-]+$/.test(ctx.attemptId), code, "unsafe attempt id");
  const profile = ctx.profiles[0];
  require(
    ctx.profiles.length === 1 && (profile === "student" || profile === "full"),
    code,
    "one student/full audience required",
  );
  require(
    ctx.portal && typeof ctx.portal.input === "string" &&
      typeof ctx.portal.output === "string" &&
      inside(ctx.sourceRoot, ctx.portal.input),
    code,
    "managed portal required",
  );
  const selected = ctx.config["course-publication"];
  require(
    object(selected) &&
      Object.keys(selected).sort().join(",") === "core-extension,owned-members",
    code,
    "explicit owned-members and core-extension required; unknown fields refused",
  );
  const ownedMembers = selected["owned-members"],
    coreExtension = selected["core-extension"];
  require(
    Array.isArray(ownedMembers) &&
      ownedMembers.every((name) =>
        typeof name === "string" && /^[A-Za-z][A-Za-z0-9_-]*$/.test(name)
      ) && new Set(ownedMembers).size === ownedMembers.length,
    code,
    "unique owned member names required",
  );
  require(
    typeof coreExtension === "string" &&
      /^_extensions\/(?:[A-Za-z0-9._-]+\/)?course-core$/.test(coreExtension) &&
      !coreExtension.split("/").includes(".."),
    code,
    "installed Core path required",
  );
  require(
    Array.isArray(ctx.members) &&
      new Set(ctx.members.map((member) => member.namespace)).size ===
        ctx.members.length,
    code,
    "unique actual members required",
  );
  for (const member of ctx.members) {
    require(
      /^[A-Za-z][A-Za-z0-9_-]*$/.test(member.namespace) &&
        isAbsolute(member.path) && resolve(member.path) === member.path &&
        member.path !== ctx.sourceRoot && inside(ctx.sourceRoot, member.path),
      code,
      "actual member must be inside Source",
    );
    require(
      typeof member.mount === "string" &&
        /^[A-Za-z][A-Za-z0-9_-]*$/.test(member.mount) &&
        ["html", "revealjs", "pdf"].includes(member.format),
      code,
      "unsupported member mount/format",
    );
  }
  for (const name of ownedMembers) {
    const member = ctx.members.find((member) => member.namespace === name);
    require(
      member?.format === "html",
      code,
      `missing or unsupported owned HTML member: ${name}`,
    );
  }
  return {
    profile,
    coreExtension,
    ownedMembers: [...ownedMembers],
    binding: canonical({
      protocol: 1,
      root: ctx.root,
      sourceRoot: ctx.sourceRoot,
      attemptId: ctx.attemptId,
      profiles: ctx.profiles,
      config: ctx.config,
      members: ctx.members,
      portal: ctx.portal,
    }),
  };
}
