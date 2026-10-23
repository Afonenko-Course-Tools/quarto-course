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
# Только фиксированные параметры запуска и argv; произвольное окружение не сохраняется.
check_ordinal=0
heartbeat_pid=""
progress() {
 local event="$1" ordinal="$2" label="$3" started="$4" code="$5" log="$6"
 printf '%s\t%03d\t%s\t%s\telapsed=%ss\texit=%s\tlog=%s\n' \
  "$event" "$ordinal" "$label" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$((SECONDS-started))" "$code" "$log" | tee -a "$evidence/progress.tsv"
}
stop_heartbeat() {
 if [[ -n "$heartbeat_pid" ]]; then
  kill "$heartbeat_pid" 2>/dev/null || true
  wait "$heartbeat_pid" 2>/dev/null || true
  heartbeat_pid=""
 fi
}
heartbeat() {
 local ordinal="$1" label="$2" started="$3" log="$4" timer_pid=""
 trap - EXIT
 trap 'if [[ -n "$timer_pid" ]]; then kill "$timer_pid" 2>/dev/null || true; wait "$timer_pid" 2>/dev/null || true; fi; exit 0' TERM INT
 while true; do
  sleep 60 & timer_pid=$!
  wait "$timer_pid" || return
  timer_pid=""
  progress HEARTBEAT "$ordinal" "$label" "$started" pending "$log"
 done
}
trap stop_heartbeat EXIT
restore_signal() {
 stop_heartbeat
 trap - "$1"
 kill -s "$1" "$$"
}
trap 'restore_signal TERM' TERM
trap 'restore_signal INT' INT
check_to_file() {
 local output="$1" label="$2"; shift 2
 check_ordinal=$((check_ordinal+1))
 local prefix started="$SECONDS" code
 printf -v prefix '%03d-%s' "$check_ordinal" "$label"
 local log="$evidence/$prefix.log"
 {
  printf 'ordinal=%s\nlabel=%q\ncwd=%q\nmode=%q\n' "$check_ordinal" "$label" "$PWD" "$mode"
  printf 'QUARTO=%q\nCUE=%q\nCANONICAL_EXTENSION=%q\nQUARTO_RUN_NO_NETWORK=%q\nargv=' "$QUARTO" "$CUE" "$CANONICAL_EXTENSION" "$QUARTO_RUN_NO_NETWORK"
  printf '%q ' "$@"; printf '\n'
 } > "$evidence/$prefix.command"
 progress BEGIN "$check_ordinal" "$label" "$started" pending "$log"
 heartbeat "$check_ordinal" "$label" "$started" "$log" & heartbeat_pid=$!
 # Проверяемая команда остаётся foreground: argv, stdin и signal group прежние.
 if [[ -n "$output" ]]; then
  if "$@" > "$output" 2> "$log"; then code=0; else code=$?; fi
 else
  if "$@" > "$log" 2>&1; then code=0; else code=$?; fi
 fi
 stop_heartbeat
 if [[ "$code" -eq 0 ]]; then
  progress PASS "$check_ordinal" "$label" "$started" "$code" "$log"
 else
  progress FAIL "$check_ordinal" "$label" "$started" "$code" "$log" >&2
  tail -n 100 "$log" >&2
 fi
 return "$code"
}
check() { check_to_file "" "$@"; }
check optional-time "$QUARTO" run tests/optional-time.ts
check performance-context "$QUARTO" run tests/performance-context.ts
check vocabulary node tools/sync-contract.mjs --check
check model node tests/canonical-model.mjs
check inspection-preimages "$QUARTO" run tests/inspection-preimages.ts
check inspection-transaction "$QUARTO" run tests/inspection-transaction.ts
check inspection-binding-phase "$QUARTO" run tests/inspection-binding-phase.ts
check process-utf8 "$QUARTO" run tests/process-utf8.ts
check types "$QUARTO" run tests/navigation-typecheck.ts
check_to_file "$evidence/projection.json" projection "$QUARTO" pandoc tests/fixtures/canonical-core/projection.qmd --from markdown --lua-filter tests/canonical-projection.lua -t json
check native-writer-paths "$QUARTO" pandoc --lua-filter tests/native-writer-paths.lua --to plain < /dev/null
check authoring-model-ast "$QUARTO" pandoc --lua-filter tests/authoring-model.lua --to plain < /dev/null
for name in exercise-defaults assignment-defaults assessment-slots project-facts java-build adapter-facts nonbank-privacy exercise-index; do
 check $name "$QUARTO" pandoc --lua-filter "tests/$name.lua" --to plain < /dev/null
done
for name in native-table-references native-reference-boundary artifacts project-materialization materialize-projects starter-artifact nonbank-privacy exercise-index effective-properties project-checks api-precheck java-build additional-java-sources cue-validation body-schema native-release native-run native-body native-body-links body-project-download native-resources selected-export system-toolchain; do
 check $name "$QUARTO" run "tests/$name.ts"
done
if [[ "$mode" == --native ]]; then
 for name in owned-config-entry owned-config-source owned-config-proof owned-config-output-lua owned-config-native-boundary; do
  check "$name" "$QUARTO" run "tests/$name.ts"
 done
 check owned-config-restoration env COURSE_CONFIG_RESTORATION_ROOT="$evidence/fixture-owned-config-restoration" "$QUARTO" run tests/owned-config-restoration.ts
 check owned-config-source-native env COURSE_CONFIG_SOURCE_NATIVE_ROOT="$evidence/fixture-owned-config-source-native" "$QUARTO" run tests/owned-config-source-native.ts
 check owned-config-derive env COURSE_CONFIG_DERIVE_ROOT="$evidence/fixture-owned-config-derive" "$QUARTO" run tests/owned-config-derive.ts
 check inspection-budget-n1 env INSPECTION_BUDGET_N=1 INSPECTION_BUDGET_OUTPUT="$evidence/fixture-inspection-budget-n1" "$QUARTO" run tests/inspection-budget-native.ts
 check inspection-budget-n3 env INSPECTION_BUDGET_N=3 INSPECTION_BUDGET_OUTPUT="$evidence/fixture-inspection-budget-n3" "$QUARTO" run tests/inspection-budget-native.ts
 check render-inspection-budget-native env INSPECTION_BUDGET_OUTPUT="$evidence/fixture-render-inspection-budget" "$QUARTO" run tests/render-inspection-budget-native.ts
 check render-inspection-budget-n3 env INSPECTION_BUDGET_N=3 INSPECTION_BUDGET_OUTPUT="$evidence/fixture-render-inspection-budget-n3" "$QUARTO" run tests/render-inspection-budget-native.ts
 check artifact-batch-native env INSPECTION_BUDGET_OUTPUT="$evidence/fixture-artifact-batch" "$QUARTO" run tests/artifact-batch-native.ts
 check native-raw-batch env RAW_BATCH_OUTPUT="$evidence/fixture-native-raw-batch" "$QUARTO" run tests/native-raw-batch.ts
 check owned-operation-native env OWNED_OPERATION_OUTPUT="$evidence/fixture-owned-operation" "$QUARTO" run tests/owned-operation-native.ts
 for name in currentness-batch-native currentness-transaction-native inspection-provenance-native forced-writer-native forced-writer-lua owned-hook-context-native source-retirement-native retired-regular-native source-identities-native metadata-closure-native metadata-includes-native common-path-binding-native native-references native-slots authoring-model public-solution course-contract root-export export-bank-ownership native-source-output native-body-addresses native-body-no-publication native-document native-lifecycle native-body-render native-body-titles native-optional-time native-generated-resources native-generated-pdf native-project-resources native-generated visibility pedagogy solution-pairing display-examples outside-bank-parity presentation; do
  check $name "$QUARTO" run "tests/$name.ts"
 done
 check hidden-answer "$QUARTO" run tests/native-document.ts answer-invalid
 check navigation-model npm run test:navigation-model
 check browser npm run test:browser
fi
printf 'PASS %s; evidence %s\n' "$mode" "$evidence"
