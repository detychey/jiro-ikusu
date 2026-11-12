# Phone baseline (plan M3.12)

The baseline of the phone version: whether the unchanged core and client run on phone engines, and the platform facts that M3.14 and M3.16-M3.18 depend on, measured before any phone rule text is written ([`docs/PHONE.md`](../docs/PHONE.md)). It holds checks 1-9 and 11 of [`docs/PHONE.md` Appendix A](../docs/PHONE.md#appendix-a-device-checklist), on today's site and on the probe and vectors pages, for each context of [§9.5](../docs/PHONE.md#95-devices): rows 1 and 3 are required, rows 2, 4 and 5 optional. A1 and A3 ([§10](../docs/PHONE.md#10-acceptance-criteria)) are read from checks 1 and 2.

**Status: the owner's round H2 has started.** The first device results, from the owner's Android phone in a Chrome tab on 2026-11-11, fill row 3's Chrome-tab features and part of the back-gesture check. Every cell still marked "to fill on device (owner)" waits for a phone. The only measurements so far are in [Emulation (Chromium, container)](#emulation-chromium-container), which is emulation, not device evidence, and settles none of the facts below. If A3 fails on row 1 or 3, the pull request stops for the owner's decision under [`docs/PHONE.md` §1.3](../docs/PHONE.md#13-what-would-change-the-answer).

## How to run the checks (owner)

The `pages` workflow posts "Preview of <sha>: <url>" on the pull request. Use that `https://` URL, never `http://`: over `http://`, iOS 27 runs JavaScript and wasm without JIT ([§9.5](../docs/PHONE.md#95-devices)). The pages are `<url>/vectors`, `<url>/probe` and Training at `<url>/`; the two preview pages link each other.

- **Today's site on the preview.** The preview builds today's five pages from the same code as production, but bundled into other chunks, as the two preview pages share modules with them: the files the pages load, and their order, differ from production's. Checks 5, 7 to 9 and 11 test today's code, not production's exact files.
- **Installed contexts.** On iOS, open `/probe` in Safari, then Share, Add to Home Screen, and open it from the Home Screen. On Android, open `/probe` in Chrome, then the menu's Install app (or Add to Home screen), and open it from the launcher. The preview pages carry their own standalone manifest, which opens `/probe`; today's site's manifest has `display` "browser" until M3.15. The installed app reaches Training through the header bar.
- **Check 1.** Open `/vectors` and wait for "Done: 126 vectors replayed, 0 mismatches." On a mismatch the page lists each one with its first differing tick: copy the list into the pull request.
- **Check 2.** On `/probe`, press Run the clock probe and keep the page in view for its 3 minutes, with Low Power Mode (iOS) or battery saver (Android) off, then again with it on. The page holds a screen wake lock where the browser grants one (`wakeLock` in the result); where it does not, set Auto-Lock or the screen timeout long enough, or tap the page's text now and then. A run in which the page was hidden does not count (`hides` above 0): run it again.
- **Check 3, which events fire.** With `/probe` open, one interruption at a time, about 5 s each: Notification Center (the notification shade), Control Center (Quick Settings), a switch to another app and back, an incoming call declined after about 10 s, the lock button for about 10 s, and Auto-Lock (the screen timeout) left to lock the screen, then 10 s. Note the order. The log gives each event with both clocks: the span from `visibilitychange` "hidden" to "visible", or from `blur` to `focus` when the page stays visible, is the interruption's, and a frame gap above 1 s on either clock gets its own entry, with the span on both clocks. These lengths are yours, so they only show that the probe measures the span: they are not OD2's spans. The probe also copies each entry to localStorage at once, so an event that fired as the page went away, such as `pagehide`, shows in the next load's log even when its IndexedDB write did not finish. A process killed at once may still lose that copy, so a missing last `pagehide` does not prove that it did not fire.
- **Check 3, the spans for OD2,** in the browser tab of rows 1 and 3, after the timed run: with no stopwatch, do each interruption as you would while playing, at least five times each, spread over a few minutes: a glance at a notification, a setting changed in Control Center (Quick Settings), a quick reply in another app, a call declined, the lock button and back, and the screen left to lock by itself until you come back. Their spans in the log go in [the OD2 table](#hidden-spans-of-common-interruptions-for-od2).
- **Check 4.** Lock the phone for 60 s with `/probe` open. On return, the "frame gap" entry, which a span above 1 s on either clock writes, has a `dateMs` of about 60,000: a `perfMs` about as large means that `performance.now()` advanced during the sleep, a much smaller one that it stopped. The `visibilitychange` "hidden" and "visible" entries, where they fire, cross-check it: each carries both clocks, so the span between them in `perfMs` against the one in `dateMs` gives the same answer.
- **Check 5.** The features are the result's `features` and `context`. Downloads: in Training, play a level to its end and download the journal; in a wallet browser, also the Challenge run file, if a season accepts runs.
- **Check 6.** The probe's log is the marker, kept in IndexedDB. Load `/probe`, kill the app from the app switcher, reopen it and `/probe`: the log should still show the earlier load. The same after an update of the browser or wallet app, when one comes. Then open `/probe` in the phone's other contexts: Safari, the Home Screen app and each wallet browser keep their own storage ([§1.1](../docs/PHONE.md#11-options-compared)), so an earlier load from another context should not show.
- **Checks 7 to 9.** On the preview's Training, with a Bluetooth keyboard: level 01 to a clear, and to a commit with X; a rotation mid-level; a 3-s and a 30-s hide mid-level (an app switch), then the journal downloaded and loaded in Replay, noting the events around each hide.
- **Check 11,** in each wallet browser: open `/challenge`, connect, switch the network. If a season accepts runs, buy, reveal, play and commit a run on Arbitrum Sepolia, noting the countdown's margins and whether the signing sheet hides the page: the Challenge page warns, in its title and on the page, when it was hidden.
- **The back gesture (§14 fact 17),** in each context of rows 3 and 4, with gesture navigation on: open `/vectors`, then `/probe` from its link, so that a back has a page to go to. Swipe in from a side edge, starting at the very edge and a little further in each time, about ten times a side; after each swipe that went back, return with the Probe link. The probe logs each touch that starts within 64 px of a side edge as `touchstart`, with its `edge` and its distance `px` from it, and every `touchcancel`; a swipe that went back is followed by `pagehide`. On each side, the zone's width lies between the largest `px` that went back and the smallest that did not. A back with no `touchstart` before it means the system took the touch before the page saw it: note it. Whether a swipe that starts on a control near the edge goes back waits for M3.13's touch controls.
- **Reporting.** After each context, press Copy on `/probe` and paste the JSON as a comment on the pull request, with the device, the OS version, the browser or wallet app and its version, the context, and the order of check 3's interruptions. Clear the log before the next round of checks in the same context.

## A1 and A3

| Row | Context | A1: check 1, 0 mismatches | A3: check 2, power saving off | A3: check 2, power saving on |
|---|---|---|---|---|
| 1 | Safari tab | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |
| 1 | Home Screen app | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |
| 1 | MetaMask browser | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |
| 1 | Coinbase Wallet browser | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |
| 3 | Chrome tab | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |
| 3 | WebAPK | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |
| 3 | MetaMask browser | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |
| 3 | Coinbase Wallet browser | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |

## Results by context

### Row 1: Safari tab

iPhone, 6.1-inch class, current iOS. Device, OS version, and browser or app version: to fill on device (owner).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, Low Power Mode off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, Low Power Mode on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. Notification Center: events, hidden span | to fill on device (owner) |
| 3. Control Center: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. Auto-Lock: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | to fill on device (owner) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | n/a: not a wallet browser |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | n/a: not a wallet browser |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | n/a: not a wallet browser |

### Row 1: Home Screen app

iPhone, 6.1-inch class, current iOS. Device, OS version, and browser or app version: to fill on device (owner).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, Low Power Mode off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, Low Power Mode on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. Notification Center: events, hidden span | to fill on device (owner) |
| 3. Control Center: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. Auto-Lock: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | to fill on device (owner) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | n/a: not a wallet browser |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | n/a: not a wallet browser |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | n/a: not a wallet browser |

### Row 1: MetaMask browser

iPhone, 6.1-inch class, current iOS. Device, OS version, and browser or app version: to fill on device (owner).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, Low Power Mode off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, Low Power Mode on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. Notification Center: events, hidden span | to fill on device (owner) |
| 3. Control Center: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. Auto-Lock: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | to fill on device (owner) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | to fill on device (owner), if a season accepts runs |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | to fill on device (owner) |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | to fill on device (owner), if a season accepts runs |

### Row 1: Coinbase Wallet browser

iPhone, 6.1-inch class, current iOS. Device, OS version, and browser or app version: to fill on device (owner).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, Low Power Mode off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, Low Power Mode on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. Notification Center: events, hidden span | to fill on device (owner) |
| 3. Control Center: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. Auto-Lock: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | to fill on device (owner) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | to fill on device (owner), if a season accepts runs |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | to fill on device (owner) |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | to fill on device (owner), if a season accepts runs |

### Row 3: Chrome tab

Pixel-class Android, current Chrome. The owner's phone, 2026-11-11: Chrome 157, the current major; a 360 × 840 CSS px screen at a device pixel ratio of 3 (1,080 × 2,520 pixels), a 360 × 754 viewport in the tab. Chrome's reduced user agent ("Android 10; K") hides the model and the Android version: to fill (owner). Build `2f149b6`, this pull request's preview (`refs/pull/94/merge` of `053a689`); [probe JSON](phone-probes/2026-11-11-row3-chrome-tab.json).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, battery saver off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, battery saver on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. The notification shade: events, hidden span | to fill on device (owner) |
| 3. Quick Settings: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. The screen timeout: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | IndexedDB ok; Web Locks granted; wake lock granted; service workers present; `persist()` false, `persisted()` false before and after; display mode "browser"; safe-area insets 0 on every side; EIP-6963 none and no `window.ethereum`, as expected in a browser tab; `share` and `canShare` with a `.jrn` file both true. A secure context with WebAssembly; the engine loads. [probe JSON](phone-probes/2026-11-11-row3-chrome-tab.json) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | n/a: not a wallet browser |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | n/a: not a wallet browser |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | n/a: not a wallet browser |
| §14 fact 17. The back gesture: on each side, the largest `px` that went back and the smallest that did not | Partial. Touches that started 51 and 60 px from the left edge and 64 px from the right reached the page as `touchstart`, and none went back: the log has no `pagehide`. A touch at 73 px from the right ended in `touchcancel`, the browser taking it. So, if those were inward swipes with gesture navigation on, the zone is under 51 px on the left and under 64 px on the right. Its lower bound needs swipes that start at the very edge (to fill on device, owner). [probe JSON](phone-probes/2026-11-11-row3-chrome-tab.json) |

### Row 3: WebAPK

Pixel-class Android, current Chrome. Device, OS version, and browser or app version: to fill on device (owner).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, battery saver off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, battery saver on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. The notification shade: events, hidden span | to fill on device (owner) |
| 3. Quick Settings: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. The screen timeout: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | to fill on device (owner) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | n/a: not a wallet browser |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | n/a: not a wallet browser |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | n/a: not a wallet browser |
| §14 fact 17. The back gesture: on each side, the largest `px` that went back and the smallest that did not | to fill on device (owner) |

### Row 3: MetaMask browser

Pixel-class Android, current Chrome. Device, OS version, and browser or app version: to fill on device (owner).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, battery saver off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, battery saver on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. The notification shade: events, hidden span | to fill on device (owner) |
| 3. Quick Settings: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. The screen timeout: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | to fill on device (owner) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | to fill on device (owner), if a season accepts runs |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | to fill on device (owner) |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | to fill on device (owner), if a season accepts runs |
| §14 fact 17. The back gesture: on each side, the largest `px` that went back and the smallest that did not | to fill on device (owner) |

### Row 3: Coinbase Wallet browser

Pixel-class Android, current Chrome. Device, OS version, and browser or app version: to fill on device (owner).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, battery saver off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, battery saver on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. The notification shade: events, hidden span | to fill on device (owner) |
| 3. Quick Settings: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. The screen timeout: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | to fill on device (owner) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | to fill on device (owner), if a season accepts runs |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | to fill on device (owner) |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | to fill on device (owner), if a season accepts runs |
| §14 fact 17. The back gesture: on each side, the largest `px` that went back and the smallest that did not | to fill on device (owner) |

### Row 2 (optional): Safari tab

iPhone SE class (375 × 667) or the oldest at hand, previous iOS major. Device, OS version, and browser or app version: to fill on device (owner).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, Low Power Mode off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, Low Power Mode on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. Notification Center: events, hidden span | to fill on device (owner) |
| 3. Control Center: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. Auto-Lock: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | to fill on device (owner) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | n/a: not a wallet browser |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | n/a: not a wallet browser |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | n/a: not a wallet browser |

### Row 2 (optional): Home Screen app

iPhone SE class (375 × 667) or the oldest at hand, previous iOS major. Device, OS version, and browser or app version: to fill on device (owner).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, Low Power Mode off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, Low Power Mode on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. Notification Center: events, hidden span | to fill on device (owner) |
| 3. Control Center: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. Auto-Lock: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | to fill on device (owner) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | n/a: not a wallet browser |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | n/a: not a wallet browser |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | n/a: not a wallet browser |

### Row 4 (optional): Chrome tab

Mid-range Android, 360 px wide, previous Chrome major. Device, OS version, and browser or app version: to fill on device (owner).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, battery saver off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, battery saver on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. The notification shade: events, hidden span | to fill on device (owner) |
| 3. Quick Settings: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. The screen timeout: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | to fill on device (owner) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | n/a: not a wallet browser |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | n/a: not a wallet browser |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | n/a: not a wallet browser |
| §14 fact 17. The back gesture: on each side, the largest `px` that went back and the smallest that did not | to fill on device (owner) |

### Row 4 (optional): Samsung Internet

Mid-range Android, 360 px wide, previous Chrome major. Device, OS version, and browser or app version: to fill on device (owner).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, battery saver off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, battery saver on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. The notification shade: events, hidden span | to fill on device (owner) |
| 3. Quick Settings: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. The screen timeout: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | to fill on device (owner) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | n/a: not a wallet browser |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | n/a: not a wallet browser |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | n/a: not a wallet browser |
| §14 fact 17. The back gesture: on each side, the largest `px` that went back and the smallest that did not | to fill on device (owner) |

### Row 5 (optional): Home Screen app, with a keyboard

iPad. Device, OS version, and browser or app version: to fill on device (owner).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, Low Power Mode off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, Low Power Mode on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. Notification Center: events, hidden span | to fill on device (owner) |
| 3. Control Center: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. Auto-Lock: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | to fill on device (owner) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | n/a: not a wallet browser |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | n/a: not a wallet browser |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | n/a: not a wallet browser |

### Row 5 (optional): Home Screen app, without a keyboard

iPad. Device, OS version, and browser or app version: to fill on device (owner).

| Check | Result |
|---|---|
| 1. Vectors page: replayed, mismatches, first differing tick | to fill on device (owner) |
| 2. Clock probe, Low Power Mode off: most ticks behind, A3 | to fill on device (owner) |
| 2. Clock probe, Low Power Mode on: most ticks behind, frames a second, A3 | to fill on device (owner) |
| 3. Notification Center: events, hidden span | to fill on device (owner) |
| 3. Control Center: events, hidden span | to fill on device (owner) |
| 3. An app switch: events, hidden span | to fill on device (owner) |
| 3. An incoming call: events, hidden span | to fill on device (owner) |
| 3. The lock button: events, hidden span | to fill on device (owner) |
| 3. Auto-Lock: events, hidden span | to fill on device (owner) |
| 4. performance.now() across a 60-s sleep: perfMs against dateMs | to fill on device (owner) |
| 5. Features: IndexedDB, Web Locks, wake lock, service workers, persist() and persisted(), display mode, safe-area insets, EIP-6963, file sharing | to fill on device (owner) |
| 5. Training's journal download | to fill on device (owner) |
| 5. The Challenge run file's download | n/a: not a wallet browser |
| 6. The log after an app kill | to fill on device (owner) |
| 6. The log after an app update | to fill on device (owner) |
| 6. The log from the phone's other contexts | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a clear | to fill on device (owner) |
| 7. Training L01 with a Bluetooth keyboard: a commit (X) | to fill on device (owner) |
| 8. A rotation mid-level | to fill on device (owner) |
| 9. A 3-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 9. A 30-s hide mid-level: the journal's events around it | to fill on device (owner) |
| 11. Connect, and switch the network | n/a: not a wallet browser |
| 11. A run on Arbitrum Sepolia: margins, and whether the signing sheet hides the page | n/a: not a wallet browser |

## Hidden spans of common interruptions, for OD2

From check 3's untimed run in the browser tab of rows 1 and 3: each interruption done as a player would, at least five times, with no stopwatch. A span runs from `visibilitychange` "hidden" to "visible", by `Date.now()`, or from `blur` to `focus` when the page stayed visible. Each cell gives the count, then the shortest, the median and the longest span, in seconds. The timed run of check 3 does not count here: its lengths are the owner's choice, not the interruptions'. M3.16 sets the hidden-page policy, and H, from these spans and the measured costs ([`docs/PHONE.md` §6.3](../docs/PHONE.md#63-the-hidden-page-policy-od2)).

| Interruption | Row 1, Safari tab: events | Row 1: spans (count; shortest, median, longest) | Row 3, Chrome tab: events | Row 3: spans (count; shortest, median, longest) |
|---|---|---|---|---|
| Notification Center / the notification shade | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |
| Control Center / Quick Settings | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |
| An app switch | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |
| An incoming call | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |
| The lock button | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |
| Auto-Lock / the screen timeout | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) | to fill on device (owner) |

## Facts of `docs/PHONE.md` §14 that this item settles

Each is untested until the owner's round H2; the emulation below settles none of them.

| # | Fact | Status | From |
|---|---|---|---|
| 1 | Which interruptions fire `blur`, `visibilitychange` or `pagehide` on current iOS and Chrome: Notification Center, Control Center, app switch, call, lock | untested | check 3 |
| 2 | Whether `performance.now()` advances during device sleep on iOS and Android | untested | check 4 |
| 3 | IndexedDB, Web Locks, the wake lock, service workers and EIP-6963 in the MetaMask and Coinbase Wallet browsers on iOS and Android | untested | check 5, wallet browsers |
| 4 | Whether wallet-browser storage survives an app kill and an app update, and whether the wallet reloads the tab on return | untested | check 6; a reload on return is any new "load" entry after a return in check 3, whatever its `navigation`: "navigate" where the wallet makes its view anew, "reload" otherwise. Its `wasDiscarded`, where the browser has it, says whether the browser discarded the page |
| 5 | Whether a wallet's signing sheet keeps the page visible | untested: settled here only if a season accepts runs during the round, otherwise in M3.18 | check 11 |
| 6 | iOS Low Power Mode's cap on `requestAnimationFrame` (30 fps in 2020), against 15 Hz | untested | check 2 with Low Power Mode on: `frames` × 1,000 ÷ `perfMs`, in frames a second |
| 7 | `persist()`'s outcome in each context | row 3, Chrome tab: refused (`persist()` false, `persisted()` false), 2026-11-11; the other contexts untested | check 5: `features.storage` |
| 8 | Touch latency on 2025-2026 phones | untested: optional, Appendix A's check 12, which this report does not carry | none |
| 17 | The width of Android's back-gesture zone under gesture navigation, and whether a swipe that starts on a control near it goes back | partial: row 3, Chrome tab, 2026-11-11, under 51 px on the left and 64 px on the right if the touches were inward swipes, with no lower bound yet; untested otherwise: the width from the back-gesture swipes on `/probe`, on rows 3 and 4; the controls part waits for M3.13's touch controls | [the back gesture](#how-to-run-the-checks-owner): the probe's `touchstart`, `touchcancel` and `pagehide` entries |
| 18 | Journal and run-file downloads in Android wallet browsers, whose WebView has no Web Share API | untested | check 5's downloads, row 3's wallet browsers |

## Emulation (Chromium, container)

**Emulation, not device evidence.** Measured in a Linux container at commit `0a3bfb0` (`0a3bfb0dc2e8474b113208c5621590ca2ef051b8`), this pull request's first commit, whose sha the pages show as their build, with Playwright 1.63.0 and its Chromium 153.0.8010.12 (build 1243; `chromium.launch()` runs its headless shell). WebKit is not installed in the container: the `webkit-iphone` project runs only in CI, in this pull request's `pages` run.

### Vectors page

```bash
bash web/wasm/build-wasm.sh
npm --prefix web run build -- --mode preview-pages
npm --prefix web run e2e -- --project=chromium --project=chromium-phone
```

| Project | format | game | levels | Mismatches | `.trace` files fetched |
|---|---|---|---|---|---|
| `chromium`, desktop, 1280 × 720 | 51 | 43 | 32 | 0 | none |
| `chromium-phone`, the Pixel 7 descriptor, 412 × 839, touch | 51 | 43 | 32 | 0 | none |

`node web/test/vectors.mjs vectors/`, the Node runner on the same module: "jiro-wasm: 51 format vectors and 75 game vectors, 0 mismatches".

### Probe: feature report

The preview build above, served by `npx --prefix web vite preview --port 4173`, and `/probe` loaded in a new page of `chromium.launch()` with no options, Playwright's default desktop context:

```js
const page = await (await chromium.launch()).newPage();
await page.goto("http://localhost:4173/probe");
// once JSON.parse(#results).features.engine is set:
await page.click("#clock-probe"); // then wait for clockProbes[0], about 180 s
```

```json
{
  "features": {
    "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.8010.12 Safari/537.36",
    "secureContext": true,
    "webAssembly": true,
    "webLocks": "granted",
    "wakeLock": "NotAllowedError: Wake Lock permission request denied",
    "serviceWorker": true,
    "storage": {
      "persistedBefore": false,
      "persist": false,
      "persistedAfter": false
    },
    "share": false,
    "canShareFile": "missing",
    "injectedEthereum": false,
    "indexedDB": "ok",
    "engine": "ok"
  },
  "context": {
    "displayMode": "browser",
    "navigatorStandalone": "missing",
    "viewport": {
      "width": 1280,
      "height": 720
    },
    "screen": {
      "width": 1280,
      "height": 720
    },
    "devicePixelRatio": 1,
    "coarsePointer": false,
    "safeAreaInsets": {
      "top": "0px",
      "right": "0px",
      "bottom": "0px",
      "left": "0px"
    },
    "visibility": "visible"
  },
  "eip6963": []
}
```

### Probe: clock probe (A3)

| Field | Headless Chromium |
|---|---|
| Ticks run, end | 2,700, Time limit |
| Duration, `performance.now()` and `Date.now()` | 179,942 ms, 179,942 ms |
| Frames | 10,795, about 60 a second |
| Ticks due and not yet run before each frame's pump | 8,095 frames at 0 behind, 2,700 frames at 1 behind |
| Most ticks behind | 1 |
| Longest frame gap | 52 ms |
| Hides | 0 |
| Wake lock | NotAllowedError: Wake Lock permission request denied |
| A3 (at most 2 behind, visible throughout) | holds |

A headless desktop browser on a server draws at 60 frames a second with nothing else to do: this shows that the probe measures, not how phones behave.
