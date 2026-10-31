# Verification

## Stylus activation

[`scripts/contracts/activation.mjs`](../scripts/contracts/activation.mjs) reads `ArbWasm.activationGas()` from the precompile at `0x0000000000000000000000000000000000000071`, at the chain's latest block. New Stylus activations count as open at or below 30,000,000, cargo-stylus 0.10.10's threshold, as ethblockdigger's `scripts/contracts/checks.ts` checks: the chain owner pauses them by raising `activationGas` above it (README §7.3). M4.9, M4.10 and M4.16 reuse it.

| Network | chainId | Block | Date (UTC) | `activationGas` | Activations |
|---|---|---|---|---|---|
| Arbitrum Sepolia | 421614 | 324,664,851 | 2026-10-31 12:23:24 | 18,446,744,073,709,551,615 (2^64 − 1) | paused |
| Arbitrum One | 42161 | 519,986,698 | 2026-10-31 12:23:25 | 18,446,744,073,709,551,615 (2^64 − 1) | paused |

- **First readings,** M4.3, with `activation.mjs` at commit e3623c2856a206366ef942e53b60fa3c7d849a8e, Node v22.22.0 and ethers 6.17.0:

  ```bash
  npm ci --prefix scripts/contracts
  node scripts/contracts/activation.mjs --rpc https://sepolia-rollup.arbitrum.io/rpc
  node scripts/contracts/activation.mjs --rpc https://arb1.arbitrum.io/rpc
  ```

  ```text
  chainId 421614, block 324664851 (2026-10-31T12:23:24.000Z): activationGas 18446744073709551615, above 30000000: activations paused
  chainId 42161, block 519986698 (2026-10-31T12:23:25.000Z): activationGas 18446744073709551615, above 30000000: activations paused
  ```

- **Reading.** Both chains hold `activationGas` at the uint64 maximum, so the pause of README §7.3 still holds on both.
