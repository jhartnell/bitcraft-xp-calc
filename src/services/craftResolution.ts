import { CraftResult } from '../types/api';
import { getCraftSkillId } from './bitcraftData';

export interface CraftResolutionInput {
  currentTargetCraftId: string | null;
  activeGainedSkillIds: Set<number>;
  ownedActiveCrafts: CraftResult[];
  candidateSharedCrafts: CraftResult[];
  verifiedHelperCraftIds?: Set<string>;
  playerContribSnapshot?: Map<string, number>;
  playerEntityId?: string;
  playerUsername?: string;
}

export interface CraftResolutionResult {
  selectedCraftId: string | null;
  selectedCraftIndex: number;
  customCraft: CraftResult | null;
  isResolved: boolean;
  reason:
    | 'active_xp_match_current'
    | 'active_xp_match_owned'
    | 'active_xp_match_shared'
    | 'sticky_owned'
    | 'sticky_shared'
    | 'fallback_owned'
    | 'fallback_shared'
    | 'none';
}

/**
 * Checks if a craft is currently active and incomplete
 */
export function isCraftOngoing(craft?: CraftResult | null): boolean {
  if (!craft) return false;
  if (craft.completed || craft.status === 'completed') return false;
  const progress = craft.progress ?? 0;
  const total = craft.totalActionsRequired || Infinity;
  return progress < total;
}

/**
 * Finds the index of the best owned craft to prioritize (e.g. by lock expiration)
 */
function findBestOwnedCraftIndex(ownedCrafts: CraftResult[]): number {
  if (!ownedCrafts || ownedCrafts.length === 0) return 0;
  const now = Date.now();
  for (let i = 0; i < ownedCrafts.length; i++) {
    const lockTime = ownedCrafts[i].lockExpiration
      ? new Date(ownedCrafts[i].lockExpiration!).getTime()
      : 0;
    if (lockTime > now - 60_000) {
      return i;
    }
  }
  return 0;
}

/**
 * Resolves which craft to select based on skill XP deltas, persistence, and candidate crafts.
 */
export function resolveActiveCraftSelection(input: CraftResolutionInput): CraftResolutionResult {
  const {
    currentTargetCraftId,
    activeGainedSkillIds,
    ownedActiveCrafts,
    candidateSharedCrafts,
    verifiedHelperCraftIds,
  } = input;

  // Deduplicate and filter ongoing candidate shared crafts that are not owned
  const ongoingOwned = ownedActiveCrafts.filter(isCraftOngoing);
  const ongoingShared = candidateSharedCrafts.filter(
    (c) => isCraftOngoing(c) && !ongoingOwned.some((oc) => oc.entityId === c.entityId)
  );

  // Identify currently selected craft object if present
  const currentOwnedIndex = currentTargetCraftId
    ? ongoingOwned.findIndex((c) => c.entityId === currentTargetCraftId)
    : -1;
  const currentSharedCraft = currentTargetCraftId && currentOwnedIndex === -1
    ? ongoingShared.find((c) => c.entityId === currentTargetCraftId) || null
    : null;

  // 1. XP-DRIVEN SWITCHING / RETENTION (When player gained XP in one or more skills in this polling tick)
  if (activeGainedSkillIds.size > 0) {
    // 1A. Check if current craft matches any gained skill
    if (currentOwnedIndex >= 0) {
      const currentOwnedCraft = ongoingOwned[currentOwnedIndex];
      const ownedSkill = getCraftSkillId(currentOwnedCraft);
      if (ownedSkill !== null && activeGainedSkillIds.has(ownedSkill)) {
        // Player is actively gaining XP on their currently selected owned craft!
        return {
          selectedCraftId: currentOwnedCraft.entityId,
          selectedCraftIndex: currentOwnedIndex,
          customCraft: null,
          isResolved: true,
          reason: 'active_xp_match_current',
        };
      }
    } else if (currentSharedCraft) {
      const helperSkill = getCraftSkillId(currentSharedCraft);
      if (helperSkill !== null && activeGainedSkillIds.has(helperSkill)) {
        // Player is actively gaining XP on their currently selected helper craft!
        return {
          selectedCraftId: currentSharedCraft.entityId,
          selectedCraftIndex: 0,
          customCraft: currentSharedCraft,
          isResolved: true,
          reason: 'active_xp_match_current',
        };
      }
    }

    // 1B. Player gained XP in a skill DIFFERENT from the current craft (or no craft was selected).
    // Search for a matching craft:
    // First, check owned crafts for a match
    const matchingOwnedIndex = ongoingOwned.findIndex((c) => {
      const s = getCraftSkillId(c);
      return s !== null && activeGainedSkillIds.has(s);
    });

    if (matchingOwnedIndex >= 0) {
      const targetCraft = ongoingOwned[matchingOwnedIndex];
      return {
        selectedCraftId: targetCraft.entityId,
        selectedCraftIndex: matchingOwnedIndex,
        customCraft: null,
        isResolved: true,
        reason: 'active_xp_match_owned',
      };
    }

    // Second, check candidate shared crafts for a match
    const matchingSharedCraft = ongoingShared.find((c) => {
      const s = getCraftSkillId(c);
      return s !== null && activeGainedSkillIds.has(s);
    });

    if (matchingSharedCraft) {
      return {
        selectedCraftId: matchingSharedCraft.entityId,
        selectedCraftIndex: 0,
        customCraft: matchingSharedCraft,
        isResolved: true,
        reason: 'active_xp_match_shared',
      };
    }
  }

  // 2. STICKY SELECTION (When no XP was gained in this tick, or gained XP was for unrelated skill)
  if (currentTargetCraftId) {
    if (currentOwnedIndex >= 0) {
      return {
        selectedCraftId: currentTargetCraftId,
        selectedCraftIndex: currentOwnedIndex,
        customCraft: null,
        isResolved: true,
        reason: 'sticky_owned',
      };
    }

    if (currentSharedCraft) {
      return {
        selectedCraftId: currentSharedCraft.entityId,
        selectedCraftIndex: 0,
        customCraft: currentSharedCraft,
        isResolved: true,
        reason: 'sticky_shared',
      };
    }
  }

  // 3. FALLBACK SELECTION (No selection, or previous targeted craft completed/expired)
  if (ongoingOwned.length > 0) {
    const bestIdx = findBestOwnedCraftIndex(ongoingOwned);
    return {
      selectedCraftId: ongoingOwned[bestIdx].entityId,
      selectedCraftIndex: bestIdx,
      customCraft: null,
      isResolved: true,
      reason: 'fallback_owned',
    };
  }

  if (ongoingShared.length > 0) {
    // Only auto-fallback to a shared craft if the player is a verified contributor
    // (avoids assuming the player is helping on random nearby or merely previewed stations)
    const fallbackCandidate = verifiedHelperCraftIds
      ? ongoingShared.find((c) => verifiedHelperCraftIds.has(c.entityId))
      : ongoingShared[0];

    if (fallbackCandidate) {
      return {
        selectedCraftId: fallbackCandidate.entityId,
        selectedCraftIndex: 0,
        customCraft: fallbackCandidate,
        isResolved: true,
        reason: 'fallback_shared',
      };
    }
  }

  return {
    selectedCraftId: null,
    selectedCraftIndex: 0,
    customCraft: null,
    isResolved: false,
    reason: 'none',
  };
}
