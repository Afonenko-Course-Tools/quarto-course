#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:---native}"
[[ "$mode" == --quick || "$mode" == --native ]] || { echo 'usage: tools/check-canonical.sh [--quick|--native] [evidence-directory]' >&2; exit 2; }
evidence="${2:-/tmp/course-native-check-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$evidence"
evidence="$(realpath "$evidence")"
export QUARTO="${QUARTO:-quarto}"
export CUE="${CUE:-cue}"
export CANONICAL_EXTENSION="$PWD/_extensions/course-core"
export QUARTO_RUN_NO_NETWORK=true
node tools/sync-contract.mjs --check > "$evidence/vocabulary.log" 2>&1
node tests/canonical-model.mjs > "$evidence/model.log" 2>&1
"$QUARTO" run tests/navigation-typecheck.ts > "$evidence/types.log" 2>&1
"$QUARTO" pandoc tests/fixtures/canonical-core/projection.qmd --from markdown --lua-filter tests/canonical-projection.lua -t json > "$evidence/projection.json" 2> "$evidence/projection.log"
for name in native-release native-run native-body native-resources system-toolchain; do
 "$QUARTO" run "tests/$name.ts" > "$evidence/$name.log" 2>&1
done
if [[ "$mode" == --native ]]; then
 for name in native-document native-lifecycle native-body-render native-generated-resources native-generated-pdf native-project-resources native-generated visibility pedagogy solution-pairing display-examples presentation; do
  "$QUARTO" run "tests/$name.ts" > "$evidence/$name.log" 2>&1
 done
 "$QUARTO" run tests/native-document.ts answer-invalid > "$evidence/hidden-answer.log" 2>&1
 npm run test:navigation-model > "$evidence/navigation-model.log" 2>&1
 npm run test:browser > "$evidence/browser.log" 2>&1
fi
printf 'PASS %s; evidence %s\n' "$mode" "$evidence"
