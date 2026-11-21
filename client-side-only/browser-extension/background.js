// Background Service Worker for BitCraft Online XP Calculator Extension

const ALARM_NAME = 'bitcraft-background-sync';
const SYNC_INTERVAL_MINUTES = 1; // Check every 1 minute
const FETCH_TIMEOUT_MS = 15000;

async function ensureSyncAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    await chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: SYNC_INTERVAL_MINUTES,
      delayInMinutes: 0.1,
    });
  }
}

// Set up periodic alarm on install or browser startup
chrome.runtime.onInstalled.addListener(() => {
  (async () => {
    await ensureSyncAlarm();
    await runBackgroundSync();
  })().catch((err) => console.error('onInstalled sync failed:', err));
});

chrome.runtime.onStartup.addListener(() => {
  (async () => {
    await ensureSyncAlarm();
    await runBackgroundSync();
  })().catch((err) => console.error('onStartup sync failed:', err));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    runBackgroundSync().catch((err) => console.error('Alarm sync failed:', err));
  }
});

// Listen for messages strictly from this extension's own pages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return false;
  }

  if (!message || typeof message !== 'object') {
    sendResponse({ success: false, error: 'Invalid message payload' });
    return false;
  }

  if (message.type === 'SYNC_PRIMARY_PLAYER') {
    (async () => {
      try {
        const player = message.player;
        if (
          player &&
          typeof player === 'object' &&
          typeof player.entityId === 'string' &&
          player.entityId.trim().length > 0 &&
          typeof player.username === 'string'
        ) {
          await chrome.storage.local.set({
            primaryPlayer: {
              entityId: player.entityId.trim(),
              username: player.username,
            },
          });
          await ensureSyncAlarm();
          const result = await runBackgroundSync();
          sendResponse({ success: true, result });
        } else {
          await chrome.storage.local.remove('primaryPlayer');
          await updateBadgeNoPlayer();
          sendResponse({ success: true, result: null });
        }
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true; // Keep message channel open for async response
  }

  if (message.type === 'FORCE_BACKGROUND_SYNC') {
    (async () => {
      try {
        const result = await runBackgroundSync();
        sendResponse({ success: true, result });
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true;
  }

  return false;
});

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`BitJita API error: ${response.status}`);
  }
  return response.json();
}

async function runBackgroundSync() {
  try {
    const data = await chrome.storage.local.get(['primaryPlayer']);
    const primaryPlayer = data.primaryPlayer;

    if (!primaryPlayer || typeof primaryPlayer.entityId !== 'string' || !primaryPlayer.entityId) {
      await updateBadgeNoPlayer();
      return null;
    }

    const encodedId = encodeURIComponent(primaryPlayer.entityId);

    // 1. Fetch live active crafts
    const craftsData = await fetchJson(
      `https://bitjita.com/api/players/${encodedId}/crafts?completed=all`
    );
    const activeCrafts = (craftsData.craftResults || []).filter(
      (c) => !c.completed && (c.progress ?? 0) < (c.totalActionsRequired || Infinity)
    );

    // 2. Fetch fresh player details, buffs, and stats to keep storage hot
    try {
      const [details, buffs, stats] = await Promise.all([
        fetchJson(`https://bitjita.com/api/players/${encodedId}`).catch(() => null),
        fetchJson(`https://bitjita.com/api/players/${encodedId}/buffs`).catch(() => null),
        fetchJson(`https://bitjita.com/api/players/${encodedId}/stats`).catch(() => null),
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
      const total =
        activeCraft.totalActionsRequired ||
        activeCraft.actionsRequiredPerItem * activeCraft.craftCount ||
        1;
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
  } catch {
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
