import { isAbsolute, join } from "stdlib/path";
import { canonical, composition, inside } from "./config.ts";
import { object, PublicationFailure, require } from "./failure.ts";
import type { BeforeRenderContext, OwnerHandle, State } from "./types.ts";
const file = (ctx: BeforeRenderContext) =>
  join(
    ctx.root,
    ".project-publish/builds",
    ctx.attemptId,
    "course-publication.json",
  );
function handle(value: unknown, root: string, ctx: BeforeRenderContext) {
  require(
    object(value) && value.protocol === 1 && value.root === root &&
      value.attemptId === ctx.attemptId && value.profile === ctx.profiles[0] &&
      typeof value.sessionId === "string" && !!value.sessionId &&
      typeof value.sessionPath === "string" && isAbsolute(value.sessionPath) &&
      inside(root, value.sessionPath) &&
      typeof value.sessionHash === "string" &&
      /^[a-f0-9]{64}$/.test(value.sessionHash),
    "COURSE_PUBLICATION.STATE_CHANGED",
    "foreign or malformed Core handle",
  );
}
function validate(
  ctx: BeforeRenderContext,
  state: unknown,
): asserts state is State {
  const plan = composition(ctx), code = "COURSE_PUBLICATION.STATE_CHANGED";
  require(
    object(state) && state.protocol === 1 && state.binding === plan.binding &&
      object(state.owners) && object(state.nativeMembers),
    code,
    "current source/attempt/profile/plan required",
  );
  require(
    Object.keys(state).every((key) =>
      [
        "protocol",
        "binding",
        "navigation",
        "owners",
        "nativeMembers",
        "publication",
      ].includes(key)
    ),
    code,
    "unknown state field",
  );
  handle(state.navigation, ctx.sourceRoot, ctx);
  require(
    canonical(Object.keys(state.owners).sort()) ===
      canonical([...plan.ownedMembers].sort()),
    code,
    "current owner set required",
  );
  for (const name of plan.ownedMembers) {
    handle(
      state.owners[name],
      ctx.members.find((member) => member.namespace === name)!.path,
      ctx,
    );
  }
  for (const [name, current] of Object.entries(state.nativeMembers)) {
    const member = ctx.members.find((member) => member.namespace === name);
    require(
      member && object(current) && current.format === member.format &&
        typeof current.output === "string" && isAbsolute(current.output) &&
        !inside(ctx.sourceRoot, current.output),
      code,
      "foreign native output registration",
    );
  }
  if (Object.hasOwn(state, "publication")) {
    const receipt = state.publication;
    require(
      object(receipt) && receipt.profile === plan.profile &&
        typeof receipt.receiptHash === "string" &&
        /^[a-f0-9]{64}$/.test(receipt.receiptHash) &&
        typeof receipt.stage === "string" && isAbsolute(receipt.stage) &&
        !inside(ctx.sourceRoot, receipt.stage),
      code,
      "invalid sealed publication summary",
    );
  }
}
async function regularState(ctx: BeforeRenderContext, exists: boolean) {
  const path = file(ctx),
    parent = join(ctx.root, ".project-publish/builds", ctx.attemptId);
  require(
    await Deno.realPath(parent) === parent,
    "COURSE_PUBLICATION.STATE_CHANGED",
    "linked attempt storage",
  );
  try {
    const info = await Deno.lstat(path);
    require(
      info.isFile && !info.isSymlink && info.nlink === 1,
      "COURSE_PUBLICATION.STATE_CHANGED",
      "non-regular state",
    );
    require(
      exists,
      "COURSE_PUBLICATION.STATE_EXISTS",
      "already prepared attempt",
    );
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
    require(
      !exists,
      "COURSE_PUBLICATION.STATE_REQUIRED",
      "prepared attempt state absent",
    );
  }
  return path;
}
export async function load(ctx: BeforeRenderContext): Promise<State> {
  composition(ctx);
  try {
    const path = await regularState(ctx, true),
      state = JSON.parse(await Deno.readTextFile(path));
    validate(ctx, state);
    return state;
  } catch (error) {
    if (error instanceof PublicationFailure) throw error;
    throw new PublicationFailure(
      "COURSE_PUBLICATION.STATE_REQUIRED",
      error instanceof Error ? error.message : "invalid private state",
    );
  }
}
/** Internal only: public adapter modules never export this state writer. */
export async function save(
  ctx: BeforeRenderContext,
  state: State,
  initial = false,
) {
  validate(ctx, state);
  const path = await regularState(ctx, !initial);
  await Deno.writeTextFile(path, JSON.stringify(state), { createNew: initial });
}
export function currentMembers(ctx: BeforeRenderContext, state: State) {
  return ctx.members.map((member) => {
    const current = Object.hasOwn(state.nativeMembers, member.namespace) &&
      state.nativeMembers[member.namespace];
    require(
      current && current.format === member.format,
      "COURSE_PUBLICATION.STATE_CHANGED",
      `current native output absent: ${member.namespace}`,
    );
    return {
      path: member.path,
      mount: member.mount,
      format: member.format,
      output: current.output,
      ...(Object.hasOwn(state.owners, member.namespace)
        ? { owner: state.owners[member.namespace] as OwnerHandle }
        : {}),
    };
  });
}
