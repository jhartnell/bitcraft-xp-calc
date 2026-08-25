# Client-Side Only (Zero Hosting) Distributions

This directory contains two standalone, client-side distributions of the **BitCraft Online XP Calculator** designed to run locally with **zero web server or hosting dependencies**.

---

## 📁 Directory Structure

```
client-side-only/
├── browser-extension/       # Option 1: Unpacked Chrome / Edge / Firefox Extension (Recommended)
│   ├── dist/                # Pre-built, ready-to-load extension distribution
│   │   ├── manifest.json    # Manifest V3 configuration with least-privilege host permissions
│   │   ├── background.js    # Service worker with 1-min alarm polling & badge alerts
│   │   ├── icon.png         # Extension icon
│   │   ├── index.html       # Extension popup/tab root
│   │   └── assets/          # Bundled JS & CSS
│   ├── manifest.json
│   ├── background.js
│   └── icon.png
├── standalone-html/         # Option 2: Single-file offline/standalone HTML
│   └── index.html           # Portable single-file web app (double-click to open)
└── README.md                # This documentation
```

---

## 🔒 Security & Least Privilege Design

* **Zero Data Exfiltration:** Neither version transmits data to external logging servers or third parties. All network traffic communicates exclusively with `https://bitjita.com/api`.
* **Least-Privilege Host Permissions:** The Browser Extension restricts network access strictly to `"host_permissions": ["https://bitjita.com/*"]` and uses standard `"alarms"` and `"storage"` APIs.

---

## 🛠️ Option 1: Standalone Browser Extension (Recommended / Best Practice)

### ✨ Features
* **Primary Character Pinning:** Pin your main character (e.g. *Ikuria*) with the star button. The extension remembers and automatically selects your character on startup.
* **Background Alarms & Toolbar Badge Alerts:**
  * **Craft In Progress:** **Emerald Green** badge displaying progress % or ETA (e.g. `10%`, `45%`).
  * **No Active Craft / Finished:** **Bright Red** badge (`IDLE`) alerting you immediately when crafting stops.
* **Direct BitJita API Access:** Natively bypasses browser CORS limits using declared host permissions.
* **Background Stats Synchronization:** Keeps equipment, buffs, and stats up to date in background storage.

### How to Install (Chrome / Edge / Brave / Opera)
1. Open your browser and navigate to `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the directory:
   ```
   <repo-path>/client-side-only/browser-extension/dist
   ```
5. Click the **BitCraft XP Calculator** icon in your extension toolbar.
6. Search for your character and click **"Pin Primary"** to start real-time background watching.

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
