#!/usr/bin/env bash
# Fails on usize where its width changes the result across targets:
# - anywhere in a struct or enum declaration in core/src, const generic parameters and
#   array lengths included;
# - in a function signature of the hashing, codec and derivation modules
#   (core/src/{hash,journal,keccak,level,seed}.rs and the files under those directories).
# Index arithmetic inside function bodies stays allowed. Comments, string literals and
# char literals are ignored.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
[ -d core/src ] || { echo "check-no-usize: core/src not found"; exit 2; }

found=0
while IFS= read -r -d '' file; do
  case "$file" in
    core/src/hash.rs | core/src/journal.rs | core/src/keccak.rs | core/src/level.rs | core/src/seed.rs | \
      core/src/hash/* | core/src/journal/* | core/src/keccak/* | core/src/level/* | core/src/seed/*)
      signatures=1 ;;
    *) signatures=0 ;;
  esac
  awk -v file="$file" -v signatures="$signatures" '
    function report(what) { printf "%s:%d: usize in %s: %s\n", file, NR, what, original; found = 1 }

    function strip_comments(text,    code, open_at, line_comment, close_at) {
      code = ""
      while (text != "") {
        if (in_block_comment) {
          close_at = index(text, "*/")
          if (!close_at) return code
          text = substr(text, close_at + 2)
          in_block_comment = 0
        } else {
          open_at = index(text, "/*")
          line_comment = index(text, "//")
          if (line_comment && (!open_at || line_comment < open_at)) return code substr(text, 1, line_comment - 1)
          if (!open_at) return code text
          code = code substr(text, 1, open_at - 1) " "
          text = substr(text, open_at + 2)
          in_block_comment = 1
        }
      }
      return code
    }

    {
      original = $0
      line = $0
      gsub(/"([^"\\]|\\.)*"|\047([^\047\\]|\\.[^\047]*)\047/, "\"\"", line)
      line = strip_comments(line)
    }

    !in_type && line ~ /(^|[^A-Za-z0-9_])(struct|enum)[[:space:]]+[A-Za-z_]/ {
      in_type = 1; type_depth = depth; type_nest = nest; type_opened = 0
    }
    !in_signature && signatures && line ~ /(^|[^A-Za-z0-9_])fn[[:space:]]+[A-Za-z_]/ {
      in_signature = 1; signature_nest = nest
    }

    in_type && line ~ /(^|[^A-Za-z0-9_])usize([^A-Za-z0-9_]|$)/ { report("a struct or enum") }
    in_signature && line ~ /(^|[^A-Za-z0-9_])usize([^A-Za-z0-9_]|$)/ {
      head = line; sub(/\{.*/, "", head)
      if (head ~ /(^|[^A-Za-z0-9_])usize([^A-Za-z0-9_]|$)/) report("a function signature")
    }

    {
      n = split(line, chars, "")
      for (i = 1; i <= n; i++) {
        c = chars[i]
        if (c == "(" || c == "[") {
          nest++
        } else if (c == ")" || c == "]") {
          nest--
        } else if (c == "{") {
          depth++
          if (in_type) type_opened = 1
          in_signature = 0
        } else if (c == "}") {
          depth--
          if (in_type && type_opened && depth == type_depth) in_type = 0
        } else if (c == ";") {
          if (in_type && !type_opened && depth == type_depth && nest == type_nest) in_type = 0
          if (in_signature && nest == signature_nest) in_signature = 0
        }
      }
    }

    END { exit found }
  ' "$file" || found=1
done < <(find core/src -name '*.rs' -print0 | sort -z)

exit "$found"
