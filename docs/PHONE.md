# Phone version

The phone version of Jiro-ikusu: why it is the web client and not an app, what it covers, and how it plays, installs and keeps a paid run safe on a phone. It is milestone M3 of README §9, scheduled on 2026-11-11. Its work items are in [`IMPLEMENTATION_PLAN.md` §8](../IMPLEMENTATION_PLAN.md#8-m3-phone-version).

[`README.md`](../README.md) is normative and wins over this file. Nothing here changes a game rule: README §4, §5 and §6.1-§6.4 and §6.6 stay as they are, `RULES_VERSION` stays 2, and no vector moves. The phone client produces the same seven mask bits, sampled once per tick ([README §6.1](../README.md#61-input-mask)), on the single input path ([§6.2](../README.md#62-events)) through the same Recorder ([plan M1.8](../IMPLEMENTATION_PLAN.md#m18-tick-loop-hits-end-of-level-state-hash-replay-and-recorder)), and never computes state or a score ([§6.5](../README.md#65-clients)).

**Owner of numbers.** This file owns the phone client's parameters: the touch geometry and holds (§3.4), the play view's reserves and the compact HUD (§4), the bound that marks a frame gap as hidden, the run store's save interval and the hidden-page threshold (§6), the service worker's navigation timeout (§5.2) and the device matrix (§9.5). The README owns the rules, the style guide owns the look, and `seasons/*.json` own `commitSlack`.

> **Status: adopted (2026-11-11). M3 is scheduled,** with D16 (README §13), and the items of the plan's §8 build what it specifies. The owner answered the decisions of [§12.1](#121-the-owners-decisions) on 2026-11-11, all but OD2, which M3.16 decides after M3.12's measurements; M3.11 records the answers here and in the README and the plan. Facts marked **[verify]** need a device or a primary source; [§14](#14-unverified-facts) lists each with the item that settles it. **[estimate]** marks our own arithmetic.

## 1. Is a progressive web app the right first step?

**Yes, with one correction.** The right vehicle is the existing web client, the same site and the same wasm core, made playable by touch. Its first step is touch play, not the parts usually called a PWA:

- **Touch controls and a phone play view** make Training playable on a phone. Today the game cannot be played without a keyboard.
- **Installing** is a manifest change. iOS 26 and later install any site as a Home Screen web app [3], and Chrome needs no service worker to install [12][14]. It serves Training.
- **Paid Challenge runs** on a phone are played in a wallet app's own browser. That is the same site, but not the installed app. The site's wallet code needs an injected wallet, which a phone has mostly inside a wallet's in-app browser, or in a browser with a built-in wallet such as Brave [34]; from a phone's own browser, MetaMask is reached by a link to its app [20] (§7).
- **The service worker** buys only offline Training. It is the riskiest piece of a PWA, so it comes last and is optional (§5.2).

No native app and no store build while paid runs exist.

### 1.1 Options compared

| Criterion | **Web client** (the site, touch-first, installable) | **Store wrapper** (TWA on Android; Capacitor on both) | **Native app** (Rust core through UniFFI, Swift and Kotlin UI) | **Cross-platform UI** (React Native with Rust bindings; Tauri 2 mobile) |
|---|---|---|---|---|
| Determinism and referee parity | **Best.** The same `wasm32` build that CI's wasm-parity job checks, and the same Recorder, journal encoding, closing rule and run store. New: JavaScriptCore runs the wasm on iOS, so a WebKit parity run is needed (M3.12). | Same as the web client: the same wasm in a system WebView. | **Weaker.** The native build already agrees with wasm and RISC Zero (README status line, M1), and an aarch64 build is a recompile under the same gates. The cost is the client duties, written today in `web/src/run/`, written twice more: the tick clock, closing a level ([§7.2](../README.md#72-run-flow)), the deadline, the season check and the run store. A bug in any copy makes runs late. | **Weaker.** React Native needs the core through bindings and rewrites the client duties once. Tauri keeps `web/` in a WebView, like a wrapper. Flutter was not researched. |
| Time to a playable phone version | **Shortest.** Two M items give touch play in Training (M3.13, M3.14), one S item installs it (M3.15). No review step. | The web client's work, plus two shells, signing, developer accounts and store review on every release. | Months: two UIs, two renderers, two input layers, two run flows, two wallet integrations. | Months: a new UI, the bindings and their toolchain. |
| Touch play | **Good.** Pointer Events with multi-touch and `touch-action` [1]. On an iPhone: no element fullscreen, no orientation lock, no vibration [1]; an installed app is `standalone`, with the status bar. | Native APIs through the shell's plugins (not researched here). TWA: Chrome's display modes. | Best: native gestures and haptics, and Apple's touch-controller framework. | Near native. |
| Wallets and paid runs | **Medium.** The current injected-wallet code works inside a wallet app's browser, and in a browser with a built-in wallet such as Brave [34]. Elsewhere it needs a connector, and each of a run's three signatures is an app switch (§7.2). | Blocked by store policy (next row). | Blocked by store policy. | Blocked by store policy. |
| Store policy for paid onchain entries | **Lowest.** No review. A legal read is already a pre-mainnet prerequisite ([`ECONOMY.md` §4](ECONOMY.md#4-pre-mainnet-prerequisites-not-scheduled)). Apple could restrict Home Screen web apps, as it announced and then reversed in the EU in 2024 [27]; Safari tabs would still work. | **High.** Google Play bans "games that accept money in exchange for an opportunity to win a … monetary prize" outside licensed gambling apps, and no real-money pilot is open [18][19]. Apple requires licenses, geo-restriction and a free app (5.3.4), bars unlocking content with cryptocurrency (3.1.1) and rejects repackaged websites (4.2) [17]. | High: the same rules. | High: the same rules. |
| Offline Training | Good, with the optional service worker: about 100 KB for Training, 568 KB for the whole site. Training makes no network call once loaded. | Best: assets in the app. | Best. | Best. |
| Storage of an unfinished run | **Medium.** IndexedDB. Safari, the Home Screen app and each wallet browser keep separate storage [6], so a run stays in the context it was bought in. Chromium evicts best-effort storage under pressure unless it is persistent [28]. The exposure lasts from the reveal to the commit: at most 1,080 s plus `commitSlack`. | Good: app-scoped WebView storage. | Best. | Good. |
| Maintenance | **Lowest.** One codebase; new code is a touch module, a play view and later a service worker. No new dependency. | Medium: two shells, SDK churn (Capacitor 8.5 adopts UIScene for Xcode 27 [32]), signing keys and listings. | Highest. | High. |
| Verdict | **First step** | Only for a free Training app, if store presence ever matters (§1.4) | No | No |

Nothing native buys security. "Paid runs are played in the browser, which attests nothing" ([README §7.1](../README.md#71-what-verification-proves)), and a native app attests nothing the contracts can check either. Bots remain a matter for the fee, qualification and public journals ([§7.4](../README.md#74-bots)).

### 1.2 What comes first, and what comes after

| Phase | Covers | Items |
|---|---|---|
| 0. Measure | WebKit parity in CI; a probe page and today's site measured on the owner's phones, wallet browsers included | M3.12 |
| 1. Training on phones | Touch controls, the phone play view, installing. A release point: the status lines say Training plays on phones. | M3.13, M3.14, M3.15 |
| 2. Challenge on phones | The hidden-page policy, the wake lock and storage, Challenge in wallet browsers, phone runs on testnet. M3 closes. | M3.16, M3.17, M3.18, M3.19 |
| 3. Offline Training (optional) | The service worker | M3.20 |
| Conditional | Challenge in the installed app or a browser tab, through a connector | M3.21, M3.22 |
| Optional | Gamepads | M3.23 |

Measurement comes before rule text: M3.12's device data feeds the hidden-page policy (OD2), whose README sentence M3.16 writes.

### 1.3 What would change the answer

- **The owner wants paid runs in the App Store or Google Play.** That is a licensing question, not a technology one: licenses per jurisdiction and geo-restriction [17][18]. If it is ever cleared, a Capacitor shell around this site is the cheapest store build. A native app still is not.
- **M3.12's clock probe fails.** If WebKit on a supported iPhone cannot hold the 15 Hz loop (A3), the iOS client would need a native UI on the UniFFI core. This is unlikely: the core's worst tick was estimated at about 22 ms on an RP2040 microcontroller, from qemu instruction counts in the handheld spike removed on 2026-11-10; it was never measured on the device.
- **Apple removes or cripples Home Screen web apps.** Safari tabs keep working. Installing and offline play would be lost on iOS, and a Training-only wrapper becomes worth weighing, subject to guideline 4.2.
- **Wallet browsers turn out unusable** (M3.12, M3.18): no IndexedDB or Web Locks, a reload on every return, or a signing sheet that hides the page. The fallbacks stay on the web: a connector (M3.21), a smart account with a session key, or an embedded wallet (§7.2). None of them is a reason to go native.
- **Fewer player signatures per run.** A smart account with a session key scoped to `revealRun` and `commitRun` needs no contract change: README §7.2 already accepts a smart-account player, and M5.3's loader finds an embedded `commitRun`. A reveal that anyone may call would change README §7.2 and need a new `Challenge` contract and a new season. Either makes a connector path much easier.
- **Discoverability becomes the bottleneck.** Then a free, Training-only TWA on Google Play, under §1.4's conditions.

### 1.4 Why no store build

- **What needs players is Challenge.** The pot is shared pro rata among a season's qualified players *(D10)*, and no store can list Challenge (§1.1).
- **A store app would bring Training players with no path to paid runs.** Google Play counts even a link out to a cash-prize contest as a call to action [18]. A TWA shows its verified origin [16], and every page's nav links to Challenge (`web/index.html:29`). So a Training-only TWA needs its own Training-only build, on its own origin or path, with no Challenge or Season links; a `scope` setting is not enough. On iOS it would also have to clear guideline 4.2 [17].
- **Not researched:** wallet dapp directories, and mini-app channels inside wallets and social apps. They are web apps inside wallets, the model of Phase 2.

## 2. Scope

**D16** (owner, 2026-11-11; README §13; [§12.1](#121-the-owners-decisions), OD1 and OD6): on phones, the game is the same web client on the same wasm core. It is touch-first, installable for Training, and plays Challenge in a wallet app's own browser. No store build exists while paid runs exist, and there is no native client.

**Devices:**

- iOS and iPadOS, current and previous major (27 and 26 on 2026-11-10 [1][2]): Safari tabs, Home Screen apps, and wallet browsers (WKWebView). iOS 18.4-18.7 is best effort and untested: 18.4 is the first release where the wake lock works in Home Screen apps [5].
- Chrome for Android, current and previous major (157 and 156 on 2026-11-10 [33]): tabs, the installed WebAPK [15], and wallet browsers (Android WebView). A new major ships every two weeks [33], so the previous one is a short window. Samsung Internet, Firefox and Brave, whose built-in wallet connects to dapps from its own tabs [34], are best effort.
- Tablets get the same play view at a larger scale.
- Lockdown Mode removes WebAssembly [8], so the game cannot run there. The engine loader says so instead of failing generically.

**Pages:**

| Page | On a phone |
|---|---|
| Training | First class: touch, installing (Phase 1), offline (Phase 3) |
| Challenge | Phase 2, in wallet browsers (M3.18). Until then the tester guide lists phones as unsupported. |
| Season | Reads work today. Close, claim and settle need a wallet, so on a phone they run in a wallet browser (M3.18). |
| Replay | Works today. Its file path works offline with the service worker (M3.20); its chain path needs the network. |
| Editor | Works through Pointer Events and gets the larger field. It stays desktop-first, with no phone-specific feature. |

**Desktop only:** key rebinding (it still works with a Bluetooth keyboard), the bots and `jiro-tools`, and proving. **Unchanged everywhere:** the keyboard path, the desktop layout at fine pointers, and the field's `integerScale` on desktop.

## 3. Touch controls

Touch produces controls, never keys, and the journal records controls *(D8)*. So a touch scheme is rules-neutral as long as each tick's sample is the same seven bits.

### 3.1 Mapping

| Control | Touch | Mask bit | Rules served |
|---|---|---|---|
| Directions | A floating stick in the left zone; its origin is where the thumb lands, as Apple's guidelines advise [24]. Past the dead zone, the angle sets a direction (§3.2). | 0-3 | [R4.5-1] direction resolution; [PIN-05]. Lifting the finger stands the player still. |
| A, fast cut | Held while a pointer is on A | 4 | [R4.5-6]: a fast cut needs A held |
| B, shield | Held while a pointer is on B | 5 | [R4.5-7], [PIN-03]: `press_tick` is the tick B enters the mask, and B wins over A. [R4.9-15]: the shield absorbs a hit only if B is held when it resolves. |
| X, commit | Enters the mask once a pointer has been down on X through `xHold` earlier samples (§3.3) | 6 | [R4.4-7], [R4.10-2]: X ends the level and discards an open cut. [PIN-07]: X at tick 0 scores claim 0. |
| Y | None | none | *(D8)*: not journaled |
| Bit 7 | Never set | none | [§6.1](../README.md#61-input-mask); decode code 10 |

### 3.2 Directions

- **Single direction.** Outside the diagonal bands, the stick sends the direction nearest its angle.
- **Diagonal bands.** In a band centered on a diagonal, the stick sends both adjacent directions only when one of them is the direction it sent on the previous sample. With two held, R4.5-1 keeps the previous one, so the band is hysteresis: a thumb drifting toward a diagonal does not turn the player. Otherwise, from rest or from the opposite side, it sends the nearest single direction. Sending both from rest would let R4.5-1's order (up, down, left, right) turn an up-left thumb up even when the player meant left.
- **Follow.** The origin follows the finger once it is more than the follow radius away, so a reversal costs little travel.
- A plain band, two bits whenever in the band, is rules-neutral too. The owner chose the conditional band (OD3).

### 3.3 X, and what its guard costs

A one-tick X is enough to end a level, so a stray tap on a touch X commits. A guard against that has a cost, which the owner accepted on 2026-11-11 (OD3):

- **Commit is an emergency action.** "Running out of lives scores zero, which makes Commit meaningful" *(D5)*. A hold of `xHold` ticks delays it by `xHold` × 66.667 ms; at 8 ticks, a minion of period 1 moves 8 cells in that time ([`levels/README.md`](../levels/README.md): levels 08, 10-12 and 14-16).
- **Ranking.** Touch and keyboard players rank in one table, where ties go to fewer ticks *(D10)*. A hold adds `xHold` ticks to every level committed by X.
- **So the hold is measured, not assumed.** M3.14's playtest counts accidental commits at `xHold` = 0, 2, 4 and 8, with X placed apart from A and B, and keeps the shortest hold that meets A7. Alternatives, if no hold works: X out of thumb reach with no hold, or a two-tap arm (a tap arms X, a second tap within a few ticks commits).
- **The keyboard X stays a single press,** and a gamepad's X needs no hold (M3.23).
- **Challenge's Stop** (end the run and commit it now) is page UI, not a mask bit: it needs a hold of 15 ticks (1 s).

The README states only that X may need a short hold, set in this file (M3.13); the number stays here.

### 3.4 Sampling, releases and parameters

- **One input path.** `HeldKeys` and a new `TouchControls` implement one input source (`sample()`, `clear()`). The tick samples the OR of every source once (`web/src/session.ts`, `web/src/run/play.ts`). Keyboard and gamepad stay active beside touch.
- **Taps shorter than a tick** count once, by the rule `HeldKeys` already applies to keys (`web/src/input.ts`: "a tap shorter than a tick still counts once"). That covers A, B and a stick flick. X needs its full hold.
- **Releases.** Every touch control is released on `pointerup`, `pointercancel` and `lostpointercapture`, and on `visibilitychange` to hidden, `blur` and `pagehide`. A released control is out of the next sample.
- **Multi-touch.** One finger steers while another holds A or B. A pointer holds the button under it and can slide between A and B.
- **Where they show.** On `(pointer: coarse)`: on Training from M3.13, and on Challenge only from M3.18, which waits for testnet-1's report or puts them behind a flag that stays off during testnet-1 (OD7), so that no testnet-1 run is played by touch. The Controls panel turns them on, off or mirrored for left-handed play, stored per browser like the key bindings, and on coarse pointers it explains them in place of the keys, keeping the bindings table for a keyboard.

| Parameter | Default |
|---|---|
| Dead zone | 12 CSS px |
| Follow radius | 48 CSS px |
| Diagonal band | 20°, centered on each diagonal |
| Stick zone | 144 × 144 CSS px at least |
| A and B | 72 × 72 CSS px when the button zone is at least 152 px wide, else 64 × 64 |
| X | 56 × 56 CSS px, at least 24 px from A and B |
| Gaps between controls | 8 px at least |
| Edge clearance | 16 px from the screen's side edges **[estimate]**, against edge back-swipes, which a page cannot turn off on Android [35]; resized from M3.12's measurement of the back-gesture zone (§14). Controls stay inside the bottom safe area. |
| `xHold` | 4, provisional until M3.14's playtest (A7), which chooses it from 0, 2, 4 and 8 ticks (OD3) |
| Stop hold | 15 ticks |

Every length is a multiple of 4 px ([STYLE_GUIDE.md §8](STYLE_GUIDE.md#8-interface)), and 64 px clears Apple's 44-pt minimum [24]. The defaults are tuned in M3.14's playtest. **The look** goes into the style guide as a new §8 component, "Touch controls", which cites this table for its sizes: cabinet buttons on a 4-px shelf, each named by its action, CUT, SHIELD and COMMIT, over its letter, A, B or X, both in Jiro Pixel 12 at 12 px (COMMIT is 47 px wide, inside X's 56), which the guide's §4 adds to the face's uses; Apple's guidelines advise against controller letters as a button's only art [24]. The stick is a 2-px `--claim` ring with a `--player` knob, and X's hold shows in whole ticks. Nothing blinks, and `prefers-reduced-motion` removes the press translate.

## 4. Layout and field scale

### 4.1 Field scale

- **Desktop** (fine pointers) keeps `integerScale` and `fitField` as they are.
- **Phones** (coarse pointers, in the play view): the cell is c = floor(min(W_avail, H_avail) / 60) whole CSS px. The renderer draws whole cells of c CSS px and never scales a 240-px bitmap by a fraction ([STYLE_GUIDE.md §15](STYLE_GUIDE.md#15-do-and-dont)). At a fractional device pixel ratio, cells differ by a device pixel, which the guide's §5 accepts.
- **When c < 4** (today's size), the field does not fit beside the controls at 4 px per cell. With zero insets, c ≥ 4 needs, in portrait, 272 px of width and 504 px of height in Training or 552 px in Challenge; in landscape, 592 px of width and 256 px of height (§4.2's formulas). Short portrait views are likely: a browser's or a wallet's toolbars take height, and §4.3's 375 × 548 row gives Challenge c = 3.
  - Below those sizes, the field is drawn at the c that fits, 3 CSS px per cell or fewer, still in whole cells, with the controls live.
  - Where the other orientation gives a larger c, the play view asks the player to turn the phone; iOS cannot lock the orientation [1]. In Training the request is a panel over the field, and the level pauses under it, as on a hide (§6.4); a tap resumes it at the smaller size. In Challenge the field stays drawn and the level plays on: the request shows only before the level and during the transitions, never over the field.
- The field is 60c, always a multiple of 4. Whole CSS px per cell on phones is OD4, decided on 2026-11-11; M3.14 amends the guide's §8 ("the field keeps `integerScale`"), and the planned sprite stamps of its §9 then need a definition at every whole cell size.

### 4.2 Reserves, HUD and controls

The values of the HUD stay at 24 px, the style guide's minimum for essential values in Jiro Pixel 12 (its §4); its labels are the 12-px labels of its §8.

- **Compact HUD.** One row of four cells, each a label (12/16) over a value (24/24): claim, with the target in its label ("CLAIM · 75.00 %" over "74.92 %"), lives, shield and time. The cells are as wide as their content and 8 px apart. With the site's font, the claim label is 112 px wide, the lives and shield labels 39 and 49, and the time value ("180 s") 60, so the row takes at most 283 px, inside the 288 px of a 320-px screen; the guide's 16-px HUD column gap would need 307. In Challenge, a second row: the run squares with "Level n of 6", the deadline margin, and Stop at its end, a 40-px secondary button behind its hold (§3.3), about 255 px in all **[estimate]**. Each row is 40 px, plus 8 px of padding.
- **Portrait,** top to bottom: the HUD, the field, the controls zone (176 px tall: the stick zone on the left, X above A and B on the right). W_avail = W − left and right insets − 32. H_avail = H − top inset − max(bottom inset, 16) − HUD (48, or 96 in Challenge) − 176 − 24, the 24 being three 8-px gaps.
- **Portrait at 320 px:** 288 px of width fit the 144-px stick zone, an 8-px gap and two 64-px buttons with an 8-px gap between them. X sits above B, at least 24 px clear.
- **Landscape:** two side zones of 160 px (16 px of edge clearance and a 144-px control area), 16 px between each zone and the field. The HUD splits over the zones' tops: claim and time on the left; lives, shield, the run and Stop on the right. A and B are 64 px. W_avail = W − insets − 352; H_avail = H − insets − 16.

```text
portrait, 360 x 640                       landscape, 640 x 360
+------------------------------------+    +------------+--------------+------------+
| CLAIM·75.00 %  LIVES  SHIELD  TIME |    | CLAIM·75 % |              | LIVES  SHLD|
| 74.92 %        3      1      161 s |    | 74.92 %    |              | 3      1   |
+------------------------------------+    | TIME 161 s |   field      |       [X]  |
|                                    |    |            |   240        |            |
|            field 300               |    |   ( o )    |              |  [A]  [B]  |
|                                    |    |            |              |            |
+------------------------------------+    +------------+--------------+------------+
|   ( o )  stick zone      [X]       |
|                       [A]  [B]     |
+------------------------------------+
```

### 4.3 Expected field sizes

Derived with §4.2's formulas from Playwright's device descriptors, measured without `viewport-fit=cover`, with zero insets except where noted; the 375 × 548 row is not a descriptor but a short tab. The portrait column is Training's, and Challenge's second HUD row costs a step only where noted. M3.14 derives the table again on devices, with `viewport-fit=cover`, and replaces it. Today every row is 240.

| Viewport (CSS px) | Portrait | Landscape |
|---|---|---|
| 320 × 568 | 240 | 180, and asks to turn the phone (W_avail 216) |
| 360 × 640 | 300 | 240 |
| 375 × 548 (iPhone SE class in a tab, with the browser's toolbars **[estimate]**) | 240 (Challenge: 180) | 180; Training asks to turn the phone |
| 375 × 667 (iPhone SE class, full screen) | 300 | 300 |
| 393 × 659 (iPhone 15, Safari tab) | 360 (Challenge: 300) | 300 at 734 × 343 |
| 393 × 852 (iPhone 15 installed; insets 59 top and 34 bottom in portrait, 59 a side and 21 bottom in landscape **[verify]**) | 360 | 300 |
| 412 × 839 (Pixel 7) | 360 | 300 at 863 × 360 |
| 430 × 739 (iPhone 15 Pro Max, Safari tab) | 360 | 360 at 814 × 380 |

### 4.4 The rest of the layout

- **Play view.** On coarse pointers, Play enters the play view: the field, the compact HUD and the controls fill the screen. The end-of-level panel shows inside it, over the field and the controls zone together in portrait, and over the whole play view in landscape: today's panel measured 268 to 368 px tall at 320 and 360 px of width and 220 to 268 px at 568 to 863, against a 176-px controls zone. Today it is off screen in landscape, and Training's controls bar of M3.13 takes the HUD's place beside the field, which pushes the HUD's lower rows below the screen. Rotating mid-level re-fits at the next frame and never touches the tick clock.
- **Before play.** On coarse pointers, the field and the HUD stay hidden until Play, and the stacked lockup shows at 1 CSS px per cell under `(min-resolution: 2dppx)`, which the guide's §5 allows; below a device pixel ratio of 2 it keeps 2. Play's top is then at 560 px at 360 × 640, on the first screen; at 2 px per cell it would be at 670. Today Play is already above the Controls panel, but 1,122 px down, under the field (at 518 px) and the HUD (at 774 px). Measured with the built site in Chromium, 2026-11-10.
- **Challenge during a run** (M3.18): the wallet, season and run panels collapse, and the play view shows the run's status in the HUD. Today the field sits about 1,430 px down and never shares the screen with the HUD.
- **Gestures.** On the play view: `touch-action: none`, `user-select: none`, `-webkit-user-select: none`, `-webkit-touch-callout: none`, and no long-press `contextmenu` on the field; `overscroll-behavior: none` on the root while in play, against pull-to-refresh. Whether iOS lets a page block its edge back-swipe and system gestures is **[verify]**; Android's back swipe from a side edge cannot be blocked by a page [35], so the edge clearance (§3.4) keeps controls out of its zone. Today a swipe on the field scrolls the page by 177 to 328 px.
- **Safe areas.** All five pages get `viewport-fit=cover`, and the header and play view are padded by `env(safe-area-inset-*)`. `web/test/pages.test.ts` pins the viewport tag and changes with it.
- **Phone targets** (guide §14): on coarse pointers, nav links and the wordmark link become 40-px targets (today 24 px, and 22 px for the wordmark below a 400-px viewport), and textareas get 16-px type, which avoids iOS's zoom on focus. Pages still reflow at 320 px.

## 5. Installing, offline, files and builds

### 5.1 Manifest and install (Phase 1, M3.15)

- **Manifest.** `web/public/site.webmanifest` gains `id` "/", `short_name` "Jiro-ikusu", `description` (the `og:description` text), `scope` "/" and `display` "standalone". It keeps `start_url` "/", the colors and the three icons. It sets no `orientation`: both are supported, and iOS ignores the member [1]. `standalone` is the most iOS offers: it has no `fullscreen` display [1].
- **Splash.** Android builds its splash from the icon, the name and `background_color`. No per-device iOS startup images, so iOS shows `background_color`, then the page. The style guide's §16 "Phone" line is rewritten to match; any new image comes only from `node brand/build.mjs`.
- **Install hint.** On Android, a stashed `beforeinstallprompt` shows an "Install" secondary button in Training's intro; Chrome may still require a `fetch` handler before firing it [13] **[verify]**, and its menu installs in any case [14]. On iOS Safari, when `navigator.standalone` is false, a one-time, dismissible hint: "Share, then Add to Home Screen". Both say that the installed app keeps its own data, so Training bests in the browser do not carry over [6].
- **Release point.** With M3.13-M3.15 merged, Training plays on phones; M3.15 updates the README and plan status lines.

### 5.2 The service worker (Phase 3, optional, M3.20)

It buys offline Training and nothing else, so it comes last. Hand-written, with no new dependency (AGENTS_COMETH: think twice before adding a library):

- **Build.** A small Vite plugin in `web/vite.config.ts` writes `dist/sw.js` with the precache list and the cache name `jiro-<git sha>`.
- **Precache.** The five pages under the URLs Cloudflare serves them at, `/`, `/challenge`, `/season`, `/replay` and `/editor`, and every other file the build emits but `_redirects` and the preview-only pages (§9.3). The site answers `/challenge.html` with a 308 to `/challenge` (checked 2026-11-10), and a service worker may not answer a navigation with a redirected response: Fetch returns a network error when the redirect mode is not "follow" and the response's URL list has more than one item [31]. So no precached response may be redirected.
- **Install.** Every response must be OK, not redirected, and of the content type its path implies. Cloudflare answers an unknown path, `/sw.js` and `/assets/` included, with 200 and `text/html` (checked 2026-11-10), so a wrong path would otherwise cache a page under an asset's name. Any failure fails the install, and the previous worker stays. Every push to `main` deploys, and the git sha changes the hash of every chunk that embeds it, so each deploy names a new cache: an `/assets/` file that the previous `jiro-*` cache holds under the same URL is copied from it, its URL carrying its content hash, and only the other files are fetched. A deploy then costs an installed phone its changed chunks and the unhashed files, about 166 KB of the build's 568 KB (2026-11-10), not the whole precache.
- **Fetch.**
  - Same-origin navigations go to the network first, with a 3-s timeout; on failure, the cached page for the path, with `/x.html` mapped to `/x` and `/index.html` to `/`, and the query ignored.
  - `/assets/*` is content-hashed, so it is cache-first, and the network serves a miss.
  - Other precached files go to the network first, with the cache as the offline fallback.
  - Cross-origin requests (RPC, wallets, faucets) and non-GET requests are never intercepted.
- **Lifecycle.** No `skipWaiting` and no `clients.claim`: a new worker activates when no page uses the old one [30], then deletes every other `jiro-*` cache. Online loads that answer within 3 s get the current build; slower ones, and offline ones, get the cached build. Either is one consistent build: the wasm and the 16 levels are content-hashed assets (the levels bundled by `import.meta.glob` in `web/src/shipped.ts`), and no chunk is loaded later by a dynamic `import()`. §5.4's resume guard, not network-first, keeps a resumed run's journals valid.
- **No pinning.** A worker cannot pin a build to a run: a waiting worker activates by itself once the last page of the old one closes [30], for example when the player swipes the app away mid-run. Valid journals do not need pinning (§5.4).
- **No `_headers` rule.** Browsers fetch `sw.js` past the HTTP cache by default (`updateViaCache` "imports") [29]. Cloudflare already serves HTML and the wasm with `max-age=0, must-revalidate`, and the hashed JavaScript and CSS with `max-age=14400` (checked 2026-11-10).
- **Kill switch.** A build flag ships a `sw.js` that deletes every `jiro-*` cache and unregisters itself, for a bad release.
- **Offline,** after one online load: Training plays a full level, keeps local bests and shares or downloads its journal; Replay opens local `.jrn` and `.bin` files; the Editor works; Challenge and Season load their shell and say they need the network. README §8.1 gains "Once loaded, Training also plays offline."

### 5.3 Files on phones (M3.15)

- Journals and run files go out through the Web Share API with files when `navigator.canShare({ files })` accepts them, and through today's blob download otherwise.
- Whether iOS lets a player pick `.jrn` and `.bin` files, and whether blob downloads work in standalone mode, is **[verify]**. File inputs keep validating the content: the decoder rejects a bad file with its code.
- In Android wallet browsers, journal and run-file downloads are **[verify]**: Android WebView has no Web Share API [1], and a blob download works only if the wallet app handles it (M3.12).

### 5.4 Builds and runs (M3.17)

A run's journals are valid on the season's referee if the client's core has the season's `RULES_VERSION` (decode code 4, [README §6.3](../README.md#63-journal-bytes-v1)) and plays the season's 16 levels (settlement check 3, [§7.2](../README.md#72-run-flow)). M5.2's season check refuses a mismatch at Buy, and the season runbook freezes `core/` and `levels/` while a season is open ([`SEASON_RUNBOOK.md` §2](SEASON_RUNBOOK.md#2-freeze-rule)).

- Each run record stores, at purchase, the core's `RULES_VERSION`, the 16 shipped level ids and the run store's schema version.
- Resuming refuses a run whose rules version or level ids differ from the build's, and says why, instead of writing journals the season would reject. Any other deploy, a CSS fix or a new service worker, resumes runs as today.
- This guard serves every client, with or without a service worker; a resumed run on a new build is already possible today after a deploy.

## 6. Run safety on phones

### 6.1 A run's clock

With testnet-0's values (`commitSlack` 120 s, `commitRun`'s bound at `revealedAt` + 1,200 s): the entropy block arrives 10 to 20 s after `startRun`, and the reveal must land within its 256-block read window, about 64 s at 0.25 s per block ([README §7.2](../README.md#72-run-flow)). From `revealedAt`, everything that is not a played tick comes out of the slack:

| Item | Seconds |
|---|---|
| Reveal receipt to level 0 **[estimate]** | 2-5 |
| Five transitions (`TRANSITION_MS` 3,000) | 15 |
| Commit: signing and inclusion **[estimate]** | 5-15 |
| Left for interruptions and reloads | about 85-98 |

M3.19 measures the real values on phones. Phones must fit the season's slack: it is one value for every client. The next season's slack is sized from both desktop and phone measurements, and testnet-1's stays at the 120 s M5.5 set ([`seasons/testnet-1.json`](../seasons/testnet-1.json)).

### 6.2 Interruptions, by phase

iOS suspends a hidden page's timers [10], and a page may be killed while hidden; closing a tab on iOS may fire no event at all [9]. Which events each interruption fires is **[verify]** on each platform (M3.12).

| Phase | Interruption | Effect | Client action | Cost under the rules |
|---|---|---|---|---|
| Entropy wait, or the `revealRun` prompt | App switch, call, lock | Polling stops while hidden | On `visible`, poll `isRevealable` at once and send `revealRun`. Before Buy, a notice: "Stay on this screen for about a minute after paying." | Back within the window: none. Past it: the run is forfeited and the fee stays in the pot ([§7.2](../README.md#72-run-flow)). |
| Level in play | Notification Center, Control Center, app switch, call, manual lock | `blur`, `hidden`, then suspension | Release every control; the hidden-page policy (§6.3) | §6.3's table |
| Level in play | Auto-lock | Prevented | The wake lock (§6.5) | None |
| Level in play | Rotation | Resize | Re-fit only | None |
| Level in play | Page killed while hidden, or a reload | Gone | The reload path closes the level at the stored tick ([§7.2](../README.md#72-run-flow), M5.2) | The rest of the level, and the time until the run resumes, from slack |
| Between levels | Any hide | Timers stop | None | The hidden time, from slack |
| Commit pending | Any hide, or leaving the wallet's prompt | The commit waits | Send at once on return; retry with backoff until the bound, showing the margin | From slack; past the deadline the run is late and earns nothing, past the bound it can never be committed |
| Any | Network loss | Offline | Play goes on; Buy is refused offline | Late, if the outage outlasts the slack |

### 6.3 The hidden-page policy (OD2)

A level in play whose page is hidden has no rule today: the loop catches up on return, sampling the controls held at return. Three policies satisfy README §7.2; none is a pause *(D8)*:

- **(a) Catch up with no control held.** Ticks that fell due while hidden run on return with mask 0, before any live sample. The level goes on, and the player stands still meanwhile.
- **(b) Close on hide.** The level closes with X at c = max(n, e + 1), as for an abandoned level ([§7.2](../README.md#72-run-flow)), n being the ticks processed before the hide.
- **(c) Decide by hidden time.** On return, a hide of at most H seconds catches up as (a); a longer one closes the level as (b). The choice reads only the elapsed time, never a simulated outcome, which would be search after the fact ([§7.2](../README.md#72-run-flow), "Real-time play").

Standing still is not safe: minions walk the rail ([R4.7-1]), and a minion that ends its move on the player's cell hits them ([R4.9-9], n = 0). Running out of lives scores the level zero *(D5)*. 15 of the 16 levels have minions, and seven move them every tick. On a level with three period-1 minions on a 236-cell rail, the border of an open field, a player standing still is hit about every 5 s, with 2 s of invulnerability after each hit **[estimate]**. Costs on such a level, with testnet-0's 120 s of slack **[estimate]**; M3.16 measures them with the core:

| Hide | Where | (a) catch up | (b) close | (c) with H = 10 s |
|---|---|---|---|---|
| 5 s | On the rail | About one hit: a life, or the level if it was the last | The rest of the level; 5 s of slack | As (a) |
| 5 s | Mid-cut | The boss may bump the trail ([R4.9-2]): a life, back to the cut start | The cut discarded ([R4.4-7]); the rest of the level; 5 s | As (a) |
| 30 s | Anywhere | About five hits: zero on a level of 2 to 4 lives | Claim kept; 30 s of slack, a quarter of it | As (b) |
| 2 min | Anywhere | Zero; the time after the lives run out comes from slack anyway | Claim kept; 120 s of slack, so the run is late unless nothing else used any | As (b) |

- Levels with slower or fewer minions cost (a) less; level 01 has none.
- A close under (b) or (c) is a commit without the X hold. It happens only when the player left, and it is the client's §7.2 duty for an abandoned level, so this is acceptable.
- The policy applies to every client, desktop included, so M3.16 merges while no run can be bought or committed on time: a season never mixes two honest-client policies. Later changes to the policy, to H, to the 1,000-ms frame-gap bound (§6.5) or, once the touch controls are live on Challenge (M3.18, with its flag on if it has one), to `xHold` (§3.3) merge under the same condition, which the runbook's freeze rule ([`SEASON_RUNBOOK.md` §2](SEASON_RUNBOOK.md#2-freeze-rule)) and `CLAUDE.md`'s sync row state (M3.11).
- **Recommended: (c),** with H chosen in M3.16 from the measured costs and M3.12's interruption lengths; 10 s is the candidate. M3.16 writes the README §7.2 client-duty sentence for the chosen policy.

### 6.4 Training pauses on hide

Training stops its loop when the page is hidden. On return it shows "Paused" and resumes on a tap, with the loop's start time moved by the hidden span, so the journal's ticks stay continuous. There is still no pause button, and D8's reason, free thinking time in paid modes, does not apply to Training. README §8.1 gains "Training pauses while its page is hidden" (M3.16).

### 6.5 Detecting a hide, sleep, saving and the wake lock

- **A frame gap counts as a hide.** `visibilitychange` may not fire [9], so a gap of more than 1,000 ms between frames is treated as hidden, for §6.3 and §6.4 alike. Today a 4-s freeze ran 60 ticks at once with the controls held at return.
- **Sleep correction.** If M3.12 finds that `performance.now()` stops during device sleep on a platform, the hidden span is measured with `Date.now()` instead, and the countdown's chain offset is measured again on return. Forfeiture checks already read the chain's latest block (`web/src/run/flow.ts`).
- **Saving.** The run store writes the live level every 250 ms (today `SAVE_INTERVAL_MS` is 1,000 ms), and once more on `hidden` and `pagehide` where they fire. A kill then loses at most about 4 ticks of play.
- **Wake lock.** `navigator.wakeLock.request("screen")` is held from Play to a Training level's end, and in Challenge from Buy to the commit receipt, the entropy wait and the transitions included. It is requested again on `visible`. Where the API is missing, a note says so.

### 6.6 Storage and resuming (M3.17)

- `navigator.storage.persist()` is requested before the first `startRun` and at a standalone launch; the pre-buy panel shows `persisted()`. WebKit grants it by heuristics that favor Home Screen apps [4]; Chromium evicts best-effort storage, least recently used origin first, when it runs out of space [28].
- Buying is refused, each with its own message, without IndexedDB, without Web Locks (`navigator.locks` is used unchecked today, `web/src/pages/challenge.ts:224`), and while offline.
- Before buying on a phone, a notice: "Finish this run here: Safari, the installed app and each wallet's browser keep separate data." Only an unrevealed run can be recovered from the chain; a revealed run lives only in this browser until its commit.
- After a reload, a wallet connected before reconnects without a prompt through `sharedConnection` (`eth_accounts`, `web/src/chain/wallet.ts`), which the Challenge page today calls only on wallet events. That shortens what a resume takes from the slack.

## 7. Wallets on phones

### 7.1 Phase 2: wallet browsers (M3.18)

No new dependency:

- **Discovery.** EIP-6963 (`eip6963:requestProvider`) first, which MetaMask recommends, then `window.ethereum` [23]. One `wallet.ts` serves Challenge and Season.
- **No wallet on a phone.** The message explains how to open this page in a wallet's browser, with links: MetaMask's `https://link.metamask.io/dapp/<host><path>` [20], Coinbase Wallet's dapp link **[verify]**, and Copy link. Today's message points to desktop extensions. Whether `link.metamask.io` opens MetaMask from an installed iOS app, or an in-app sheet, is **[verify]**.
- **Network.** The existing EIP-3326 and EIP-3085 switch to Arbitrum Sepolia, which already handles MetaMask mobile's nested error code.
- **What M3.12 and M3.18 confirm in each wallet browser:** IndexedDB, Web Locks, the wake lock and service workers are present; storage survives an app kill and an app update; the wallet does not reload the tab when it returns from the background; the signing sheet is an overlay that keeps the page visible; EIP-6963 announcements arrive.
- **After the commit,** nothing changes: the operator settles best runs from chain data ([README §7.5](../README.md#75-later-version-proving-service)), and claims run on the Season page in the same browser.

### 7.2 Later options (OD5)

Outside a wallet browser or a browser with a built-in wallet, a phone has no injected wallet, and each of `startRun`, `revealRun` and `commitRun` needs the player's signature ([README §7.2](../README.md#72-run-flow)):

- **A connector,** conditional on M3.21's spike: MetaMask Connect (`@metamask/connect-evm`) [20], Reown AppKit, which needs a project id and Reown's hosted relay [21], or Base Account (`@base-org/account`, passkeys), whose documentation moved to Coinbase Developer Platform's Coinbase Wallet SDK [22] and whose Arbitrum Sepolia support is **[verify]**. Each signature is an app switch that suspends the page. After a signature, a mobile wallet may return the player to the page by itself or ask them to return by hand [21], and the return to a browser tab and to a Home Screen app are both **[verify]**. The spike measures them.
- **A smart account with a session key** scoped to `revealRun` and `commitRun`: one signature at Buy, no contract change (§1.3). Wallet support on Arbitrum Sepolia is **[verify]**.
- **An embedded wallet,** passkey or email based: a custody and vendor decision.

Any of these is a new dependency or a custody decision, reviewed with the ethskills `wallets` skill, never adopted without its own decision.

## 8. Accessibility, haptics, sound and battery

- **Touch layer.** It is `aria-hidden` and out of the tab order. The keyboard path, the canvas's focus ring, live regions and the end-of-level status region keep the guide's §14 rules. An arcade game cannot be played under VoiceOver by touch; a Bluetooth keyboard still works.
- **Both orientations** are supported (WCAG 1.3.4). Color is never the only signal: the buttons carry their actions' names and letters, and a pressed button loses its shelf.
- **No haptics.** iOS has no `navigator.vibrate` [1], and haptics on Android alone would split the experience.
- **Sound,** when the guide's §10 sound arrives: muted until the player turns it on, its `AudioContext` resumed from a tap and again after backgrounding, in the default audio session, so the silent switch mutes it.
- **Battery.** `requestAnimationFrame` wakes the loop at the display's rate, up to 120 Hz, for a 15-Hz game, but the renderer draws only when a tick ran (`web/src/run/play.ts`). Low impact; M3.12 notes it.

## 9. Testing

### 9.1 Unit tests (vitest)

- `touch.test.ts`: the angle-to-bits table, the dead zone, the conditional band, follow, each release event, X through `xHold` − 1 and `xHold` samples, taps shorter than a tick, multi-touch.
- `input.test.ts`: the combined sources.
- `loop.test.ts`: the hidden-page policy; a frame gap above the bound counts as hidden; Training's pause keeps ticks continuous; Challenge cannot pause.
- `sw.test.ts`: the precache list equals the build's files under their served URLs; no entry is a `.html` path; the cache name carries the sha; an `/assets/` file of the previous cache is copied, not fetched.
- `layout.test.ts`: §4's formulas and size table.
- The wake lock, `persist()`, the feature checks and the resume guard, with mocks.

### 9.2 Journal equivalence

`touch-journal.test.ts` plays `open-field-capture`'s control schedule through synthetic pointer events, and must produce the vector's journal bytes and final hash, as the keyboard test of `web/test/play.test.ts` does. This shows that touch adds no input semantics (A2).

### 9.3 Parity on phone engines

- **A vectors page** (M3.12) replays every format, game and gate-set vector through the wasm engine in the page, sharing its replay logic with `web/test/vectors.mjs`, and reports the first differing tick. CI runs it under Playwright WebKit, the core's first run on JavaScriptCore, and every device of §9.5 runs it.
- **A probe page** (M3.12) logs lifecycle events with both clocks, runs a 2,700-tick clock probe, and reports features: IndexedDB, Web Locks, the wake lock, service workers, `persist()`, display mode, safe-area insets, EIP-6963 announcements and file sharing. It keeps its log in IndexedDB, so a kill or an app update shows in the next load.
- Both pages are built only for pull-request previews: `vectors/` is about 3.5 MB, and neither belongs in production.

### 9.4 End-to-end (Playwright)

- New projects: `chromium-phone` (Pixel 7 with touch, in which `phone-layout.spec.ts` sets each viewport of §4.3 but the installed row, in portrait and landscape) and `webkit-iphone` (iPhone 15, both orientations). CI emulation supplies no safe-area insets, so the installed row is a device check (A4b). `pages.yml` installs WebKit beside Chromium; today `web/playwright.config.ts` has no WebKit or phone project.
- Specs: `touch.spec.ts` (play by touch; X needs its hold); `phone-layout.spec.ts` (A4a); `install.spec.ts` (A6's manifest part); `pwa.spec.ts` (A14, A15); `challenge-phone.spec.ts` (the local-chain run in both phone projects, and at 375 × 548, with an injected wallet that forwards to the local chain).
- Playwright's WebKit is not iOS Safari: installing, backgrounding and system gestures need real iPhones [26]. So safe areas and gestures are device checks (A4b).

### 9.5 Devices

The owner's own phones, rows 1 and 3 at least; a paid real-device cloud [26] only if the owner offers one. Previews only, over HTTPS: on `http://` iOS 27 runs JavaScript and wasm without JIT, 4 to 60 times slower (about 8 times on a wasm loop) [7].

| # | Device | Contexts |
|---|---|---|
| 1 | iPhone, 6.1-inch class, current iOS | Safari tab, Home Screen app, MetaMask browser, Coinbase Wallet browser |
| 2 | iPhone SE class (375 × 667) or the oldest at hand, previous iOS major | Safari tab, Home Screen app |
| 3 | Pixel-class Android, current Chrome | Tab, WebAPK, MetaMask browser, Coinbase Wallet browser |
| 4 | Mid-range Android, 360 px wide, previous Chrome major | Chrome tab, Samsung Internet |
| 5 | iPad (optional) | Home Screen app, with and without a keyboard |

[Appendix A](#appendix-a-device-checklist) lists the checks; M3.12 and M3.19 fill them in `reports/phone-baseline.md` and `reports/phone-runs.md`.

## 10. Acceptance criteria

| # | Criterion | Shown by |
|---|---|---|
| A1 | 0 mismatches on every golden vector (format, game, gate set) under Playwright WebKit in CI, and on every context of §9.5's rows at hand, rows 1 and 3 at least | M3.12 |
| A2 | A touch schedule yields the keyboard schedule's journal bytes and final hash, byte for byte | M3.13 |
| A3 | While visible, at every frame, before `pump()` runs, the ticks due, floor((t − t0) / 66.667) + 1, exceed the ticks already run by at most 2, which bounds a frame gap at about 133 ms, over a 2,700-tick level, on the rows at hand, rows 1 and 3 at least, iOS Low Power Mode and Android battery saver included | M3.12 |
| A4a | In CI, in `chromium-phone`, for each viewport of §4.3 but the installed row, in portrait and landscape: the field size follows §4.1, the field is drawn below 4 px per cell, and the play view asks to turn the phone where §4.1 says so; the field, HUD and controls lie inside the viewport without overlapping, and no HUD cell's text overflows it; the end panel is in view; a scripted 150-px touch swipe on the play view, started where the document could scroll that far in the swipe's direction, leaves `scrollX` and `scrollY` unchanged. At 360 × 640, Play is in the first viewport before play. At 1280 × 800 and 1920 × 1080 the desktop field is unchanged. | M3.14 |
| A4b | On the rows at hand, rows 1 and 3 at least, and §4.3's installed row on row 1: the same, within the safe areas; no scroll, zoom, reload or back navigation from a swipe, pinch or double-tap that starts on the field or a control. Exempt are only the edge gestures a page cannot block: on iOS, the home-indicator swipe and the Notification Center and Control Center pulls; on Android, the back swipe from a side edge and the home swipe from the bottom edge. | M3.14 |
| A5 | Control sizes meet §3.4. Each release event clears its control by the next sample. X held through `xHold` − 1 samples commits nothing; through `xHold`, it commits. | M3.13 |
| A6 | `Page.getAppManifest` parses `display` "standalone", `id`, `scope` and `short_name` with no error. On rows 1 and 3 the installed icon opens with `(display-mode: standalone)` matching. | M3.15 |
| A7 | Two players besides the owner, on their own phones, each clear L01, L02 and L03 by touch. For `xHold` = 0, 2, 4 and 8 in turn, stopping at the first that passes, each player plays 20 levels at that hold; after every X commit, the playtest build asks "Did you mean to commit?" and logs the answer with the level, the tick, `xHold` and the journal's hash. A hold passes when each player logged at most one "no" in their 20 levels. | M3.14 |
| A8 | Under the chosen policy, hides of 5 s and 30 s mid-level, and under (c) also of H − 1 s and H + 1 s, end as the policy says, in unit tests for every length and in the local-chain e2e for 5 s and 30 s: under (a) every hide catches up, under (b) every hide closes the level, and under (c) a hide of at most H catches up and a longer one closes. Catching up: the hidden span holds at most one event, with mask 0, at the first tick due after the hide. Closing: the level ends with X at c = max(n, e + 1). The run commits on time with replayable journals. In Training, a 5-s hide pauses the level, and its ticks stay continuous. | M3.16 |
| A9 | Hidden during the entropy wait and visible again inside the window, the page sends `revealRun` within one poll | M3.16 |
| A10 | The wake lock is requested at Play and at Buy, requested again on `visible`, and released at the level's end and at the commit receipt. On rows 1 and 3, with Auto-Lock at 30 s (iOS) and the screen timeout at 30 s or less (Android), the screen stays on through a 60-s idle in a level, and locks or dims through the same idle on the level select, which holds no wake lock. | M3.17 |
| A11 | `persist()` is called before the first `startRun`. Buying is refused, each with its own message, without IndexedDB, without Web Locks and offline. A run bought under another `RULES_VERSION` or other level ids is refused at resume, with its message. | M3.17 |
| A12 | On the local chain, in both phone projects with an injected forwarding wallet, and in `chromium-phone` at 375 × 548 in portrait, a run is bought, revealed, played by touch and committed, with the field, the HUD, the margin and Stop in view throughout, the field drawn at 180 px at 375 × 548; Stop needs its hold | M3.18 |
| A13 | At least 3 Sepolia runs on phones, at least 1 on iOS and 1 on Android, in wallet browsers, played by touch: all committed on time. Each run's overhead, the seconds from `revealedAt` not counted as ticks, is reported against `commitSlack`. | M3.19 |
| A14 | After one online load, with the network off: `/` plays a level to its end, stores a best and shares or downloads the journal; Replay opens a local journal; the Editor loads; `/challenge` and `/challenge.html` load the Challenge shell, which says it needs the network. Back online, the next load runs a newly deployed build. | M3.20 |
| A15 | The precache stays under 1 MB, and Training's share under 150 KB (today 568 KB and about 100 KB) | M3.20 |

## 11. Work breakdown

The items, in the plan's §1.1 format, are in [`IMPLEMENTATION_PLAN.md` §8](../IMPLEMENTATION_PLAN.md#8-m3-phone-version), scheduled on 2026-11-11. Ids start at M3.11: M3.1-M3.10 were the handheld items removed on 2026-11-10, and ids are never reused (plan §1.1).

```text
Phone
  M3.11 -> M3.12, M3.17
  M3.12 -> M3.13, M3.16
  M3.13 -> M3.14 -> M3.15
  M3.13 -> M3.23 (optional)
  M3.14 + M3.16 + M3.17 (+ M5.6's report, or a flag that stays off during testnet-1: OD7) -> M3.18
  M3.15 + M3.18 (+ a season accepting runs after testnet-1) -> M3.19
  M3.15 + M3.19 -> M3.20 (optional)
  M3.18 -> M3.21 (if Challenge outside wallet browsers is wanted: OD5) -> M3.22
```

M3.13 follows M3.12, which adds the `chromium-phone` and `webkit-iphone` projects that M3.13's tests run in. M3.19 follows M3.15, because README §9's M3 row, which M3.19 closes, includes installing. M3.20 follows M3.19: the service worker comes last (OD1).

- **Critical path** (S = 1, M = 2, L = 3): M3.11 1 > M3.12 4 > M3.13 6 > M3.14 8 > M3.18 10 > M3.19 11. Slack: M3.15 1, M3.16 2, M3.17 5. M3 stays off M5's critical path; its outside gates are OD7 and a season accepting runs.
- **Owner rounds** ([plan §13](../IMPLEMENTATION_PLAN.md#round-h-phone-version), round H): H1, critical, the open decisions (M3.11), answered on 2026-11-11; H2, critical, the device checklist (M3.12); H3, critical, the touch controls' README and guide text (M3.13) and the touch playtest (M3.14); H4 installing on two phones (M3.15); H5 the hidden-page policy and its README text (M3.16), and the 60-s idle check on two phones (M3.17); H6, critical, a wallet-browser check (M3.18); H7, critical, phone runs on testnet and the season they need (M3.19); H8, conditional, a connector (M3.21) and two runs through it (M3.22); H9, optional, Training in airplane mode on two phones (M3.20).

Changes outside this file, by item:

| File | Change | Item |
|---|---|---|
| README | Status line; §2's first paragraph points to D16; §6.5's last sentence becomes "On phones it is the same client *(D16)*" (not rule text: the PR says so, and `RULES_VERSION` stays); §9's M3 row; §13 D1 extended and D16 added | M3.11 |
| README | §2: on a touchscreen, on-screen controls produce the same controls, and X may need a short hold, set in this file | M3.13 |
| README | Status line: Training plays on phones | M3.15 |
| README | §7.2: the hidden-page client duty, under "Closing a level early"; §8.1: Training pauses while hidden | M3.16 |
| README | §8.2: on a phone, Challenge is played in a wallet app's own browser *(D16)* | M3.18 |
| README | Line 3: "It plays in the browser, on desktops and phones"; the status line; §9 M3 closed | M3.19 |
| README | §8.1: Training plays offline once loaded | M3.20 |
| Style guide | §4: touch-control names and letters among Jiro Pixel 12's uses; §8: the "Touch controls" component; §10: X's hold in whole ticks; no haptics | M3.13 |
| Style guide | §8: whole CSS px per cell on phones, the play view and the compact HUD, and in Units the stacked lockup at 1 px per cell at a device pixel ratio of 2 or more; §9: stamps at every whole cell size; §14: phone targets | M3.14 |
| Style guide | §16: follow-up 1's manifest text and the "Phone" line | M3.15 |
| Plan | Status line, item count, §1.4's milestone-closing PRs (M3.19), §4's M3 row, §8 scheduled, §11 rows (D16, with OD6's store presence; P18 service worker; P19 touch scheme; P20 phone wallet path; P21 hidden-page policy; P22 field scale on phones; P23 phones in testnet-1), §12, §13 round H, §14 risks, §16 store builds deferred; `SEASON_RUNBOOK.md` §2's freeze rule extended to the hidden-page policy, H, the frame-gap bound and, once the touch controls are live on Challenge, `xHold` | M3.11 |
| `CLAUDE.md` | The project line names M3 (D16). This file among the owners of numbers, and a sync row: a change to the touch module, the play view, the run store's save interval or the service worker updates this file where it owns the number or the policy; a change to the hidden-page policy, H, the frame-gap bound or, once the touch controls are live on Challenge, `xHold` merges only while no run can be bought or committed on time | M3.11 |
| `web/README.md` | Touch controls, installing, offline behavior and the kill switch | M3.13, M3.15, M3.20 |

README §9's M3 row, as M3.11 writes it: the deliverable "The game on phones *(D16)*: touch controls, a phone layout and an installable app; Challenge runs in wallet browsers", done when "Training plays by touch and installs on iOS and Android; Challenge runs played by touch on phones commit on time on testnet".

## 12. Decisions

### 12.1 The owner's decisions

The owner answered OD1 and OD3-OD7 on 2026-11-11, when scheduling M3, each with the recommended option. OD2 stays open until M3.16, after M3.12's measurements.

| # | Decision | Options | Recommendation | Answer | Decided in |
|---|---|---|---|---|---|
| OD1 | Platform, order and scope (D16) | (a) The web client, touch-first; installable for Training; Challenge in wallet browsers; the service worker last and optional; no store build; no native client. (b) (a), plus a Training-only store build now. (c) A native or cross-platform app. | **(a).** Include offline Training (M3.20), after M3.19. | **(a)** (owner, 2026-11-11): D16 adopted. Offline Training (M3.20) is an optional last step, after M3.19. | M3.11 |
| OD2 | Challenge's hidden-page policy (§6.3) | (a) Catch up with no control held. (b) Close on hide. (c) By hidden time: catch up up to H seconds, close beyond. | **(c),** with H from M3.16's measured costs and M3.12's interruption lengths; 10 s is the candidate. | Open until M3.16 | M3.16, after M3.12 |
| OD3 | Touch scheme and X's guard (§3) | (a) The floating stick with the conditional band, A and B held, X apart from them with a hold chosen by the playtest from 0, 2, 4 and 8 ticks. (b) A two-tap arm for X. (c) No guard, X out of thumb reach. | **(a),** accepting §3.3's cost: the shortest hold that meets A7. A mirrored layout as an option. | **(a)** (owner, 2026-11-11), with the mirrored layout as an option. The hold is chosen in M3.14. | M3.11 (scheme), M3.14 (hold) |
| OD4 | Field scale on phones (§4.1) | (a) Whole CSS px per cell, at least 4, on coarse pointers: 300 to 360 px on most phones. (b) 240 px everywhere, as today. | **(a),** with the guide's §8 amended and its §9 stamps defined for every whole cell size | **(a)** (owner, 2026-11-11). The style guide's amendments come in M3.14. | M3.11, built in M3.14 |
| OD5 | Wallet path on phones (§7) | (a) Wallet browsers only. (b) Also a connector for the installed app and browser tabs, after M3.21's spike. (c) A smart account with a session key. (d) An embedded wallet. | **(a)** now. M3.21's spike, covering (b) and (c), only if Challenge outside wallet browsers matters. | **(a)** (owner, 2026-11-11): wallet browsers only for now. M3.21 and M3.22 stay conditional, built only if Challenge outside wallet browsers is wanted later. | M3.11; M3.21 if asked |
| OD6 | Store presence (§1.4) | (a) None while paid runs exist. (b) A free Training-only TWA on Google Play, as its own build on its own origin or path. (c) (b) on iOS too, subject to 4.2. | **(a)** | **(a)** (owner, 2026-11-11): no store presence while paid runs exist (plan §16). | M3.11 |
| OD7 | Phones in testnet-1 | (a) Phone Challenge after testnet-1: M3.18 waits for M5.6's report, or ships behind a flag that stays off during testnet-1. The touch controls reach the Challenge page only in M3.18, under the same flag, so no earlier item lets testnet-1 be played by touch. (b) Phones allowed, testers report their device. (c) Phones allowed, unmarked. | **(a).** Testnet-1's report decides the slow-cut rule from how often A is held while cutting ([`TODO.md`](../TODO.md)), touch may change that, and journals do not record the client. | **(a)** (owner, 2026-11-11). M3.18 chooses between waiting for M5.6's report and the flag. | M3.11, before M5.6 recruits |

### 12.2 Decided in this specification

| # | Decision | Reason |
|---|---|---|
| S1 | `display` "standalone", no `orientation` member, no iOS startup images | iOS has no fullscreen display and ignores `orientation` [1]; Android builds its splash from the manifest |
| S2 | A hand-written service worker, network-first for navigations, no build pinning (§5.2) | No dependency; a worker cannot pin a build to a run [30]; §5.4's guard keeps journals valid |
| S3 | The resume guard checks `RULES_VERSION`, the level ids and the store's schema, not the build's sha (§5.4) | A sha guard would turn any deploy into lost runs, in wallet browsers above all |
| S4 | The owner's phones for device tests; a paid device cloud only if offered | Rows 1 and 3 settle the platform facts; the cloud costs money |
| S5 | No haptics | iOS has no `navigator.vibrate` [1] |
| S6 | Training pauses on hide | D8's no-pause reason concerns paid modes |
| S7 | Phones fit the season's slack; the next season's slack is sized from desktop and phone runs | `commitSlack` is one value per season ([README §8.4](../README.md#84-season-scoring)) |
| S8 | The live level is saved every 250 ms, not on every journal event | See §12.3 |
| S9 | A frame gap above 1,000 ms counts as a hide | `visibilitychange` may not fire [9]; 1 s is far above any frame jank |
| S10 | Item ids start at M3.11 | Plan §1.1: ids are never reused, and M3.1-M3.10 were the handheld items |
| S11 | The probe and vectors pages are built for previews only | They are test tools, and `vectors/` is about 3.5 MB |
| S12 | The touch buttons are named by their actions, with their letters as a second mark (§3.4) | Apple's guidelines advise against controller letters as a button's only art [24]; the letters keep README §2's control names *(D8)* |

### 12.3 Review record

An adversarial review of this specification's first draft questioned the PWA case, the service worker, the hidden-page policy, X's hold, the geometry, the acceptance criteria, the items and several platform claims. The specification adopts every point but two, recorded here:

- **Rejected: saving on every journal event,** in addition to every 250 ms. A write per event can reach 15 writes a second of a record of up to about 49 KB, each awaited in the frame loop (`web/src/run/play.ts`), on phones where battery and jank matter. Saving every 250 ms bounds the loss to about 4 ticks before a kill, after which the level is closed at the stored tick anyway.
- **Modified: a device spike "with no new code".** The spike runs today's product code unchanged, but it needs a preview-only probe page (§9.3): lifecycle events, the clock during sleep and the features of wallet browsers cannot be read without one.

A second review, of the work items against the plan's rules and of the platform claims against their sources and the built site, was adopted in full: among its points, the portrait limits by height (§4.1), the item order M3.12 before M3.13 (§11), objective tests for A3, A7, A8 and A10, and corrected sources.

## 13. Risks

| Risk | Mitigation | Retired by |
|---|---|---|
| iOS suspends a hidden page, and every interruption costs ticks, lives or slack | The hidden-page policy; controls released on hide; the wake lock; saving every 250 ms; warnings; device measurements | M3.16, M3.19 |
| A hide during the entropy wait or the `revealRun` prompt forfeits the run | The reveal sent at once on return; a pre-buy notice; the wake lock | M3.16, M3.17 |
| A slack sized on desktop is too tight on phones | Phone runs measured; the next season's slack sized from both | M3.19 |
| A revealed run lost to a kill, eviction or the storage silos | `persist()`; the pre-buy notice; saving every 250 ms; refusal without IndexedDB. Accepted residual: journals are local until the commit. | M3.16, M3.17 |
| A cached or newly deployed build resumes a run under other rules | The resume guard; network-first navigations; the season check at Buy (M5.2); the freeze while a season is open ([`SEASON_RUNBOOK.md` §2](SEASON_RUNBOOK.md#2-freeze-rule)) | M3.17, M3.20 |
| Wallet browsers lack a feature, reload the tab or clear data | Feature checks with their own messages; device checks | M3.12, M3.18 |
| Touch players are handicapped in a shared ranking: X's hold, small-screen precision | X's hold measured; touch against keyboard compared in the report | M3.14, M3.19 |
| An accidental commit or Stop by touch | X's hold and placement; the Stop hold | M3.13, M3.14, M3.18 |
| Browser or system gestures reload or leave the page mid-level | `touch-action` and `overscroll-behavior`; edge clearance. Residual: the edge gestures of iOS and Android that a page cannot block (A4b). | M3.14 |
| JavaScriptCore runs the wasm differently | WebKit parity in CI; the vectors page on every device | M3.12 |
| Two honest-client policies in one season | M3.16 merges while no run can be bought or committed on time; later changes to the policy, H, the frame-gap bound or, once the touch controls are live on Challenge, `xHold` fall under the season freeze (§6.3) | M3.11, M3.16 |
| Phone players skew testnet-1's fast-cut measurement | OD7 | M5.6 |
| Training bests split between the browser and the installed app | The install hint says so | M3.15 |
| An installed iOS app with a service worker freezes after backgrounding, as reported in 2020 [36] | Backgrounding the installed app checked on row 1 with the worker; the kill switch | M3.20 |
| Every iOS fact is confirmed only in owner rounds, and a slipped round stalls M3 | Rounds batched (§11); an optional device cloud | Not retired |
| Apple restricts Home Screen web apps | Safari tabs still work; a Training-only wrapper reconsidered | Not retired |
| iOS 27 runs wasm without JIT over `http://`; Lockdown Mode has no wasm | HTTPS previews for every test; a clear engine message | M3.12 |

## 14. Unverified facts

| # | Fact | Settled in |
|---|---|---|
| 1 | Which interruptions fire `blur`, `visibilitychange` or `pagehide` on current iOS and Chrome: Notification Center, Control Center, app switch, call, lock | M3.12 |
| 2 | Whether `performance.now()` advances during device sleep on iOS and Android | M3.12 |
| 3 | IndexedDB, Web Locks, the wake lock, service workers and EIP-6963 in the MetaMask and Coinbase Wallet browsers on iOS and Android | M3.12 |
| 4 | Whether wallet-browser storage survives an app kill and an app update, and whether the wallet reloads the tab on return | M3.12 |
| 5 | Whether a wallet's signing sheet keeps the page visible | M3.12, if a season accepts runs; else M3.18 |
| 6 | iOS Low Power Mode's cap on `requestAnimationFrame` (30 fps in 2020 [11]), against 15 Hz | M3.12 |
| 7 | `persist()`'s outcome in each context | M3.12 |
| 8 | Touch latency on 2025-2026 phones: the only measurements found date from 2013-2019 [25]. Sampling at 15 Hz adds 0 to 66.7 ms to every input path, so it does not decide the platform. | M3.12, optional |
| 9 | The safe-area insets iOS reports with `viewport-fit=cover`, in a tab and installed | M3.14 |
| 10 | Whether iOS lets a page block edge back-swipe and pull-to-refresh with `touch-action` and `overscroll-behavior` | M3.14 |
| 11 | Whether Chrome's install prompt still needs a `fetch` handler [13] | M3.15 |
| 12 | `.jrn` and `.bin` file picking, and blob downloads, in iOS standalone mode | M3.15 |
| 13 | Coinbase Wallet's dapp link format; whether `link.metamask.io` opens MetaMask from an installed iOS app | M3.18 |
| 14 | Base Account and smart-account session keys on Arbitrum Sepolia | M3.21 |
| 15 | Returning to a Home Screen app, or a browser tab, after signing in a wallet app | M3.21 |
| 16 | Any 2026 EU, UK or Japanese decision on iOS web apps [27] | Watched; not an item |
| 17 | The width of Android's back-gesture zone under gesture navigation, which a page cannot turn off [35], and whether a swipe that starts on a control near it goes back | M3.12 |
| 18 | Journal and run-file downloads in Android wallet browsers, whose WebView has no Web Share API [1] | M3.12 |

## 15. Sources

All accessed on 2026-11-10. Dates are publication or update dates where the source shows one.

| # | Source | Used for |
|---|---|---|
| 1 | MDN browser-compat-data 8.1.8, data file of 2026-11-02: https://unpkg.com/@mdn/browser-compat-data@8.1.8/data.json | Fullscreen, orientation lock, `vibrate`, `beforeinstallprompt`, display modes, Pointer Events, wake lock and `persist()` support on iOS and Chrome |
| 2 | Apple, Safari 27 release notes (2026-09-14): https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes | Current iOS release |
| 3 | WebKit, "WebKit Features in Safari 26.0" (2025-09-15): https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ | Every Home Screen site opens as a web app; no installability requirements |
| 4 | WebKit, "Updates to Storage Policy" (2023-08-10): https://webkit.org/blog/14403/updates-to-storage-policy/ | Quotas, eviction, `persist()` heuristics |
| 5 | Apple, Safari 18.4 release notes: https://developer.apple.com/documentation/safari-release-notes/safari-18_4-release-notes | Wake lock fixed in Home Screen apps |
| 6 | WebKit bug 181849 (2018): https://bugs.webkit.org/show_bug.cgi?id=181849 | Home Screen apps do not share storage with Safari |
| 7 | WebKit bug 324968 (2026-09-23; reply 2026-09-30): https://bugs.webkit.org/show_bug.cgi?id=324968 | iOS 27 runs JS and wasm without JIT over `http://` |
| 8 | WebKit bug 273824 (2024-05): https://bugs.webkit.org/show_bug.cgi?id=273824 | Lockdown Mode blocks WebAssembly |
| 9 | WebKit bug 199854 (comment 6, 2023-04-17): https://bugs.webkit.org/show_bug.cgi?id=199854 | Closing a tab on iOS may fire no event |
| 10 | Firtman, "Understanding JS in the background" (undated, secondary): https://firt.dev/understanding-js-background/ | iOS suspends a hidden page's timers |
| 11 | WebKit bug 215745 (2020-08): https://bugs.webkit.org/show_bug.cgi?id=215745 | Low Power Mode caps `requestAnimationFrame` at 30 fps |
| 12 | web.dev, "What does it take to be installable?" (undated): https://web.dev/articles/install-criteria | Chrome's install criteria list no service worker |
| 13 | Chrome for Developers, "Revisiting Chrome's installability criteria" (undated, about 2023): https://developer.chrome.com/blog/update-install-criteria | The install prompt may still need a `fetch` handler |
| 14 | MDN, "Installing and uninstalling web apps": https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing | Chrome installs any site from its menu |
| 15 | web.dev, "WebAPKs on Android" (undated): https://web.dev/articles/webapks | Installed sites become WebAPKs |
| 16 | Chrome for Developers, Trusted Web Activity overview: https://developer.chrome.com/docs/android/trusted-web-activity | A TWA shows its verified origin |
| 17 | Apple, App Review Guidelines (2026-10-16): https://developer.apple.com/app-store/review/guidelines/ | 3.1.1, 4.2, 5.3.4 |
| 18 | Google Play Console Help, "Real-Money Gambling, Games, and Contests": https://support.google.com/googleplay/android-developer/answer/9877032 | Paid contests banned outside licensed gambling apps; calls to action |
| 19 | Google Play Console Help, "Real-money gaming pilots": https://support.google.com/googleplay/android-developer/answer/12918670 | No pilot open |
| 20 | MetaMask docs, MetaMask Connect supported platforms: https://docs.metamask.io/metamask-connect/supported-platforms/ ; npm `@metamask/connect-evm` 2.1.1 (2026-07-08): https://registry.npmjs.org/@metamask/connect-evm | Dapp links into MetaMask's browser; the connector |
| 21 | Reown docs, AppKit FAQ: https://docs.reown.com/appkit/faq ; WalletConnect, WalletKit mobile linking ("Manual Return: The wallet asks the user to manually return to the Dapp. Automatic Return: Alternatively…"): https://docs.walletconnect.com/wallets/ios/mobile-linking ; WalletConnect monorepo discussion 949: https://github.com/WalletConnect/walletconnect-monorepo/discussions/949 | Project id and relay; a mobile wallet returns the player by itself or asks them to; universal links |
| 22 | Base docs, "Migrated and Deprecated Products": https://docs.base.org/sdks/migrated-products (the former Smart Wallet networks page redirects here) | Base App renamed Coinbase Wallet; the Base Account SDK's documentation moved to Coinbase Developer Platform's Coinbase Wallet SDK, with no network list left on Base's site |
| 23 | MetaMask docs, MetaMask Connect EVM provider API: https://docs.metamask.io/metamask-connect/evm/reference/provider-api/ | EIP-6963 recommended, `window.ethereum` the alternative |
| 24 | Apple Human Interface Guidelines, game controls (2025-06-09): https://developer.apple.com/design/human-interface-guidelines/game-controls ; design tips (44 pt): https://developer.apple.com/design/tips | Floating stick; no controller letters as a button's only art; minimum target size |
| 25 | GameBench (about 2019): https://blog.gamebench.net/touch-latency-benchmarks-iphone-xs-max-galaxy-note-10 ; Kaaresoja, PhD thesis (2016): https://theses.gla.ac.uk/7075/1/2016kaaresojaphd.pdf | Touch latency, dated evidence |
| 26 | BrowserStack, Playwright on real iOS Safari (2025-06-12): https://www.browserstack.com/press/browserstack-becomes-the-first-platform-to-enable-playwright-testing-on-real-ios-devices-with-safari | Playwright WebKit is not iOS Safari; a device cloud |
| 27 | Open Web Advocacy, "OWA 2025 in Review" (2026-01-05): https://open-web-advocacy.org/blog/owa-2025-review/ ; Engadget (2024-02): https://www.engadget.com/apple-explains-why-web-apps-will-no-longer-work-on-european-ios-devices-112527267.html | The 2024 EU reversal; pending regulation |
| 28 | web.dev, "Storage for the web" (content update 2024): https://web.dev/articles/storage-for-the-web | Chromium evicts best-effort storage when out of space, least recently used first |
| 29 | MDN, `ServiceWorkerRegistration.updateViaCache` (2024-04-15): https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/updateViaCache | The service-worker script bypasses the HTTP cache by default |
| 30 | Chrome for Developers, "The service worker lifecycle": https://developer.chrome.com/docs/workbox/service-worker-lifecycle | A new worker activates when no client uses the old one; `skipWaiting` |
| 31 | WHATWG, Fetch Standard (2026-10-19), HTTP fetch: https://fetch.spec.whatwg.org/#http-fetch | A redirected response to a request whose redirect mode is not "follow" is a network error |
| 32 | Ionic, "Capacitor 8.5 released" (2026-07-31): https://ionic.io/blog/capacitor-8-5-released | UIScene required for Xcode 27 |
| 33 | Chromium Dash, milestone schedule and releases: https://chromiumdash.appspot.com/fetch_milestone_schedule?mstone=157 ; https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Android | Chrome 156 stable on 2026-10-20, 157 on 2026-11-03 (157.0.8103.50 on Android on 2026-11-09), 158 due on 2026-11-17 |
| 34 | Brave, "Brave Wallet": https://brave.com/wallet/ | A wallet built into the browser, on desktop and mobile, that connects to dapps on EVM chains |
| 35 | Android Developers, "Gesture navigation": https://developer.android.com/develop/ui/views/touch-and-input/gestures/gesturenav | The back gesture is an inward swipe from either side edge; only native views can exclude areas from it |
| 36 | WebKit bug 211018 (2020, resolved "configuration changed"): https://bugs.webkit.org/show_bug.cgi?id=211018 | iOS Home Screen apps with a service worker froze after backgrounding |

## Appendix A. Device checklist

M3.12 fills it for today's site and the probe page, M3.19 for the phone runs, each per context of §9.5:

1. The vectors page: mismatches, and the first differing tick if any.
2. The clock probe, with iOS Low Power Mode and Android battery saver on and off.
3. Which events fire, and the hidden span measured, for: Notification Center, Control Center, an app switch, an incoming call, the lock button, auto-lock.
4. Whether `performance.now()` advances during a 60-s sleep.
5. Features: IndexedDB, Web Locks, the wake lock, service workers, `persist()` and `persisted()`, display mode, safe-area insets, EIP-6963, file sharing, and journal and run-file downloads in wallet browsers.
6. Storage: a marker written, then read after an app kill, after an app update, and from the other contexts.
7. Training level 01 to a clear and to a commit: with a Bluetooth keyboard on today's site (M3.12), by touch (M3.14).
8. A rotation mid-level.
9. Hides of 3 s and 30 s mid-level, with the journal inspected.
10. Installing and a standalone launch, then Training in airplane mode, and backgrounding the installed app with the service worker (M3.20).
11. In wallet browsers: connect, switch the network, then, if a season accepts runs, buy, reveal, play and commit on Arbitrum Sepolia, with the margins and whether the signing sheet hides the page.
12. Optional: touch latency, from 240-fps video of 20 touches, touch-down to the first changed cell, against a USB keyboard on the same page.
