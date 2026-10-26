Here is a master plan structured as a direct context document.   
Consider this as the "Project Specification" and use that to build the readme of the repo.

## **1\. Project Context & Hardware Target**

**Goal:** Build a deterministic, onchain-verifiable area-capture game (inspired by *Volfied/Qix*) for a specific hardware target.  
**Hardware:** Raspberry Pi Pico (RP2040) using the Waveshare Pico-LCD-1.3 hat.

* **Display:** 240×240 IPS LCD (controlled via SPI).  
* **Inputs:** 4-way Joystick, 4 physical push buttons (Key0, Key1, Key2, Key3).  
* **Verification Model:** Optimistic Rollup / ZK-ready. The game runs entirely on the Pico. To allow a smart contract to verify the score cheaply, the game engine MUST be 100% deterministic, avoid all floating-point math, run at a low tick rate (15 Hz), and output a compact "Input Journal" (tick number \+ button state) at the end of the session.

We will build a browser based version too for quick testing and play purposes 

## **2\. Technical Architecture & Constraints**

* **Logical Grid:** The 240×240 screen maps to a $60\times 60$ logical grid. Every logical cell is rendered as a $4\times 4$ pixel square.  
* **Tick Engine:** The game loop operates at 15 ticks per second (TPS). Do not use delta-time for physics; update state rigidly once per tick.  
* **State Array:** The map is a 1D or 2D array of 3,600 uint8 values:  
  * 0: Empty Space (Boss territory).  
  *   
  * 1: Claimed Solid / Perimeter.  
  *   
  * 2: Active Cut Trail (vulnerable).  
  *   
* **Entities:**  
  * Player: (x, y) coordinates, cutting\_state boolean.  
  *   
  * Boss: (x, y) coordinates, vx, vy velocities (strictly 1 or \-1).  
  *   
  * Minions (x3): (x, y) coordinates, direction (0-3 for N/E/S/W).  
  * 

## **3\. Deterministic Algorithms (No Floats Allowed)**

**Boss Movement:**  
The Boss uses strict integer reflection. Every tick, calculate next\_x \= x \+ vx and next\_y \= y \+ vy.

* If grid\[next\_x\]\[y\] is State 1 or 2, vx \*= \-1.  
* If grid\[x\]\[next\_y\] is State 1 or 2, vy \*= \-1.

**Minion Movement:**  
Minions patrol the edges using a Right-Hand Wall Follower algorithm. They only traverse State 1 cells that are adjacent to State 0 cells.

**The Flood Fill (Shape Closure):**  
When the Player connects an Active Cut Trail (State 2\) back to a Claimed area (State 1), the cut is complete:

1. Treat the Cut Trail as a temporary solid wall.  
2. Run a standard integer Flood Fill starting from the Boss's (x, y) coordinate. Mark all reachable State 0 cells as BossZone (e.g., State 3).  
3. Iterate through the entire 3,600-cell grid. Any cell that is State 0 (meaning the Boss cannot reach it) becomes State 1 (Claimed).  
4. Convert all State 2 cells (the Trail) to State 1\.  
5. Revert all BossZone cells back to State 0\.  
   

## **4\. Input Mapping & Journaling**

**Inputs:**

* **Joystick:** Moves the Player 1 cell per tick (Up, Down, Left, Right).  
* **Key0:** Fast Cut (Move 2 cells per tick while cutting).  
* **Key1:** Slow Shield (Move 1 cell every 2 ticks, but immune to 1 hit).  
* **Key2:** Commit/Forfeit (Ends game immediately).


**Journaling:**  
Maintain an array of state changes: struct InputEvent { uint16 tick; uint8 bitmask; }.  
Only push a new event to the array when the combined state of the joystick and buttons changes.

## **5\. Implementation Sequence for the AI Agent**

Provide the AI with the context above, then prompt it to execute these exact steps in order.

**1.Phase 1: Hardware Setup:**Waveshare SDK & Render Loop.  
"Write the C++ initialization code for the RP2040 and Waveshare Pico-LCD-1.3. Define a 60x60 uint8 grid. Write a render function that maps this logical grid to the 240x240 display using 4x4 pixel blocks. Set the grid borders (x=0, x=59, y=0, y=59) to State 1, and the inside to State 0\. Render State 0 as Black, State 1 as Blue, and State 2 as Red."

**2.Phase 2: Tick Engine & Input Hook:**15Hz Loop & Journaling.  
"Implement a rigid 15Hz tick loop using Pico hardware timers. Read the Joystick and Key0-3 GPIO pins. Create a dynamic array of InputEvent structs. On every tick, compare current GPIO state to previous state; if it changed, append the new state and the current tick number to the array."

**3.Phase 3: Player Movement:**State 1 to State 2 transitions.  
"Implement Player movement based on the InputEvent array. Start Player at (30, 59). If moving on State 1, restrict movement to adjacent State 1 cells. If moving into State 0, mark the path as State 2 (Active Cut). Ensure the player cannot move backward onto their own State 2 trail."

**4.Phase 4: Enemy AI & Collision:**Integer reflection & Wall-following.  
"Implement the Boss logic starting at (30, 30\) using only integer reflection (vx, vy \= 1 or \-1) against State 1 and 2 cells. Implement 3 Minions using a right-hand wall-follower algorithm on State 1 cells. Add lethality: If Boss touches State 2, or Boss/Minion touches Player, reset Player to (30,59) and erase all State 2 cells."

**5.Phase 5: The Flood Fill Algorithm:**Grid parsing.  
"Implement the Polygon Fill logic. When Player is drawing a State 2 trail and steps onto a State 1 cell, trigger a Flood Fill from the Boss's (x, y) coordinates to find all connected State 0 cells. Convert any State 0 cell NOT reached by the fill into State 1\. Convert all State 2 cells to State 1\. Calculate the percentage of the board that is State 1."

**6.Phase 6: Onchain Serialization:**Solidity ABI payload.  
"Write a function that triggers on Game Over. It must serialize the initial random seed (used for Boss start direction), the final score, the final board claim percentage, and the byte array of InputEvent structs into a hex string formatted for a Solidity contract ABI."

**7.Phase 7: Smart Contract Verifier:**State reconstruction.  
"Write a Solidity smart contract named VolfiedVerifier. It must accept the initial seed, score, and the array of InputEvents. It must recreate the 60x60 grid and the 15Hz tick loop, processing the exact same integer math, movement, and flood-fill logic to verify the submitted score matches the simulated result."

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

We will need to build a first set of 16 levels

Training mode: play the 16 level, get a score

Challenge mode:

Pay 0.10\$ for a set for a random set of 6 levels. At the end of each level the score will be added up for the total score of the run. Get ranked for the season and claim a reward 

The scoring formula per level (which is based on the completion) will be adjusted each season to reflect the player skills from what was actually observed in the previous seasons.

Superchallenge mode:

For this we will need to build a map generator. A player generates a map himself or at random for 1\$. Each run to clear the map costs 0.01\$. Once the map has been completed once, the minter claims half of the leftover value of the map. Any player may try a run on the map by paying 0.01\$ to beat the score of the minter and get half the accumulated value of the map.  Challenge this design. 

We can certainly will reuse stuff from the repo [https\://github.com/detychey/ethblockdigger](https://github.com/detychey/ethblockdigger) , typically:

- User can mint maps for 1\$  
- Each play is 0.01\$  
- The season and payout concepts 

Best reference implementations available on the web for volfied.

### **1\. Web & JavaScript Rewrites (Best for high-level logic)**

* **yanbrod/volfied\_clone (GitHub)**  
  * **Tech Stack:** TypeScript and HTML5 Canvas API.  
  * **Why it's useful:** This is a direct modern clone of Volfied. Because it is written in TypeScript, the game state, collision logic, and grid management are highly readable. It avoids complex memory management, making it an excellent blueprint for how to structure your core game loop and state variables before translating them into C++ or Solidity.  
* **Xonix / Qix Clones in JS**  
  * *Xonix* was a popular MS-DOS clone of Qix. Searching GitHub for "Xonix javascript" or "Qix HTML5" will bring up dozens of single-file canvas implementations. These are fantastic for studying the **Point-in-Polygon** or **Flood Fill** algorithms in their simplest, most readable forms.

### **2\. C++ & Systems-Level Code (Best for your RP2040 target)**

* **Przemekkkth/Xonix\_Qt-Cpp (GitHub)**  
  * **Tech Stack:** C++ and the Qt Framework.  
  * **Why it's useful:** *Xonix* is mechanically identical to *Volfied/Qix*. This repository shows how to implement the grid arrays and bouncing enemies in C++. You can strip away the Qt rendering layer and adapt the underlying array logic directly for the Pico SDK.  
* **aferust/drawee (GitHub)**  
  * **Tech Stack:** D/C/Assembly using SDL and OpenGL (compiles to WebAssembly).  
  * **Why it's useful:** This is a "Volfied-like" game built from scratch without a heavy game engine. It implements the shrinking polygon concepts directly, making it a good reference for handling raw pixel/grid buffers.

### **3\. Hardware-Constrained Ports (Best for memory/compute limits)**

* **"Qixie" by Milasoft (itch.io / 8-bit homebrew)**  
  * **Tech Stack:** 8-bit Assembly for the Commodore PET / C64.  
  * **Why it's useful:** The developer documented the exact problem you will face on the RP2040: **Stack Overflows during Flood Fill**. When dealing with a large grid, a standard recursive flood-fill algorithm will crash limited hardware. The developer details how they solved it by rewriting the fill routine to use linear sweeps and separate buffer swapping. Reading the devlogs for this project will save you hours of debugging memory leaks on the Pico.

Analyse this and Focus on three specific mechanics from these repos:

1. **The Grid Representation:** Look at how they store the board (usually a 1D or 2D array of integers, not floating-point coordinates).  
2. **The Iterative Flood Fill:** Do not let your AI write a *recursive* flood fill (like fill(x, y) { fill(x+1, y)... }). It will cause a stack overflow on the RP2040. Look at how the C++ clones use a *queue-based* or *iterative* flood fill to determine captured territory.  
3. **Enemy Reflection:** Look at how the Xonix/Volfied clones calculate the Boss bouncing off the freshly drawn player lines using simple integer velocity inversion (vx \= \-vx), which is crucial for your onchain zero-knowledge proofs.

Here are some examples of skills you should use, challenge and improve those (I also populated the file [skills-import.md](http://skills-import.md), check it out) :

### **Claude System Prompts: Onchain Game Architect**

**1\. The Embedded C++ Optimizer (RP2040 / Pico SDK)**

XML

```
<role>
You are an expert embedded C++ systems engineer writing bare-metal code for the Raspberry Pi Pico (RP2040) using the official Pico SDK. 
</role>
<hardware_constraints>
- SRAM is strictly limited to 264KB.
- Processing power is minimal; avoid deep call stacks.
</hardware_constraints>
<forbidden_practices>
- NEVER use dynamic memory allocation (`malloc`, `new`).
- NEVER use the C++ Standard Template Library (`std::vector`, `std::map`, etc.).
- NEVER use recursion (especially for Flood Fill algorithms). It will cause a stack overflow.
</forbidden_practices>
<required_practices>
- Use pre-allocated, fixed-size flat arrays (e.g., `uint8_t grid[3600]`).
- Implement all search or fill algorithms using iterative loops and statically sized queue arrays.
</required_practices>
```

**2\. The Deterministic Engine Architect**

XML

```
<role>
You are a retro arcade engine architect designing a 100% deterministic, tick-based game loop suitable for zero-knowledge or EVM smart contract verification.
</role>
<physics_and_math_rules>
- You are strictly forbidden from including `<math.h>` or `<cmath>`.
- You are strictly forbidden from using `float` or `double` data types.
- All spatial coordinates, movement vectors, and collision checks must use discrete integer math (`int8_t`, `uint16_t`).
- All velocity reflections must use simple inversion (e.g., `vx = -vx`).
</physics_and_math_rules>
<game_loop_rules>
- Do NOT use delta-time (`dt`) for physics calculations. 
- State transitions must occur rigidly and identically exactly once per tick (target 15Hz).
</game_loop_rules>
```

**3\. The EVM / Solidity Gas Optimizer**

XML

```
<role>
You are a Solidity security researcher and gas optimization expert specializing in L2 rollup environments. You translate deterministic C++ logic into EVM bytecode.
</role>
<optimization_directives>
- Minimize state writes (`SSTORE`). Perform the entire 15Hz tick loop replay and 60x60 grid verification in memory (`MSTORE`).
- Parse the submitted player input journal using bitwise operations and bitmasking to save gas.
- The C++ Flood Fill algorithm must be translated into highly optimized pure Solidity (or inline Yul assembly) to ensure the entire verification transaction executes under a strict 1,000,000 gas limit.
</optimization_directives>
```

**4\. The Cryptographic State Mapper**

XML

```
<role>
You are a cryptographic data engineer ensuring perfect byte-alignment between a C++ hardware client and an EVM smart contract.
</role>
<serialization_rules>
- Design a tightly packed byte schema for the 15Hz input journal (e.g., combining tick deltas and button bitmasks into minimal uint16/uint8 blocks).
- Ensure the Pseudorandom Number Generator (PRNG) used in the C++ client for initial enemy spawns mathematically perfectly matches the state-transition hashing logic of `keccak256` used in the Solidity verifier.
</serialization_rules>
```

**5\. The State-Machine Debugger**

XML

```
<role>
You are a Test-Driven Development (TDD) engineer for optimistic rollups.
</role>
<testing_protocol>
Because a single mismatched integer tick between the RP2040 and the EVM will invalidate the game session, you must write pure test functions for both C++ and Solidity.
- For every major function (movement, collision, shape closure), generate a test script that takes a deterministic random seed and a string of raw inputs.
- The script must output the final board state hash so I can verify the C++ output matches the Solidity output 1:1 before deploying.
</testing_protocol>
```

skills-import.md
