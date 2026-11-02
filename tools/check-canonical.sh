#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:---native}"
[[ "$mode" == --quick || "$mode" == --native ]] || { echo 'usage: tools/check-canonical.sh [--quick|--native] [evidence-directory]' >&2; exit 2; }
evidence="${2:-/tmp/course-native-check-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$evidence"
evidence="$(realpath "$evidence")"
export QUARTO="${QUARTO:-quarto}"
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
  printf 'QUARTO=%q\nCANONICAL_EXTENSION=%q\nQUARTO_RUN_NO_NETWORK=%q\nargv=' "$QUARTO" "$CANONICAL_EXTENSION" "$QUARTO_RUN_NO_NETWORK"
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
# Единственный executable canon и его actual native producer suites.
check vocabulary node tools/sync-contract.mjs --check
check retired-tool python3 -B tools/check-retired-tool.py
for name in quarto-version-policy body-schema answer-body-ts project-context-budget process-utf8 process-input fixed-stdin-native system-toolchain performance-context navigation-typecheck navigation-composition course-theme; do
 check "$name" "$QUARTO" run "tests/$name.ts"
done
check performance-document-context env COURSE_PERF_MODE=summary "$QUARTO" pandoc --lua-filter tests/performance-context.lua --to plain < /dev/null
check native-default-runtime "$QUARTO" run tests/native-default-runtime.ts
check native-preview-no-work "$QUARTO" run tests/native-preview-no-work.ts
for suite in native condition operation; do
 check "native-$suite-suite" bash "tools/check-core-$suite-ts.sh"
done
for name in native-project-contracts native-project-contract-guards native-project-marker-isolation carrier-physical-guard own-stage-progress static-source-diagrams static-source-policy native-context-scaling artifact-origin-dto artifact-raw-origin prepared-operation operation-project-reuse operation-project-reuse-boundaries operation-project-reuse-mixed native-title-transport reveal-authored-header catalogue-cite-a1; do
 check "$name" "$QUARTO" run "tests/$name.ts"
done
for file in tests/assignment-*.ts; do
 name="${file##*/}"; name="${name%.ts}"
 check "$name" "$QUARTO" run "$file"
done
if [[ "$mode" == --native ]]; then
 check native-early-slice-suite bash tools/check-core-early-slice-ts.sh
 check navigation-model npm run test:navigation-model
 check browser npm run test:browser
fi
printf 'PASS %s; evidence %s\n' "$mode" "$evidence"
