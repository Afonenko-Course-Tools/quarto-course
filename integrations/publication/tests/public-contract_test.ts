// Compile-time compatibility with actual public packages; no native proof seeds.
import prepare from "../_extensions/course-publication/entrypoints/prepare.ts";
import finish from "../_extensions/course-publication/entrypoints/finish.ts";
import verify from "../_extensions/course-publication/entrypoints/verify.ts";
import type { Integration } from "../../../../quarto-project-publish/_extensions/project-publish/domain/model.ts";
import type { PreparedOwner } from "../../../_extensions/course-core/owner-preflight/owner.ts";
import type { core } from "../_extensions/course-publication/internal/core.ts";
import type { OwnerHandle } from "../_extensions/course-publication/internal/types.ts";
import type * as owner from "../../../_extensions/course-core/owner-preflight/owner.ts";
import type * as navigation from "../../../_extensions/course-core/owner-preflight/navigation.ts";
import type * as resources from "../../../_extensions/course-core/owner-preflight/publication-resources.ts";
const integrations: Integration[] = [prepare, finish, verify];
function coreTypes(value: PreparedOwner): OwnerHandle {
  return value;
}
function adapterTypes(value: OwnerHandle): PreparedOwner {
  return value;
}
function coreApi(
  ownerApi: typeof owner,
  navigationApi: typeof navigation,
  resourceApi: typeof resources,
): Awaited<ReturnType<typeof core>> {
  return { owner: ownerApi, navigation: navigationApi, resources: resourceApi };
}
Deno.test("public callbacks and Core protocol are structurally assignable", () => {
  if (integrations.length !== 3 || !coreTypes || !adapterTypes || !coreApi) {
    throw new Error("public contract changed");
  }
});
