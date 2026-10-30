#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export QUARTO_RUN_NO_NETWORK=true
"${QUARTO:-quarto}" run tests/tool-cache-paths-a3.ts
"${QUARTO:-quarto}" run tests/tool-cache-a3.ts
"${QUARTO:-quarto}" run tests/artifact-inventory-policy-a3-fix.ts
"${QUARTO:-quarto}" run tests/native-operation-a3.ts
