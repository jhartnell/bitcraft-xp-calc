// Background Service Worker for BitCraft Online XP Calculator Extension

interface StoredPrimaryPlayer {
  entityId: string;
  username: string;
  userType?: string;
  isOnline?: boolean;
}

interface BackgroundSyncResult {
  hasActiveCraft: boolean;
  craftCount: number;
  progressPercent: number;
  buildingName?: string;
  lastSyncedAt: string;
}

const ALARM_NAME = 'bitcraft-background-sync';
const SYNC_INTERVAL_MINUTES = 1; // Check every 1 minute

// Set up periodic alarm on install or startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
    delayInMinutes: 0.1,
  });
  runBackgroundSync();
});

chrome.runtime.onStartup.addListener(() => {
  runBackgroundSync();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    runBackgroundSync();
  }
});

// Listen for messages from popup or full tab UI
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SYNC_PRIMARY_PLAYER') {
    if (message.player) {
      chrome.storage.local.set({ primaryPlayer: message.player }, () => {
        runBackgroundSync().then(sendResponse);
      });
    } else {
      chrome.storage.local.remove('primaryPlayer', () => {
        updateBadgeNoPlayer();
        sendResponse({ success: true });
      });
    }
    return true; // Keep message channel open for async response
  }

  if (message.type === 'FORCE_BACKGROUND_SYNC') {
    runBackgroundSync().then(sendResponse);
    return true;
  }
});

async function runBackgroundSync(): Promise<BackgroundSyncResult | null> {
  try {
    const data = await chrome.storage.local.get(['primaryPlayer']);
    const primaryPlayer = data.primaryPlayer as StoredPrimaryPlayer | undefined;

    if (!primaryPlayer || !primaryPlayer.entityId) {
      updateBadgeNoPlayer();
      return null;
    }

    // 1. Fetch live active crafts
    const craftsRes = await fetch(
      `https://bitjita.com/api/players/${primaryPlayer.entityId}/crafts?completed=all`,
      { headers: { Accept: 'application/json' } }
    );

    if (!craftsRes.ok) {
      throw new Error(`Crafts fetch error: ${craftsRes.status}`);
    }

    const craftsData = await craftsRes.json();
    const activeCrafts = (craftsData.craftResults || []).filter((c: any) => !c.completed);

    // 2. Fetch fresh player details, buffs, and stats to keep storage hot
    try {
      const [detailsRes, buffsRes, statsRes] = await Promise.all([
        fetch(`https://bitjita.com/api/players/${primaryPlayer.entityId}`, { headers: { Accept: 'application/json' } }),
        fetch(`https://bitjita.com/api/players/${primaryPlayer.entityId}/buffs`, { headers: { Accept: 'application/json' } }),
        fetch(`https://bitjita.com/api/players/${primaryPlayer.entityId}/stats`, { headers: { Accept: 'application/json' } }),
      ]);

      const [details, buffs, stats] = await Promise.all([
        detailsRes.ok ? detailsRes.json() : null,
        buffsRes.ok ? buffsRes.json() : null,
        statsRes.ok ? statsRes.json() : null,
      ]);

      await chrome.storage.local.set({
        [`cached_player_${primaryPlayer.entityId}`]: {
          details: details?.player || null,
          crafts: craftsData,
          buffs: buffs?.buffs || [],
          stats: stats?.stats || null,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch {
      // Non-critical background storage cache failure
    }

    // 3. Update Badge State based on active crafts
    if (activeCrafts.length > 0) {
      const activeCraft = activeCrafts[0];
      const total = activeCraft.totalActionsRequired || (activeCraft.actionsRequiredPerItem * activeCraft.craftCount) || 1;
      const progress = activeCraft.progress || 0;
      const pct = Math.min(100, Math.max(0, Math.round((progress / total) * 100)));

      // Active crafting state: Emerald Green badge
      await chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
      await chrome.action.setBadgeText({ text: `${pct}%` });
      await chrome.action.setTitle({
        title: `BitCraft: ${primaryPlayer.username} is CRAFTING (${activeCraft.buildingName || 'Station'} • ${pct}%)`,
      });

      return {
        hasActiveCraft: true,
        craftCount: activeCrafts.length,
        progressPercent: pct,
        buildingName: activeCraft.buildingName,
        lastSyncedAt: new Date().toISOString(),
      };
    } else {
      // IDLE state (Craft completed or stopped): Bright Red badge
      await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
      await chrome.action.setBadgeText({ text: 'IDLE' });
      await chrome.action.setTitle({
        title: `⚠️ BitCraft Alert: ${primaryPlayer.username} is IDLE! (No active craft in progress)`,
      });

      return {
        hasActiveCraft: false,
        craftCount: 0,
        progressPercent: 0,
        lastSyncedAt: new Date().toISOString(),
      };
    }
  } catch (err) {
    // Network or parse error: amber badge
    await chrome.action.setBadgeBackgroundColor({ color: '#F59E0B' });
    await chrome.action.setBadgeText({ text: 'ERR' });
    return null;
  }
}

async function updateBadgeNoPlayer() {
  await chrome.action.setBadgeText({ text: '' });
  await chrome.action.setTitle({
    title: 'BitCraft XP Calculator (Open and pin a character to start watching)',
  });
}
