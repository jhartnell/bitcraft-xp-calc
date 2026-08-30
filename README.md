# BitCraft Online XP Calculator

A high-performance, real-time web application to track active crafting progress, calculate expected Experience Points (XP), estimate completion times, and project skill level-ups for **Bitcraft Online** players using the [BitJita Developer API](https://bitjita.com/docs/api).

---

## 🌟 Features

### 1. Player Search & Multi-Character Management
- Real-time debounced character search with online/offline status indicators.
- Quick-switch character dropdown and recent player chip history saved in browser storage.
- Instant multi-character tracking for players managing active alts.

### 2. Active Craft Tracker & Station Discovery
- Automatically detects active, in-progress, and idle crafts on player-owned or shared stations.
- Detailed recipe inspection including Item Name, Tier, Rarity, Building Station, and Claim / Region location coordinates.
- Live progress indicators (`progress` / `totalProgressRequired`) and remaining item counters.
- Multi-craft navigation tabs when a player has multiple active crafts running concurrently.

### 3. Dynamic Level Progression & Milestone Roadmaps
- **Calibrated Level Curve:** Matches BitCraft's in-game exponential progression curve ($\text{delta}(L) = 500 + 520.26 \times (1.115732^{L-1} - 1)$) with exact lifetime cumulative tracking across Levels 1–110.
- **Immediate Next Level Countdown:** Computes exact time to ding (e.g. `Level 80 in ~1m 45s`).
- **Interactive Milestone Roadmap:** Clickable milestone pill that expands to show intermediate level milestones, craft completion % markers, and XP needed when gaining multiple levels on large crafts.
- Dual progress bars illustrating current skill level progression % vs. projected outcome upon craft completion.

### 4. Effort Pacing & Multi-Tier Tool Power System
- **1:1 Effective Power Scaling:** Calibrates effort pace to $1\text{ Power} = 1.0\text{ effort / action}$, matching live in-game mechanics.
- **Interactive Power Breakdown Popover:** Hover or click the effort pace to view an itemized breakdown of power contributions from Primary Hand Tools, Charms, Instruments, and Profession Level Bonuses.
- **Tool Tier & Rarity Recognition:** Enriches tools across all 10 material tiers (`Tier 1` to `Tier 10`) and 6 commonality grades (`Common` to `Mythic`).
- **Tool Compatibility Validation:** Verifies equipped hand tools against station requirements (e.g. Hammer vs. Axe) with clear status badges and extracted power ratings.

### 5. Profession Level Stat Increases & Overrides
- **Authoritative CSV Stat Ingestion:** Ingests cumulative stat progressions across all levels 1 to 110 for all 12 crafting and gathering professions (Forestry, Carpentry, Masonry, Mining, Smithing, Scholar, Leatherworking, Hunting, Tailoring, Farming, Fishing, Foraging).
- **Cumulative Power, Speed, and Crit Bonuses:** Applies cumulative level power increases (+1 Power every 10 levels up to level 95, and +1 Power per level from 101 to 110) and speed increases (+0.1 speed per even level, up to +500% at level 100).
- **Adventuring Skill Exclusion:** Excludes non-profession / adventuring abilities (Cooking, Construction, Taming, Slayer, Merchanting, Sailing, Hexite Gathering) from receiving level stat bonuses.
- **Smart Baseline Level Floor:** When server experience data is unpopulated, infers the skill level using the higher requirement between the station craft level and the equipped tool's tier.
- **Inferred Level Transparency:** Highlights when skill levels are estimated from equipment/station requirements and notes that milestone projections measure from baseline XP.
- **Click-to-Edit Skill Level Customizer:** Click any skill badge in the header or the Character Skills Overview to edit character levels (`1–110`). Custom levels persist in `localStorage` with a 1-click reset to server data.

### 6. Real-Time Rolling XP Rates & Trendline HUD
- **Side-by-Side Hourly Rates:** Displays Theoretical Maximum Rate alongside Live Measured Rate derived from active SpacetimeDB action deltas.
- **Outlier Clamping:** Automatically filters SpacetimeDB database backlog flushes to prevent multi-action spikes from distorting graphs.
- **Interactive SVG Trendline Graph:** Plots live measured rates (solid spline with gradient fill) against the theoretical ceiling (dashed stepped line).
- **Hover Scrubber:** Inspects historical timestamps, instantaneous speed, and efficiency percentages across timeline events.
- **Session HUD Summary:** Tracks Current Live, Theoretical, Session Peak, and Session Total XP gained with persistent `sessionStorage`.

### 7. Multi-User Collaborative Crafting & Contributor Projections
- **Dynamic Activity Detection:** Tracks live contributor recency (`🔥 Currently Crafting`, `Active Participant`, `Idle / Left`).
- **Compounded Team Speed:** Combines the effort-per-second rates of all active participants to compute collaborative station completion times.
- **Time Saved Metrics:** Displays projected finish ETAs alongside solo duration baselines, estimated future hours saved, past work saved, and total project savings.
- **XP Share Distribution:** Accurately distributes remaining craft effort and expected XP according to each participant's relative crafting speed and gear buffs.
- **Simulation Toggles:** Check or uncheck any contributor to simulate team compositions on shared or public crafting stations.

### 8. Spatial Proximity & Claim Auto-Discovery
- **2D World Coordinate Tracking:** Ingests character coordinates and region to detect all active crafting stations within interaction distance ($\le 500\text{m}$).
- **Automatic Helper Station Tabs:** Identifies stations where the player has contributed effort and pins a prominent **`⭐ Helping: Station (Item Name)`** tab directly to the dashboard.
- **Active Task Rollover:** Automatically transitions to new crafts or helper stations when a tracked craft finishes.
- **Nearby Station Dropdown Drawer:** Tucks idle claim stations into a compact menu to keep the dashboard clean.

### 9. Public Crafts Explorer & BitCraftMap Integration
- Search and inspect global in-progress crafts across the realm to test character stats and hypothetical XP gains.
- **Direct BitCraftMap Links:** Station claim coordinates link directly to **[BitCraftMap.com](https://bitcraftmap.com)** (`/?center=X%2CZ&zoom=1.0`).
- **Collapsible Profession Groups:** Categorized into alphabetical profession accordions with stations ordered by required skill level (Highest ➔ Lowest).
- **3-Tier Filter Controls:** Full-width search, Region & Profession dropdowns, dynamic quick filters, and a **2-point Item Tier Range Slider (`T1 – T10`)**.
- **Track / Untrack Management:** Pin or unpin public stations (`⭐ Tracked Station`) with instant `localStorage` synchronization.

### 10. Equipment, Buffs & Debuff Engine
- **Item & Cargo Resolution:** Unified metadata resolution for both standard inventory items and heavy cargo items.
- **Interactive Speed Breakdown Popover:** Floating hover card displaying the complete speed calculation formula ($1.60\text{s} \div \text{Total Multiplier} = \text{Action Duration}$) and itemized gear hierarchy.
- **Food Buff Override & Resilience:** Apply food buffs directly with 1-click presets or custom inputs when server buff tables lag.
- **Active Buff Timers:** Live countdown timers with expiration warnings (< 2 minutes).

### 11. In-Memory Cache Inspector & Server Data Health Diagnostics
- **Dual-Tab Inspector Popover:** Hover or click the header's `Cache` indicator to open the interactive cache and data health dashboard.
- **Categorized URL Path Feeds:** Live inspection of all in-memory endpoints partitioned into Character & Equipment, Crafting & Contributions, Items & Cargo Metadata, and Master Catalogs.
- **Real-Time Timestamps & Expiration:** Real-time age timers (`Fetched 4s ago`), TTL countdowns (`Expires in 16s` or `1h Static TTL`), and expired status tags.
- **Server Data Health Anomaly Tracker:** Automatically logs null/empty SpacetimeDB arrays (e.g. `experience: null`), missing stats tables, rate limits, and network errors with itemized diagnostic cards explaining active fallbacks.
- **Granular Eviction & Retry:** 1-click individual endpoint cache eviction (`✕`) and single-URL retry buttons (`[ 🔄 Retry Endpoint ]`) alongside global cache flushing.

---

## 📡 BitJita API Architecture & Caching Reference

All network requests to the **BitJita API** (`https://bitjita.com/api`) route through a polite singleton client ([`src/services/apiClient.ts`](src/services/apiClient.ts)), equipped with in-flight request deduplication, rate limiting, and tiered caching:

### 1. Endpoint & Caching Matrix

| Endpoint | Method | Caching TTL | Purpose | Cache Policy / Invalidation |
| :--- | :---: | :---: | :--- | :--- |
| **`GET /api/players?q={query}`** | GET | **60s** (1m) | Character search autocomplete | In-memory cache keyed by query string |
| **`GET /api/players/{id}`** | GET | **20s** | Character details, experience array, and coordinates | Bypassed on poll cycle / manual refresh (`forceFresh=true`) |
| **`GET /api/players/{id}/crafts?completed=all`** | GET | **10s** | Active, idle, and completed crafts | Bypassed on poll cycle; primes recipe XP cache |
| **`GET /api/players/{id}/equipment`** | GET | **15s** | 36 gear slots (tools, charms, instruments, armor) | Bypassed on poll cycle; parallel `getItem` enrichment |
| **`GET /api/players/{id}/tools`** | GET | **15s** | Tool registry (exact level & power across 15 skills) | Bypassed on poll cycle (`forceFresh=true`) |
| **`GET /api/players/{id}/buffs`** | GET | **15s** | Food, potion, wonder, and beacon modifiers | Bypassed on poll cycle (`forceFresh=true`) |
| **`GET /api/players/{id}/stats`** | GET | **30s** | SpacetimeDB stats registry (Stat #50 XP rate, #15 speed) | Bypassed on poll cycle (`forceFresh=true`) |
| **`GET /api/crafts?completed=false&limit=100`** | GET | **20s** | Public crafting stations search & recipe XP cache priming | Background seeded & modal search |
| **`GET /api/crafts?completed=false&region_id={r}`** | GET | **20s** | Nearby stations within 500m ranked by distance | Bypassed on poll cycle when player moves |
| **`GET /api/crafts/{craftId}`** | GET | **10s** | Single crafting station details & progress state | Bypassed on custom craft selection (`forceFresh=true`) |
| **`GET /api/crafts/{craftId}/contributions`** | GET | **15s** | Real-time action ticks, progress deltas, and helpers | Bypassed on poll cycle to calculate live action speed |
| **`GET /api/items/{itemId}`** | GET | **3,600s** (1h) | Static item metadata, toolStats, rarity, and stats | Long-lived static cache |
| **`GET /api/cargos/{cargoId}`** | GET | **3,600s** (1h) | Static cargo item metadata, tier, and stats | Long-lived static cache |
| **`GET /api/skills`** | GET | **3,600s** (1h) | Static skills and profession catalog | Long-lived static cache |

### 2. Politeness & Protection Engine
- **In-Flight Request Deduplication:** Merges concurrent requests for the exact same endpoint into a single network `Promise`, eliminating redundant requests.
- **120ms Queue Spacing:** Enforces a minimum 120ms spacing between outgoing requests to prevent burst load on BitJita.
- **Adaptive HTTP 429 Backoff:** Detects rate limits and doubles backoff interval (from 1,000ms up to 30,000ms), gradually decreasing on successful responses.
- **Dual Routing:** Reverse-proxies through Nginx (`/api/...`) for the Web App, and makes direct HTTPS requests in the Chrome Extension.

---

## 🛠️ Architecture & Tech Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Build Tool:** Vite with proxy support for `https://bitjita.com`
- **Testing:** Vitest with JSDOM test runner
- **Styling:** Dark fantasy aesthetic with glassmorphism and animated progress indicators

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
$$\text{Speed Multiplier } (M) = 1.0 + \sum \text{Equipment Bonuses} + \sum \text{Food Buffs / Debuffs} + \sum \text{Profession Skill Speed}$$
$$\text{Action Duration (Seconds)} = \frac{1.6\text{s}}{M}$$
$$\text{Estimated Time Remaining} = \text{Physical Actions Remaining} \times \text{Action Duration}$$

### 3. Total XP & Progress
$$\text{Total Craft XP} = \text{Total Effort Required} \times \text{baseXpPerAction} \times \text{xpMultiplier}$$
$$\text{Remaining XP} = \text{Remaining Effort} \times \text{baseXpPerAction} \times \text{xpMultiplier}$$

---

## 📜 Changelog

For a detailed history of all version releases, feature additions, and fixes, see [CHANGELOG.md](CHANGELOG.md).

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
