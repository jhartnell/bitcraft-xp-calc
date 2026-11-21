// Multi-User Collaborative Crafting Projection Calculator

import {
  CraftContribution,
  CraftResult,
  EquipmentSlot,
  PlayerBuff,
  PlayerDetails,
  PlayerStatsData,
} from '../types/api';
import {
  MultiUserCraftProjection,
  ParticipantContributionSummary,
  XpCalculationResult,
} from '../types/calculator';
import { BASE_ACTION_DURATION_SECONDS, PROFESSION_SPEED_STAT_IDS } from './toolMatching';

export interface ContributorDetailPayload {
  contribution: CraftContribution;
  playerDetails?: PlayerDetails | null;
  equipment?: EquipmentSlot[];
  buffs?: PlayerBuff[];
  stats?: PlayerStatsData | null;
  isIncluded?: boolean;
}

export function calculateMultiUserCraftProjection(
  _craft: CraftResult,
  primaryPlayer: PlayerDetails | null,
  primaryCalc: XpCalculationResult,
  contributorPayloads: ContributorDetailPayload[],
  activeWindowMinutes = 5.0
): MultiUserCraftProjection {
  const remainingEffort = primaryCalc.remainingProgress;
  const now = Date.now();
  const profStatId = PROFESSION_SPEED_STAT_IDS[primaryCalc.skillId];

  const participants: ParticipantContributionSummary[] = [];

  for (const payload of contributorPayloads) {
    const cb = payload.contribution;
    const isPrimary = Boolean(
      primaryPlayer &&
        (cb.contributorEntityId === primaryPlayer.entityId ||
          cb.contributorUsername?.toLowerCase() === primaryPlayer.username.toLowerCase())
    );

    // Calculate recency
    let minutesSinceLast = 999;
    if (cb.lastContributedAt) {
      const lastTime = new Date(cb.lastContributedAt).getTime();
      if (!isNaN(lastTime)) {
        minutesSinceLast = Math.max(0, Math.round(((now - lastTime) / 60000) * 10) / 10);
      }
    }

    // Determine activity status
    const isActive = isPrimary ? true : minutesSinceLast <= activeWindowMinutes;
    const isCurrentlyCrafting = isPrimary ? true : minutesSinceLast <= 1.0;
    const secondsUntilInactive =
      isActive && !isPrimary
        ? Math.max(0, Math.round(activeWindowMinutes * 60 - minutesSinceLast * 60))
        : 0;

    // Inclusion toggle: manual user override if set, otherwise follow dynamic activity
    const isIncludedInProjection = payload.isIncluded !== undefined ? payload.isIncluded : isActive;

    // Progress per action
    let ppa = 20;
    if (cb.contributionCount > 0 && cb.totalProgressContributed > 0) {
      ppa = Math.round((cb.totalProgressContributed / cb.contributionCount) * 10) / 10;
    }

    // Equipment, Buffs, and Speed calculation
    let craftingSpeedBonusPercent = 0;
    let secondsPerAction = primaryCalc.secondsPerAction;
    let xpMultiplier = 1.0;
    let equippedToolName: string | undefined;
    let equippedToolTier: number | undefined;
    const activeBuffsSummary: string[] = [];

    if (isPrimary) {
      craftingSpeedBonusPercent = primaryCalc.craftingSpeedBonusPercent;
      secondsPerAction = primaryCalc.secondsPerAction;
      xpMultiplier = primaryCalc.xpMultiplier;
      equippedToolName = primaryCalc.toolStatus.equippedTool?.name;
      equippedToolTier = primaryCalc.toolStatus.equippedTool?.tier;
      for (const b of primaryCalc.activeBuffModifiers) {
        if (b.craftingSpeedBonus !== 0) {
          activeBuffsSummary.push(
            `${b.name} (${b.craftingSpeedBonus > 0 ? '+' : ''}${(b.craftingSpeedBonus * 100).toFixed(0)}% Speed)`
          );
        }
      }
    } else if (payload.stats || payload.equipment || payload.buffs) {
      let equipSpeed = 0;
      let expRateBonus = 0;

      if (payload.equipment) {
        for (const eq of payload.equipment) {
          if (eq.item) {
            if (eq.item.tag?.toLowerCase().includes('tool') || eq.primary === 'main_hand') {
              equippedToolName = eq.item.name;
              equippedToolTier = eq.item.tier || 1;
            }
            if (eq.item.stats) {
              for (const st of eq.item.stats) {
                if (st.id === 15) equipSpeed += st.value;
                if (profStatId && st.id === profStatId) equipSpeed += st.value;
                if (st.id === 50) expRateBonus += st.value;
              }
            }
          }
        }
      }

      let buffSpeed = 0;
      if (payload.buffs) {
        for (const bf of payload.buffs) {
          const isActiveBuff = bf.status === 'active' || (bf.timeRemaining && bf.timeRemaining > 0);
          if (isActiveBuff && bf.stats) {
            for (const st of bf.stats) {
              if (st.id === 15) buffSpeed += st.value;
              if (st.id === 50) expRateBonus += st.value;
            }
            if (bf.description) activeBuffsSummary.push(bf.description);
          }
        }
      }

      const profSpeedBonus =
        profStatId &&
        payload.stats?.values &&
        typeof payload.stats.values[profStatId] === 'number' &&
        payload.stats.values[profStatId] > 0
          ? payload.stats.values[profStatId] - 1.0
          : 0;

      let totalSpeed = 1.0;
      if (
        payload.stats?.values &&
        typeof payload.stats.values[15] === 'number' &&
        payload.stats.values[15] > 0
      ) {
        totalSpeed = Math.max(0.1, payload.stats.values[15] + profSpeedBonus);
      } else {
        totalSpeed = Math.max(0.1, 1.0 + equipSpeed + buffSpeed + profSpeedBonus);
      }

      craftingSpeedBonusPercent = Math.round((totalSpeed - 1.0) * 100 * 10) / 10;
      secondsPerAction = BASE_ACTION_DURATION_SECONDS / totalSpeed;

      if (
        payload.stats?.values &&
        typeof payload.stats.values[50] === 'number' &&
        payload.stats.values[50] > 0
      ) {
        xpMultiplier = Math.max(1.0, payload.stats.values[50] / 100.0);
      } else {
        xpMultiplier = Math.max(0.1, 1.0 + expRateBonus);
      }
    }

    const effortPerSecond = secondsPerAction > 0 ? ppa / secondsPerAction : 0;
    const xpPerHour = Math.round(effortPerSecond * primaryCalc.baseXpPerAction * xpMultiplier * 3600);
    const earnedXp = Math.round(
      cb.totalProgressContributed * primaryCalc.baseXpPerAction * xpMultiplier
    );

    participants.push({
      entityId: cb.contributorEntityId,
      username: cb.contributorUsername || `Player #${cb.contributorEntityId.slice(0, 6)}`,
      isOnline: payload.playerDetails?.signedIn ?? true,
      isActive,
      isCurrentlyCrafting,
      isIncludedInProjection,
      lastContributedAt: cb.lastContributedAt,
      minutesSinceLastContribution: minutesSinceLast,
      secondsUntilInactive,
      totalProgressContributed: cb.totalProgressContributed,
      contributionCount: cb.contributionCount,
      progressPerAction: ppa,
      equippedToolName,
      equippedToolTier,
      craftingSpeedBonusPercent,
      secondsPerAction,
      effortPerSecond,
      xpPerHour,
      xpMultiplier,
      earnedXp,
      projectedRemainingEffort: 0,
      projectedRemainingXp: 0,
      totalExpectedXp: earnedXp,
      projectedSharePercent: 0,
      activeBuffsSummary,
    });
  }

  // Calculate Combined Collaborative Rate
  const includedParticipants = participants.filter((p) => p.isIncludedInProjection);
  const combinedEffortPerSecond = includedParticipants.reduce(
    (sum, p) => sum + Math.max(0, p.effortPerSecond),
    0
  );

  // Distribute remaining effort & compute projected XP
  for (const p of participants) {
    if (p.isIncludedInProjection && combinedEffortPerSecond > 0) {
      const share = p.effortPerSecond / combinedEffortPerSecond;
      p.projectedSharePercent = Math.round(share * 1000) / 10;
      p.projectedRemainingEffort = Math.round(remainingEffort * share);
      p.projectedRemainingXp = Math.round(
        p.projectedRemainingEffort * primaryCalc.baseXpPerAction * p.xpMultiplier
      );
      p.totalExpectedXp = p.earnedXp + p.projectedRemainingXp;
    } else {
      p.projectedSharePercent = 0;
      p.projectedRemainingEffort = 0;
      p.projectedRemainingXp = 0;
      p.totalExpectedXp = p.earnedXp;
    }
  }

  const soloEstimatedSecondsRemaining = primaryCalc.estimatedSecondsRemaining;
  const collaborativeEstimatedSecondsRemaining =
    combinedEffortPerSecond > 0
      ? Math.round(remainingEffort / combinedEffortPerSecond)
      : soloEstimatedSecondsRemaining;

  const secondsProjectedSaved = Math.max(
    0,
    soloEstimatedSecondsRemaining - collaborativeEstimatedSecondsRemaining
  );

  const primaryIsOwner = Boolean(
    primaryPlayer?.entityId && _craft.ownerEntityId === primaryPlayer.entityId
  );
  const primaryIsContributor = participants.some(
    (p) =>
      Boolean(
        primaryPlayer &&
          ((primaryPlayer.entityId && p.entityId === primaryPlayer.entityId) ||
            (primaryPlayer.username &&
              p.username?.toLowerCase() === primaryPlayer.username.toLowerCase()))
      ) && p.totalProgressContributed > 0
  );

  let helperEffortContributed = 0;
  if (primaryIsOwner || primaryIsContributor) {
    for (const p of participants) {
      const isPrimary = Boolean(
        primaryPlayer &&
          ((primaryPlayer.entityId && p.entityId === primaryPlayer.entityId) ||
            (primaryPlayer.username &&
              p.username?.toLowerCase() === primaryPlayer.username.toLowerCase()))
      );
      if (!isPrimary) {
        helperEffortContributed += Math.max(0, p.totalProgressContributed);
      }
    }
  }

  const helperActionsOwnerSaved =
    primaryCalc.progressPerAction > 0
      ? Math.ceil(helperEffortContributed / primaryCalc.progressPerAction)
      : 0;

  const secondsAlreadySaved = Math.round(helperActionsOwnerSaved * primaryCalc.secondsPerAction);
  const secondsTotalSaved = secondsAlreadySaved + secondsProjectedSaved;

  const soloEtaCompletionTime = primaryCalc.estimatedCompletionTime;
  let collaborativeEtaCompletionTime: string | null = null;
  if (
    collaborativeEstimatedSecondsRemaining > 0 &&
    isFinite(collaborativeEstimatedSecondsRemaining)
  ) {
    const colDate = new Date(Date.now() + collaborativeEstimatedSecondsRemaining * 1000);
    collaborativeEtaCompletionTime = colDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  return {
    activeParticipantsCount: includedParticipants.length,
    totalContributorsCount: participants.length,
    inactivityTimeoutMinutes: activeWindowMinutes,
    soloEstimatedSecondsRemaining,
    collaborativeEstimatedSecondsRemaining,
    secondsSaved: secondsProjectedSaved,
    secondsProjectedSaved,
    secondsAlreadySaved,
    secondsTotalSaved,
    soloEtaCompletionTime,
    collaborativeEtaCompletionTime,
    combinedEffortPerSecond,
    participants,
  };
}
