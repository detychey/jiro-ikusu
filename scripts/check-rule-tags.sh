#!/usr/bin/env bash
# Checks the rule tags of README §4, from §4.1 to the end of §4. Prints every
# line that carries neither a rule tag ([R4.<n>-<k>] or [PIN-<nn>]) nor the
# trailing rationale marker, every code block without a tag, every repeated
# tag, and every R tag outside its own subsection. Headings, blank lines, table
# header rows and table separator rows are exempt; tables use outer pipes.
# Empty output means every rule is tagged; exits 1 otherwise.
set -euo pipefail

readme="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/README.md}"
[ -f "$readme" ] || { echo "check-rule-tags: $readme not found"; exit 2; }

awk -v file="$(basename "$readme")" '
  { lines[NR] = $0 }

  function tagged(line) { return line ~ /\[(R4\.[1-9][0-9]*-[1-9][0-9]*|PIN-[0-9][0-9])\]/ }
  function heading(line) { return line ~ /^ ? ? ?#+([[:space:]]|$)/ }
  function separator(line) { return line ~ /^[[:space:]]*\|([[:space:]]*:?-+:?[[:space:]]*\|)+[[:space:]]*$/ }
  function fence(line) { return line ~ /^[[:space:]]*(```|~~~)/ }
  function report(number, text) { printf "%s:%d: %s\n", file, number, text; found = 1 }

  function check_tags(number, line,    rest, tag) {
    rest = line
    while (match(rest, /\[(R4\.[0-9]+-[0-9]+|PIN-[0-9]+)\]/)) {
      tag = substr(rest, RSTART, RLENGTH)
      rest = substr(rest, RSTART + RLENGTH)
      if (tag in first_line) { report(number, "repeated tag " tag ", first on line " first_line[tag]) }
      else { first_line[tag] = number }
      if (!tagged(tag)) { report(number, "malformed tag " tag) }
      if (tag ~ /^\[R4\./ && index(tag, "[R4." section "-") != 1) { report(number, "tag " tag " outside section 4." section) }
    }
  }

  END {
    for (i = 1; i <= NR; i++) {
      line = lines[i]
      if (!inside && line ~ /^### 4\.1 /) { inside = 1; started = 1 }
      if (!inside) { continue }
      if (!in_code && line ~ /^## /) { inside = 0; continue }

      if (fence(line)) {
        if (!in_code) { in_code = 1; code_start = i; code_tagged = 0 }
        else { in_code = 0; if (!code_tagged) report(code_start, "code block without a tag") }
        continue
      }
      if (line ~ /^### 4\.[0-9]+ / && !in_code) { section = substr(line, 7); sub(/ .*/, "", section); continue }

      check_tags(i, line)
      if (in_code) { if (tagged(line)) code_tagged = 1; continue }

      if (line ~ /^[[:space:]]*$/ || heading(line) || separator(line)) { continue }
      if (line ~ /^[[:space:]]*\|/ && i < NR && separator(lines[i + 1]) && lines[i - 1] !~ /^[[:space:]]*\|/) { continue }
      if (tagged(line) || line ~ /<!-- rationale -->[[:space:]]*$/) { continue }
      report(i, line)
    }
    if (!started) { printf "%s: no \"### 4.1 \" heading, nothing checked\n", file; exit 2 }
    if (in_code) { report(code_start, "code block not closed") }
    exit found
  }
' "$readme"
