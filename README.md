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
- **Self-Correcting Live XP Sync Bridge:** Compensates for BitJita `/api/players/{id}` experience lag and partial/delayed XP trickles while actively crafting by tracking a per-`(player, skill, craft)` anchor in `sessionStorage` (`bitcraft_live_xp_anchor_*`). Observed craft contribution deltas automatically advance Current Level, Level Power/Speed bonuses, and keep Projected Final Level stable instead of shrinking. Partial BitJita trickles smoothly drain the remaining lag without ever dropping your level backward, and the anchor automatically resets once BitJita fully catches up (`serverXp >= expectedXp`) so XP is never double-counted. For cold-start mid-craft page loads, offers an explicit 1-click **"Include prior craft XP"** toggle (with instant revert and automatic reset upon full BitJita catch-up).
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
- **Cumulative Power, Speed, and Crit Bonuses:** Applies cumulative level power increases (+1 Power every 10 levels up to level 95, and +1 Power per level from 101 to 110) and speed increases (+0.1% speed per even level, up to +5.0% at level 100).
- **Adventuring Skill Exclusion:** Excludes non-profession / adventuring abilities (Cooking, Construction, Taming, Slayer, Merchanting, Sailing, Hexite Gathering) from receiving level stat bonuses.
- **Smart Baseline Level Floor:** When server experience data is unpopulated, infers the skill level using the higher requirement between the station craft level and the equipped tool's tier.
- **Inferred Level Transparency:** Highlights when skill levels are estimated from equipment/station requirements and notes that milestone projections measure from baseline XP.
- **Click-to-Edit Skill Level Customizer (Live-Advancing Mid-Craft Overrides):** Click any skill badge in the header or the Character Skills Overview to edit character levels (`1–110`). Custom levels persist in `localStorage` with a 1-click reset to server data. When set during an active craft where you have verified contributions, the override anchors to your current craft progress so it continues advancing live as you earn more XP and automatically clears once BitJita's server XP catches up past it.

### 6. Real-Time Rolling XP Rates & Trendline HUD
- **Side-by-Side Hourly Rates:** Displays Theoretical Maximum Rate alongside Live Measured Rate derived from active SpacetimeDB action deltas.
- **Outlier Clamping:** Automatically filters SpacetimeDB database backlog flushes to prevent multi-action spikes from distorting graphs.
- **Interactive SVG Trendline Graph:** Plots live measured rates (solid spline with gradient fill) against the theoretical ceiling (dashed stepped line).
- **Hover Scrubber:** Inspects historical timestamps, instantaneous speed, and efficiency percentages across timeline events.
- **Session HUD Summary:** Tracks Current Live, Theoretical, Session Peak, and Session Total XP gained with persistent `sessionStorage`.

### 7. Multi-User Collaborative Crafting & Contributor Projections
- **Dynamic Activity Detection:** Tracks live contributor recency (`🔥 Currently Crafting`, `Active Participant`, `Idle / Left`).
- **Authoritative Helper Power & Unified Speed:** Enriches up to 5 active non-primary helpers with `/players/{id}/tools` and `/players/{id}` (with HTTP `429` circuit-breaker protection) to calculate exact tool + profession level power, filter cross-profession gear stats, ignore expired food buffs lingering in stale `/stats` (`stat15`), and apply `+1` station-initiation off-by-one correction on historical fallbacks.
- **Compounded Team Speed:** Combines the effort-per-second rates of all active participants to compute collaborative station completion times.
- **Time Saved Metrics:** Displays projected finish ETAs alongside solo duration baselines, estimated future hours saved, past work saved, and total project savings.
- **XP Share Distribution:** Accurately distributes remaining craft effort and expected XP according to each participant's relative crafting speed and gear buffs.
- **Simulation Toggles:** Check or uncheck any contributor to simulate team compositions on shared or public crafting stations.

### 8. Spatial Proximity, Helper Station Tracking & Active XP Auto-Switching
- **Bidirectional Active Skill XP Auto-Switching:** Automatically detects when a player gains skill XP on a shared/helper station and switches focus immediately (e.g. tailoring at another player's station while owning an idle cooking station).
- **Owned Station Immunity & Personal XP Isolation:** Retains focus on active helper stations even if third parties work on owned stations, only returning to owned stations when the player physically gains XP on their own craft.
- **2D World Coordinate Tracking:** Ingests character coordinates and region to detect all active crafting stations within interaction distance ($\le 500\text{m}$).
- **Automatic Helper Station Tabs:** Identifies stations where the player has contributed effort and pins a prominent **`⭐ Helping: Station (Item Name)`** tab directly to the dashboard.
- **Active Task Rollover, Bounded LRU Tracking & Automatic Stale Craft Pruning:** Automatically transitions to new crafts or helper stations when a tracked craft finishes, and automatically prunes completed or BitJita-purged (`HTTP 404`) craft IDs from `localStorage` (`bitcraft_assisted_crafts_<entityId>`). Tracked shared crafts are capped at the 20 most recent LRU entries per character (with automatic legacy trimming on startup, owned crafts excluded from redundant tracking, a strict `≤ 5` background `GET /crafts/{id}` verification budget per poll, an automatic HTTP `429` circuit breaker, and a 1-click **Clear Tracked** action in `PublicCraftsModal`) so switching alts never triggers API request storms.
- **Nearby Station Dropdown Drawer:** Tucks idle claim stations into a compact menu to keep the dashboard clean.

### 9. Public Crafts Explorer & BitCraftMap Integration
- Search and inspect global in-progress crafts across the realm to test character stats and hypothetical XP gains.
- **Direct BitCraftMap Links:** Station claim coordinates link directly to **[BitCraftMap.com](https://bitcraftmap.com)** (`/?center=X%2CZ&zoom=1.0`).
- **Collapsible Profession Groups:** Categorized into alphabetical profession accordions with stations ordered by required skill level (Highest ➔ Lowest).
- **3-Tier Filter Controls:** Full-width search, Region & Profession dropdowns, dynamic quick filters, and a **2-point Item Tier Range Slider (`T1 – T10`)**.
- **Track / Untrack Management:** Pin or unpin public stations (`⭐ Tracked Station`) with instant `localStorage` synchronization and automatic removal when stations complete or expire (`HTTP 404`).

### 10. Equipment, Buffs & Debuff Engine
- **Item & Cargo Resolution:** Unified metadata resolution for both standard inventory items and heavy cargo items.
- **Interactive Speed Breakdown Popover:** Floating hover card displaying the complete speed calculation formula ($1.60\text{s} \div \text{Total Multiplier} = \text{Action Duration}$) and itemized gear hierarchy.
- **Food Buff Override & Resilience:** Apply food buffs directly with 1-click presets or custom inputs when server buff tables lag.
- **Active Buff Timers:** Live countdown timers with expiration warnings (< 2 minutes).

### 11. In-Memory Cache Inspector & Server Data Health Diagnostics
- **Dual-Tab Inspector Popover:** Hover or click the header's `Cache` indicator to open the interactive cache and data health dashboard.
- **Categorized URL Path Feeds:** Live inspection of all in-memory endpoints partitioned into Character & Equipment, Crafting & Contributions, Items & Cargo Metadata, and Master Catalogs.
- **Real-Time Timestamps & Expiration:** Real-time age timers (`Fetched 4s ago`), TTL countdowns (`Expires in 16s` or `1h Static TTL`), and expired status tags.
- **Server Data Health Anomaly Tracker:** Automatically logs null/empty SpacetimeDB arrays (e.g. `experience: null`), missing stats tables, rate limits, and network errors with itemized diagnostic cards explaining active fallbacks. Automatically clears anomalies and evicts cache entries when completed or purged (`HTTP 404`) crafts are retired.
- **Granular Eviction & Retry:** 1-click individual endpoint cache eviction (`✕`) and single-URL retry buttons (`[ 🔄 Retry Endpoint ]`) alongside global cache flushing.
- **Browser Diagnostics & Bug Report Exporter:** Click **Diagnostics** from the Cache Inspector popover, the page footer, or the crash recovery screen (`ErrorBoundary`) to preview, optionally anonymize character names/IDs, copy to clipboard (Markdown or raw JSON), or download a 100% local diagnostic snapshot containing app version, API health, compacted allowlisted `bitcraft_*` storage, live craft calculation/speed/power breakdowns, server speed stat telemetry, and a bounded ring buffer of recent runtime/API events.

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
| **`GET /api/crafts?completed=false&region_id={r}`** | GET | **120s** (2m) | Nearby stations within 500m ranked by distance | Cached across background polls; force-refreshed on player movement, region change, or manual Refresh; serves stale cache with 120s cooldown (`stale_fallback`) on upstream timeouts |
| **`GET /api/crafts/{craftId}`** | GET | **10s** | Single crafting station details & progress state | Bypassed on custom craft selection (`forceFresh=true`); auto-retired & pruned on completion or HTTP `404` |
| **`GET /api/crafts/{craftId}/contributions`** | GET | **15s** | Real-time action ticks, progress deltas, and helpers | Bypassed on poll cycle to calculate live action speed; auto-retired & pruned on HTTP `404` |
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

- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons, native `<dialog>` top-layer modals, and a top-level `ErrorBoundary`
- **Build & Lint Tooling:** Vite 6 (emitting `version.json` cleanly during production builds), ESLint 9 flat config (`npm run lint`), and proxy support for `https://bitjita.com`
- **Testing:** Vitest 5 with JSDOM test runner
- **Container Security:** Multi-stage Docker build serving via unprivileged, non-root `nginxinc/nginx-unprivileged:1.27-alpine` on port `8080`, hardened with read-only rootfs, dropped capabilities, rate-limited `GET`/`HEAD`-only `/api/` reverse proxy, and strict CSP/security headers on every route

---

## 🚀 Getting Started

### Prerequisites
- Node.js (`>=22.0.0`, Node 24 LTS recommended)
- npm

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

### Running Linter, Version Check & Unit Tests
```bash
npm run lint
npm run version:check
npm run test:run
```

### Bumping Project Version
Keep `package.json`, `package-lock.json`, `client-side-only/browser-extension/manifest.json`, and `nginx.conf` synchronized in one command:
```bash
npm run version:bump -- patch --dry-run   # preview next patch version
npm run version:bump -- patch             # apply patch | minor | major | X.Y.Z
```

### Production Web Build
```bash
npm run build
npm run preview
```

### Docker Deployment (Non-Root Containerized Nginx Reverse Proxy)

The container runs as the unprivileged `nginx` user (UID `101`) listening on port **`8080`**, adhering to the principle of least privilege.

#### Option A: Pull & Run Official Image (GitHub Container Registry)
```bash
# Pull and run the pre-built multi-arch image (no login required)
docker run -d \
  -p 8080:8080 \
  --read-only \
  --cap-drop=ALL \
  --security-opt=no-new-privileges:true \
  --tmpfs /tmp \
  --tmpfs /var/cache/nginx \
  --name bitcraft-xp-calc \
  --restart unless-stopped \
  ghcr.io/jhartnell/bitcraft-xp-calc:latest
```

#### Option B: Run with Docker Compose
```bash
# Pulls published image or builds locally with hardened least-privilege flags
docker compose up -d
```

#### Option C: Build from Source
```bash
docker build -t bitcraft-xp-calc:latest .
docker run -d -p 8080:8080 --read-only --cap-drop=ALL --security-opt=no-new-privileges:true --tmpfs /tmp --tmpfs /var/cache/nginx --name bitcraft-xp-calc bitcraft-xp-calc:latest
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

#### Option D: Push to a Custom Registry
```bash
DOCKER_REGISTRY=ghcr.io/your-username ./builddocker.sh
```
Set `PUSH_IMAGE=false` to build and tag locally without pushing.

### Browser Extension Build (Zero-Hosting Client Distribution)
```bash
npm run build:extension
```
Load the unpacked extension in Chrome/Edge at `client-side-only/browser-extension/dist` (see [`client-side-only/README.md`](client-side-only/README.md)), or download a pre-packaged `bitcraft-xp-calc-extension-vX.Y.Z.zip` (with `SHA256SUMS.txt`) from the [GitHub Releases](https://github.com/jhartnell/bitcraft-xp-calc/releases) page.

### Automated CI/CD & GitHub Releases
Pushing a semantic version tag (`v*.*.*`) triggers [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml) with strict per-job least-privilege permissions (`permissions: {}` at workflow root):
1. **`test` (`contents: read`):** Runs `npm run lint`, `npm run test:run`, `npm run build`, and `npm run build:extension`.
2. **`docker` (`contents: read`, `packages: write`):** Builds and publishes multi-arch (`linux/amd64`, `linux/arm64`) non-root Nginx images to GHCR (`ghcr.io/jhartnell/bitcraft-xp-calc`).
3. **`release` (`contents: write`, tag pushes only):** Extracts the matching `## [X.Y.Z]` section from [`CHANGELOG.md`](CHANGELOG.md) via [`scripts/extract-release-notes.mjs`](scripts/extract-release-notes.mjs) (falling back to GitHub's `--generate-notes`), packages `bitcraft-xp-calc-extension-vX.Y.Z.zip` with `SHA256SUMS.txt`, and publishes the GitHub Release using the built-in `gh` CLI (pre-releases detected automatically for tags containing `-`).

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
