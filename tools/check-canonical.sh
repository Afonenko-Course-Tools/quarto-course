#!/usr/bin/env bash
# Finite paired native verification. Root owns the long --native run after freeze.
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:---quick}"
if [[ "$mode" != --quick && "$mode" != --native ]]; then
  echo 'usage: tools/check-canonical.sh [--quick|--native] [evidence-directory]' >&2
  exit 2
fi
canonical_evidence="${2:-/tmp/course-canonical-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$canonical_evidence"
canonical_evidence="$(realpath "$canonical_evidence")"
canonical_head="$(git rev-parse HEAD)"
printf '%s\n' "$canonical_head" > "$canonical_evidence/head.txt"
git diff --binary > "$canonical_evidence/development.diff"
export CUE="${CUE:-/home/tolya/course-tools/local-tools/cue/cue}"
export PATH="$(dirname "$CUE"):$PATH"
export FONTCONFIG_FILE="${FONTCONFIG_FILE:-/home/tolya/course-tools/local-runtime/session-20261004/fontconfig/fonts.conf}"
export QUARTO_RUN_NO_NETWORK=true
export CANONICAL_EXTENSION="$PWD/_extensions/course-core"
node tools/sync-contract.mjs --check > "$canonical_evidence/vocabulary.log" 2>&1
for name in contracts model body; do
  node "tests/canonical-$name.mjs" > "$canonical_evidence/$name.log" 2>&1
done
for version in 1.10.18 1.11.5; do
  export QUARTO="/home/tolya/course-tools/local-tools/quarto-$version/bin/quarto"
  canonical_channel=root-stable
  if [[ "$version" == 1.11.5 ]]; then canonical_channel=root-pre; fi
  export XDG_CACHE_HOME="/home/tolya/course-tools/local-cache/$canonical_channel"
  canonical_dir="$canonical_evidence/$version"
  mkdir -p "$canonical_dir"
  "$QUARTO" --version > "$canonical_dir/version.txt"
  "$CUE" version > "$canonical_dir/cue-version.txt"
  for probe in projection topology; do
    "$QUARTO" pandoc tests/fixtures/canonical-core/projection.qmd --from markdown --lua-filter "tests/canonical-$probe.lua" -t json > "$canonical_dir/$probe.json" 2> "$canonical_dir/$probe.log"
  done
  DENO_DIR="$XDG_CACHE_HOME/quarto/deno_std/cache" \
    "/home/tolya/course-tools/local-tools/quarto-$version/bin/tools/x86_64/deno" check --no-config \
    --import-map "/home/tolya/course-tools/local-tools/quarto-$version/share/deno_std/run_import_map.json" \
    _extensions/course-core/owner-preflight/owner.ts _extensions/course-core/entrypoints/post.ts \
    tests/canonical-core.ts tests/owner-preflight.ts tests/owner-identities.ts \
    tests/owner-session.ts tests/native-listing-owner.ts tests/navigation-owner.ts \
    tests/owner-body-configs.ts tests/owner-resources.ts \
    > "$canonical_dir/typecheck.log" 2>&1
  if [[ "$mode" == --native ]]; then
    export TMPDIR="$canonical_dir/tmp"
    mkdir -p "$TMPDIR"
    for selection in negative positive projection ownerless reference; do
      export CANONICAL_TEST_OUTPUT="$canonical_dir/$selection"
      "$QUARTO" run tests/canonical-core.ts "$selection" > "$canonical_dir/native-$selection.log" 2>&1
    done
  fi
done
[[ "$(git rev-parse HEAD)" == "$canonical_head" ]]
printf 'PASS %s; evidence %s\n' "$mode" "$canonical_evidence"
