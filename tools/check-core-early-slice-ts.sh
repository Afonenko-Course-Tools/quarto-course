#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export QUARTO_RUN_NO_NETWORK=true
for name in native-format-scope-a4c native-metadata-a4c native-capture-scope-a4c native-capture-fences-a4c native-capture-transitions-a4c native-capture-currentness-a4c native-capture-expiry-a4c native-binding-fences-a4c native-operation-pointer-race-a4c native-metadata-producer-a4c native-sp-index-a4c answers-a4b metadata-a4b answers-native-a4b native-formats-a4b release-semantics-a4a release-collection-a4a release-project-source-a4a release-a4a materialization-a4a native-full-a4a pending-a4a generated-condition-a4a generated-policy-a4a early-layout-a4a; do
  "${QUARTO:-quarto}" run "tests/$name.ts"
done
