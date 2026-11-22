import { useState, useMemo, useEffect, useCallback } from 'react';
import { LiveXpAnchor } from '../types/calculator';
import {
  anchorsEqual,
  getLiveXpAnchorStorageKey,
  loadLiveXpAnchor,
  reconcileLiveXpAnchor,
  saveLiveXpAnchor,
} from '../services/liveXpBridge';

interface UseLiveSkillXpBridgeParams {
  playerId?: string;
  skillId?: number;
  craftId?: string;
  serverSkillXp: number | null;
  userProgress: number | null;
}

export interface UseLiveSkillXpBridgeReturn {
  anchor: LiveXpAnchor | null;
  setIncludePriorCraftProgress: (include: boolean) => void;
}

/**
 * Tracks a self-correcting (serverXp, userProgress) baseline anchor per
 * (playerId, skillId, craftId) in sessionStorage so live craft progress keeps
 * Current Level, Level Power/Speed bonuses, and Projected Final Level accurate
 * even while BitJita's /players/{id} experience endpoint lags behind.
 */
export function useLiveSkillXpBridge({
  playerId,
  skillId,
  craftId,
  serverSkillXp,
  userProgress,
}: UseLiveSkillXpBridgeParams): UseLiveSkillXpBridgeReturn {
  const storageKey =
    playerId && skillId && craftId
      ? getLiveXpAnchorStorageKey(playerId, skillId, craftId)
      : null;

  const [state, setState] = useState<{
    key: string | null;
    anchor: LiveXpAnchor | null;
  } | null>(null);

  // Resolve persisted anchor for the current (player, skill, craft) tuple
  const baseAnchor = useMemo<LiveXpAnchor | null>(() => {
    if (!storageKey || !playerId || !skillId || !craftId) return null;
    if (state && state.key === storageKey) {
      return state.anchor;
    }
    return loadLiveXpAnchor(playerId, skillId, craftId);
  }, [state, storageKey, playerId, skillId, craftId]);

  // Synchronously reconcile against the latest server XP & user progress for render accuracy
  const anchor = useMemo<LiveXpAnchor | null>(() => {
    if (!storageKey || serverSkillXp === null || userProgress === null) {
      return baseAnchor;
    }
    return reconcileLiveXpAnchor(baseAnchor, serverSkillXp, userProgress, baseAnchor?.updatedAt ?? 0);
  }, [baseAnchor, storageKey, serverSkillXp, userProgress]);

  // Persist anchor updates asynchronously (avoids synchronous setState inside effects)
  useEffect(() => {
    if (!storageKey || !playerId || !skillId || !craftId || serverSkillXp === null || userProgress === null) {
      return;
    }

    const existing =
      state && state.key === storageKey
        ? state.anchor
        : loadLiveXpAnchor(playerId, skillId, craftId);
    const next = reconcileLiveXpAnchor(existing, serverSkillXp, userProgress, Date.now());

    if (anchorsEqual(existing, next)) {
      return;
    }

    saveLiveXpAnchor(playerId, skillId, craftId, next);

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setState({ key: storageKey, anchor: next });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [storageKey, playerId, skillId, craftId, serverSkillXp, userProgress, state]);

  const setIncludePriorCraftProgress = useCallback(
    (include: boolean) => {
      if (!storageKey || !playerId || !skillId || !craftId || serverSkillXp === null || userProgress === null) {
        return;
      }

      const current = reconcileLiveXpAnchor(
        anchor,
        serverSkillXp,
        userProgress,
        Date.now()
      );
      if (current.hasObservedServerSync && include) {
        return;
      }

      const updated: LiveXpAnchor = {
        ...current,
        includePriorCraftProgress: include,
        updatedAt: Date.now(),
      };
      saveLiveXpAnchor(playerId, skillId, craftId, updated);
      setState({ key: storageKey, anchor: updated });
    },
    [storageKey, playerId, skillId, craftId, serverSkillXp, userProgress, anchor]
  );

  return {
    anchor,
    setIncludePriorCraftProgress,
  };
}
