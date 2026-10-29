#!/usr/bin/env bash
# Fails on usize where its width changes the result across targets:
# - anywhere in a struct or enum declaration in core/src;
# - in a function signature of the hash, journal and level modules
#   (core/src/{hash,journal,level}.rs and the files under core/src/{hash,journal,level}/).
# Index arithmetic inside function bodies stays allowed. Comments and string literals
# are ignored.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
[ -d core/src ] || { echo "check-no-usize: core/src not found"; exit 2; }

found=0
while IFS= read -r -d '' file; do
  case "$file" in
    core/src/hash.rs | core/src/journal.rs | core/src/level.rs | \
      core/src/hash/* | core/src/journal/* | core/src/level/*) signatures=1 ;;
    *) signatures=0 ;;
  esac
  awk -v file="$file" -v signatures="$signatures" '
    function report(what) { printf "%s:%d: usize in %s: %s\n", file, NR, what, original; found = 1 }

    {
      original = $0
      line = $0
      gsub(/"([^"\\]|\\.)*"/, "\"\"", line)
      sub(/\/\/.*/, "", line)
    }

    !in_type && line ~ /(^|[^A-Za-z0-9_])(struct|enum)[[:space:]]+[A-Za-z_]/ { in_type = 1; type_depth = depth; type_opened = 0 }
    !in_signature && signatures && line ~ /(^|[^A-Za-z0-9_])fn[[:space:]]+[A-Za-z_]/ { in_signature = 1 }

    in_type && line ~ /(^|[^A-Za-z0-9_])usize([^A-Za-z0-9_]|$)/ { report("a struct or enum") }
    in_signature && line ~ /(^|[^A-Za-z0-9_])usize([^A-Za-z0-9_]|$)/ {
      head = line; sub(/\{.*/, "", head)
      if (head ~ /(^|[^A-Za-z0-9_])usize([^A-Za-z0-9_]|$)/) report("a function signature")
    }

    {
      n = split(line, chars, "")
      for (i = 1; i <= n; i++) {
        c = chars[i]
        if (c == "{") {
          depth++
          if (in_type) type_opened = 1
          in_signature = 0
        } else if (c == "}") {
          depth--
          if (in_type && type_opened && depth == type_depth) in_type = 0
        } else if (c == ";") {
          if (in_type && !type_opened && depth == type_depth) in_type = 0
          if (in_signature) in_signature = 0
        }
      }
    }

    END { exit found }
  ' "$file" || found=1
done < <(find core/src -name '*.rs' -print0 | sort -z)

exit "$found"
