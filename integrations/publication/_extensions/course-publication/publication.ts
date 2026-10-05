import { composition } from "./internal/config.ts";
import { compatiblePackages, core } from "./internal/core.ts";
import { require } from "./internal/failure.ts";
import { currentMembers, load, save } from "./internal/state.ts";
import type {
  BeforeRenderContext,
  PublicationContext,
  PublicationStatus,
  RenderContext,
  State,
} from "./internal/types.ts";
export type {
  BeforeRenderContext,
  PublicationContext,
  PublicationStatus,
  RenderContext,
} from "./internal/types.ts";

export async function prepare(ctx: BeforeRenderContext) {
  const plan = composition(ctx), api = await core(ctx, plan);
  await api.owner.withOwnerValidationScope(async () => {
    await compatiblePackages(ctx, plan);
    const navigation = await api.navigation.prepareNavigationOwner(
      ctx.sourceRoot,
      {
        attemptId: ctx.attemptId,
        profile: plan.profile,
        extension: plan.coreExtension,
        portal: ctx.portal!,
        members: ctx.members,
      },
    );
    const owners: State["owners"] = Object.create(null);
    for (const name of plan.ownedMembers) {
      const member = ctx.members.find((member) => member.namespace === name)!;
      owners[name] = await api.owner.prepareOwner(member.path, {
        attemptId: ctx.attemptId,
        profile: plan.profile,
        extension: plan.coreExtension,
        publicationAddresses: { navigation },
      });
    }
    await save(ctx, {
      protocol: 1,
      binding: plan.binding,
      navigation,
      owners,
      nativeMembers: {},
    }, true);
  });
}
export async function metadata(
  ctx: RenderContext,
): Promise<Record<string, unknown>> {
  const plan = composition(ctx),
    state = await load(ctx),
    api = await core(ctx, plan);
  if (ctx.namespace === undefined) {
    require(
      ctx.portal && ctx.output === ctx.portal.output && ctx.format === "html",
      "COURSE_PUBLICATION.CONTEXT_INVALID",
      "actual namespace-less portal required",
    );
    return await api.navigation.activateNavigationOwner(state.navigation);
  }
  const member = ctx.members.find((member) =>
    member.namespace === ctx.namespace
  );
  require(
    member && member.format === ctx.format &&
      !Object.hasOwn(state.nativeMembers, ctx.namespace),
    "COURSE_PUBLICATION.CONTEXT_INVALID",
    "missing/repeated current native member",
  );
  const result = Object.hasOwn(state.owners, ctx.namespace)
    ? await api.owner.activateOwner(state.owners[ctx.namespace], {
      output: ctx.output,
    })
    : {};
  state.nativeMembers[ctx.namespace] = {
    output: ctx.output,
    format: ctx.format,
  };
  await save(ctx, state);
  return result;
}
export async function finish(ctx: PublicationContext) {
  const plan = composition(ctx), api = await core(ctx, plan);
  await api.owner.withOwnerValidationScope(async () => {
    const state = await load(ctx), current = currentMembers(ctx, state);
    require(
      !state.publication,
      "COURSE_PUBLICATION.STATE_CHANGED",
      "publication already sealed",
    );
    for (const name of plan.ownedMembers) {
      const result = await api.owner.finishOwner(state.owners[name], {
        publicationAddresses: { output: ctx.stage, members: current },
      });
      require(
        result.exitCode === 0,
        "COURSE_PUBLICATION.COMPLETION_REFUSED",
        `current child: ${name}`,
      );
      await api.owner.validateOwnerResources(state.owners[name]);
    }
    const result = await api.navigation.finishNavigationOwner(
      state.navigation,
      { output: ctx.stage },
    );
    require(
      result.exitCode === 0,
      "COURSE_PUBLICATION.COMPLETION_REFUSED",
      "current navigation",
    );
    const receipt = await api.resources.sealNavigationPublicationResources(
      state.navigation,
      { output: ctx.stage, members: current },
    );
    state.publication = {
      profile: receipt.profile,
      receiptHash: receipt.receiptHash,
      stage: ctx.stage,
    };
    await save(ctx, state);
  });
}
export async function verify(ctx: PublicationContext) {
  const plan = composition(ctx), api = await core(ctx, plan);
  await api.owner.withOwnerValidationScope(async () => {
    const state = await load(ctx);
    require(
      state.publication?.stage === ctx.stage,
      "COURSE_PUBLICATION.STATE_CHANGED",
      "current sealed stage required",
    );
    const receipt = await api.resources.validateNavigationPublicationResources(
      state.navigation,
    );
    require(
      receipt.profile === plan.profile &&
        receipt.receiptHash === state.publication.receiptHash,
      "COURSE_PUBLICATION.STATE_CHANGED",
      "current sealed provider receipt required",
    );
  });
}
/** Diagnostics only: detached summary, no owner handles, authority, writes or proof. */
export async function readPublicationStatus(
  ctx: BeforeRenderContext,
): Promise<PublicationStatus> {
  const plan = composition(ctx), state = await load(ctx);
  return structuredClone({
    attemptId: ctx.attemptId,
    sourceRoot: ctx.sourceRoot,
    profile: plan.profile,
    ownedMembers: plan.ownedMembers,
    ...(state.publication ? { publication: state.publication } : {}),
  });
}
