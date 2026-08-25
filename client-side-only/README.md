# BitCraft Online XP Calculator - Browser Extension

A 100% client-side, zero-hosting distribution of the **BitCraft Online XP Calculator** built as a Manifest V3 browser extension for Chrome, Edge, Brave, Opera, and Firefox.

---

## 📁 Directory Structure

```
client-side-only/
├── browser-extension/       # Unpacked Browser Extension Package
│   ├── dist/                # Pre-built, ready-to-load extension distribution
│   │   ├── manifest.json    # Manifest V3 configuration with least-privilege host permissions
│   │   ├── background.js    # Service worker with 1-min alarm polling & badge alerts
│   │   ├── icon.png         # Extension icon
│   │   ├── index.html       # Extension popup/tab root
│   │   └── assets/          # Bundled JS & CSS
│   ├── manifest.json
│   ├── background.js
│   └── icon.png
└── README.md                # Documentation
```

---

## 🔒 Security & Least Privilege Design

* **Zero Data Exfiltration:** The extension never transmits user data or telemetry to external servers. All requests communicate strictly with `https://bitjita.com/api`.
* **Least-Privilege Host Permissions:** Restricts network access strictly to `"host_permissions": ["https://bitjita.com/*"]` and uses standard `"alarms"` and `"storage"` APIs.

---

## ✨ Features

1. **Direct BitJita API Access:** Natively bypasses browser CORS limits using declared host permissions, enabling live character search and automatic craft polling without third-party proxies.
2. **Primary Character Pinning:** Pin your main character (e.g. *Ikuria*) with the star button. The extension remembers and automatically selects your character on startup.
3. **Background Alarms & Toolbar Badge Alerts:**
   * **Craft In Progress:** **Emerald Green** badge displaying progress % (e.g. `11%`, `45%`).
   * **No Active Craft / Finished:** **Bright Red** badge (`IDLE`) alerting you immediately when crafting stops.
4. **Full Tab Mode:** Click the **"New Tab"** button in the header to expand the calculator into a dedicated, full-width desktop browser tab anytime.
5. **Background Stats Synchronization:** Keeps equipment, buffs, and stats up to date in background storage.

---

## 🛠️ How to Install (Chrome / Edge / Brave / Opera)

1. Open your browser and navigate to `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the directory:
   ```
   <repo-path>/client-side-only/browser-extension/dist
   ```
5. Click the **BitCraft XP Calculator** icon in your extension toolbar.
6. Search for your character and click **"Pin Primary"** to start real-time background watching.

---

## 🔨 How to Rebuild

To rebuild the extension bundle after making source code changes:

```bash
npm run build:extension
```
Then click the **Reload** icon on the extension card in `chrome://extensions`.
