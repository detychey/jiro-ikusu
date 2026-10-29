#!/usr/bin/env bash
# The version gate (README §6.3, PIN-13): moved vectors need a version bump. Compares the
# working tree with base = git merge-base origin/main HEAD, or HEAD's first parent when HEAD is
# on origin/main (a push to main), so that the pushed change itself is checked:
# - a modified or deleted file under vectors/game or vectors/levels requires RULES_VERSION in
#   core/src/consts.rs to differ from its value at base, and every game vector's rulesVersion
#   to equal the new value;
# - a modified or deleted file under vectors/format requires a bump of a format version
#   (JOURNAL_VERSION, LEVEL_VERSION, STATE_HASH_VERSION) or of RULES_VERSION;
# - added vector files trigger neither. A renamed file counts as deleted, then added.
# With --reverse (M4.15), any modified or deleted vector file, or any changed version, fails.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
reverse=0
case "${1:-}" in
  "") ;;
  --reverse) reverse=1 ;;
  *) echo "usage: check-rules-version.sh [--reverse]" >&2; exit 2 ;;
esac

base="$(git merge-base origin/main HEAD)" ||
  { echo "check-rules-version: no merge base with origin/main; fetch it first" >&2; exit 2; }
if [ "$base" = "$(git rev-parse HEAD)" ]; then
  base="$(git rev-parse --verify HEAD^1)" ||
    { echo "check-rules-version: HEAD is on origin/main and has no parent to compare with" >&2; exit 2; }
fi

# The value of a version constant in a file, at base (rev) or in the working tree (empty rev).
version() {
  local rev="$1" file="$2" name="$3" text
  if [ -n "$rev" ]; then
    text="$(git show "$rev:$file" 2>/dev/null || true)"
  else
    text="$(cat "$file")"
  fi
  sed -n "s/^pub const $name: u[0-9]* = \([0-9]*\);$/\1/p" <<<"$text"
}

# A constant that base doesn't have yet is new, not changed.
changed() {
  local file="$1" name="$2" before
  before="$(version "$base" "$file" "$name")"
  [ -n "$before" ] && [ "$before" != "$(version "" "$file" "$name")" ]
}

moved() {
  git diff --no-renames --diff-filter=MD --name-only "$base" -- "$@"
}

rules=core/src/consts.rs
versions=("$rules RULES_VERSION" "$rules JOURNAL_VERSION" "$rules LEVEL_VERSION" "core/src/hash.rs STATE_HASH_VERSION")
echo "check-rules-version: base $base"

if [ "$reverse" = 1 ]; then
  status=0
  if [ -n "$(moved vectors)" ]; then
    moved vectors
    echo "check-rules-version: --reverse: the vector files above moved"
    status=1
  fi
  for entry in "${versions[@]}"; do
    read -r file name <<<"$entry"
    if changed "$file" "$name"; then
      echo "check-rules-version: --reverse: $name changed"
      status=1
    fi
  done
  exit "$status"
fi

status=0
game="$(moved vectors/game vectors/levels)"
if [ -n "$game" ]; then
  echo "$game"
  if ! changed "$rules" RULES_VERSION; then
    echo "check-rules-version: the game vectors above moved, but RULES_VERSION is still $(version "" "$rules" RULES_VERSION)"
    status=1
  fi
  current="$(version "" "$rules" RULES_VERSION)"
  stale="$(grep -L "^  \"rulesVersion\": $current,$" vectors/game/*.json || true)"
  if [ -n "$stale" ]; then
    echo "$stale"
    echo "check-rules-version: the game vectors above do not record rulesVersion $current"
    status=1
  fi
fi

format="$(moved vectors/format)"
if [ -n "$format" ]; then
  echo "$format"
  bumped=0
  for entry in "${versions[@]}"; do
    read -r file name <<<"$entry"
    if changed "$file" "$name"; then
      bumped=1
    fi
  done
  if [ "$bumped" = 0 ]; then
    echo "check-rules-version: the format vectors above moved, but no format version or RULES_VERSION changed"
    status=1
  fi
fi

[ "$status" = 0 ] && echo "check-rules-version: ok"
exit "$status"
