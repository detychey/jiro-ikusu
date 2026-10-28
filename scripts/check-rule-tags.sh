#!/usr/bin/env bash
# Prints every line of README §4.1-§4.10 that carries neither a rule tag
# ([R4.<n>-<k>] or [PIN-<nn>]) nor the rationale marker, and every code block
# without a tag. Headings, blank lines, table header rows and table separator
# rows are exempt. Empty output means every rule is tagged; exits 1 otherwise.
set -euo pipefail

readme="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/README.md}"
[ -f "$readme" ] || { echo "check-rule-tags: $readme not found" >&2; exit 2; }

awk -v file="$(basename "$readme")" '
  { lines[NR] = $0 }

  function tagged(line) { return line ~ /\[(R4\.[0-9]+-[0-9]+|PIN-[0-9]+)\]/ }
  function separator(line) { return line ~ /^[[:space:]]*\|[-:| ]+\|[[:space:]]*$/ }
  function report(number, text) { printf "%s:%d: %s\n", file, number, text; found = 1 }

  END {
    for (i = 1; i <= NR; i++) {
      line = lines[i]
      if (line ~ /^### 4\.1 /) { inside = 1; continue }
      if (inside && line ~ /^## /) { inside = 0 }
      if (!inside) { continue }

      if (line ~ /^[[:space:]]*```/) {
        if (!in_code) { in_code = 1; code_start = i; code_tagged = 0 }
        else { in_code = 0; if (!code_tagged) report(code_start, "code block without a tag") }
        continue
      }
      if (in_code) { if (tagged(line)) code_tagged = 1; continue }

      if (line ~ /^[[:space:]]*$/ || line ~ /^#/ || separator(line)) { continue }
      if (line ~ /^[[:space:]]*\|/ && i < NR && separator(lines[i + 1])) { continue }
      if (tagged(line) || line ~ /<!-- rationale -->/) { continue }
      report(i, line)
    }
    if (in_code) { report(code_start, "code block not closed") }
    exit found
  }
' "$readme"
