#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export QUARTO_RUN_NO_NETWORK=true
for name in zod-a1 native-context-a1 native-context-a1-negative document-a1 document-a1-native native-context-a1-typecheck; do
  "${QUARTO:-quarto}" run "tests/$name.ts"
done
