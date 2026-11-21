import { useState, useEffect, useCallback } from 'react';
import { PlayerSummary } from '../types/api';
import { FoodBuffOverride } from '../types/calculator';
import { isExtensionContext } from '../services/apiClient';

const RECENT_PLAYERS_KEY = 'bitcraft_xp_recent_players';
const REFRESH_INTERVAL_KEY = 'bitcraft_xp_refresh_interval';
const PRIMARY_PLAYER_KEY = 'bitcraft_primary_player';
const INACTIVITY_TIMEOUT_KEY = 'bitcraft_inactivity_timeout';
const FOOD_BUFF_OVERRIDE_KEY = 'bitcraft_food_buff_override';

function isValidPlayerSummary(val: unknown): val is PlayerSummary {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    typeof (val as PlayerSummary).entityId === 'string' &&
    (val as PlayerSummary).entityId.length > 0 &&
    typeof (val as PlayerSummary).username === 'string' &&
    (val as PlayerSummary).username.length > 0
  );
}

function notifyExtensionPrimaryPlayer(player: PlayerSummary | null): void {
  if (!isExtensionContext()) return;
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'SYNC_PRIMARY_PLAYER',
          player: player ? { entityId: player.entityId, username: player.username } : null,
        },
        () => {
          // Read lastError to avoid unchecked runtime.lastError warnings when SW restarts
          void chrome.runtime.lastError;
        }
      );
    } catch {
      // Ignore extension messaging failures outside extension context
    }
  }
}

export function usePersistentPreferences() {
  const [primaryPlayer, setPrimaryPlayer] = useState<PlayerSummary | null>(() => {
    try {
      const saved = localStorage.getItem(PRIMARY_PLAYER_KEY);
      if (!saved) return null;
      const parsed: unknown = JSON.parse(saved);
      return isValidPlayerSummary(parsed) ? parsed : null;
    } catch {
      return null;
    }
  });

  const [inactivityTimeout, setInactivityTimeout] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(INACTIVITY_TIMEOUT_KEY);
      const num = saved !== null ? Number(saved) : 2.0;
      return Number.isFinite(num) && num > 0 ? num : 2.0;
    } catch {
      return 2.0;
    }
  });

  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(REFRESH_INTERVAL_KEY);
      const num = saved !== null ? Number(saved) : 30;
      return Number.isFinite(num) && num >= 0 ? num : 30;
    } catch {
      return 30;
    }
  });

  const [recentPlayers, setRecentPlayers] = useState<PlayerSummary[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_PLAYERS_KEY);
      if (!saved) return [];
      const parsed: unknown = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(isValidPlayerSummary) : [];
    } catch {
      return [];
    }
  });

  const [foodBuffOverride, setFoodBuffOverride] = useState<FoodBuffOverride | null>(() => {
    try {
      const saved = sessionStorage.getItem(FOOD_BUFF_OVERRIDE_KEY);
      if (!saved) return null;
      const parsed: FoodBuffOverride = JSON.parse(saved);
      if (!parsed || typeof parsed.startedAt !== 'number' || typeof parsed.durationSeconds !== 'number') {
        return null;
      }
      const elapsed = (Date.now() - parsed.startedAt) / 1000;
      if (elapsed < parsed.durationSeconds) {
        return {
          ...parsed,
          remainingSeconds: Math.max(0, Math.round(parsed.durationSeconds - elapsed)),
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  // Ensure Chrome Extension background service worker is synced with saved primary player on load
  useEffect(() => {
    if (primaryPlayer) {
      notifyExtensionPrimaryPlayer(primaryPlayer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetFoodBuffOverride = useCallback((override: FoodBuffOverride | null) => {
    setFoodBuffOverride(override);
    try {
      if (override) {
        sessionStorage.setItem(FOOD_BUFF_OVERRIDE_KEY, JSON.stringify(override));
      } else {
        sessionStorage.removeItem(FOOD_BUFF_OVERRIDE_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  // Ticking countdown effect for active food override
  const overrideStartedAt = foodBuffOverride?.startedAt;
  const overrideDuration = foodBuffOverride?.durationSeconds;
  const overrideEnabled = foodBuffOverride?.enabled;

  useEffect(() => {
    if (!overrideEnabled || overrideStartedAt === undefined || overrideDuration === undefined) return;
    const timer = setInterval(() => {
      const elapsed = (Date.now() - overrideStartedAt) / 1000;
      if (elapsed >= overrideDuration) {
        handleSetFoodBuffOverride(null);
      } else {
        setFoodBuffOverride((prev) =>
          prev
            ? {
                ...prev,
                remainingSeconds: Math.max(0, Math.round(prev.durationSeconds - elapsed)),
              }
            : null
        );
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [overrideStartedAt, overrideDuration, overrideEnabled, handleSetFoodBuffOverride]);

  const togglePrimaryPlayer = useCallback(
    (player: PlayerSummary) => {
      if (primaryPlayer?.entityId === player.entityId) {
        setPrimaryPlayer(null);
        try {
          localStorage.removeItem(PRIMARY_PLAYER_KEY);
        } catch {
          // ignore
        }
        notifyExtensionPrimaryPlayer(null);
      } else {
        setPrimaryPlayer(player);
        try {
          localStorage.setItem(PRIMARY_PLAYER_KEY, JSON.stringify(player));
        } catch {
          // ignore
        }
        notifyExtensionPrimaryPlayer(player);
      }
    },
    [primaryPlayer]
  );

  const handleInactivityTimeoutChange = useCallback((minutes: number) => {
    setInactivityTimeout(minutes);
    try {
      localStorage.setItem(INACTIVITY_TIMEOUT_KEY, String(minutes));
    } catch (err) {
      console.error('Failed to save inactivity timeout:', err);
    }
  }, []);

  const saveRecentPlayer = useCallback((player: PlayerSummary) => {
    if (!player.entityId) return;
    setRecentPlayers((prev) => {
      const filtered = prev.filter((p) => p.entityId !== player.entityId);
      const updated = [player, ...filtered].slice(0, 8);
      try {
        localStorage.setItem(RECENT_PLAYERS_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save recent players:', err);
      }
      return updated;
    });
  }, []);

  const removeRecentPlayer = useCallback((entityId: string) => {
    setRecentPlayers((prev) => {
      const updated = prev.filter((p) => p.entityId !== entityId);
      try {
        localStorage.setItem(RECENT_PLAYERS_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to remove recent player:', err);
      }
      return updated;
    });
  }, []);

  const handleIntervalChange = useCallback((secs: number) => {
    setRefreshInterval(secs);
    try {
      localStorage.setItem(REFRESH_INTERVAL_KEY, String(secs));
    } catch (err) {
      console.error('Failed to save refresh interval:', err);
    }
  }, []);

  return {
    primaryPlayer,
    togglePrimaryPlayer,
    inactivityTimeout,
    handleInactivityTimeoutChange,
    refreshInterval,
    handleIntervalChange,
    recentPlayers,
    saveRecentPlayer,
    removeRecentPlayer,
    foodBuffOverride,
    handleSetFoodBuffOverride,
  };
}
