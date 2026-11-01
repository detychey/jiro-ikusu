# Deployment records

`deployments/<network>.json` records the contracts deployed on one network. Contracts are immutable, so a redeploy is a new generation: `scripts/contracts/deploy.mjs` writes it at the front of the record's list of generations, newest first, and keeps every earlier generation as it was, so an earlier address is never overwritten. The web app (plan M5.1) reads the newest generation, `generations[0]`.

`scripts/contracts/deployments.mjs` checks a record against this schema, and `deploy.mjs` and `localnet.mjs` check every record they write: `node scripts/contracts/deployments.mjs deployments/<network>.json`.

## Schema

A record is a JSON object with exactly these keys:

| Key | Type | Value |
|---|---|---|
| `network` | string | the network's name, lowercase letters, digits and `-`, and the file's name without `.json`: `local`, `nitro-devnode` |
| `chainId` | integer | the network's chain id: 31337 for `local` (anvil), 412346 for `nitro-devnode` |
| `generations` | list | at least one generation, newest first: each `deployedAt` is at or before the one of the generation above it |

A generation is a JSON object with exactly these keys:

| Key | Type | Value |
|---|---|---|
| `deployedAt` | string | when `deploy.mjs` finished deploying it, an ISO 8601 UTC time with milliseconds, as `Date.toISOString` writes it |
| `sourceCommit` | string | the full sha of the commit `deploy.mjs` ran from |
| `backend` | string | the referee at `Referee` (README §7.3): `mock` for MockReferee, `stylus` for the Stylus referee deployed and activated through cargo-stylus. M4.10 adds `zk`, if it is built. |
| `operator` | address | `Season`'s operator: the deployer |
| `treasury` | address | `Season`'s treasury, which `withdrawRake` pays |
| `ArbSys` | address | the ArbSys `ArbBlockhashEntropy` reads: the precompile `0x0000000000000000000000000000000000000064` on Arbitrum chains, MockArbSys on `local` |
| `ArbBlockhashEntropy` | address | the entropy source |
| `Referee` | address | the referee of the backend above |
| `Season` | address | `Season` |
| `Challenge` | address | `Challenge`, bound to `Season` by `bindChallenge` |
| `seasons` | object | each season opened on this generation's `Season`: a label, such as a season file's name, mapped to the season number `open` assigned. Empty until a season opens. |

Addresses are checksummed (EIP-55) strings.

## Networks

- **`local`**: anvil, started by `node scripts/contracts/localnet.mjs --up`. Its deployer is anvil's development account 0 and its treasury account 1. It opens one season, labeled `local`, with the rules version, level ids and weights of `seasons/calibration-1.json` and the testnet parameters of README §8.4: D12's fee of 0.00005 ETH, a length of 14 days, the proposed grace of 48 h and slack of 120 s, `minClears` 1, and a rake of 1,000 bp, the contract tests' (`localnet.mjs` holds them). A fresh anvil is a new chain, so `--up` replaces `local.json` with a record of one generation. `deploy.mjs --network local` on a running chain adds a generation to it. `localnet.mjs --check` writes its record to a temporary file instead, since its chain stops when the check ends.
- **`nitro-devnode`**: the local Arbitrum node of `scripts/contracts/nitro/run-dev-node.sh`, the network of the `stylus` backend (plan M4.16). Its deployer's key comes from `DEPLOYER_KEY`.

`local.json` and `nitro-devnode.json` are not committed (`.gitignore`): they describe a chain that exists only while its node runs, and every run rewrites them. Records of public networks, such as `arbitrum-sepolia.json` (plan M4.14), are committed.
