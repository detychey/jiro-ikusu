#!/usr/bin/env bash
# Deploys web/dist to the Cloudflare Pages project jiro-ikusu (plan M2.2): a preview branch
# pr-<number> for a pull request, production for main. It creates the project if it is missing,
# adds the custom domain jiro-ikusu.win and its DNS record when they are missing, and prints the
# deployment URL and the domain's status between `=== BEGIN <name> ===` and `=== END <name> ===`
# markers (plan §1.3). Needs CLOUDFLARE_API_TOKEN (Pages: Edit, and DNS: Edit on the
# jiro-ikusu.win zone) and CLOUDFLARE_ACCOUNT_ID, the repository secrets of round A1, and
# wrangler from this directory's lockfile (npm ci --ignore-scripts --prefix scripts/deploy).
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?the CLOUDFLARE_API_TOKEN repository secret is not set (plan M2.2, round A1)}"
: "${CLOUDFLARE_ACCOUNT_ID:?the CLOUDFLARE_ACCOUNT_ID repository secret is not set (plan M2.2, round A1)}"

readonly here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly wrangler="$here/node_modules/.bin/wrangler"
readonly project=jiro-ikusu
readonly domain=jiro-ikusu.win
readonly api=https://api.cloudflare.com/client/v4
readonly pages="$api/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects"
[[ -x "$wrangler" ]] || { echo "deploy: run npm ci --ignore-scripts --prefix scripts/deploy first" >&2; exit 1; }

# The Cloudflare API, with the error body on failure.
cf() {
  curl -sS --fail-with-body -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" "$@"
}

if [[ "${GITHUB_EVENT_NAME:-}" == pull_request ]]; then
  branch="pr-${PR_NUMBER:?PR_NUMBER is not set}"
elif [[ "${GITHUB_REF:-}" == refs/heads/main ]]; then
  branch=main
else
  branch="$(tr -c 'a-zA-Z0-9-\n' '-' <<<"${GITHUB_REF_NAME:-preview}")"
fi

if ! cf "$pages/$project" >/dev/null 2>&1; then
  "$wrangler" pages project create "$project" --production-branch=main
fi

log="${RUNNER_TEMP:-/tmp}/deploy.log"
"$wrangler" pages deploy web/dist --project-name="$project" --branch="$branch" \
  --commit-dirty=true | tee "$log"
url="$(grep -oE 'https://[a-zA-Z0-9.-]+\.pages\.dev' "$log" | tail -1)"
[[ -n "$url" ]] || { echo "deploy: no deployment URL in wrangler's output" >&2; exit 1; }
echo "=== BEGIN DEPLOYMENT URL ==="
echo "$url"
echo "=== END DEPLOYMENT URL ==="
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "url=$url" >>"$GITHUB_OUTPUT"
fi

# The custom domain: the project's own *.pages.dev name, which Cloudflare may have suffixed.
subdomain="$(cf "$pages/$project" | jq -er '.result.subdomain')"
if ! cf "$pages/$project/domains" | jq -e --arg name "$domain" '.result[] | select(.name == $name)' >/dev/null; then
  cf -X POST "$pages/$project/domains" --data "{\"name\":\"$domain\"}" >&2
fi
zone="$(cf "$api/zones?name=$domain" | jq -er '.result[0].id')"
web_records="$(cf "$api/zones/$zone/dns_records?name=$domain" |
  jq -c '[.result[] | select(.type == "CNAME" or .type == "A" or .type == "AAAA")]')"
if [[ "$(jq 'length' <<<"$web_records")" == 0 ]]; then
  cf -X POST "$api/zones/$zone/dns_records" \
    --data "{\"type\":\"CNAME\",\"name\":\"$domain\",\"content\":\"$subdomain\",\"proxied\":true}" >&2
elif ! jq -e --arg target "$subdomain" 'length == 1 and .[0].type == "CNAME" and .[0].content == $target' \
  <<<"$web_records" >/dev/null; then
  echo "deploy: $domain already has web records that do not point at $subdomain:" >&2
  jq -r '.[] | "  \(.type) \(.content)"' <<<"$web_records" >&2
  exit 1
fi
status="$(cf "$pages/$project/domains/$domain" | jq -er '.result.status')"
echo "=== BEGIN CUSTOM DOMAIN ==="
echo "$domain: $status"
echo "=== END CUSTOM DOMAIN ==="
