# BitCraft Online XP Calculator

🌐 **Live Deployment:** [https://xpcalc.adhocbasis.com/](https://xpcalc.adhocbasis.com/)

A high-performance, real-time web application to track active crafting progress, calculate expected Experience Points (XP), estimate time to completion, and project level-ups for **Bitcraft Online** players using the [BitJita Developer API](https://bitjita.com/docs/api).

---

## 🌟 Key Features

1. **Player Selection & Character Switcher:**
   - Real-time debounced character search with autocomplete and online/offline status indicators.
   - Quick-switch character dropdown and recent player chip history (persisted in local storage).
   - Instant multi-character management for players with active alts.

2. **Active Craft Tracker:**
   - Automatically detects in-progress crafts (`/api/players/{id}/crafts`).
   - Detailed recipe inspection (Item Name, Tier, Rarity, Building Station, and Claim / Region location coordinates).
   - Effort progress bar (`progress` / `totalProgressRequired`) and finished vs. remaining item counts.
   - Multi-craft navigation tabs when a player has multiple active crafts.

3. **Accurate Tool Mapping:**
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

4. **In-Game Calibrated Action Timing & Debuff Calculation:**
   - **Base Action Cycle (1.4s):** Uses BitCraft's actual 1.4-second base channel duration per crafting action.
   - **Food Debuff & Speed Modifiers:** Accurately accounts for negative Crafting Speed modifiers (e.g. food debuffs like $-11.5\%$ or $-20\%$ Crafting Speed, rez sickness, etc.) which lengthen action duration:
     $$\text{Action Duration} = \frac{1.4\text{s}}{\text{Total Crafting Speed Multiplier}}$$
   - **Server Stat Integration:** Directly ingests `player.stats.values[15]` when available from BitJita for exact server-calculated speed rates.
   - **Historical Contribution Detection:** Automatically calculates real-world progress-per-action rate ($\text{progress} \div \text{actions}$) from `/api/crafts/{id}/contributions`.

5. **Accurate XP & Progression Engine:**
   - **Total Craft XP:** `totalProgressRequired * baseXpPerAction * xpMultiplier`.
   - **XP Left to Gain:** `(totalProgressRequired - progress) * baseXpPerAction * xpMultiplier`.
   - **XP Already Earned:** `progress * baseXpPerAction * xpMultiplier`.
   - **Calibrated Level Curve:** Converts XP into BitCraft skill levels (1–110) with exact progress percentages and XP needed for the next level milestone.

6. **Equipment & Food Buff Modifiers:**
   - **Tool Compatibility Verification:** Inspects main-hand, off-hand, and profession charm slots to ensure required tool type, minimum level, and power tier are satisfied.
   - **Debuff Highlighting:** Visually distinguishes beneficial buffs from speed penalties.
   - **Active Buff Countdown:** Live countdown timers with expiration warnings (< 2 minutes).

7. **Polite API Architecture & Rate Limit Protection:**
   - **In-Memory TTL Cache:** Caches search results, player metadata, crafts, and skills to minimize network traffic.
   - **Request Queue & Throttling:** Enforces a minimum 120ms spacing and maximum 2 concurrent outbound requests with automatic exponential backoff on HTTP 429 errors.
   - **User-Configurable Auto-Refresh:** Selectable polling intervals (`Off`, `15s`, `30s`, `60s`, `2m`, `5m`) with live pause/resume and countdown indicator.

8. **Multi-User Collaborative Crafting & Contributor XP (v1.1.0):**
   - **Dynamic Activity Detection:** Tracks contributor recency and live progress deltas (`🔥 Currently Crafting`, `Active Participant`, `Idle / Left`).
   - **Compounded Team Speed:** Combines the effort-per-second rates of all active participants to calculate collaborative station completion times.
   - **Time Saved Highlight:** Shows Solo ETA vs. Collaborative ETA and time saved with the team.
   - **Individual Projected XP Shares:** Accurately distributes remaining craft effort and expected XP according to each participant's relative crafting speed and gear buffs.
   - **Interactive Simulation Toggles:** Check or uncheck any contributor to simulate team compositions on shared or public crafting stations.

9. **Public Crafts Explorer:**
   - Search and inspect global in-progress crafts across the realm to test character stats and hypothetical XP gains.

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
```bash
# Build and run with Docker Compose
docker compose up -d

# Or build and run with Docker directly
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
