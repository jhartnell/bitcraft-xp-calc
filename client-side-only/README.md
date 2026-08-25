# Client-Side Only (Zero Hosting) Distributions

This directory contains two standalone, client-side distributions of the **BitCraft Online XP Calculator** designed to run locally with **zero web server or hosting dependencies**.

---

## 📁 Directory Structure

```
client-side-only/
├── browser-extension/       # Option 1: Unpacked Chrome / Edge / Firefox Extension (Recommended)
│   ├── dist/                # Pre-built, ready-to-load extension distribution
│   │   ├── manifest.json    # Manifest V3 configuration with least-privilege host permissions
│   │   ├── icon.png         # Extension icon
│   │   ├── index.html       # Extension popup/tab root
│   │   └── assets/          # Bundled JS & CSS
│   ├── manifest.json
│   └── icon.png
├── standalone-html/         # Option 2: Single-file offline/standalone HTML
│   └── index.html           # Portable single-file web app (double-click to open)
└── README.md                # This documentation
```

---

## 🔒 Security & Least Privilege Design

* **Zero Data Exfiltration:** Neither version transmits data to external logging servers or third parties. All network traffic communicates exclusively with `https://bitjita.com/api`.
* **Least-Privilege Host Permissions:** The Browser Extension restricts network access strictly to `"host_permissions": ["https://bitjita.com/*"]`, ensuring no other domains or user browsing data can be accessed.

---

## 🛠️ Option 1: Standalone Browser Extension (Recommended / Best Practice)

### Why This Is the Best Approach
* **Direct BitJita API Access:** Browser extensions natively bypass browser Cross-Origin Resource Sharing (CORS) limits using declared host permissions, enabling live character search and automatic craft polling without third-party proxies.
* **Toolbar Accessibility:** Open the full dashboard directly from your browser toolbar as a popup or full-page tab.

### How to Install (Chrome / Edge / Brave / Opera)
1. Open your browser and navigate to `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the directory:
   ```
   <repo-path>/client-side-only/browser-extension/dist
   ```
5. The **BitCraft XP Calculator** icon will appear in your browser extension toolbar. Click it anytime to open the calculator.

### How to Rebuild After Code Changes
```bash
npm run build:extension
```

---

## 📄 Option 2: Standalone Single-File HTML

### Why Use This Approach
* **Zero Setup Required:** A single, self-contained `index.html` file that can be double-clicked directly from your file manager (`file:///.../index.html`).
* **Offline Calculation:** Includes quick character presets (e.g. *Ikuria Masonry Craft*, *DOOM Smithing Craft*) and customizable input sliders to calculate exact XP, level projections, and in-game crafting duration completely offline.

### How to Run
1. Navigate to `client-side-only/standalone-html/`.
2. Double-click `index.html` (or open it with any browser).
3. Use the preset buttons or configure your custom craft parameters directly.

---

## 📐 Calculation Consistency
Both client-side distributions share the identical calibrated formulas:
* **Base Action Duration:** `1.6s` per crafting station action cycle.
* **Tool Validation:** Chisel (Masonry), Pickaxe (Mining), Saw (Carpentry), Axe (Forestry), Hammer (Smithing).
* **Speed Modifiers:** Compounded gear bonuses minus active food penalties (e.g., High Quality EXP Pie `-20%`).
* **Experience Modifiers:** Compounded Experience Rate bonuses (e.g., EXP Pie `+10%`, Librarian Book `+8%`).
