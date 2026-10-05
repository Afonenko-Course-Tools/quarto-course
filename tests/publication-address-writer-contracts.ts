// Pure address geometry; no owner session or native acceptance is claimed.
import { deferredPublicationAddress } from "../_extensions/course-core/owner-preflight/publication-addresses.ts";
import type { Session } from "../_extensions/course-core/owner-preflight/owner.ts";
import type { ResourceObservation } from "../_extensions/course-core/owner-preflight/resources.ts";
const root = "/attempt/sources/book";
const session = {
  root,
  audit: {
    coverage: { "index.qmd": { profiles: ["student", "full"] } },
    profiles: {},
  },
  publicationAddresses: {
    navigation: { root: "/attempt/sources" },
    member: { path: "book", mount: "book", format: "html" },
    contextHash: "a".repeat(64),
    addresses: [
      {
        member: "book",
        source: root + "/index.qmd",
        format: "html",
        target: "book/index.html",
      },
      {
        member: "handouts",
        source: "/attempt/sources/handouts/sheet.qmd",
        format: "pdf",
        target: "handouts/contracts.pdf",
      },
    ],
  },
} as unknown as Session;
const use = {
  kind: "Link" as const,
  target: "../handouts/contracts.pdf",
  order: 1,
};
const observation: ResourceObservation = {
  source: "index.qmd",
  effectiveBase: "index.qmd",
  profile: "student",
  phase: "render",
  outputDirectory: root + "/../../output/book",
  outputFile: root + "/../../output/book/index.html",
  raw: [use],
  projected: [use],
};
let checked = 0;
for (
  const convention of [
    {
      projectType: "default",
      outputFiles: [root + "/index.html", "index.html"],
      wrongConvention: "/attempt/output/book/index.html",
      wrongDirectory: root + "/other/index.html",
      wrongFilename: root + "/other.html",
    },
    {
      projectType: undefined,
      outputFiles: [root + "/index.html", "index.html"],
      wrongConvention: "/attempt/output/book/index.html",
      wrongDirectory: root + "/other/index.html",
      wrongFilename: root + "/other.html",
    },
    {
      projectType: "book",
      outputFiles: [
        root + "/../../output/book/index.html",
        "/attempt/output/book/index.html",
      ],
      wrongConvention: root + "/index.html",
      wrongDirectory: "/attempt/output/other/index.html",
      wrongFilename: "/attempt/output/book/other.html",
    },
    {
      projectType: "website",
      outputFiles: [
        root + "/../../output/book/index.html",
        "/attempt/output/book/index.html",
      ],
      wrongConvention: root + "/index.html",
      wrongDirectory: "/attempt/output/other/index.html",
      wrongFilename: "/attempt/output/book/other.html",
    },
  ]
) {
  for (const profile of ["student", "full"] as const) {
    session.audit.profiles[profile] = {
      config: { project: { type: convention.projectType } },
    };
    for (
      const outputFile of convention.outputFiles
    ) {
      const edge = await deferredPublicationAddress(
        session,
        { ...observation, profile, outputFile },
        use,
        "raw",
      );
      if (
        edge?.writer.outputFile !== "index.html" ||
        edge.address.target !== "handouts/contracts.pdf"
      ) throw new Error("current output writer missing");
      checked++;
    }
    for (
      const changes of [
        { outputFile: convention.wrongConvention },
        { outputFile: convention.wrongDirectory },
        { outputFile: convention.wrongFilename },
        { outputDirectory: undefined },
      ]
    ) {
      let error: unknown;
      try {
        await deferredPublicationAddress(
          session,
          { ...observation, profile, ...changes },
          use,
          "raw",
        );
      } catch (e) {
        error = e;
      }
      if (
        !String(error).includes("SOURCE.PUBLICATION_ADDRESS_WRITER_MISMATCH")
      ) {
        throw new Error(`accepted wrong writer ${JSON.stringify(changes)}`);
      }
      checked++;
    }
  }
}
for (const profile of ["student", "full"] as const) {
  for (
    const malformed of [
      undefined,
      { config: { project: { type: "unsupported" } } },
    ]
  ) {
    session.audit.profiles[profile] = malformed;
    let error: unknown;
    try {
      await deferredPublicationAddress(
        session,
        { ...observation, profile },
        use,
        "raw",
      );
    } catch (e) {
      error = e;
    }
    if (
      !String(error).includes("SOURCE.PUBLICATION_ADDRESS_WRITER_UNSUPPORTED")
    ) {
      throw new Error("accepted writer without frozen native project facts");
    }
    checked++;
  }
}
console.log(
  `PASS publication address current-writer contracts: ${checked} checks; pure only`,
);
