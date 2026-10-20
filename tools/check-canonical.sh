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
check() {
 local label="$1"; shift
 if "$@" > "$evidence/$label.log" 2>&1; then return 0; else
  local code=$?
  printf 'FAIL %s (exit %s); log %s\n' "$label" "$code" "$evidence/$label.log" >&2
  tail -n 100 "$evidence/$label.log" >&2
  return "$code"
 fi
}
check optional-time "$QUARTO" run tests/optional-time.ts
check performance-context "$QUARTO" run tests/performance-context.ts
check vocabulary node tools/sync-contract.mjs --check
check model node tests/canonical-model.mjs
check types "$QUARTO" run tests/navigation-typecheck.ts
"$QUARTO" pandoc tests/fixtures/canonical-core/projection.qmd --from markdown --lua-filter tests/canonical-projection.lua -t json > "$evidence/projection.json" 2> "$evidence/projection.log" || { code=$?; printf 'FAIL projection (exit %s); log %s\n' "$code" "$evidence/projection.log" >&2; tail -n 100 "$evidence/projection.log" >&2; exit "$code"; }
check native-writer-paths "$QUARTO" pandoc --lua-filter tests/native-writer-paths.lua --to plain < /dev/null
check authoring-model-ast "$QUARTO" pandoc --lua-filter tests/authoring-model.lua --to plain < /dev/null
for name in exercise-defaults assignment-defaults assessment-slots project-facts adapter-facts nonbank-privacy exercise-index; do
 check $name "$QUARTO" pandoc --lua-filter "tests/$name.lua" --to plain < /dev/null
done
for name in native-table-references native-reference-boundary artifacts project-materialization materialize-projects starter-artifact nonbank-privacy exercise-index effective-properties project-checks api-precheck additional-java-sources cue-validation body-schema native-release native-run native-body native-body-links body-project-download native-resources selected-export system-toolchain; do
 check $name "$QUARTO" run "tests/$name.ts"
done
if [[ "$mode" == --native ]]; then
 for name in source-retirement-native source-identities-native metadata-closure-native metadata-includes-native common-path-binding-native native-references native-slots authoring-model public-solution course-contract root-export export-bank-ownership native-source-output native-body-addresses native-body-no-publication native-document native-lifecycle native-body-render native-body-titles native-optional-time native-generated-resources native-generated-pdf native-project-resources native-generated visibility pedagogy solution-pairing display-examples outside-bank-parity presentation; do
  check $name "$QUARTO" run "tests/$name.ts"
 done
 check hidden-answer "$QUARTO" run tests/native-document.ts answer-invalid
 check navigation-model npm run test:navigation-model
 check browser npm run test:browser
fi
printf 'PASS %s; evidence %s\n' "$mode" "$evidence"
