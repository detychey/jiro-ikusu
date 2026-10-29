#!/usr/bin/env bash
# Fails unless every Cargo workspace root of the repository sets
# overflow-checks = true under [profile.dev], [profile.test], [profile.bench] and
# [profile.release], and no profile, package override or build-override sets it to
# false (README §3, plan §3.3). Cargo config files (.cargo/config.toml) may set neither
# profiles nor overflow-checks, since they would override the manifests.
# Roots are found with `cargo locate-project --workspace` next to each Cargo.toml,
# tracked or new, outside target/ and node_modules/.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

manifests="$(git ls-files --cached --others --exclude-standard -- '*Cargo.toml' 'Cargo.toml' | sort -u)"
[ -n "$manifests" ] || { echo "check-profiles: no Cargo.toml found"; exit 2; }

roots="$(while IFS= read -r manifest; do
  [ -f "$manifest" ] || continue
  cargo locate-project --workspace --message-format plain --manifest-path "$manifest" || exit 2
done <<<"$manifests" | sort -u)"
mapfile -t roots <<<"$roots"

configs="$(git ls-files --cached --others --exclude-standard -- '*.cargo/config' '*.cargo/config.toml')"

CARGO_CONFIGS="$configs" python3 - "$PWD" "${roots[@]}" <<'EOF'
import os, sys, tomllib

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
        tables = {f"profile.{profile}": settings,
                  f"profile.{profile}.build-override": settings.get("build-override", {})}
        tables |= {f"profile.{profile}.package.{package}": table
                   for package, table in settings.get("package", {}).items()}
        for table_name, table in tables.items():
            if table.get("overflow-checks") is False:
                problems.append(f"{name}: [{table_name}] sets overflow-checks = false")
    print(f"check-profiles: {name}")
for config in os.environ["CARGO_CONFIGS"].split():
    text = open(config, "rb").read()
    if "profile" in tomllib.loads(text.decode()) or b"overflow-checks" in text:
        problems.append(f"{config}: profiles and overflow-checks belong in the workspace root manifest, not in a Cargo config file")
for problem in problems:
    print(problem)
sys.exit(1 if problems else 0)
EOF
