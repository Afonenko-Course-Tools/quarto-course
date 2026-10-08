# Final consumers integration

Core runtime: `0ddb4638df096bf4969cb0f30c99e1e7dde9b095`.

## Descriptor versions

- quarto-project-publish: 5.0.0, commit `08d7f1ba7369cc91531689844c7a54775338636e`; only `_extensions/course-site/_extension.yml` version line.

- quarto-reference-catalog: 3.0.0, commit `b3e59c1c37e1e8dec3c4ad50f048a4f7313496ef`; only `_extensions/reference-catalog/_extension.yml` version line.

- quarto-course-print: 0.3.0, commit `177d3a180dd95a14922f960749ca664c39c3e21d`; only `_extensions/course-print/_extension.yml` version line.

- quarto-course-moodle: 0.3.0, commit `1041b9885d58d4e8311a72f81405f864f7454df3`; only `_extensions/course-moodle/_extension.yml` version line.

- quarto-course-prairielearn: 3.0.0, commit `c0e2308d7d9e14396d9e15a833f1c4e4d6acb092`; only `_extensions/course-prairielearn/_extension.yml` version line.

- quarto-course-cloud: 3.0.0, commit `22b3d6fbca0b453fe082639d2bc63163ddf42044`; only `_extensions/course-cloud/_extension.yml` version line.

- quarto-project-download: 2.0.0, commit `e71675030bde684aa5352993809132086cf4dfdf`; only `_extensions/project-download/_extension.yml` version line.

## Inputs

Snapshot bytes recorded in `snapshot-manifest.json`; mutable docs/examples copied once before tests. Core extracted from exact archive SHA. QRC baseline tag peeled to d06adf5a30f01eec834dd5f2a34f4e6bd9ec99b7.

- publisher/native-warnings: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-project-publish`, command `quarto run tests/site-native.ts warnings`, env override `{}`, exit 0, 23.1s; `native-warnings.log`.

QRC compatibility baseline: every `_extensions/reference-catalog` runtime byte equals published `v2.2.1` tag; only descriptor version/minimum differs. Two-way exhaustive file comparison, exit 0.

- publisher/native: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-project-publish`, command `quarto run tests/site-native.ts`, env override `{'COURSE_SITE_TEST_ROOT': '/tmp/consumers-final-integration-20261008/native'}`, exit 0, 114.1s; `native.log`.

- publisher/domains-default: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-project-publish`, command `quarto run tests/site-domains.ts`, env override `{'COURSE_SITE_DOMAIN_ROOT': '/tmp/consumers-final-integration-20261008/domains-default'}`, exit 1, 60.0s; `domains-default.log`.

## Narrow assertion correction

Initial default suite exit 1 at site-domains.ts:406: obsolete filename substring expectation. Genuine failed native output preserved in `default-collector-red-native.log`; direct `quarto render --profile student` reproduction exit 1 in `default-diagnostic-reproduce.log`. Frozen Core refuses removed hooks through `NATIVE.RUN_NOT_CURRENT`, source part, field native-run. Root approved scoped assertion correction; no runtime change. New assertion requires exact diagnostic ID/context and checks absent part native completion plus absent root/mounted HTML publication. Original snapshot manifest will be supplemented with this exact test delta/hash.

- publisher-resume/domains-default: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-project-publish`, command `quarto run tests/site-domains.ts`, env override `{'COURSE_SITE_DOMAIN_ROOT': '/tmp/consumers-final-integration-20261008/domains-default-green'}`, exit 0, 110.5s; `domains-default.log`.

Correction commit `f62770f958acdd879e4fb6cdfc52251c603ed007`: only tests/site-domains.ts; complete default GREEN exit 0, 110.5s. Original manifest plus snapshot-delta.json defines tested inputs.

- publisher-resume/domains-resources: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-project-publish`, command `quarto run tests/site-domains.ts resources`, env override `{'COURSE_SITE_DOMAIN_ROOT': '/tmp/consumers-final-integration-20261008/domains-resources'}`, exit 0, 60.2s; `domains-resources.log`.

- publisher-resume/domains-rootless: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-project-publish`, command `quarto run tests/site-domains.ts rootless`, env override `{'COURSE_SITE_DOMAIN_ROOT': '/tmp/consumers-final-integration-20261008/domains-rootless'}`, exit 0, 61.9s; `domains-rootless.log`.

- publisher-resume/domains-smoke: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-project-publish`, command `quarto run tests/site-domains.ts smoke`, env override `{'COURSE_SITE_DOMAIN_ROOT': '/tmp/consumers-final-integration-20261008/domains-smoke'}`, exit 0, 29.5s; `domains-smoke.log`.

- publisher-resume/child-default: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-project-publish`, command `quarto run tests/site-child-profiles.ts default`, env override `{}`, exit 0, 22.5s; `child-default.log`.

- publisher-resume/child-group: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-project-publish`, command `quarto run tests/site-child-profiles.ts group`, env override `{}`, exit 0, 24.3s; `child-group.log`.

- publisher-resume/preview: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-project-publish`, command `quarto run tests/site-preview.ts /tmp/consumers-final-integration-20261008/native`, env override `{}`, exit 1, 0.7s; `preview.log`.

Before final QRC tests only examples snapshots refreshed from stable final commits Pub `0f914973b1a78f4ed59453a37f134025f73b7dda`, QRC `46ca2477e34ef3d85839c5e52b2c37a0b0244a40`; exact hashes in final-examples-manifest.json. Frozen runtime and all existing fixtures unchanged.

- preview/preview-authorized: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-project-publish`, command `quarto run tests/site-preview.ts /tmp/consumers-final-integration-20261008/native`, env override `{}`, exit 0, 26.1s; `preview-authorized.log`.

- preview/preview-course-authorized: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-project-publish`, command `quarto run tests/site-preview.ts /tmp/consumers-final-integration-20261008/domains-resources --course`, env override `{}`, exit 0, 32.7s; `preview-course-authorized.log`.

- baseline/domains-baseline: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-project-publish`, command `quarto run tests/site-domains.ts smoke`, env override `{'COURSE_SITE_DOMAIN_ROOT': '/tmp/consumers-final-integration-20261008/domains-baseline', 'QRC_PROVIDER': '/tmp/consumers-final-integration-20261008/snapshots/qrc-v2.2.1'}`, exit 0, 30.3s; `domains-baseline.log`.

Runtime/test/schema snapshot bytes equal final prepared repo HEADs, exhaustive comparison exit0; current HEADs saved in runtime-provenance.json. Examples have separately verified final commits/hashes.

- qrc/composition: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-reference-catalog`, command `quarto run tests/composition.ts`, env override `{}`, exit 0, 73.4s; `composition.log`.

- qrc/example: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-reference-catalog`, command `quarto run tests/example.ts`, env override `{}`, exit 1, 32.4s; `example.log`.

QRC example initial RED exit1: tests hardcoded historical demo-20261007-ru1 source URLs, final examples use v3.0.0. Red retained example-red.log. Narrow correction only exact expected source tag in tests/example.ts and tests/demo-external.ts; source duplicate and native action requirements remain strict. No runtime or example change.

- qrc-resume/example: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-reference-catalog`, command `quarto run tests/example.ts`, env override `{}`, exit 0, 45.7s; `example.log`.

- qrc-resume/export-context: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-reference-catalog`, command `quarto run tests/export-context.ts`, env override `{}`, exit 0, 5.2s; `export-context.log`.

- qrc-resume/profile-publication: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-reference-catalog`, command `quarto run tests/profile-publication.ts`, env override `{}`, exit 0, 0.8s; `profile-publication.log`.

- qrc-resume/full-outputs: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-reference-catalog`, command `quarto run tests/full-outputs.ts`, env override `{}`, exit 0, 0.8s; `full-outputs.log`.

- qrc-resume/search-publication: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-reference-catalog`, command `quarto run tests/search-publication.ts`, env override `{}`, exit 0, 0.8s; `search-publication.log`.

- qrc-resume/search: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-reference-catalog`, command `quarto run tests/search.ts`, env override `{}`, exit 0, 0.8s; `search.log`.

- qrc-resume/native-local: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-reference-catalog`, command `quarto run tests/native-local.ts`, env override `{}`, exit 0, 15.6s; `native-local.log`.

- qrc-resume/demo-external: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-reference-catalog`, command `quarto run tests/demo-external.ts`, env override `{}`, exit 0, 5.4s; `demo-external.log`.

- qrc-resume/imports: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-reference-catalog`, command `quarto run tests/imports.ts`, env override `{}`, exit 0, 0.5s; `imports.log`.

- qrc-resume/external: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-reference-catalog`, command `quarto run tests/external.ts`, env override `{}`, exit 0, 25.4s; `external.log`.

- qrc-resume/browser: cwd `/tmp/consumers-final-integration-20261008/snapshots/quarto-reference-catalog`, command `npm run test:browser`, env override `{}`, exit 0, 11.0s; `browser.log`.

## Final outcome

Publisher integration complete against exact frozen Core: native/warnings, default/resources/rootless/smoke, native child default/group, standalone and Core course previews all final exit0. Published QRC v2.2.1 smoke compatibility exit0; candidate QRC runtime unchanged byte-for-byte except descriptor version/minimum.

QRC final composition, example, export-context, profile-publication, full-outputs, search-publication, search, native-local, demo-external, HTTP imports/external, and locked-Playwright browser all final exit0. Example parsed actual native HTML/Revealjs with ru/source URLs, 163 local links and all catalog anchors; demo-external checked exact native source action and external links. Native fixture outputs for example are transient and removed by existing test finally; result evidence is the actual parse/validation log. Preserved Publisher fixtures retain mounted actual outputs. No claim that future release source URLs already exist remotely; producer postrelease check remains root-owned.

QRC test-only commit `65ea737237116ac83d106bd0e21d4174d48ef81d`: exactly tests/example.ts + tests/demo-external.ts expected source ref changed to current v3.0.0. Count/action/privacy guards unchanged. Final exact-byte HEAD/runtime/test/schema/example checks exit0; supplemental final-tested-inputs.json supersedes original manifest for those paths.

All launched sessions awaited to actual exit; no pending runners. Initial failures preserved: Pub obsolete diagnostic expectation, sandbox localhost denial, QRC historical source-ref mismatch. No production runtime edit, no dependency ref edit, no push/CI/merge/release by this task. Full prior independent unit matrices remain separate owner evidence; not duplicated here.
