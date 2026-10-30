#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export QUARTO_RUN_NO_NETWORK=true
for name in release-semantics-a4a release-collection-a4a release-project-source-a4a release-a4a materialization-a4a native-full-a4a pending-a4a generated-condition-a4a generated-policy-a4a early-layout-a4a; do
  "${QUARTO:-quarto}" run "tests/$name.ts"
done
