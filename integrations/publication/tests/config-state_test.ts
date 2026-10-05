// Synthetic composition/state checks only; these are not native owner proofs.
import { assertEquals, assertRejects, assertThrows } from "./assert.ts";
import { join } from "stdlib/path";
import { composition } from "../_extensions/course-publication/internal/config.ts";
import {
  currentMembers,
  load,
  save,
} from "../_extensions/course-publication/internal/state.ts";
import { readPublicationStatus } from "../_extensions/course-publication/publication.ts";
import type {
  BeforeRenderContext,
  State,
} from "../_extensions/course-publication/internal/types.ts";

function context(root: string): BeforeRenderContext {
  const sourceRoot = join(root, "source");
  return {
    root: join(root, "coordinator"),
    sourceRoot,
    attemptId: "test-attempt",
    profiles: ["student"],
    config: {
      "course-publication": {
        "owned-members": ["exercises", "labs"],
        "core-extension": "_extensions/course-core",
      },
    },
    members: ["exercises", "labs", "slides"].map((namespace) => ({
      namespace,
      path: join(sourceRoot, namespace),
      mount: namespace,
      format: namespace === "slides" ? "revealjs" : "html",
    })),
    portal: {
      input: join(sourceRoot, "index.qmd"),
      output: join(root, "native"),
      renderProfiles: ["student", "publish-portal"],
      control: join(sourceRoot, "_quarto-publish-portal.yml"),
      controlHash: "a".repeat(64),
      configHashes: {},
    },
  };
}

Deno.test("composition accepts renamed, two and empty explicit owned selections", () => {
  const ctx = context("/tmp/course-publication-config");
  assertEquals(composition(ctx).ownedMembers, ["exercises", "labs"]);
  for (const owned of [["labs"], []]) {
    ctx.config["course-publication"] = {
      "owned-members": owned,
      "core-extension": "_extensions/org/course-core",
    };
    assertEquals(composition(ctx).ownedMembers, owned);
    assertEquals(composition(ctx).coreExtension, "_extensions/org/course-core");
  }
});
for (
  const [name, mutate] of [
    ["missing selection", (c: BeforeRenderContext) => {
      delete c.config["course-publication"];
    }],
    ["implicit selection", (c: BeforeRenderContext) => {
      c.config["course-publication"] = {
        "core-extension": "_extensions/course-core",
      };
    }],
    ["unknown member", (c: BeforeRenderContext) => {
      (c.config["course-publication"] as any)["owned-members"] = ["tasks"];
    }],
    ["duplicate member", (c: BeforeRenderContext) => {
      (c.config["course-publication"] as any)["owned-members"] = [
        "labs",
        "labs",
      ];
    }],
    ["owned Reveal", (c: BeforeRenderContext) => {
      (c.config["course-publication"] as any)["owned-members"] = ["slides"];
    }],
    ["unknown option", (c: BeforeRenderContext) => {
      (c.config["course-publication"] as any).discover = true;
    }],
    ["escaping extension", (c: BeforeRenderContext) => {
      (c.config["course-publication"] as any)["core-extension"] =
        "../course-core";
    }],
    ["escaping member", (c: BeforeRenderContext) => {
      c.members[0].path = join(c.sourceRoot, "../other");
    }],
    ["missing portal", (c: BeforeRenderContext) => {
      delete c.portal;
    }],
    ["unknown profile", (c: BeforeRenderContext) => {
      c.profiles = ["teacher"];
    }],
    ["two audiences", (c: BeforeRenderContext) => {
      c.profiles = ["student", "full"];
    }],
    ["unsafe attempt", (c: BeforeRenderContext) => {
      c.attemptId = "../other";
    }],
  ] as const
) {
  Deno.test(`composition refuses ${name}`, () => {
    const ctx = context("/tmp/course-publication-config");
    mutate(ctx);
    assertThrows(() => composition(ctx), Error, "COURSE_PUBLICATION.");
  });
}

async function fixture() {
  const root = await Deno.makeTempDir({ prefix: "publication-state-" });
  const ctx = context(root), plan = composition(ctx);
  await Deno.mkdir(join(ctx.root, ".project-publish/builds", ctx.attemptId), {
    recursive: true,
  });
  const handle = (path: string) => ({
    protocol: 1 as const,
    root: path,
    attemptId: ctx.attemptId,
    profile: "student" as const,
    sessionId: "synthetic-state-only",
    sessionPath: join(path, ".course-owner/session.json"),
    sessionHash: "a".repeat(64),
  });
  const state: State = {
    protocol: 1,
    binding: plan.binding,
    navigation: handle(ctx.sourceRoot),
    owners: Object.fromEntries(
      plan.ownedMembers.map((name) => [
        name,
        handle(ctx.members.find((m) => m.namespace === name)!.path),
      ]),
    ),
    nativeMembers: {},
  };
  await save(ctx, state, true);
  return { root, ctx, state };
}
Deno.test("private state binds Source, coordinator, attempt, config, member plan and portal", async () => {
  const f = await fixture();
  try {
    assertEquals((await load(f.ctx)).binding, composition(f.ctx).binding);
    for (
      const change of [
        (c: BeforeRenderContext) => {
          c.root += "-other";
        },
        (c: BeforeRenderContext) => {
          c.sourceRoot += "-other";
        },
        (c: BeforeRenderContext) => {
          c.attemptId += "-other";
        },
        (c: BeforeRenderContext) => {
          c.profiles = ["full"];
        },
        (c: BeforeRenderContext) => {
          c.config.unrelated = "changed callback input";
        },
        (c: BeforeRenderContext) => {
          c.members[0].mount = "renamed";
        },
        (c: BeforeRenderContext) => {
          c.portal!.output += "-other";
        },
        (c: BeforeRenderContext) => {
          (c.config["course-publication"] as any)["owned-members"] = ["labs"];
        },
      ]
    ) {
      const ctx = structuredClone(f.ctx);
      change(ctx);
      await assertRejects(() => load(ctx), Error, "COURSE_PUBLICATION.");
    }
    const file = join(
      f.ctx.root,
      ".project-publish/builds",
      f.ctx.attemptId,
      "course-publication.json",
    );
    const damaged = structuredClone(f.state);
    damaged.owners.exercises.root += "-foreign";
    await Deno.writeTextFile(file, JSON.stringify(damaged));
    await assertRejects(
      () => load(f.ctx),
      Error,
      "COURSE_PUBLICATION.STATE_CHANGED",
    );
  } finally {
    await Deno.remove(f.root, { recursive: true });
  }
});
Deno.test("legal Object.prototype member names use only own registrations and handles", async () => {
  const f = await fixture();
  try {
    f.ctx.members[0].namespace = "constructor";
    f.ctx.members[2].namespace = "toString";
    (f.ctx.config["course-publication"] as any)["owned-members"] = [
      "constructor",
      "labs",
    ];
    f.state.binding = composition(f.ctx).binding;
    f.state.owners = {
      constructor: f.state.owners.exercises,
      labs: f.state.owners.labs,
    };
    await save(f.ctx, f.state);
    const state = await load(f.ctx);
    assertThrows(
      () => currentMembers(f.ctx, state),
      Error,
      "current native output absent: constructor",
    );
    state.nativeMembers = Object.fromEntries(
      f.ctx.members.map((
        member,
      ) => [member.namespace, {
        output: join(f.root, "native", member.namespace),
        format: member.format,
      }]),
    );
    assertEquals(currentMembers(f.ctx, state).map((member) => !!member.owner), [
      true,
      true,
      false,
    ]);
  } finally {
    await Deno.remove(f.root, { recursive: true });
  }
});
Deno.test("diagnostic read exposes only a detached summary, never owner handles or writes", async () => {
  const f = await fixture();
  try {
    const before = await Deno.readTextFile(
      join(
        f.ctx.root,
        ".project-publish/builds",
        f.ctx.attemptId,
        "course-publication.json",
      ),
    );
    const summary = await readPublicationStatus(f.ctx);
    assertEquals(Object.keys(summary).sort(), [
      "attemptId",
      "ownedMembers",
      "profile",
      "sourceRoot",
    ]);
    assertEquals(summary.ownedMembers, ["exercises", "labs"]);
    summary.ownedMembers.pop();
    assertEquals((await readPublicationStatus(f.ctx)).ownedMembers, [
      "exercises",
      "labs",
    ]);
    assertEquals(
      await Deno.readTextFile(
        join(
          f.ctx.root,
          ".project-publish/builds",
          f.ctx.attemptId,
          "course-publication.json",
        ),
      ),
      before,
    );
  } finally {
    await Deno.remove(f.root, { recursive: true });
  }
});
