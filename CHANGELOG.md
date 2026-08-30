# Changelog

All notable changes to the **BitCraft Online XP Calculator** project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
