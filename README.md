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

11. **Item & Cargo Metadata Resolution (v1.3.0, v1.3.5):**
    - **Unified Item & Cargo Resolution:** Seamlessly ingests both `items` and `cargos` collections from BitJita API endpoints, resolving real names and tiers for both inventory items (e.g. `📦 Cedar Planks (T2)`) and heavy cargo items (e.g. `📦 Ornate Brick Slab (T7)`, `📦 Fine Brick Slab (T4)`).
    - **Nearby Station Dropdown Drawer:** Tucks idle claim stations into a compact `[📍 +X Nearby Stations ▾]` menu to keep the main view clean and focused.
    - **Independent Show / Hide Panel Controls:** Provides dedicated collapse toggles for Modifiers & Buffs, Skills Matrix, and Contributors Panel to minimize screen clutter during active grinding.

12. **Public Crafts Explorer & BitCraftMap Integration (v1.3.0, v1.3.5, v1.4.0, v1.6.2):**
    - Search and inspect global in-progress crafts across the realm to test character stats and hypothetical XP gains.
    - **Direct BitCraftMap.com Interactive Links (v1.6.2):** Station claim locations and coordinates link directly to **[BitCraftMap.com](https://bitcraftmap.com)** (`/?center=X%2CZ&zoom=1.0`) with `target="_blank"` and `rel="noopener noreferrer"`.
    - **Collapsible Profession Accordion Groups (v1.6.2):** Crafts are categorized into collapsible profession accordions sorted alphabetically (A–Z), with stations inside each group sorted strictly by **Required Skill Level: Highest ➔ Lowest**.
    - **3-Tier Filter Controls & Dual-Point Tier Range Slider (v1.6.2):** Features a clean 3-tier layout: full-width search on top, collapsible filter drawer containing Region & Profession dropdowns and a unified **2-point Item Tier Range Slider (`T1 – T10`)**, always-visible dynamic quick filters, and dedicated global `[ ▾ Expand All ]` / `[ ▸ Collapse All ]` toggles.
    - **Interactive Track / Untrack Station Management (v1.6.2):** Easily pin or unpin any public station (`⭐ Tracked Station` / `✕ Untrack` / `☆ Track`) with instant localStorage sync and top-of-list pinning.
    - **Smart Region Filtering & Auto-Default (v1.6.2):** Automatically defaults to the player's active region upon opening, with a dynamic Region dropdown (`🌐 All Regions`, `📍 Your Region: 14`, etc.) and multi-format text search (e.g. `14`, `Region 14`, `R14`).
    - **1-Click Header Shortcut (v1.4.0):** Direct `[ 🌐 Search Public Stations ]` button in the active craft header and empty state for instant access.

13. **Effort Pace & Tool Power Breakdown Popover (v1.7.0):**
    - **Contextual Effort Pace Trigger:** Hovering or clicking the `Calculated Effort Pace: X.X effort / action` row opens a comprehensive breakdown popover.
    - **Skill Level & Profession Integration:** Automatically infers craft profession from `toolRequirements.tool_type` (e.g. Quill/Codex $\to$ Scholar, Axe $\to$ Forestry, Chisel $\to$ Masonry) even when server `experiencePerProgress` arrays are unpopulated, displaying active player profession skill level (e.g. `📜 Scholar Lvl 24`) alongside station requirements.
    - **Dedicated `/players/{id}/tools` Endpoint Ingestion:** Ingests BitJita's authoritative `/players/{id}/tools` endpoint, retrieving exact tool powers and levels for all 15 profession tool types.
    - **Tier & Commonality (Rarity) Resolution:** Accurately maps player tools to their material Tier (`Tier 1` to `Tier 10`) and in-game Commonality (`Common`, `Uncommon`, `Rare`, `Epic`, `Legendary`, `Mythic`), e.g. displaying `Active Tool • Tier 7 • Legendary` alongside `Aurumite Axe` (+35 Power).
    - **BitJita `toolStats` Metadata Ingestion & Power Resolution:** Enriches equipped gear with `/api/items/{itemId}` `toolStats` objects (`power`, `level`, `toolType`, `skillId`, `skillName`), reading exact numerical power ratings across all 10 item tiers and 6 rarity grades (e.g. T2 Pyrelite Axe with 13/16 Power, T7 Aurumite Axe with 23-38 Power, T10 Mythic Pickaxe with 47 Power).
    - **Tool In Use & Validation:** Inspects equipped hand tool validity against the station's required tool type (e.g. matching Hammer vs. mismatched Axe) with clear status badges and extracted power (`+35 Power`).
    - **Itemized Contributor Breakdown:** Details power contributions from Primary Hand Tools, Charms, Instruments (e.g. `+2 Hexite Wooden Wedge`), and auxiliary gear.
    - **Calibrated 1:1 Effective Power Baseline:** Explains live calibrated historical pace derived from SpacetimeDB action deltas alongside theoretical baseline scaling ($1\text{ Power} = 1.0\text{ effort / action}$, replacing the legacy 5x tier multiplier).

14. **Profession Level Stat Increases (v1.7.0) & Missing Server XP Baseline Fix (v1.7.1):**
    - **Authoritative CSV Ingestion (`BitcraftLevelStatIncreases.csv`):** Compiles cumulative stat progressions across all levels 1 to 110 for all 12 crafting and gathering professions (Forestry, Carpentry, Masonry, Mining, Smithing, Scholar, Leatherworking, Hunting, Tailoring, Farming, Fishing, Foraging).
    - **Strict Adventuring Skill Exclusion:** Explicitly excludes non-profession / adventuring abilities (Cooking, Construction, Taming, Slayer, Merchanting, Sailing, Hexite Gathering) from receiving level stat bonuses.
    - **Cumulative Power Bonus:** Adds cumulative level power increases (+1 Power every 10 levels up to level 95, and +1 Power per level from 101 to 110, e.g. +7 Power at Level 72 Forestry, +8 Power at Level 78) directly into total effective power and effort pace.
    - **Cumulative Speed Multiplier:** Ingests +0.1 speed increases per even level (up to +500% / 5.0x speed at level 100) into action duration pacing.
    - **Smart Craft & Tool Baseline Floor (v1.7.1 Fix):** When `player.experience` is unpopulated/null from the server, automatically infers the skill level by taking the **higher requirement** between the station's craft level and the equipped tool's tier (e.g. using a Tier 7 tool on a Tier 5 station floors to Level 70; crafting a Level 60 recipe with a Tier 5 tool floors to Level 60).
    - **Inferred Skill Level & Milestone Accuracy Notices (v1.7.1 Fix):** Transparently alerts users in the **Recipe Banner** (`Lvl 70 (Inferred ℹ️)`), the **Power Breakdown Popover**, and the **Level Projection Panel** with an explicit notice explaining that BitJita experience was unpopulated, starting XP was baselined at 0 XP, and milestones/ETAs are baseline estimates unless customized.
    - **Interactive Skill Level Customizer & `localStorage` Persistence (v1.7.1 Fix):** Click any skill level badge in the **Character Skills Overview** or the **Active Craft Recipe Banner** to edit your exact level (`1–110`). Custom levels persist per player in `localStorage`, update all power/speed/crit formulas immediately, and feature a 1-click reset to server data.
    - **Transparent Popover Display:** Features an itemized `Profession Level Stat Bonus` row in the Power Breakdown Popover detailing exact Power, Speed, and Crit contributions at all levels (including `+0 Power • Next +1 Power at Level 5` for lower tiers).

15. **Auto-Deployment Version Detection & Toast Notification (v1.3.3):**
    - **Background Manifest Polling:** Periodically checks `/version.json` with cache-busting headers on tab focus and background intervals.
    - **Interactive Update Toast:** Displays a floating alert (`🚀 New Version Available! (vX.X.X)`) with a 30-second auto-reload countdown (pauses on hover) and instant `[ Reload Now ]` / `[ Later ]` controls.
    - **Stale Chunk Preload Trap:** Listens for Vite dynamic chunk errors (`vite:preloadError`) to automatically reload stale sessions after new server deployments.

16. **Real-Time Rolling XP Rates & Outlier Filtering (v1.4.0):**
    - **Dedicated Hourly XP Rates Grid Card:** Features side-by-side metric display with Theoretical Max Rate on top and Live Measured Speed on the bottom.
    - **Active Snapshot Tracking Engine:** Computes measured speed directly from real action progress deltas ($\Delta \text{progress} \times \text{effectiveXpPerAction}$) across verified polling intervals, eliminating database synchronization delays and idle clock decay.
    - **Catch-Up & Outlier Filter:** Automatically detects and clamps SpacetimeDB database backlog flushes to a plausible ceiling (max 125% of theoretical speed), preventing multi-action spikes from distorting speed graphs and peak stats.

17. **Dual Trendline HUD & SVG Interactive Popover (v1.4.0):**
    - **Dual Curve Visualization:** Plots Live Measured Rate (solid indigo spline with area gradient) against the Theoretical Ceiling (dashed emerald line reflecting mid-flight food buff or tool changes) on the exact same coordinate system.
    - **Y-Axis Metric Scale:** Clear left-column XP/hr labels (`200k`, `150k`, `100k`, `50k`, `0`) with horizontal guidelines for effortless visual gauging.
    - **Interactive Hover Crosshair:** Real-time scrubber inspecting historical timestamps, live speed, theoretical speed, and efficiency percentage.
    - **Session HUD Matrix:** Summarizes Current Live, Theoretical, Session Peak, and Session Total XP gained with persistent `sessionStorage`.

18. **Privacy Coordinate Resilience & Smart Station Switching (v1.4.0):**
    - **BitJita Privacy Fallback:** Ingests active region IDs from `/players/{id}/buffs` when public player coordinates are masked, ensuring uninterrupted regional scans.
    - **Owned Craft Priority:** Automatically detects when a player starts an owned craft and immediately prioritizes it over any previously viewed helper station.

19. **Multi-Helper Isolation & Profession Skill Speed Calibration (v1.4.1):**
    - **Multi-Helper Progress Isolation:** Isolate personal contributed progress on collaborative stations from other players' actions, preventing multi-helper progress bundling.
    - **Profession Skill Speed Multipliers:** Ingests character profession skill level speed bonuses (SpacetimeDB stats 21–33) alongside general crafting speed (Stat 15), matching exact in-game action durations (e.g. 1.13s) and closing theoretical vs. live calibration to $\approx 100\%$.
    - **Live API Status & Reset Session Wiring:** Subscribed `App.tsx` directly to live API client status events, wired the popover `[ 🔄 Reset ]` button, and enabled immediate un-cached refresh upon clearing the API cache.

18. **Persistent Item Metadata Caching & Catalog Auto-Fetch (v1.4.2):**
    - **Metadata Retention Across Polls:** Preserves and merges discovered item & cargo metadata across background poll cycles instead of wiping cache when viewing assisted crafts.
    - **Catalog Auto-Fetch Fallback:** Automatically queries `/api/items/{id}` or `/api/cargos/{id}` if an active craft item is ever missing from memory, guaranteeing item names, tiers, and icons remain visible.

19. **Point-in-Time Dynamic Theoretical Rate Curve & Modifier Logging (v1.5.0):**
    - **Historical Point-in-Time Theoretical Ceiling:** Every historical data point permanently records the exact theoretical rate at that specific second, plotting a true stepped curve across gear changes, food buff expirations, or tool swaps rather than a static horizontal line.
    - **Instant Modifier Transition Capture:** Immediately registers timeline event transitions whenever modifiers change, even while resting or paused for stamina.
    - **Point-by-Point Efficiency Scrubber:** Interactive hover scrubber displays the exact historical theoretical target and individual point efficiency percentage for every recorded moment in the timeline.

20. **Uniform Rate Badge Alignment & Full Width Stacking (v1.5.1):**
    - **Fixed Column Width Badges:** Standardized right-side status badges (`Theoretical` and `Live X%`) with fixed column widths (`w-[82px] shrink-0 text-center`), ensuring vertical alignment remains flush regardless of single, double, or triple-digit efficiency values.
    - **Border & Padding Standardization:** Cleaned up internal padding and negative margins in the hourly rate card for consistent spacing and alignment.

21. **Food Buff Override, Interactive Speed Breakdown Popover & True Equipment Ground-Truth (v1.6.0):**
    - **Food Buff Override & Resilience System:** Allows active food buffs to be applied directly in calculations with 1-click presets (`🥧 +9.4% (60m)`, `🍞 +8.2% (30m)`, `🍲 +4.2% (30m)`, `🌟 +10% & +5% XP`, `📜 +5% XP (30m)`) or customizable food/XP inputs even when BitJita's SpacetimeDB ingestor drops or delays player buff table syncs.
    - **Interactive Speed Breakdown Popover:** Interactive floating hover card on all Speed badges exposing the complete formula ($1.60\text{s} \div \text{Total Multiplier} = \text{Action Duration}$) and itemized contributor hierarchy across Base Station (`1.000x`), individual equipped clothing pieces/rings (`+28.4%`), active food buffs (`+9.4%`), and profession skill speed.
    - **True Ground-Truth Equipment Engine:** Calculates gear bonuses directly from all individual equipped pieces, preventing double-counting when SpacetimeDB composite stats have food buffs baked into server stat #15.
    - **Full Debuff & Negative Value Support:** Fully supports negative speed and XP rate overrides (e.g. `-20%` speed or `-10%` XP) for exhaustion, encumbrance, or rez sickness with dedicated red debuff styling.

22. **Resilient Profession Skill Speed & Craft Station Hydration (v1.6.1):**
    - **Offline-Resilient Profession Speed Engine:** Computes exact profession skill speed bonuses directly from verified player skill levels ($+0.05\%$ speed per level, e.g. $+3.6\%$ at Level 72 Carpentry) when BitJita's SpacetimeDB server stats table is unreachable or 404s.
    - **Full Craft Station Hydration:** Automatically hydrates incomplete craft records from station names (*Ornate Carpentry Station* $\to$ Carpentry) and level requirement skill IDs, ensuring profession-specific speed bonuses are applied accurately on all owned and assisted crafts.

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
