# Testing Jiro-ikusu on Arbitrum Sepolia

Testnet season 1 runs for 14 days on Arbitrum Sepolia, with test ETH only. You play Challenge runs in the browser at [jiro-ikusu.win](https://jiro-ikusu.win); every run that scores is settled for you, and the season's pot is shared among all its games, each by its ticket. [`SEASON_RUNBOOK.md`](SEASON_RUNBOOK.md) gives the season's dates and how it is operated.

## 1. Before you play

- **A desktop browser with a keyboard,** and a browser wallet such as MetaMask. The Challenge page adds Arbitrum Sepolia to the wallet and switches to it.
- **Test ETH on Arbitrum Sepolia,** from one of the faucets on [Arbitrum's list](https://docs.arbitrum.io/for-devs/dev-tools-and-resources/chain-info#faucet-list), which the Challenge page also links. A run costs 0.000176 ETH, about 0.30 USD at the season's opening price of 1,700 USD an ETH, plus a little gas for its three transactions: 0.002 ETH covers about ten runs.
- **Practice first** in Training, on the [home page](https://jiro-ikusu.win): it is free, needs no wallet, and plays the 16 levels. Challenge plays their paid copies, which are easier: 3 more lives and a target of 50 % (§3).

## 2. Controls

| Key | Control |
|---|---|
| Arrow keys | Move: on the border, or into the field to cut; a cut runs two cells per tick |
| X | Commit: end the level now and keep its claim |

X is the key that prints that letter on your keyboard layout, where the browser reports it (Chrome and Edge). Elsewhere it sits at the QWERTY place of that letter; the Controls panel shows which. Every control can be rebound there, and the choice is kept in your browser.

## 3. Rules that matter for a run

- **You capture the field** by cutting from the border and back. A Challenge level is cleared at its target claim, 50 % of the field, and gives you 3 more lives than the same level in Training, whose targets are 70 % to 81.5 %. On the four levels with two bosses, a capture that separates them also clears the level once you hold half the target, 25 % of the field. A level lasts at most 3 minutes.
- **Running out of lives scores 0 for the level.** X banks the claim you have: commit when the rest of the level is not worth the risk.
- **A run is six levels,** drawn from the 16 paid levels by the chain after you pay, and played back to back. Each level is one paid game.
- **Every game earns a ticket:** your claim over the level's target, capped at 1, or 0 when you ran out of lives. A cleared level is a full ticket.
- **Every game of every run counts.** At the end of the season, the pot, the fees less the 20 % rake, is shared among all the season's games: the higher a game's ticket, the larger its prize, and no game earns more than its fee (README §8.4). While the season's average ticket is at least 0.8, a game's prize is its share of the pot by its ticket; below 0.8, a perfect game gets its fee back, about 0.05 USD of test ETH, and a game of ticket 0 still gets part of its fee back. A run you bought but never played or committed counts with tickets of 0. There is no ranking and no best run.

## 4. A Challenge run, step by step

1. **Buy.** On the [Challenge page](https://jiro-ikusu.win/challenge.html), connect your wallet and buy a run: confirm `startRun` and its 0.000176 ETH fee.
2. **Reveal.** The page waits 10 to 20 s for the run's entropy block, then asks you to confirm `revealRun`. Confirm it within about a minute: a reveal that comes too late forfeits the run. Keep the page open from the purchase until level 1 starts.
3. **Play** the six levels. The clock runs from the reveal: the run must commit within its playing time plus 120 s, which covers the level transitions, a reload and the transactions.
4. **Commit.** After level 6, confirm `commitRun` at once. The page shows how many seconds were left before the deadline.
5. **Nothing else to do.** The operator settles every run with a ticket above 0 from the chain's data, so you send nothing. If you want to prove and settle a run yourself, download its run file from the [season page](https://jiro-ikusu.win/season.html) and settle it before the season's settlement ends.
6. **Claim.** Once the season has closed, one day after its end, connect to the season page and claim the prize of your games: every player who bought a run has one.

## 5. Feedback

Open an issue on [GitHub](https://github.com/detychey/jiro-ikusu/issues). For a problem with a run, attach its run file from the season page, or the journal you downloaded from Training, and say what you saw. Anyone can replay a committed run from the chain, so a run id is enough to start.

## 6. Known gaps

- **Test ETH only.** Nothing here has value, and the contracts are not audited.
- **The levels can be known up to 256 blocks before the reveal.** The run nonce comes from a block hash, readable as soon as that block exists, so a script can see the six levels about a minute before the clock starts. It cannot change them: a run whose reveal lapses is lost.
- **A lapsed reveal forfeits the run,** and its fee stays in the pot.
- **A reload closes the current level** with the claim it had, and the run resumes at the next level. The time away counts against the 120 s.
- **Desktop and keyboard only.** There are no touch controls yet.
