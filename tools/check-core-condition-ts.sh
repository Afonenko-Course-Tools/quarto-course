#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export QUARTO_RUN_NO_NETWORK=true
for name in condition-selection-a2 project-closure-a2 condition-materialization-a2 artifact-a2-types artifact-target-guards-a2; do
  "${QUARTO:-quarto}" run "tests/$name.ts"
done
