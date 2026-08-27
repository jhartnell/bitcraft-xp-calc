# BitCraft Online XP Calculator

A high-performance, real-time web application to track active crafting progress, calculate expected Experience Points (XP), estimate time to completion, and project level-ups for **Bitcraft Online** players using the [BitJita Developer API](https://bitjita.com/docs/api).

---

## 🌟 Key Features

1. **Player Selection & Character Switcher:**
   - Real-time debounced character search with autocomplete and online/offline status indicators.
   - Quick-switch character dropdown and recent player chip history (persisted in local storage).
   - Instant multi-character management for players with active alts.

2. **Dynamic Level Progression & Next-Level Timing (v1.2.0, v1.3.1):**
   - **Calibrated Cumulative Curve:** Matches BitCraft's live in-game exponential progression curve ($\text{delta}(L) = 500 + 520.26 \times (1.115732^{L-1} - 1)$) with exact lifetime cumulative tracking.
   - **Immediate Next Level Countdown:** Computes exact time to ding (e.g. `Level 80 in ~1m 45s at 10:42 PM`).
   - **Interactive Milestone Roadmap:** Clickable milestone pill that expands to show intermediate level milestones, craft completion % markers, and XP needed when gaining multiple levels on a large craft.
   - Dual progress bars illustrating current skill level progression % vs. projected outcome upon completion.

3. **Active Craft Tracker:**
   - Automatically detects in-progress crafts (`/api/players/{id}/crafts`).
   - Detailed recipe inspection (Item Name, Tier, Rarity, Building Station, and Claim / Region location coordinates).
   - Effort progress bar (`progress` / `totalProgressRequired`) and finished vs. remaining item counts.
   - Multi-craft navigation tabs when a player has multiple active crafts.

4. **Accurate Tool Mapping:**
   - Verified tool type mappings across all 14 BitCraft professions:
     - **Masonry:** Chisel
     - **Mining:** Pickaxe
     - **Carpentry:** Saw
     - **Forestry:** Axe
     - **Smithing:** Smithing Hammer
     - **Leatherworking:** Knife
     - **Tailoring:** Needle / Shears
     - **Farming:** Hoe / Sickle
     - **Fishing:** Fishing Rod
     - **Cooking:** Cooking Pot / Pan
     - **Foraging:** Foraging Sickle / Basket
     - **Scholar:** Quill / Codex
     - **Construction:** Mallet / Trowel

5. **In-Game Calibrated Action Timing & Debuff Calculation:**
   - **Base Action Cycle (1.6s):** Uses BitCraft's actual 1.6-second base channel duration per crafting action.
   - **Food Debuff & Speed Modifiers:** Accurately accounts for negative Crafting Speed modifiers (e.g. food debuffs like $-11.5\%$ or $-20\%$ Crafting Speed, rez sickness, etc.) which lengthen action duration:
     $$\text{Action Duration} = \frac{1.6\text{s}}{\text{Total Crafting Speed Multiplier}}$$
   - **Server Stat Integration:** Directly ingests `player.stats.values[15]` when available from BitJita for exact server-calculated speed rates.
   - **Historical Contribution Detection:** Automatically calculates real-world progress-per-action rate ($\text{progress} \div \text{actions}$) from `/api/crafts/{id}/contributions`.

6. **Accurate XP & Progression Engine:**
   - **Total Craft XP:** `totalProgressRequired * baseXpPerAction * xpMultiplier`.
   - **XP Left to Gain:** `(totalProgressRequired - progress) * baseXpPerAction * xpMultiplier`.
   - **XP Already Earned:** `progress * baseXpPerAction * xpMultiplier`.
   - **Calibrated Level Curve:** Converts XP into BitCraft skill levels (1–110) with exact progress percentages and XP needed for the next level milestone.

7. **Equipment & Food Buff Modifiers:**
   - **Tool Compatibility Verification:** Inspects main-hand, off-hand, and profession charm slots to ensure required tool type, minimum level, and power tier are satisfied.
   - **Debuff Highlighting:** Visually distinguishes beneficial buffs from speed penalties.
   - **Active Buff Countdown:** Live countdown timers with expiration warnings (< 2 minutes).

8. **Polite API Architecture & Rate Limit Protection:**
   - **In-Memory TTL Cache:** Caches search results, player metadata, crafts, and skills to minimize network traffic.
   - **Request Queue & Throttling:** Enforces a minimum 120ms spacing and maximum 2 concurrent outbound requests with automatic exponential backoff on HTTP 429 errors.
   - **User-Configurable Auto-Refresh:** Selectable polling intervals (`Off`, `15s`, `30s`, `60s`, `2m`, `5m`) with live pause/resume and countdown indicator.

9. **Multi-User Collaborative Crafting & Contributor Projections (v1.1.0, v1.2.1, v1.3.2):**
   - **Dynamic Activity Detection:** Tracks contributor recency and live progress deltas (`🔥 Currently Crafting`, `Active Participant`, `Idle / Left`).
   - **Compounded Team Speed:** Combines the effort-per-second rates of all active participants to calculate collaborative station completion times.
   - **Contextual Time Saved & Acceleration Metrics (v1.3.2):**
     - **Projected Time to Finish:** Prominently displays the collaborative completion ETA alongside the solo baseline duration and speedup.
     - **🔮 Estimated Future Savings:** Clear future-tense metric showing the grinding hours shaved off the *remaining* unfinished progress.
     - **⚡ Already Saved (Past Work):** Exact time shaved off so far by helpers' completed contributions.
     - **🏆 Projected Total Craft Savings:** Lifetime project savings combining past contributions and projected future speedups.
   - **Individual Projected XP Shares:** Accurately distributes remaining craft effort and expected XP according to each participant's relative crafting speed and gear buffs.
   - **Interactive Simulation Toggles:** Check or uncheck any contributor to simulate team compositions on shared or public crafting stations.

10. **Spatial Proximity & Automatic Task Rollover (v1.3.0, v1.3.4):**
    - **2D World Coordinate Tracking:** Ingests character `(locationX, locationZ)` and region to detect all active crafting stations within interaction distance ($\le 500\text{m}$).
    - **Boundary-Proof Proximity:** Resolves stations seamlessly whether standing inside a claim, outside a perimeter fence, or in a ruined city without polygon boundary limitations.
    - **Automatic Helper Station Tabs:** Identifies stations where the player has contributed effort and pins a prominent **`⭐ Helping: Station (Item Name)`** tab directly to the dashboard.
    - **Lifecycle Completion & Active Task Rollover (v1.3.4):** Automatically detects when a currently tracked craft completes, discards stale identifiers, and transitions seamlessly to newly started owned crafts or active helper stations without requiring manual user refresh.
    - **Selection Persistence:** Seamlessly retains chosen station selections and live progress during background auto-refresh cycles while a craft is ongoing.

11. **Compact Station Dropdown & Clean UI Controls (v1.3.0):**
    - **Real Item & Recipe Name Resolution:** Resolves and displays human-readable item names and tiers (e.g. `📦 Cedar Planks (T2)`, `📦 Pyrelite Ore Concentrate`) instead of numeric recipe IDs.
    - **Nearby Station Dropdown Drawer:** Tucks idle claim stations into a compact `[📍 +X Nearby Stations ▾]` menu to keep the main view clean and focused.
    - **Independent Show / Hide Panel Controls:** Provides dedicated collapse toggles for Modifiers & Buffs, Skills Matrix, and Contributors Panel to minimize screen clutter during active grinding.

12. **Public Crafts Explorer:**
    - Search and inspect global in-progress crafts across the realm to test character stats and hypothetical XP gains.

13. **Auto-Deployment Version Detection & Toast Notification (v1.3.3):**
    - **Background Manifest Polling:** Periodically checks `/version.json` with cache-busting headers on tab focus and background intervals.
    - **Interactive Update Toast:** Displays a floating alert (`🚀 New Version Available! (vX.X.X)`) with a 30-second auto-reload countdown (pauses on hover) and instant `[ Reload Now ]` / `[ Later ]` controls.
    - **Stale Chunk Preload Trap:** Listens for Vite dynamic chunk errors (`vite:preloadError`) to automatically reload stale sessions after new server deployments.

---

## 🛠️ Architecture & Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Build Tool:** Vite with proxy support for `https://bitjita.com`
- **Testing:** Vitest with JSDOM test runner
- **Styling:** Custom dark fantasy aesthetic with glassmorphism and animated progress indicators

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Installation
```bash
# Clone repository
git clone https://github.com/jhartnell/bitcraft-xp-calc.git
cd bitcraft-xp-calc

# Install dependencies
npm install
```

### Running Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Running Unit Tests
```bash
npm run test:run
```

### Production Web Build
```bash
npm run build
npm run preview
```

### Docker Deployment (Containerized with Reverse Proxy)

#### Option A: Pull & Run Official Image (GitHub Container Registry)
```bash
# Pull and run the pre-built multi-arch image (no login required)
docker run -d \
  -p 8080:80 \
  --name bitcraft-xp-calc \
  --restart unless-stopped \
  ghcr.io/jhartnell/bitcraft-xp-calc:latest
```

#### Option B: Run with Docker Compose
```bash
# Pulls published image or builds locally
docker compose up -d
```

#### Option C: Build from Source
```bash
docker build -t bitcraft-xp-calc:latest .
docker run -d -p 8080:80 --name bitcraft-xp-calc bitcraft-xp-calc:latest
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

### Browser Extension Build (Zero-Hosting Client Distribution)
```bash
npm run build:extension
```
Load the unpacked extension in Chrome/Edge at `client-side-only/browser-extension/dist` (see [`client-side-only/README.md`](client-side-only/README.md)).

---

## 📐 Formulas & Calculation Reference

### 1. Progress & Physical Actions
$$\text{Total Effort Required} = \text{actionsRequiredPerItem} \times \text{craftCount}$$
$$\text{Remaining Effort} = \max(0, \text{Total Effort Required} - \text{progress})$$
$$\text{Physical Actions Remaining} = \left\lceil \frac{\text{Remaining Effort}}{\text{Progress Per Action}} \right\rceil$$

### 2. Action Timing & Speed Modifiers
$$\text{Speed Multiplier } (M) = 1.0 + \sum \text{Equipment Bonuses} + \sum \text{Food Buffs / Debuffs}$$
$$\text{Action Duration (Seconds)} = \frac{1.6\text{s}}{M}$$
$$\text{Estimated Time Remaining} = \text{Physical Actions Remaining} \times \text{Action Duration}$$

### 3. Total XP & Progress
$$\text{Total Craft XP} = \text{Total Effort Required} \times \text{baseXpPerAction} \times \text{xpMultiplier}$$
$$\text{Remaining XP} = \text{Remaining Effort} \times \text{baseXpPerAction} \times \text{xpMultiplier}$$

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
