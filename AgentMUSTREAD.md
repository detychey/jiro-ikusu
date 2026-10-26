# 🤖 AGENT MUST-READ: SYSTEM INSTRUCTIONS & BOUNDARIES

## 1. PROJECT CONTEXT
**Project Description:** A fast-paced mobile Progressive Web App (PWA) hybrid game blending 2D mining exploration (50x50 grid) and auto-battler tower defense (5x5 grid).
**Core Resources:** R (Red), G (Green), B (Blue).
**Tech Stack:** TypeScript, React, Phaser 3, Vite, Zustand, `pure-rand`.

---

## 2. STRICT BOUNDARIES & RULES (NEVER VIOLATE)

### Rule 1: The React-Phaser Event Bridge
* **NEVER** manipulate the Phaser Canvas directly from React components.
* **NEVER** manipulate React DOM directly from Phaser.
* **ALWAYS** use `zustand` (a framework-agnostic state manager) or a centralized Event Bus to pass messages and sync state between the React UI (upgrades, menus) and the Phaser Engine (spawning, rendering).

### Rule 2: Strict TypeScript & Enumerators
* **NEVER** use raw strings for game logic or tile identities.
* **ALWAYS** use strict TypeScript `enum` or union types.
* *Example:* `type ResourceType = 'R' | 'G' | 'B' | 'NONE';`
* *Example:* `type TileType = 'ROCK_EMPTY' | 'ROCK_BASIC' | 'VEIN_RED' | 'VEIN_GREEN' | 'VEIN_BLUE';`

### Rule 3: Separation of Concerns (Logic vs. Render)
* **NEVER** put core game math (synergy unlocking, resource counting, wave timing) directly inside Phaser's `update()` loop or Scene classes.
* **ALWAYS** keep core logic in pure TypeScript classes/files. Phaser should ONLY be used for reading that state, drawing graphics, and detecting collisions/inputs.

### Rule 4: Deterministic Grid Math & Seeding
* **NEVER** use `Math.random()` for map generation. 
* **ALWAYS** use a seeded PRNG (like `pure-rand` or `ts-seedrandom`) paired with a game `nonce` string.
* **ALWAYS** manage the 50x50 exploration grid mathematically in a 1D array of 2,500 elements. Use `index = y * width + x` for grid lookups.

---

## 3. GAME DATA BLUEPRINTS

### Exploration Grid (50x50)
Total Tiles: 2500. Must be generated based on a provided `nonce` and strictly respect this distribution pool:
* `1000`: Useless Rocks (0 yield)
* `1000`: Standard Rocks (1 R, 1 G, 1 B yield)
* `500`: Distributed randomly among Red (6 R), Green (6 G), and Blue (6 B) veins using the seeded PRNG.

### Mechanics & Economy
* **Universal Sinks:** Any resource can be used to construct standard towers, upgrade miner speed, or upgrade tower levels (1-5).
* **Tower Evolutions:** specific resources turn standard towers into specific types (Red = Splash, Green = DoT/Poison, Blue = Slow/Freeze).
* **Synergies:** Handled via automatic passives based on specific combos of built tower types (e.g., 2 R + 1 B = Thermal Shock).

---

## 4. SUGGESTED REFERENCE REPOSITORIES
When building boilerplate, refer to standard patterns from:
* **Architecture:** `phaserjs/template-react-ts` (Standard Vite + React + Phaser EventBus pattern).
* **State Management:** `zustand` (Use standard vanilla + React hooks pattern).
* **PRNG:** `pure-rand` (Use for all Map initialization).
