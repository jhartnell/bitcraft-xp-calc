import { useState, useEffect, useRef, useCallback } from 'react';
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
  const trackerRef = useRef<SessionTrackerState | null>(null);
  trackerRef.current = tracker;

  // Initialize or update tracking when character, skill, craft, or progress updates
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

    setTracker((prev) => {
      const now = Date.now();

      // If switching character or skill, try to hydrate cumulative totals but start rolling rate snapshots fresh
      if (!prev || prev.characterId !== characterId || prev.skillId !== skillId) {
        const persisted = loadPersistedSession(characterId, skillId);
        const newState: SessionTrackerState = {
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
        return newState;
      }

      // If switching craft on the same skill/character, retain cumulative XP but calibrate rolling rate cleanly
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

      // Same craft: if progress advanced, record new active snapshot and history point
      if (currentProgress > prev.lastProgress) {
        const deltaProgress = currentProgress - prev.lastProgress;
        const deltaXp = deltaProgress * effectiveXpPerAction;
        const newCumulativeXp = prev.cumulativeXp + deltaXp;

        const timeSinceLastProgress = (now - prev.lastProgressTimestamp) / 1000;
        const isFreshBurst = prev.snapshots.length === 0 || timeSinceLastProgress > 45;

        let updatedSnapshots: ProgressSnapshot[];

        if (isFreshBurst) {
          // Fresh burst after idle: Anchor a clean baseline point without artificial micro-time guessing
          updatedSnapshots = [
            { timestamp: now, cumulativeXp: prev.cumulativeXp },
          ];
        } else {
          // Append to rolling active window (keep last 120s)
          updatedSnapshots = prev.snapshots.filter((s) => now - s.timestamp <= 120_000);
          updatedSnapshots.push({ timestamp: now, cumulativeXp: newCumulativeXp });
        }

        // Calculate rate for this point
        const { measuredXpPerHour } = calculateSnapshotRate(updatedSnapshots, theoreticalXpPerHour);

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

          // Keep up to 50 historical points
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

      // No progress change, but theoretical rate changed (e.g. food eaten, buff expired, or gear changed while resting)
      const currentTheo = theoreticalXpPerHour || 0;
      const prevTheo = prev.lastTheoreticalXpPerHour || 0;
      if (currentTheo > 0 && prevTheo > 0 && Math.abs(currentTheo - prevTheo) >= 50 && prev.history.length > 0) {
        const lastPt = prev.history[prev.history.length - 1];
        // Only append transition if at least 3 seconds have passed since last point
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

      // No progress change: keep existing state
      return prev;
    });
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

  // Compute live session stats
  if (!tracker || tracker.characterId !== characterId || tracker.skillId !== skillId) {
    return { sessionStats: null, resetSession };
  }

  const now = Date.now();
  const sessionDurationSeconds = Math.max(1, Math.floor((now - tracker.sessionStartTime) / 1000));
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
