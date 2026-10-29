#!/usr/bin/env bash
# Fails unless every Cargo workspace root of the repository sets
# overflow-checks = true under [profile.dev], [profile.test], [profile.bench] and
# [profile.release], and no profile sets it to false (README §3, plan §3.3).
# Roots are found with `cargo locate-project --workspace` next to each Cargo.toml,
# tracked or new, outside target/ and node_modules/.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

manifests="$(git ls-files --cached --others --exclude-standard -- '*Cargo.toml' 'Cargo.toml' | sort -u)"
[ -n "$manifests" ] || { echo "check-profiles: no Cargo.toml found"; exit 2; }

roots="$(while IFS= read -r manifest; do
  cargo locate-project --workspace --message-format plain --manifest-path "$manifest"
done <<<"$manifests" | sort -u)"

python3 - "$PWD" $roots <<'EOF'
import sys, tomllib, os

repo, roots = sys.argv[1], sys.argv[2:]
required = ["dev", "test", "bench", "release"]
problems = []
for root in roots:
    name = os.path.relpath(root, repo)
    profiles = tomllib.load(open(root, "rb")).get("profile", {})
    for profile in required:
        if profiles.get(profile, {}).get("overflow-checks") is not True:
            problems.append(f"{name}: [profile.{profile}] lacks overflow-checks = true")
    for profile, settings in profiles.items():
        if settings.get("overflow-checks") is False:
            problems.append(f"{name}: [profile.{profile}] sets overflow-checks = false")
    print(f"check-profiles: {name}")
for problem in problems:
    print(problem)
sys.exit(1 if problems else 0)
EOF
