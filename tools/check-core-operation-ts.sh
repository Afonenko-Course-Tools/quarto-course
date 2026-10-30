#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export QUARTO_RUN_NO_NETWORK=true
"${QUARTO:-quarto}" run tests/native-operation-a3.ts
