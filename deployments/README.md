# Deployment records

`deployments/<network>.json` records the contracts deployed on one network. Contracts are immutable, so a redeploy is a new generation: `scripts/contracts/deploy.mjs` writes it at the front of the record's list of generations, newest first, and keeps every earlier generation as it was, so an earlier address is never overwritten. The web app (plan M5.1, `web/src/chain/deployments.ts`) reads the newest generation, `generations[0]`, of the records the repository holds when the site is built.

`scripts/contracts/deployments.mjs` checks a record against this schema, and `deploy.mjs`, `localnet.mjs` and `season.mjs` check every record they write: `node scripts/contracts/deployments.mjs deployments/<network>.json`.

## Schema

A record is a JSON object with exactly these keys:

| Key | Type | Value |
|---|---|---|
| `network` | string | the network's name, lowercase letters, digits and `-`, and the file's name without `.json`: `local`, `nitro-devnode`, `arbitrum-sepolia` |
| `chainId` | integer | the network's chain id: 31337 for `local` (anvil), 412346 for `nitro-devnode`, 421614 for `arbitrum-sepolia` |
| `generations` | list | at least one generation, newest first: each `deployedAt` is at or before the one of the generation above it |

A generation is a JSON object with exactly these keys:

| Key | Type | Value |
|---|---|---|
| `deployedAt` | string | when `deploy.mjs` finished deploying it, an ISO 8601 UTC time with milliseconds, as `Date.toISOString` writes it |
| `sourceCommit` | string | the full sha of the commit `deploy.mjs` ran from |
| `backend` | string | the referee at `Referee` (README §7.3): `mock` for MockReferee, `stylus` for the Stylus referee deployed and activated through cargo-stylus, `zk` for `ZkReferee`, whose runs the operator proves and settles (README §7.5). `ZkReferee` is pinned to the verify program's image id (`deploy.mjs --image-id`, from `zk-host image-id`) and calls RISC Zero's mock verifier `RiscZeroMockVerifier` on `local` and `nitro-devnode`, and RISC Zero's emergency stop over its 3.0 Groth16 verifier on Arbitrum One (`0x9F9994Eb4Cb5200198FEfb470f8b50301662e696`) and Arbitrum Sepolia (`0x724d375B5b622e15f0E64e9Deb76a4cB17877797`); `deploy.mjs` refuses any other chain for it (plan M4.10, M4.12). `localnet.mjs --up --backend zk` also writes `zk`, with MockReferee standing in. |
| `operator` | address | `Season`'s operator: the deployer |
| `treasury` | address | `Season`'s treasury, which `withdrawRake` pays |
| `ArbSys` | address | the ArbSys `ArbBlockhashEntropy` reads: the precompile `0x0000000000000000000000000000000000000064` on Arbitrum chains, MockArbSys on `local` |
| `ArbBlockhashEntropy` | address | the entropy source |
| `Referee` | address | the referee of the backend above |
| `Season` | address | `Season` |
| `Challenge` | address | `Challenge`, bound to `Season` by `bindChallenge` |
| `seasons` | object | each season opened on this generation's `Season`: a label, such as a season file's name, mapped to the season number `open` assigned. Empty until a season opens. `season.mjs open --season seasons/<label>.json` adds `<label>` to the newest generation. |

Addresses are checksummed (EIP-55) strings.

## Networks

- **`local`**: anvil, started by `node scripts/contracts/localnet.mjs --up`. Its deployer is anvil's development account 0 and its treasury account 1. It opens one season, labeled `local`, with the rules version, level ids and weights of `seasons/calibration-1.json` and the testnet parameters of README §8.4: D12's fee of 0.00005 ETH, a length of 14 days, the proposed grace of 48 h and slack of 120 s, `minClears` 1, and a rake of 1,000 bp, the contract tests' (`localnet.mjs` holds them). With `--backend zk`, the record names the `zk` backend, so that the web app settles through the operator, as on a zk network (plan M5.3), and MockReferee, which ignores the proof, stands in for ZkReferee. A fresh anvil is a new chain, so `--up` replaces `local.json` with a record of one generation. `deploy.mjs --network local` on a running chain adds a generation to it. `localnet.mjs --check` writes its record to a temporary file instead, since its chain stops when the check ends.
- **`nitro-devnode`**: the local Arbitrum node of `scripts/contracts/nitro/run-dev-node.sh`, the network of the `stylus` backend (plan M4.16). Its deployer's key comes from `DEPLOYER_KEY`. `e2e.mjs`, the end-to-end suite that `e2e.yml` runs on it, writes its record to a temporary file, as `localnet.mjs --check` does.
- **`arbitrum-sepolia`**: Arbitrum Sepolia, the testnet of M4 and M5 (plan M4.14, [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md)). Its deployer's key comes from `DEPLOYER_KEY`, and the deployer is also the treasury, on testnet only. `deploy.mjs` and the preflight refuse the mock backend there, and its `ZkReferee` calls RISC Zero's emergency stop, never a mock verifier. `season.mjs open` records `testnet-0` and the later seasons. A redeploy adds a generation ([`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md#4-redeploy-and-generations)).

`local.json` and `nitro-devnode.json` are not committed (`.gitignore`): they describe a chain that exists only while its node runs, and every run rewrites them. Records of public networks, such as `arbitrum-sepolia.json` (plan M4.14), are committed.
