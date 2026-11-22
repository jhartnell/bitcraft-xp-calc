// Self-correcting live skill XP bridge to compensate for BitJita /players/{id} experience lag
// while a player is actively contributing to a craft, without double-counting when BitJita flushes.

import { LiveSkillXpBridgeInfo, LiveXpAnchor } from '../types/calculator';
import { getLevelFromXp } from './bitcraftData';

export const LIVE_XP_ANCHOR_PREFIX = 'bitcraft_live_xp_anchor_';

export function getLiveXpAnchorStorageKey(
  playerEntityId: string,
  skillId: number,
  craftId: string
): string {
  return `${LIVE_XP_ANCHOR_PREFIX}${playerEntityId}_${skillId}_${craftId}`;
}

export function loadLiveXpAnchor(
  playerEntityId: string,
  skillId: number,
  craftId: string
): LiveXpAnchor | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(
      getLiveXpAnchorStorageKey(playerEntityId, skillId, craftId)
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LiveXpAnchor>;
    if (
      typeof parsed.baselineServerXp !== 'number' ||
      typeof parsed.baselineUserProgress !== 'number'
    ) {
      return null;
    }
    return {
      baselineServerXp: Math.max(0, parsed.baselineServerXp),
      baselineUserProgress: Math.max(0, parsed.baselineUserProgress),
      includePriorCraftProgress: Boolean(parsed.includePriorCraftProgress),
      hasObservedLag: Boolean(parsed.hasObservedLag),
      hasObservedServerSync: Boolean(parsed.hasObservedServerSync),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveLiveXpAnchor(
  playerEntityId: string,
  skillId: number,
  craftId: string,
  anchor: LiveXpAnchor
): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      getLiveXpAnchorStorageKey(playerEntityId, skillId, craftId),
      JSON.stringify(anchor)
    );
  } catch {
    // Ignore storage quota or restricted-mode errors
  }
}

/**
 * Pure state-transition function that reconciles a persisted XP anchor against the latest
 * BitJita server XP and verified player craft contribution progress.
 *
 * - On cold start: anchors to (serverXp, userProgress) with includePriorCraftProgress = false.
 * - When serverXp increases (BitJita flushed): re-anchors immediately to (serverXp, userProgress),
 *   clears includePriorCraftProgress, and marks hasObservedServerSync = true so prior progress
 *   is never double-counted.
 * - When serverXp stays flat while userProgress advances: preserves the baseline and marks
 *   hasObservedLag = true so the unflushed craft delta bridges the gap.
 */
export function reconcileLiveXpAnchor(
  prev: LiveXpAnchor | null,
  serverXp: number,
  userProgress: number,
  now: number = 0
): LiveXpAnchor {
  const safeServerXp = Math.max(0, Math.round(serverXp));
  const safeProgress = Math.max(0, userProgress);

  if (!prev) {
    return {
      baselineServerXp: safeServerXp,
      baselineUserProgress: safeProgress,
      includePriorCraftProgress: false,
      hasObservedLag: false,
      hasObservedServerSync: false,
      updatedAt: now,
    };
  }

  // BitJita flushed server experience upward -> re-anchor immediately to avoid double-counting
  if (safeServerXp > prev.baselineServerXp) {
    return {
      baselineServerXp: safeServerXp,
      baselineUserProgress: safeProgress,
      includePriorCraftProgress: false,
      hasObservedLag: false,
      hasObservedServerSync: true,
      updatedAt: now,
    };
  }

  // Unexpected downward reset in server XP -> re-anchor conservatively
  if (safeServerXp < prev.baselineServerXp) {
    return {
      baselineServerXp: safeServerXp,
      baselineUserProgress: safeProgress,
      includePriorCraftProgress: false,
      hasObservedLag: false,
      hasObservedServerSync: false,
      updatedAt: now,
    };
  }

  // Server XP unchanged: track lag if craft progress advanced beyond the anchor
  const clampedBaselineProgress = Math.min(prev.baselineUserProgress, safeProgress);
  const progressedBeyondBaseline = safeProgress > clampedBaselineProgress;

  return {
    baselineServerXp: prev.baselineServerXp,
    baselineUserProgress: clampedBaselineProgress,
    includePriorCraftProgress: prev.includePriorCraftProgress,
    hasObservedLag: prev.hasObservedLag || progressedBeyondBaseline,
    hasObservedServerSync: prev.hasObservedServerSync,
    updatedAt: progressedBeyondBaseline ? now : prev.updatedAt,
  };
}

export function anchorsEqual(a: LiveXpAnchor | null, b: LiveXpAnchor | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.baselineServerXp === b.baselineServerXp &&
    a.baselineUserProgress === b.baselineUserProgress &&
    a.includePriorCraftProgress === b.includePriorCraftProgress &&
    a.hasObservedLag === b.hasObservedLag &&
    a.hasObservedServerSync === b.hasObservedServerSync
  );
}

export interface ComputeLiveXpAdjustmentParams {
  anchor: LiveXpAnchor | null;
  serverSkillXp: number;
  hasServerExperience: boolean;
  hasManualOverride: boolean;
  userProgress: number | null;
  effectiveXpPerAction: number;
}

/**
 * Computes the live-adjusted skill XP and UI reconciliation metadata for the active craft.
 * Re-reconciles against serverSkillXp synchronously so even on the exact render frame where
 * BitJita flushes new server XP, XP is never double-counted.
 */
export function computeLiveXpAdjustment({
  anchor,
  serverSkillXp,
  hasServerExperience,
  hasManualOverride,
  userProgress,
  effectiveXpPerAction,
}: ComputeLiveXpAdjustmentParams): LiveSkillXpBridgeInfo | null {
  if (hasManualOverride || !hasServerExperience || userProgress === null || effectiveXpPerAction <= 0) {
    return null;
  }

  const safeServerXp = Math.max(0, Math.round(serverSkillXp));
  const safeProgress = Math.max(0, userProgress);
  const effectiveAnchor = reconcileLiveXpAnchor(anchor, safeServerXp, safeProgress);

  const observedDeltaProgress = Math.max(0, safeProgress - effectiveAnchor.baselineUserProgress);
  const priorCraftProgress = effectiveAnchor.hasObservedServerSync
    ? 0
    : Math.max(0, effectiveAnchor.baselineUserProgress);
  const priorCraftXp = Math.round(priorCraftProgress * effectiveXpPerAction);

  const isPriorCraftXpIncluded =
    !effectiveAnchor.hasObservedServerSync &&
    effectiveAnchor.includePriorCraftProgress &&
    priorCraftProgress > 0;

  const unflushedProgress = isPriorCraftXpIncluded ? safeProgress : observedDeltaProgress;
  const unflushedCraftXp = Math.round(unflushedProgress * effectiveXpPerAction);
  const effectiveSkillXp = safeServerXp + unflushedCraftXp;

  const isServerXpLagging = effectiveAnchor.hasObservedLag || observedDeltaProgress > 0;
  const canIncludePriorCraftXp =
    !effectiveAnchor.hasObservedServerSync && priorCraftProgress > 0 && priorCraftXp > 0;

  return {
    serverSkillXp: safeServerXp,
    serverSkillLevel: getLevelFromXp(safeServerXp),
    unflushedCraftXp,
    effectiveSkillXp,
    priorCraftProgress,
    priorCraftXp,
    isPriorCraftXpIncluded,
    isServerXpLagging,
    canIncludePriorCraftXp,
  };
}
