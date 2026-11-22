// Multi-User Collaborative Crafting Projection Calculator

import {
  CraftContribution,
  CraftResult,
  EquipmentSlot,
  PlayerBuff,
  PlayerDetails,
  PlayerStatsData,
  PlayerToolEntry,
} from '../types/api';
import {
  MultiUserCraftProjection,
  ParticipantContributionSummary,
  XpCalculationResult,
} from '../types/calculator';
import {
  SKILL_DEFINITIONS,
  TOOL_TYPE_NAMES,
  getItemPower,
  getProfessionLevelStats,
  getXpProgressForLevel,
} from './bitcraftData';
import {
  ALL_PROFESSION_NAMES,
  BASE_ACTION_DURATION_SECONDS,
  PROFESSION_SPEED_STAT_IDS,
  resolveEquippedTool,
} from './toolMatching';

export interface ContributorDetailPayload {
  contribution: CraftContribution;
  playerDetails?: PlayerDetails | null;
  equipment?: EquipmentSlot[];
  buffs?: PlayerBuff[];
  stats?: PlayerStatsData | null;
  tools?: PlayerToolEntry[];
  isIncluded?: boolean;
}

function hasAuthoritativeToolPower(tool: EquipmentSlot['item']): boolean {
  return Boolean(
    tool &&
      tool.id !== 'active_tool' &&
      ((tool.toolStats && typeof tool.toolStats.power === 'number' && tool.toolStats.power > 0) ||
        tool.stats?.some((st) => st.id === 2 || (st.name || '').toLowerCase().includes('power')))
  );
}

function resolveHelperSkillLevel(playerDetails: PlayerDetails | null | undefined, skillId: number): number {
  if (!playerDetails?.experience || !Array.isArray(playerDetails.experience)) {
    return 1;
  }
  const expObj = playerDetails.experience.find(
    (e) =>
      e.skill_id === skillId ||
      (e as unknown as Record<string, unknown>).skillId === skillId ||
      (e as unknown as Record<string, unknown>).id === skillId
  );
  if (!expObj) return 1;
  const rawQty =
    expObj.quantity ??
    (expObj as unknown as Record<string, unknown>).experience ??
    (expObj as unknown as Record<string, unknown>).xp ??
    0;
  const xp = typeof rawQty === 'number' ? rawQty : Number(rawQty) || 0;
  return getXpProgressForLevel(xp).level;
}

function computeHistoricalProgressPerAction(
  cb: CraftContribution,
  craftOwnerEntityId?: string
): number {
  if (cb.contributionCount <= 0 || cb.totalProgressContributed <= 0) {
    return 20;
  }

  // Detect BitJita's +1 station-initiation off-by-one entry when exact or on the station owner
  if (cb.contributionCount > 1 && cb.totalProgressContributed % cb.contributionCount !== 0) {
    const adjustedCount = cb.contributionCount - 1;
    const isExactAdjusted = cb.totalProgressContributed % adjustedCount === 0;
    const isStationOwner = Boolean(craftOwnerEntityId && cb.contributorEntityId === craftOwnerEntityId);
    if (isExactAdjusted || isStationOwner) {
      return Math.round((cb.totalProgressContributed / adjustedCount) * 10) / 10;
    }
  }

  return Math.round((cb.totalProgressContributed / cb.contributionCount) * 10) / 10;
}

export function calculateMultiUserCraftProjection(
  craft: CraftResult,
  primaryPlayer: PlayerDetails | null,
  primaryCalc: XpCalculationResult,
  contributorPayloads: ContributorDetailPayload[],
  activeWindowMinutes = 5.0
): MultiUserCraftProjection {
  const remainingEffort = primaryCalc.remainingProgress;
  const now = Date.now();
  const skillId = primaryCalc.skillId;
  const profStatId = PROFESSION_SPEED_STAT_IDS[skillId];
  const skillDef = SKILL_DEFINITIONS[skillId] || {
    id: skillId,
    name: primaryCalc.skillName,
    category: 'Profession' as const,
    icon: '✨',
    color: '#10b981',
  };
  const skillNameLower = (skillDef.name || '').toLowerCase();
  const isGatheringSkill = [2, 5, 11, 12, 14].includes(skillId);
  const toolReq =
    craft.toolRequirements && craft.toolRequirements.length > 0 ? craft.toolRequirements[0] : null;
  const reqToolType = toolReq?.tool_type ?? skillDef.toolType ?? 0;
  const reqToolLevel = toolReq?.level ?? 1;
  const reqToolName = TOOL_TYPE_NAMES[reqToolType] || toolReq?.name || 'Tool';

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

    let ppa = 20;
    let craftingSpeedBonusPercent = 0;
    let secondsPerAction = primaryCalc.secondsPerAction;
    let xpMultiplier = 1.0;
    let equippedToolName: string | undefined;
    let equippedToolTier: number | undefined;
    const activeBuffsSummary: string[] = [];

    if (isPrimary) {
      ppa = primaryCalc.progressPerAction;
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
    } else {
      const helperEquipment = payload.equipment || [];
      const helperBuffs = payload.buffs || [];
      const helperTools = payload.tools || [];
      const helperDetails: PlayerDetails | null =
        payload.playerDetails ||
        (cb.contributorEntityId
          ? {
              entityId: cb.contributorEntityId,
              username: cb.contributorUsername || `Player #${cb.contributorEntityId.slice(0, 6)}`,
            }
          : null);

      const hasDetailedPayload = Boolean(
        payload.stats ||
          helperEquipment.length > 0 ||
          helperBuffs.length > 0 ||
          helperTools.length > 0 ||
          payload.playerDetails
      );

      if (hasDetailedPayload) {
        const { equippedTool } = resolveEquippedTool({
          skillId,
          skillDef,
          reqToolType,
          reqToolLevel,
          reqToolName,
          craft,
          player: helperDetails,
          equipment: helperEquipment,
          contributions: [cb],
          playerTools: helperTools,
        });

        if (equippedTool && equippedTool.id !== 'active_tool') {
          equippedToolName = equippedTool.name;
          equippedToolTier = equippedTool.tier || 1;
        }

        let equipSpeed = 0;
        let equipExpRateBonus = 0;
        let extraGearPower = 0;

        for (const slot of helperEquipment) {
          if (!slot.item?.stats) continue;

          let slotCraftSpeed = 0;
          let slotProfSpeed = 0;
          let slotGatherSpeed = 0;

          for (const st of slot.item.stats) {
            const statNameLower = (st.name || '').toLowerCase();
            const belongsToOtherProfession = ALL_PROFESSION_NAMES.some(
              (p) => p !== skillNameLower && statNameLower.includes(p)
            );
            if (belongsToOtherProfession) continue;

            if (st.id === 15 || statNameLower.includes('crafting speed')) {
              slotCraftSpeed += st.value;
            }
            if (
              (profStatId && st.id === profStatId) ||
              (skillNameLower && statNameLower.includes(`${skillNameLower} speed`))
            ) {
              slotProfSpeed += st.value;
            }
            if (st.id === 16 || statNameLower.includes('gathering speed')) {
              slotGatherSpeed += st.value;
            }
            if (
              st.id === 2 ||
              statNameLower.includes('tool power') ||
              (skillNameLower && statNameLower.includes(`${skillNameLower} power`)) ||
              statNameLower === 'power'
            ) {
              if (slot.item !== equippedTool) {
                extraGearPower += st.value;
              }
            }
            if (
              st.id === 50 ||
              statNameLower.includes('experience rate') ||
              (skillNameLower && statNameLower.includes(`${skillNameLower} exp`))
            ) {
              equipExpRateBonus += st.value;
            }
          }

          equipSpeed += slotCraftSpeed + slotProfSpeed + (isGatheringSkill ? slotGatherSpeed : 0);
        }

        let buffSpeed = 0;
        let buffExpRateBonus = 0;
        for (const bf of helperBuffs) {
          const isActiveBuff = bf.status === 'active' || (bf.timeRemaining && bf.timeRemaining > 0);
          if (!isActiveBuff || !bf.stats) continue;

          let thisBuffSpeed = 0;
          for (const st of bf.stats) {
            const stLower = (st.name || '').toLowerCase();
            if (st.id === 15 || stLower.includes('crafting speed')) {
              buffSpeed += st.value;
              thisBuffSpeed += st.value;
            }
            if (st.id === 50 || stLower.includes('experience rate')) {
              buffExpRateBonus += st.value;
            }
          }
          if (thisBuffSpeed !== 0 && (bf.description || bf.buffName)) {
            activeBuffsSummary.push(
              `${bf.description || bf.buffName} (${thisBuffSpeed > 0 ? '+' : ''}${(thisBuffSpeed * 100).toFixed(0)}% Speed)`
            );
          }
        }

        const helperLevel = resolveHelperSkillLevel(payload.playerDetails, skillId);
        const helperLevelStats = getProfessionLevelStats(skillId, helperLevel);

        // Authoritative helper tool power takes precedence over BitJita's historical ratio
        if (hasAuthoritativeToolPower(equippedTool)) {
          const baseToolPower = getItemPower(equippedTool);
          ppa = Math.max(1, baseToolPower + extraGearPower + helperLevelStats.power);
        } else {
          ppa = computeHistoricalProgressPerAction(cb, craft.ownerEntityId);
        }

        const profSpeedBonus =
          profStatId &&
          payload.stats?.values &&
          typeof payload.stats.values[profStatId] === 'number' &&
          payload.stats.values[profStatId] > 0
            ? payload.stats.values[profStatId] - 1.0
            : helperLevelStats.speed / 100;

        // Unified speed reconciliation (matches xpCalculator.ts):
        // Prefer explicit equipment crafting speed over stale server stat #15 so expired
        // food buffs lingering in /stats do not inflate helper speed; when equipment has no
        // speed stats, subtract active server buff speed from stat #15 to avoid double-counting.
        const effectiveEquipSpeed =
          equipSpeed > 0
            ? equipSpeed
            : payload.stats?.values &&
                typeof payload.stats.values[15] === 'number' &&
                payload.stats.values[15] > 0
              ? Math.max(0, payload.stats.values[15] - 1.0 - buffSpeed)
              : 0;

        const totalSpeed = Math.max(0.1, 1.0 + effectiveEquipSpeed + buffSpeed + profSpeedBonus);
        craftingSpeedBonusPercent = Math.round((totalSpeed - 1.0) * 100 * 10) / 10;
        secondsPerAction = BASE_ACTION_DURATION_SECONDS / totalSpeed;

        if (
          payload.stats?.values &&
          typeof payload.stats.values[50] === 'number' &&
          payload.stats.values[50] > 0
        ) {
          xpMultiplier = Math.max(1.0, payload.stats.values[50] / 100.0);
        } else {
          xpMultiplier = Math.max(0.1, 1.0 + equipExpRateBonus + buffExpRateBonus);
        }
      } else {
        ppa = computeHistoricalProgressPerAction(cb, craft.ownerEntityId);
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
    primaryPlayer?.entityId && craft.ownerEntityId === primaryPlayer.entityId
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
