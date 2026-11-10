# Testing Jiro-ikusu on Arbitrum Sepolia

Testnet season 1 runs for 14 days on Arbitrum Sepolia, with test ETH only. You play Challenge runs in the browser at [jiro-ikusu.win](https://jiro-ikusu.win); each player's best run is settled for you, and qualified players share the season's pot. [`SEASON_RUNBOOK.md`](SEASON_RUNBOOK.md) gives the season's dates and how it is operated.

## 1. Before you play

- **A desktop browser with a keyboard,** and a browser wallet such as MetaMask. The Challenge page adds Arbitrum Sepolia to the wallet and switches to it.
- **Test ETH on Arbitrum Sepolia,** from one of the faucets on [Arbitrum's list](https://docs.arbitrum.io/for-devs/dev-tools-and-resources/chain-info#faucet-list), which the Challenge page also links. A run costs 0.00005 ETH, plus a little gas for its three transactions: 0.001 ETH covers about ten runs.
- **Practice first** in Training, on the [home page](https://jiro-ikusu.win): it is free, needs no wallet, and plays the same 16 levels.

## 2. Controls

| Key | Control |
|---|---|
| Arrow keys | Move: on the border, or into the field to cut |
| A | Hold for the fast cut: two cells per tick while cutting |
| B | Hold for the slow shield: one cell every second tick; it absorbs one hit |
| X | Commit: end the level now and keep its claim |

A, B and X are the keys that print those letters on your keyboard layout, where the browser reports it (Chrome and Edge). Elsewhere they sit at the QWERTY places of those letters, so on an AZERTY keyboard A is the key that prints Q; the Controls panel shows which. Every control can be rebound there, and the choice is kept in your browser.

## 3. Rules that matter for a run

- **You capture the field** by cutting from the border and back. A level is cleared at its target claim, 75 % by default. A level lasts at most 3 minutes.
- **Running out of lives scores 0 for the level.** X banks the claim you have: commit when the rest of the level is not worth the risk.
- **A run is six levels,** drawn from the 16 by the chain after you pay, and played back to back. Its score is the sum of the six level scores: your claim on each level times that level's weight, so the draw does not decide the ranking. A run qualifies for the pot when it clears at least one level.
- **Your best run counts,** by qualification, then score, then fewer ticks. At the end of the season, qualified players share the pot in proportion to their best scores.

## 4. A Challenge run, step by step

1. **Buy.** On the [Challenge page](https://jiro-ikusu.win/challenge.html), connect your wallet and buy a run: confirm `startRun` and its 0.00005 ETH fee.
2. **Reveal.** The page waits 10 to 20 s for the run's entropy block, then asks you to confirm `revealRun`. Confirm it within about a minute: a reveal that comes too late forfeits the run. Keep the page open from the purchase until level 1 starts.
3. **Play** the six levels. The clock runs from the reveal: the run must commit within its playing time plus 120 s, which covers the level transitions, a reload and the transactions.
4. **Commit.** After level 6, confirm `commitRun` at once. The page shows how many seconds were left before the deadline.
5. **Nothing else to do.** The operator settles each player's best run from the chain's data, so you send nothing. If you want to prove and settle a run yourself, download its run file from the [season page](https://jiro-ikusu.win/season.html) and settle it before the season's settlement ends.
6. **Claim.** Once the season has closed, a week after its end, connect to the season page and claim your share if your best run qualified.

## 5. Feedback

Open an issue on [GitHub](https://github.com/detychey/jiro-ikusu/issues). For a problem with a run, attach its run file from the season page, or the journal you downloaded from Training, and say what you saw. Anyone can replay a committed run from the chain, so a run id is enough to start.

## 6. Known gaps

- **Test ETH only.** Nothing here has value, and the contracts are not audited.
- **The levels can be known up to 256 blocks before the reveal.** The run nonce comes from a block hash, readable as soon as that block exists, so a script can see the six levels about a minute before the clock starts. It cannot change them: a run whose reveal lapses is lost.
- **A lapsed reveal forfeits the run,** and its fee stays in the pot.
- **A reload closes the current level** with the claim it had, and the run resumes at the next level. The time away counts against the 120 s.
- **Desktop and keyboard only.** There are no touch controls yet.
