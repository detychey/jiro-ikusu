#!/usr/bin/env bash
# Verifies the Solidity sources of the newest generation of deployments/<network>.json on
# Sourcify (plan M4.14 step 6): ArbBlockhashEntropy, ZkReferee, Season and Challenge, each with
# the constructor arguments of its creation transaction (--guess-constructor-args). It needs no key
# and sends no transaction. The sources must be the generation's: contracts/ unchanged since its
# sourceCommit. A Stylus referee is verified with `cargo stylus verify` instead (plan M4.14).
# Usage: bash scripts/contracts/sourcify.sh [network], arbitrum-sepolia by default; RPC_URL overrides its RPC.
set -euo pipefail

network="${1:-arbitrum-sepolia}"
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
record="deployments/$network.json"
[ -f "$record" ] || { echo "sourcify: no record $record" >&2; exit 2; }
case "$network" in
  arbitrum-sepolia) rpc="${RPC_URL:-https://sepolia-rollup.arbitrum.io/rpc}" ;;
  *) rpc="${RPC_URL:?sourcify: set RPC_URL for $network}" ;;
esac

generation() { jq -r ".generations[0].$1" "$record"; }
[ "$(generation backend)" = zk ] || { echo "sourcify: the newest generation's referee is $(generation backend), not ZkReferee" >&2; exit 2; }
source_commit="$(generation sourceCommit)"
git diff --quiet "$source_commit" -- contracts/ ||
  { echo "sourcify: contracts/ differs from the generation's sourceCommit $source_commit: check it out first" >&2; exit 2; }

chain_id="$(jq -r .chainId "$record")"
for entry in ArbBlockhashEntropy:ArbBlockhashEntropy Referee:ZkReferee Season:Season Challenge:Challenge; do
  key="${entry%%:*}"
  contract="${entry#*:}"
  address="$(generation "$key")"
  echo "sourcify: $contract at $address"
  forge verify-contract --root contracts --chain "$chain_id" --verifier sourcify --rpc-url "$rpc" \
    --guess-constructor-args --watch "$address" "src/$contract.sol:$contract"
  echo "sourcify: https://repo.sourcify.dev/$chain_id/$address"
done
