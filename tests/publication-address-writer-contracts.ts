// Pure address geometry; no owner session or native acceptance is claimed.
import { deferredPublicationAddress } from "../_extensions/course-core/owner-preflight/publication-addresses.ts";
import type { Session } from "../_extensions/course-core/owner-preflight/owner.ts";
import type { ResourceObservation } from "../_extensions/course-core/owner-preflight/resources.ts";
const root = "/attempt/sources/book";
const session = {
  root,
  audit: { coverage: { "index.qmd": { profiles: ["student", "full"] } } },
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
for (const profile of ["student", "full"] as const) {
  for (
    const outputFile of [
      observation.outputFile!,
      "/attempt/output/book/index.html",
    ]
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
      { outputFile: root + "/index.html" },
      { outputFile: "/attempt/output/other/index.html" },
      { outputFile: "/attempt/output/book/other.html" },
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
    if (!String(error).includes("SOURCE.PUBLICATION_ADDRESS_WRITER_MISMATCH")) {
      throw new Error(`accepted wrong writer ${JSON.stringify(changes)}`);
    }
    checked++;
  }
}
console.log(
  `PASS publication address current-writer contracts: ${checked} checks; pure only`,
);
