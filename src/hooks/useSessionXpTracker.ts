import { useState, useEffect, useCallback } from 'react';
import { SessionRateStats, SessionRatePoint } from '../types/calculator';

export interface ProgressSnapshot {
  timestamp: number;
  cumulativeXp: number;
}

interface SessionTrackerState {
  characterId: string;
  skillId: number;
  craftId: string;
  lastProgress: number;
  lastProgressTimestamp: number;
  effectiveXpPerAction: number;
  lastTheoreticalXpPerHour: number;
  cumulativeXp: number;
  snapshots: ProgressSnapshot[];
  history: SessionRatePoint[];
  peakXpPerHour: number | null;
  sessionStartTime: number;
}

const STORAGE_PREFIX = 'bitcraft_session_xp_';

function getStorageKey(characterId: string, skillId: number): string {
  return `${STORAGE_PREFIX}${characterId}_${skillId}`;
}

function loadPersistedSession(characterId: string, skillId: number): Partial<SessionTrackerState> | null {
  try {
    const raw = sessionStorage.getItem(getStorageKey(characterId, skillId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePersistedSession(state: SessionTrackerState): void {
  try {
    sessionStorage.setItem(
      getStorageKey(state.characterId, state.skillId),
      JSON.stringify({
        cumulativeXp: state.cumulativeXp,
        snapshots: state.snapshots.slice(-30),
        history: state.history.slice(-50),
        peakXpPerHour: state.peakXpPerHour,
        sessionStartTime: state.sessionStartTime,
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function calculateSnapshotRate(
  snapshots: ProgressSnapshot[],
  theoreticalXpPerHour?: number
): {
  measuredXpPerHour: number | null;
  efficiencyPercent: number | null;
} {
  if (snapshots.length < 2) {
    return { measuredXpPerHour: null, efficiencyPercent: null };
  }

  const oldest = snapshots[0];
  const newest = snapshots[snapshots.length - 1];
  const elapsedSeconds = Math.max(1, (newest.timestamp - oldest.timestamp) / 1000);
  const deltaXp = Math.max(0, newest.cumulativeXp - oldest.cumulativeXp);

  // Require at least 5 seconds of real measured elapsed time to avoid micro-interval spikes
  if (elapsedSeconds < 5 || deltaXp <= 0) {
    return { measuredXpPerHour: null, efficiencyPercent: null };
  }

  let measuredXpPerHour = Math.round((deltaXp / elapsedSeconds) * 3600);

  // Plausibility Clamp: Filter out database catch-up flushes that exceed physical speed (max 125% of theoretical)
  if (theoreticalXpPerHour && theoreticalXpPerHour > 0) {
    const maxPlausibleRate = Math.round(theoreticalXpPerHour * 1.25);
    if (measuredXpPerHour > maxPlausibleRate) {
      measuredXpPerHour = maxPlausibleRate;
    }
  }

  let efficiencyPercent: number | null = null;
  if (theoreticalXpPerHour && theoreticalXpPerHour > 0) {
    efficiencyPercent = Math.min(
      125,
      Math.round((measuredXpPerHour / theoreticalXpPerHour) * 1000) / 10
    );
  }

  return { measuredXpPerHour, efficiencyPercent };
}

export function useSessionXpTracker(
  characterId?: string,
  skillId?: number,
  craftId?: string,
  currentProgress?: number,
  effectiveXpPerAction?: number,
  theoreticalXpPerHour?: number
): {
  sessionStats: SessionRateStats | null;
  resetSession: () => void;
} {
  const [tracker, setTracker] = useState<SessionTrackerState | null>(null);
  const [clockMs, setClockMs] = useState<number>(() => Date.now());

  // Tick live session duration clock cleanly inside an interval callback
  useEffect(() => {
    if (!tracker) return;
    const timer = setInterval(() => {
      setClockMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [tracker]);

  // Initialize or update tracking asynchronously when character, skill, craft, or progress updates
  useEffect(() => {
    if (
      !characterId ||
      !skillId ||
      !craftId ||
      currentProgress === undefined ||
      effectiveXpPerAction === undefined
    ) {
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      const now = Date.now();
      setClockMs(now);

      setTracker((prev) => {
        if (!prev || prev.characterId !== characterId || prev.skillId !== skillId) {
          const persisted = loadPersistedSession(characterId, skillId);
          return {
            characterId,
            skillId,
            craftId,
            lastProgress: currentProgress,
            lastProgressTimestamp: now,
            effectiveXpPerAction,
            lastTheoreticalXpPerHour: theoreticalXpPerHour || 0,
            cumulativeXp: persisted?.cumulativeXp ?? 0,
            snapshots: [],
            history: persisted?.history ?? [],
            peakXpPerHour: persisted?.peakXpPerHour ?? null,
            sessionStartTime: persisted?.sessionStartTime ?? now,
          };
        }

        if (prev.craftId !== craftId) {
          const updated: SessionTrackerState = {
            ...prev,
            craftId,
            lastProgress: currentProgress,
            lastProgressTimestamp: now,
            effectiveXpPerAction,
            lastTheoreticalXpPerHour: theoreticalXpPerHour || 0,
            snapshots: [],
          };
          savePersistedSession(updated);
          return updated;
        }

        if (currentProgress > prev.lastProgress) {
          const deltaProgress = currentProgress - prev.lastProgress;
          const deltaXp = deltaProgress * effectiveXpPerAction;
          const newCumulativeXp = prev.cumulativeXp + deltaXp;

          const timeSinceLastProgress = (now - prev.lastProgressTimestamp) / 1000;
          const isFreshBurst = prev.snapshots.length === 0 || timeSinceLastProgress > 45;

          let updatedSnapshots: ProgressSnapshot[];

          if (isFreshBurst) {
            updatedSnapshots = [{ timestamp: now, cumulativeXp: prev.cumulativeXp }];
          } else {
            updatedSnapshots = prev.snapshots.filter((s) => now - s.timestamp <= 120_000);
            updatedSnapshots.push({ timestamp: now, cumulativeXp: newCumulativeXp });
          }

          const { measuredXpPerHour } = calculateSnapshotRate(
            updatedSnapshots,
            theoreticalXpPerHour
          );

          let updatedHistory = [...prev.history];
          let newPeak = prev.peakXpPerHour;

          if (measuredXpPerHour !== null && measuredXpPerHour > 0) {
            const timeLabel = new Date(now).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            updatedHistory.push({
              timestamp: now,
              timeLabel,
              xpPerHour: measuredXpPerHour,
              theoreticalXpPerHour: theoreticalXpPerHour || 0,
              deltaXp: Math.round(deltaXp),
            });

            if (updatedHistory.length > 50) {
              updatedHistory = updatedHistory.slice(-50);
            }

            newPeak = Math.max(prev.peakXpPerHour || 0, measuredXpPerHour);
          }

          const newState: SessionTrackerState = {
            ...prev,
            lastProgress: currentProgress,
            lastProgressTimestamp: now,
            effectiveXpPerAction,
            lastTheoreticalXpPerHour: theoreticalXpPerHour || 0,
            cumulativeXp: newCumulativeXp,
            snapshots: updatedSnapshots,
            history: updatedHistory,
            peakXpPerHour: newPeak,
          };

          savePersistedSession(newState);
          return newState;
        }

        const currentTheo = theoreticalXpPerHour || 0;
        const prevTheo = prev.lastTheoreticalXpPerHour || 0;
        if (
          currentTheo > 0 &&
          prevTheo > 0 &&
          Math.abs(currentTheo - prevTheo) >= 50 &&
          prev.history.length > 0
        ) {
          const lastPt = prev.history[prev.history.length - 1];
          if (now - lastPt.timestamp >= 3000) {
            const timeLabel = new Date(now).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            const updatedHistory = [
              ...prev.history,
              {
                timestamp: now,
                timeLabel,
                xpPerHour: lastPt.xpPerHour,
                theoreticalXpPerHour: currentTheo,
                deltaXp: 0,
              },
            ].slice(-50);

            const newState: SessionTrackerState = {
              ...prev,
              effectiveXpPerAction,
              lastTheoreticalXpPerHour: currentTheo,
              history: updatedHistory,
            };

            savePersistedSession(newState);
            return newState;
          }
        }

        return prev;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [characterId, skillId, craftId, currentProgress, effectiveXpPerAction, theoreticalXpPerHour]);

  const resetSession = useCallback(() => {
    if (!characterId || !skillId || !craftId || currentProgress === undefined || !effectiveXpPerAction) {
      return;
    }
    const now = Date.now();
    try {
      sessionStorage.removeItem(getStorageKey(characterId, skillId));
    } catch {
      // ignore
    }

    setClockMs(now);
    setTracker({
      characterId,
      skillId,
      craftId,
      lastProgress: currentProgress,
      lastProgressTimestamp: now,
      effectiveXpPerAction,
      lastTheoreticalXpPerHour: theoreticalXpPerHour || 0,
      cumulativeXp: 0,
      snapshots: [],
      history: [],
      peakXpPerHour: null,
      sessionStartTime: now,
    });
  }, [characterId, skillId, craftId, currentProgress, effectiveXpPerAction, theoreticalXpPerHour]);

  if (!tracker || tracker.characterId !== characterId || tracker.skillId !== skillId) {
    return { sessionStats: null, resetSession };
  }

  const sessionDurationSeconds = Math.max(
    1,
    Math.floor((Math.max(clockMs, tracker.lastProgressTimestamp) - tracker.sessionStartTime) / 1000)
  );
  const { measuredXpPerHour, efficiencyPercent } = calculateSnapshotRate(
    tracker.snapshots,
    theoreticalXpPerHour
  );

  const isWarmingUp = tracker.snapshots.length < 2 || tracker.cumulativeXp === 0;

  const sessionStats: SessionRateStats = {
    sessionXpGained: Math.round(tracker.cumulativeXp),
    sessionDurationSeconds,
    measuredXpPerHour,
    peakXpPerHour: tracker.peakXpPerHour,
    efficiencyPercent,
    isWarmingUp,
    history: tracker.history,
  };

  return { sessionStats, resetSession };
}
