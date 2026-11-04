#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export QUARTO_RUN_NO_NETWORK=true
for name in zod-a1 course-project-loader course-project-guards course-project-native course-project-roles artifact-files document-a1 document-a1-pairing-native document-a1-conditional-native document-a1-native; do
  "${QUARTO:-quarto}" run "tests/$name.ts"
done
