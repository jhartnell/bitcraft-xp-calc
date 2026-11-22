# Changelog

All notable changes to the **BitCraft Online XP Calculator** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.10.1] - 2026-11-22

### Fixed
- **Authoritative Tool Power ETA Accuracy (`contributionCount` Off-by-One):** Fixed `calculateCraftXp` (and `calculateMultiUserCraftProjection`) so authoritative tool power from `/players/{id}/tools` or enriched equipment + profession level power takes precedence over BitJita's historical `totalProgressContributed / contributionCount` ratio, eliminating the systematic off-by-one (`+1`) underestimation (e.g. `16.9` vs `17` effort/action) that made Time Remaining read slower than in-game. Historical contribution rate remains the fallback when tool power metadata is unavailable.
- **Server Crafting Speed (`stats.values[15]`) Reconciliation:** Fixed `xpCalculator.ts` so server crafting speed stat `#15` is no longer discarded when only non-speed gear (e.g. stamina/power) is equipped, while subtracting active server buff speed to prevent double-counting.
- **Faster Active Craft Poll Updates:** Prioritized fetching owned active craft contributions and merging owned craft metadata immediately in `usePlayerDashboardData` instead of waiting behind nearby station sweeps.

### Changed
- **Richer & More Compact Diagnostics Snapshots:** Added `speedBreakdown`, `effectivePower`, `isMeasuredProgressPerAction`, server speed stats (`stat15` & profession stat), and active `userContribution` to browser diagnostics, and compacted large `bitcraft_assisted_crafts_*` arrays and `sessionStorageKeys` lists for clean Discord/GitHub pasting.

---

## [1.10.0] - 2026-11-21

### Added
- **Browser Diagnostics & Bug Report Exporter:** Added a 100% local, privacy-safe diagnostics collector (`src/services/diagnosticsCollector.ts` + bounded ring buffer in `src/services/diagnosticsBuffer.ts`) and native `<dialog>` `DiagnosticsModal` accessible from the Cache Inspector popover, the page footer, and the `ErrorBoundary` crash screen (`Copy Crash Diagnostics`). Captures app version, browser environment, live player/craft/calculation state, BitJita API cache & anomaly health, strictly allowlisted `bitcraft_*` storage, and recent runtime/API/crash events, with 1-click Copy to Clipboard (Markdown or Raw JSON), Download `.json`, and optional character/ID anonymization.
- **Automated GitHub Releases Pipeline:** Added a gated, least-privilege `release` job (`contents: write` only, running after `test` and `docker` succeed) to `.github/workflows/docker-publish.yml` using the preinstalled `gh` CLI (no third-party release actions). On every `v*.*.*` tag push, it extracts the matching release notes from `CHANGELOG.md` via `scripts/extract-release-notes.mjs` (falling back to `--generate-notes`), builds and zips the browser extension (`bitcraft-xp-calc-extension-vX.Y.Z.zip`), generates `SHA256SUMS.txt`, and publishes the GitHub Release.

### Fixed
- **API Active Request Counter Reset:** Fixed `PoliteApiClient.fetchWithCache` so `notifyStatus()` runs after deleting the completed request from `activeRequests`, ensuring `activeRequestsCount` cleanly returns to `0` when idle.

---

## [1.9.1] - 2026-11-21

### Fixed
- **Automatic Pruning of Completed & Expired (`404`) Tracked Crafts:** In long-running browser sessions, crafts that complete and are later removed from BitJita's database are now automatically pruned from `localStorage` (`bitcraft_assisted_crafts_<entityId>`) whenever `/crafts/{id}` or `/crafts/{id}/contributions` returns HTTP `404` or when a craft is reported as completed (`!isCraftOngoing`). Transient server errors (`500`, `429`, network failures) do not prune tracked crafts.
- **Self-Cleaning Cache Inspector for Retired Crafts:** Added typed `ApiHttpError` (`status`, `statusText`, `endpoint`) and `bitjitaApi.retireCraft(craftId)` so retired crafts are evicted from in-memory cache and their `404` anomalies are automatically cleared from the Cache Inspector popover instead of persisting across polling cycles.
- **Shared Assisted Crafts Storage Sync:** Extracted `src/services/assistedCraftsStorage.ts` so background pruning in `usePlayerDashboardData` is immediately reflected when reopening `PublicCraftsModal`, and empty tracking lists cleanly remove their `localStorage` key.

---

## [1.9.0] - 2026-11-21

### Security
- **Non-Root Least-Privilege Docker Runtime:** Switched runtime image to `nginxinc/nginx-unprivileged:1.27-alpine` listening on port `8080` as UID `101`, updated `docker-compose.yml` with `read_only: true`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, and tmpfs mounts, and removed unused extension files from the web Docker build stage.
- **Nginx Reverse Proxy & Header Hardening:** Added shared `nginx-security-headers.conf` (strict `Content-Security-Policy`, `Permissions-Policy`, `Referrer-Policy`, `X-Frame-Options`, `X-Content-Type-Options`) included across all `location` blocks to prevent Nginx `add_header` inheritance drops; restricted `/api/` to `GET`/`HEAD` only with `limit_req` throttling, TLS upstream verification, `server_tokens off;`, and removed deprecated `X-XSS-Protection`.
- **CI/CD & Extension Least Privilege:** Scoped GitHub Actions permissions per job (`contents: read` for `test`, `packages: write` only for `docker`) with `persist-credentials: false`; narrowed Chrome Extension `host_permissions` to `https://bitjita.com/api/*`; added sender ID/payload validation, `AbortSignal.timeout`, and `encodeURIComponent` URL encoding in `apiClient.ts` and `background.js`; parameterized `builddocker.sh` via `DOCKER_REGISTRY` with `set -euo pipefail`.
- **Dependency CVE Remediation:** Upgraded `vite` (`6.4.6`), `vitest` (`5.1.1`), and transitive dependencies (`postcss-selector-parser`, `source-map-js`, `tinypool`, `@vitest/mocker`) to resolve all 6 `npm audit` vulnerabilities (0 remaining), and moved `tailwindcss` to `devDependencies`.

### Fixed
- **Public Craft Analysis vs. Verified Helping Distinction:** Fixed an issue where previewing/analyzing a public craft assumed the character was actively helping on it. Unverified public crafts now show **`Analyzing:`** / **`Analyzing Public Craft (Not Contributing)`** with an **Exit preview** button instead of **`Helping:`**, require verified `totalProgressContributed > 0` craft-matched contributions (`isPlayerVerifiedContributor`) to be marked as helping, are no longer auto-saved into `bitcraft_assisted_crafts_`, are excluded from both `active_xp_match_shared` and `fallback_shared` auto-selection unless verified, do not claim "helper time already saved" in `ContributorsPanel` for non-contributing previews, and do not feed other players' progress into the character's live Session XP tracker.
- **Single Authoritative Polling Loop:** Removed duplicate auto-refresh trigger and state-updater side effect in `RefreshControls`; countdown is now purely derived from `nextRefreshAt`.
- **Welcome Screen Sample Players:** Sample player quick-start buttons now resolve real `entityId`s via `bitjitaApi.searchPlayers` instead of passing empty IDs.
- **Chrome Extension Background Sync Bridge:** Connected `usePersistentPreferences` primary player pinning directly to `chrome.runtime.sendMessage({ type: 'SYNC_PRIMARY_PLAYER' })`, enabling live toolbar badge tracking (`%` / `IDLE`).
- **XP & Contributor Calculations:** Fixed primary participant `equippedToolTier` (previously mapped to `effectivePower`), fixed max-level (120) milestone guard, fixed `physicalActionsRemaining` rounding (`Math.ceil(remainingProgress / progressPerAction)`), prevented double-counting food XP overrides with server stat `#50`, and included profession speed + stat `#50` for non-primary contributors.
- **Async Race Conditions & Performance:** Added request-generation guards in `usePlayerDashboardData` and `PlayerSearch`, removed redundant per-poll equipment `getItem` re-enrichment, fixed in-place cache mutation in `getPlayerEquipment`, parallelized nearby craft contribution lookups, batched `itemMetadataMap` updates, added bounded cache eviction & 15s fetch timeouts in `PoliteApiClient`, and scoped `bitjitaApi.subscribe` to `Header` to avoid full-app re-renders.
- **Build & UI Polish:** Emitted `version.json` via Vite `generateBundle` (preventing `public/version.json` git churn), added `public/favicon.svg`, removed stale `1.8.4` fallback strings, fixed `document` `visibilitychange` listener and skipped version polling in extension contexts, fixed `useHoverPopoverState` timer cleanup, synced `effortInput` on edit open, and replaced dead `tailwindcss-animate` classes with working CSS keyframes (`prefers-reduced-motion` aware).

### Changed
- **Architecture & Accessibility:** Decomposed `App.tsx` into `usePersistentPreferences` and `usePlayerDashboardData`, split `xpCalculator.ts` into `toolMatching.ts`, `levelForecast.ts`, and `multiUserProjection.ts`, added a top-level `ErrorBoundary`, upgraded `PublicCraftsModal` to a native `<dialog>` with `closedby="any"` + Safari light-dismiss fallback, upgraded popovers to keyboard/touch-accessible button triggers with Escape dismissal, and added ESLint 9 (`npm run lint`).

---

## [1.8.5] - 2026-09-04

### Fixed
- **Bidirectional Active Skill XP Auto-Switching:** Implemented unified multi-source craft candidate resolution in `resolveActiveCraftSelection`, allowing the app to automatically detect when a player gains XP on shared/helper crafting stations (e.g. Niomore working on SPancerfaustyna's Tailoring Station while owning an idle Cooking Station) and immediately switch focus to the active shared station.
- **Owned Station Immunity & Personal XP Isolation:** Retains focus on the active helper station even when third-party contributors progress an owned station, only returning to owned stations when the player physically gains XP on their own craft.
- **Multi-Source Candidate Resolution:** Aggregates owned active crafts, nearby claim stations within 500m, and tracked assisted craft history (`localStorage`) before evaluating skill XP deltas, eliminating async race conditions and UI flickering.
- **Robust Tool & Station Skill Extraction:** Canonical `getCraftSkillId` extracts skill associations across recipe experience, level requirements, `toolRequirements` (mapping `tool_type` through `TOOL_TYPE_TO_SKILL_ID`), and station building names.

---

## [1.8.4] - 2026-09-04

### Fixed
- **XP-Driven Active Craft Tracking & Helper Persistence:** Fixed an issue where the calculator would forcibly reset back to a player's owned craft every 30 seconds during background data polling, even when actively helping with a shared community craft (e.g. Niomore on SPancerfaustyna's Tailoring Station).
- **Player-Specific Contribution Isolation:** Distinguishes between progress made by *this player* vs other contributors. Third-party progress on owned stations will no longer hijack active craft focus away from the shared station the player is assisting on.
- **Skill Experience Delta Tracking:** Automatically detects when a player switches between stations by monitoring `player.experience` gains and personal contribution increases across polling cycles.
- **Seamless Station Tabs Header:** Active assisted/helper stations are rendered directly in the header tabs alongside owned crafts (`[My Craft #1]` and `[Helping: <StationName>]`), allowing 1-click manual switching at any time.

---

## [1.8.3] - 2026-08-31

### Fixed
- **Authoritative BitJita Canonical Level Curve:** Integrated official 120-level dataset from `https://bitjita.com/static/experience/levels.json`, ensuring 100% mathematically exact level thresholds and progression deltas across all professions (resolving Level 80+ calculation discrepancies).
- **In-Level Progress & Remaining XP Tracking:** Added detailed in-level metrics (`2,054 / 2,974,820 XP (0.1%)`) and explicit remaining XP display (`• 2,972,766 XP left to Lvl 81`) alongside lifetime XP totals in the Level Projection Card.
- **25% Interval Tick Marks & Percentage Scales:** Introduced clean vertical divider tick marks at 25%, 50%, and 75% with a monospace percentage scale on Level Progression bars, Projected Outcome bars, and Craft Station completion bars via reusable `ProgressBarWithTicks` component.
- **Skill Card Tooltip Metrics:** Enriched skill cards in the 20-skill matrix with exact in-level progress and remaining XP on hover.

---

## [1.8.2] - 2026-08-30

### Fixed
- **Self-Healing Anomaly Diagnostics:** Automatically clears logged endpoint anomalies from the Cache Inspector when a previously failed or unpopulated API endpoint (e.g. player experience, player stats, or network 429/500) successfully returns healthy data on subsequent polls or retries.

---

## [1.8.1] - 2026-08-30

### Fixed
- **Spatial Proximity & False 0m Distance Resolution:** Fixed the bug where distant or unindexed crafting stations from other regions (e.g. Region 19, Region 12) appeared at the top of the Nearby Stations (< 500m) list showing `0m away`.
- **Client-Side Region Verification:** Added strict client-side region verification (`c.regionId === regionId`) because BitJita's backend `/api/crafts?region_id={r}` returns crafts across all regions globally.
- **Strict Coordinate Validation:** Stations with missing or unindexed coordinates (`coords === null`) are excluded from proximity calculation so they no longer default to `0m`.
- **Multi-Path Player Coordinate Resolution:** Added multi-path resolution across `player.locationX`, `player.location.locationX`, `player.teleportLocationX`, and fallback to the player's active craft station location.
- **Self-Healing Anomaly Diagnostics:** Automatically clears logged endpoint anomalies from the Cache Inspector when a previously failed or unpopulated API endpoint (e.g. player experience, player stats, or network 429/500) successfully returns healthy data on subsequent polls or retries.

---

## [1.8.0] - 2026-08-30

### Added
- **BitJita In-Memory Cache Inspector:** Added an interactive dual-tab popover on the header's Cache indicator displaying all active in-memory URL endpoints categorized into Character & Equipment, Crafting & Contributions, Items & Cargo Metadata, and Master Catalogs.
- **Server Data Health & Anomaly Diagnostics:** Added real-time tracking for null/empty SpacetimeDB arrays (e.g. unpopulated player experience), missing tables, rate limit 429 events, and network errors with itemized diagnostic cards explaining active fallbacks.
- **Granular Endpoint Eviction & Retry:** Added 1-click single-endpoint eviction buttons (`✕`) and dedicated `[ 🔄 Retry Endpoint ]` triggers alongside global cache clearing.
- **Node 24 LTS Build Toolchain:** Upgraded multi-stage Docker build and GitHub Actions CI runner to modern **Node 24 LTS (`node:24-alpine`)**.

---

## [1.7.1] - 2026-08-30

### Fixed
- **Missing BitJita Player Experience Resolution:** Fixed calculation baselines when player experience arrays return `null` by automatically inferring the baseline level from the higher requirement between the crafting station requirement and the equipped tool's tier requirement.
- **Milestone Projection Transparency:** Added informational warning notices in the Recipe Banner, Level Progression Card, and Popovers explaining that milestones and ETAs are measured from the baseline level when server experience is unpopulated.
- **Skill Level Overrides:** Added persistent inline click-to-edit custom skill levels stored in `localStorage` with a 1-click reset to server data.

---

## [1.7.0] - 2026-08-30

### Added
- **Profession Level Stat Progression:** Ingested `BitcraftLevelStatIncreases.csv` adding cumulative level power, speed (+0.1 per even level), and crit chance increases across Levels 1–110 for all 12 crafting and gathering professions.
- **1:1 Effective Power Scaling:** Calibrated effort pace to $1\text{ Power} = 1.0\text{ effort / action}$, replacing the legacy 5x tier multiplier.
- **Power Breakdown Popover:** Added an interactive popover detailing itemized power contributions from Primary Tools, Charms, Instruments, and Profession Level Bonuses.
- **Adventuring Skill Exclusion:** Explicitly excluded non-profession abilities (Cooking, Construction, Taming, Slayer, Merchanting, Sailing, Hexite Gathering) from level stat bonuses.

---

## [1.6.2] - 2026-08-30

### Added
- **BitCraftMap.com Interactive Links:** Claim locations and coordinates in public craft cards link directly to `https://bitcraftmap.com`.
- **Public Crafts Organization:** Added collapsible profession accordions sorted alphabetically with stations ordered by required level (Highest ➔ Lowest).
- **Dual-Point Tier Range Slider:** Added 2-point slider (`T1 – T10`) and region-filtered station searching.

---

## [1.6.1] - 2026-08-29

### Added
- **Offline-Resilient Profession Speed Engine:** Computes exact profession skill speed bonuses directly from verified player skill levels ($+0.05\%$ speed per level) when the server stats table is unreachable.
- **Craft Station Hydration:** Automatically hydrates incomplete craft records from station names and level requirement skill IDs.

---

## [1.6.0] - 2026-08-28

### Added
- **Food Buff Override & Resilience System:** Allows active food buffs to be applied directly in calculations with 1-click presets or custom inputs when server buff tables lag.
- **Interactive Speed Breakdown Popover:** Floating hover card displaying complete speed calculation formulas ($1.60\text{s} \div \text{Total Multiplier}$) and gear hierarchy.
- **True Ground-Truth Equipment Engine:** Calculates gear bonuses directly from all individual equipped pieces, avoiding double-counting with composite server stats.

---

## [1.5.1] - 2026-08-28

### Fixed
- **Uniform Rate Badge Alignment:** Standardized right-side status badges with fixed column widths and cleaned up card padding.

---

## [1.5.0] - 2026-08-28

### Added
- **Point-in-Time Dynamic Theoretical Rate Curve:** Permanently records theoretical rates at each second to plot stepped curves across gear/buff transitions.
- **Point-by-Point Efficiency Scrubber:** Real-time hover scrubber for inspecting historical timestamps, live speed, and efficiency percentage.

---

## [1.4.2] - 2026-08-28

### Added
- **Persistent Item Metadata Caching:** Preserves and merges discovered item & cargo metadata across background poll cycles.
- **Catalog Auto-Fetch Fallback:** Queries `/api/items/{id}` or `/api/cargos/{id}` if active craft items are missing from cache.

---

## [1.4.1] - 2026-08-28

### Added
- **Multi-Helper Progress Isolation:** Isolates personal contributed progress on collaborative stations from other players' actions.
- **Profession Skill Speed Multipliers:** Ingests character profession skill level speed bonuses alongside general crafting speed.

---

## [1.4.0] - 2026-08-27

### Added
- **Real-Time Rolling XP Rates & Outlier Filtering:** Side-by-side metric display with Theoretical Max Rate and Live Measured Speed.
- **Dual Trendline HUD & SVG Interactive Popover:** Plots live measured rates against theoretical ceilings.
- **Privacy Coordinate Resilience:** Ingests active region IDs from buffs when coordinates are masked.

---

## [1.3.0] - [1.3.5] - 2026-08-27

### Added
- **Spatial Proximity & Automatic Task Rollover:** 2D world coordinate tracking detecting active stations within 500m.
- **Auto-Deployment Version Detection:** Background `/version.json` polling with update toast notifications.
- **Item & Cargo Metadata Resolution:** Unified resolution for both inventory and cargo items.

---

## [1.0.0] - [1.2.1] - 2026-08-26

### Added
- **Initial Release:** Real-time craft progress tracking, XP estimation, tool requirement checks, and collaborative multi-user crafting speedup calculations.
