// Comprehensive XP and Crafting Calculation Engine for Bitcraft Online

import {
  CraftResult,
  PlayerDetails,
  EquipmentSlot,
  PlayerBuff,
  PlayerStatsData,
  CraftContribution,
} from '../types/api';
import {
  XpCalculationResult,
  ToolStatusInfo,
  ActiveBuffModifier,
  EquipmentModifier,
  ParticipantContributionSummary,
  MultiUserCraftProjection,
  LevelMilestone,
  LevelProgressForecast,
} from '../types/calculator';
import {
  SKILL_DEFINITIONS,
  TOOL_TYPE_NAMES,
  DEFAULT_SKILL_BASE_XP,
  calculateXpForLevel,
  getXpProgressForLevel,
} from './bitcraftData';

// BitCraft Online base crafting station action tick duration is exactly 1.6 seconds
export const BASE_ACTION_DURATION_SECONDS = 1.6;

export interface ContributorDetailPayload {
  contribution: CraftContribution;
  playerDetails?: PlayerDetails | null;
  equipment?: EquipmentSlot[];
  buffs?: PlayerBuff[];
  stats?: PlayerStatsData | null;
  isIncluded?: boolean;
}

export function calculateCraftXp(
  craft: CraftResult,
  player: PlayerDetails | null,
  equipment: EquipmentSlot[] = [],
  buffs: PlayerBuff[] = [],
  stats: PlayerStatsData | null = null,
  contributions: CraftContribution[] = [],
  overrideProgressPerAction: number | null = null,
  overrideBaseXp: number | null = null
): XpCalculationResult {
  // 1. Identify primary skill for the craft
  let skillId = 4; // default masonry
  if (craft.experiencePerProgress && craft.experiencePerProgress.length > 0) {
    skillId = craft.experiencePerProgress[0].skill_id;
  } else if (craft.levelRequirements && craft.levelRequirements.length > 0) {
    skillId = craft.levelRequirements[0].skill_id;
  }

  const skillDef = SKILL_DEFINITIONS[skillId] || {
    id: skillId,
    name: `Skill #${skillId}`,
    category: 'Profession' as const,
    icon: '✨',
    color: '#10b981',
  };

  // 2. Base XP per progress unit
  let baseXpPerAction = DEFAULT_SKILL_BASE_XP[skillId] || 1.6;
  if (overrideBaseXp && overrideBaseXp > 0) {
    baseXpPerAction = overrideBaseXp;
  } else if (craft.experiencePerProgress && craft.experiencePerProgress.length > 0) {
    const matched = craft.experiencePerProgress.find((ep) => ep.skill_id === skillId);
    baseXpPerAction = matched ? matched.quantity : craft.experiencePerProgress[0].quantity;
  }

  // 3. Progress and Items Breakdown
  const progressPerItem = craft.actionsRequiredPerItem || 1;
  const itemsTotal = craft.craftCount || 1;
  const totalProgressRequired = craft.totalActionsRequired || progressPerItem * itemsTotal;
  const completedProgress = Math.min(totalProgressRequired, Math.max(0, craft.progress || 0));
  const remainingProgress = Math.max(0, totalProgressRequired - completedProgress);
  const progressPercent = totalProgressRequired > 0 ? (completedProgress / totalProgressRequired) * 100 : 0;

  const itemsCompleted = Math.min(itemsTotal, Math.floor(completedProgress / progressPerItem));
  const itemsRemaining = Math.max(0, itemsTotal - itemsCompleted);

  // 4. Required Tool & Equipped Tool Matching
  const toolReq = craft.toolRequirements && craft.toolRequirements.length > 0 ? craft.toolRequirements[0] : null;
  const reqToolType = toolReq?.tool_type ?? (skillDef.toolType ?? 0);
  const reqToolLevel = toolReq?.level ?? 1;
  const reqToolPower = toolReq?.power ?? 1;
  const reqToolName = TOOL_TYPE_NAMES[reqToolType] || toolReq?.name || 'Tool';

  let equippedTool: EquipmentSlot['item'] = null;
  let isEquipped = false;
  let effectivePower = 1;

  for (const slot of equipment) {
    if (slot.item) {
      const isMainOrOff = slot.primary === 'main_hand' || slot.primary === 'off_hand';
      const itemName = slot.item.name.toLowerCase();
      const itemTag = (slot.item.tag || slot.item.tags || '').toLowerCase();
      const targetToolName = reqToolName.toLowerCase();
      const skillName = skillDef.name.toLowerCase();

      const matchesTool = itemName.includes(targetToolName) || itemTag.includes(targetToolName);
      const matchesSkill = itemTag.includes(skillName) || slot.primary.includes(skillName);

      if (isMainOrOff || matchesTool || matchesSkill) {
        if (!equippedTool || matchesTool) {
          equippedTool = slot.item;
        }
      }
    }
  }

  if (equippedTool) {
    isEquipped = true;
    effectivePower = equippedTool.tier || 1;
  }

  const toolStatus: ToolStatusInfo = {
    requiredToolName: reqToolName,
    requiredToolType: reqToolType,
    requiredToolLevel: reqToolLevel,
    requiredToolPower: reqToolPower,
    equippedTool,
    isEquipped,
    meetsLevelReq: equippedTool ? (equippedTool.tier || 1) >= reqToolLevel : false,
    meetsPowerReq: equippedTool ? (equippedTool.tier || 1) >= reqToolPower : false,
    effectivePower,
  };

  // 5. Calculate Progress Per Physical Action (Effort per click/tick)
  let progressPerAction = 20;
  let isMeasuredProgressPerAction = false;

  if (overrideProgressPerAction && overrideProgressPerAction > 0) {
    progressPerAction = overrideProgressPerAction;
  } else {
    if (player && contributions.length > 0) {
      const userContrib = contributions.find(
        (c) =>
          c.contributorEntityId === player.entityId ||
          c.contributorUsername?.toLowerCase() === player.username.toLowerCase()
      );
      if (userContrib && userContrib.contributionCount > 0 && userContrib.totalProgressContributed > 0) {
        progressPerAction = Math.round((userContrib.totalProgressContributed / userContrib.contributionCount) * 10) / 10;
        isMeasuredProgressPerAction = true;
      }
    }

    if (!isMeasuredProgressPerAction) {
      const toolTier = equippedTool?.tier || reqToolLevel || 1;
      progressPerAction = Math.max(5, 5 * (toolTier + 1));
    }
  }

  const physicalActionsTotal = Math.ceil(totalProgressRequired / progressPerAction);
  const physicalActionsCompleted = Math.ceil(completedProgress / progressPerAction);
  const physicalActionsRemaining = Math.max(0, physicalActionsTotal - physicalActionsCompleted);

  // 6. Equipment Modifiers (Crafting speed %, Experience Rate %, stamina bonuses)
  const equipmentModifiers: EquipmentModifier[] = [];
  let equipCraftingSpeedBonus = 0;
  let equipGatheringSpeedBonus = 0;
  let equipStaminaBonus = 0;
  let equipExpRateBonus = 0;

  for (const slot of equipment) {
    if (slot.item && slot.item.stats) {
      let slotCraftingSpeed = 0;
      let slotGatheringSpeed = 0;
      let slotStamina = 0;

      for (const stat of slot.item.stats) {
        if (stat.id === 15 || stat.name.toLowerCase().includes('crafting speed')) {
          slotCraftingSpeed += stat.value;
        }
        if (stat.id === 16 || stat.name.toLowerCase().includes('gathering speed')) {
          slotGatheringSpeed += stat.value;
        }
        if (stat.id === 1 || stat.name.toLowerCase().includes('stamina')) {
          slotStamina += stat.value;
        }
        if (stat.id === 50 || stat.name.toLowerCase().includes('experience rate')) {
          equipExpRateBonus += stat.value;
        }
      }

      if (slotCraftingSpeed !== 0 || slotGatheringSpeed !== 0 || slotStamina !== 0) {
        equipCraftingSpeedBonus += slotCraftingSpeed;
        equipGatheringSpeedBonus += slotGatheringSpeed;
        equipStaminaBonus += slotStamina;

        equipmentModifiers.push({
          slot: slot.primary,
          itemName: slot.item.name,
          tier: slot.item.tier || 1,
          rarity: slot.item.rarityString || slot.item.rarityStr || 'Common',
          craftingSpeedBonus: slotCraftingSpeed,
          gatheringSpeedBonus: slotGatheringSpeed,
          staminaBonus: slotStamina,
        });
      }
    }
  }

  // 7. Active Buff & Debuff Modifiers
  const activeBuffModifiers: ActiveBuffModifier[] = [];
  let buffCraftingSpeedBonus = 0;
  let buffGatheringSpeedBonus = 0;
  let buffStaminaRegenBonus = 0;
  let buffExpRateBonus = 0;

  for (const buff of buffs) {
    const isBuffActive = buff.status === 'active' || (buff.timeRemaining && buff.timeRemaining > 0);
    if (!isBuffActive) continue;

    let buffCraftSpeed = 0;
    let buffGatherSpeed = 0;
    let buffStaminaRegen = 0;

    if (buff.stats) {
      for (const st of buff.stats) {
        if (st.id === 15 || st.name.toLowerCase().includes('crafting speed')) {
          buffCraftSpeed += st.value;
        }
        if (st.id === 16 || st.name.toLowerCase().includes('gathering speed')) {
          buffGatherSpeed += st.value;
        }
        if (st.id === 48 || st.name.toLowerCase().includes('stamina regeneration')) {
          buffStaminaRegen += st.value;
        }
        if (st.id === 50 || st.name.toLowerCase().includes('experience rate')) {
          buffExpRateBonus += st.value;
        }
      }
    }

    buffCraftingSpeedBonus += buffCraftSpeed;
    buffGatheringSpeedBonus += buffGatherSpeed;
    buffStaminaRegenBonus += buffStaminaRegen;

    const remainingSecs = Math.max(0, buff.timeRemaining || 0);

    activeBuffModifiers.push({
      name: buff.description || buff.buffName || 'Buff',
      category: buff.buffName || 'Buff',
      craftingSpeedBonus: buffCraftSpeed,
      gatheringSpeedBonus: buffGatherSpeed,
      staminaRegenBonus: buffStaminaRegen,
      durationSeconds: buff.buffDuration || 0,
      remainingSeconds: remainingSecs,
      isExpiringSoon: remainingSecs > 0 && remainingSecs < 120,
      isDebuff: buffCraftSpeed < 0,
    });
  }

  // 8. Total Crafting Speed Multiplier
  let totalCraftingSpeedMultiplier: number;

  if (stats && stats.values && typeof stats.values[15] === 'number' && stats.values[15] > 0) {
    totalCraftingSpeedMultiplier = stats.values[15];
  } else {
    const calculatedSum = 1.0 + equipCraftingSpeedBonus + buffCraftingSpeedBonus;
    totalCraftingSpeedMultiplier = Math.max(0.1, calculatedSum);
  }

  const craftingSpeedBonusPercent = Math.round((totalCraftingSpeedMultiplier - 1.0) * 100 * 10) / 10;

  // In-Game action duration
  const secondsPerAction = BASE_ACTION_DURATION_SECONDS / totalCraftingSpeedMultiplier;
  const effectiveActionsPerSecond = 1.0 / secondsPerAction;

  // 9. XP Multiplier (Server authoritative or equipment + buffs)
  let xpMultiplier = 1.0;
  if (stats && stats.values && typeof stats.values[50] === 'number' && stats.values[50] > 0) {
    // Server stat 50 is total experience rate percentage (e.g. 108 = 1.08x)
    xpMultiplier = Math.max(1.0, stats.values[50] / 100.0);
  } else {
    xpMultiplier = 1.0 + equipExpRateBonus + buffExpRateBonus;
    const skillNameLower = skillDef.name.toLowerCase();
    for (const slot of equipment) {
      if (slot.primary.includes('instrument') && slot.item) {
        if (slot.primary.includes(skillNameLower) || slot.item.name.toLowerCase().includes(skillNameLower)) {
          xpMultiplier += 0.05;
        }
      }
    }
  }

  const effectiveXpPerAction = baseXpPerAction * xpMultiplier;
  const totalCraftXp = Math.round(totalProgressRequired * effectiveXpPerAction);
  const earnedXp = Math.round(completedProgress * effectiveXpPerAction);
  const remainingXp = Math.max(0, totalCraftXp - earnedXp);

  // 10. Current & Projected Player Level Progress
  let currentSkillXp = 0;
  if (player && player.experience) {
    const expObj = player.experience.find((e) => e.skill_id === skillId);
    if (expObj) {
      currentSkillXp = expObj.quantity;
    }
  }

  const currentLevelProgress = getXpProgressForLevel(currentSkillXp);
  const projectedSkillXp = currentSkillXp + remainingXp;
  const projectedLevelProgress = getXpProgressForLevel(projectedSkillXp);
  const levelsGained = Math.max(0, projectedLevelProgress.level - currentLevelProgress.level);

  // 11. Exact In-Game Matched ETA, Hourly Rate & Completion Time
  const estimatedSecondsRemaining = Math.round(physicalActionsRemaining * secondsPerAction);
  const effortPerSecond = secondsPerAction > 0 ? progressPerAction / secondsPerAction : 0;
  const effortPerHour = Math.round(effortPerSecond * 3600);
  const xpPerSecond = effortPerSecond * effectiveXpPerAction;
  const xpPerHour = Math.round(xpPerSecond * 3600);

  let estimatedCompletionTime: string | null = null;
  if (estimatedSecondsRemaining > 0 && isFinite(estimatedSecondsRemaining)) {
    const completionDate = new Date(Date.now() + estimatedSecondsRemaining * 1000);
    estimatedCompletionTime = completionDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  return {
    skillId,
    skillName: skillDef.name,
    baseXpPerAction,
    effectiveXpPerAction,
    xpMultiplier,
    
    totalCraftXp,
    earnedXp,
    remainingXp,
    
    totalProgressRequired,
    completedProgress,
    remainingProgress,
    progressPercent,

    progressPerAction,
    isMeasuredProgressPerAction,
    physicalActionsTotal,
    physicalActionsCompleted,
    physicalActionsRemaining,
    
    itemsTotal,
    itemsCompleted,
    itemsRemaining,
    progressPerItem,
    
    currentSkillLevel: currentLevelProgress.level,
    currentSkillXp,
    projectedSkillXp,
    projectedSkillLevel: projectedLevelProgress.level,
    xpForCurrentLevel: currentLevelProgress.currentLevelXp,
    xpForNextLevel: currentLevelProgress.nextLevelXp,
    currentLevelProgressPct: currentLevelProgress.progressPercent,
    projectedLevelProgressPct: projectedLevelProgress.progressPercent,
    levelsGained,
    
    baseActionDurationSeconds: BASE_ACTION_DURATION_SECONDS,
    secondsPerAction,
    totalCraftingSpeedMultiplier,
    craftingSpeedBonusPercent,
    effectiveActionsPerSecond,
    effortPerHour,
    xpPerHour,
    estimatedSecondsRemaining,
    estimatedCompletionTime,
    
    toolStatus,
    activeBuffModifiers,
    equipmentModifiers,
    levelForecast: calculateLevelProgressForecast(
      currentSkillXp,
      remainingProgress,
      completedProgress,
      totalProgressRequired,
      progressPerItem,
      itemsTotal,
      effectiveXpPerAction,
      progressPerAction,
      secondsPerAction
    ),
  };
}

// Level Milestone and Progression Timing Calculator
export function calculateLevelProgressForecast(
  currentSkillXp: number,
  remainingProgress: number,
  completedProgress: number,
  totalProgressRequired: number,
  progressPerItem: number,
  itemsTotal: number,
  effectiveXpPerAction: number,
  progressPerAction: number,
  secondsPerAction: number
): LevelProgressForecast {
  const currentInfo = getXpProgressForLevel(currentSkillXp);
  const remainingCraftXp = remainingProgress * effectiveXpPerAction;
  const projectedFinalXp = currentSkillXp + remainingCraftXp;
  const finalInfo = getXpProgressForLevel(projectedFinalXp);
  const totalLevelsGained = Math.max(0, finalInfo.level - currentInfo.level);

  const targetNextLevel = currentInfo.level + 1;
  const xpForNext = calculateXpForLevel(targetNextLevel);
  const xpNeededForNextLevel = Math.max(0, xpForNext - currentSkillXp);
  const effortForNext = effectiveXpPerAction > 0 ? Math.ceil(xpNeededForNextLevel / effectiveXpPerAction) : 0;
  const isNextLevelAchievable = effortForNext <= remainingProgress;

  let secondsToNextLevel: number | null = null;
  let nextLevelEtaTimestamp: string | null = null;
  let itemsFinishedAtNextLevel: number | null = null;
  let craftProgressPercentAtNextLevel: number | null = null;

  if (isNextLevelAchievable && effortForNext > 0 && progressPerAction > 0) {
    const actionsToNext = Math.ceil(effortForNext / progressPerAction);
    secondsToNextLevel = Math.round(actionsToNext * secondsPerAction);
    const date = new Date(Date.now() + secondsToNextLevel * 1000);
    nextLevelEtaTimestamp = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const progressAtNext = Math.min(totalProgressRequired, completedProgress + effortForNext);
    itemsFinishedAtNextLevel = progressPerItem > 0 ? Math.min(itemsTotal, Math.floor(progressAtNext / progressPerItem)) : 0;
    craftProgressPercentAtNextLevel =
      totalProgressRequired > 0 ? (progressAtNext / totalProgressRequired) * 100 : 0;
  }

  // Generate milestone list for each level reached during craft
  const milestones: LevelMilestone[] = [];
  const maxForecastLevel = Math.max(targetNextLevel, finalInfo.level);

  for (let lvl = targetNextLevel; lvl <= maxForecastLevel; lvl++) {
    const threshold = calculateXpForLevel(lvl);
    const needed = Math.max(0, threshold - currentSkillXp);
    const effort = effectiveXpPerAction > 0 ? Math.ceil(needed / effectiveXpPerAction) : 0;
    const achievable = effort <= remainingProgress;
    const actions = progressPerAction > 0 ? Math.ceil(effort / progressPerAction) : 0;
    const secs = Math.round(actions * secondsPerAction);
    const progressAtMilestone = Math.min(totalProgressRequired, completedProgress + effort);
    const itemsAtMilestone =
      progressPerItem > 0 ? Math.min(itemsTotal, Math.floor(progressAtMilestone / progressPerItem)) : 0;
    const pctAtMilestone =
      totalProgressRequired > 0 ? (progressAtMilestone / totalProgressRequired) * 100 : 0;

    let timestamp: string | null = null;
    if (secs > 0 && isFinite(secs)) {
      const d = new Date(Date.now() + secs * 1000);
      timestamp = d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }

    milestones.push({
      level: lvl,
      xpThreshold: threshold,
      xpNeededFromCurrent: needed,
      effortRequired: effort,
      physicalActionsRequired: actions,
      itemsFinishedAtMilestone: itemsAtMilestone,
      craftProgressPercentAtMilestone: pctAtMilestone,
      estimatedSecondsFromNow: secs,
      estimatedTimestamp: timestamp,
      isAchievableInThisCraft: achievable,
    });
  }

  return {
    currentLevel: currentInfo.level,
    currentSkillXp,
    targetNextLevel,
    xpNeededForNextLevel,
    isNextLevelAchievable,
    secondsToNextLevel,
    nextLevelEtaTimestamp,
    itemsFinishedAtNextLevel,
    craftProgressPercentAtNextLevel,
    totalLevelsGained,
    projectedFinalLevel: finalInfo.level,
    projectedFinalXp,
    projectedFinalProgressPercent: finalInfo.progressPercent,
    milestones,
  };
}

// Multi-User Collaborative Crafting Projection Calculator
export function calculateMultiUserCraftProjection(
  _craft: CraftResult,
  primaryPlayer: PlayerDetails | null,
  primaryCalc: XpCalculationResult,
  contributorPayloads: ContributorDetailPayload[],
  activeWindowMinutes = 5.0
): MultiUserCraftProjection {
  const remainingEffort = primaryCalc.remainingProgress;
  const now = Date.now();

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
      try {
        const lastTime = new Date(cb.lastContributedAt).getTime();
        if (!isNaN(lastTime)) {
          minutesSinceLast = Math.max(0, Math.round(((now - lastTime) / 60000) * 10) / 10);
        }
      } catch {
        minutesSinceLast = 999;
      }
    }

    // Determine activity status
    const isActive = isPrimary ? true : minutesSinceLast <= activeWindowMinutes;
    const isCurrentlyCrafting = isPrimary ? true : minutesSinceLast <= 1.0;
    const secondsUntilInactive = isActive && !isPrimary
      ? Math.max(0, Math.round(activeWindowMinutes * 60 - minutesSinceLast * 60))
      : 0;

    // Inclusion toggle: manual user override if set, otherwise follow dynamic activity
    const isIncludedInProjection =
      payload.isIncluded !== undefined ? payload.isIncluded : isActive;

    // Progress per action
    let ppa = 20;
    if (cb.contributionCount > 0 && cb.totalProgressContributed > 0) {
      ppa = Math.round((cb.totalProgressContributed / cb.contributionCount) * 10) / 10;
    }

    // Equipment, Buffs, and Speed calculation
    let craftingSpeedBonusPercent = 0;
    let secondsPerAction = primaryCalc.secondsPerAction;
    let xpMultiplier = 1.0;
    let equippedToolName = undefined;
    let equippedToolTier = undefined;
    const activeBuffsSummary: string[] = [];

    if (isPrimary) {
      craftingSpeedBonusPercent = primaryCalc.craftingSpeedBonusPercent;
      secondsPerAction = primaryCalc.secondsPerAction;
      xpMultiplier = primaryCalc.xpMultiplier;
      equippedToolName = primaryCalc.toolStatus.equippedTool?.name;
      equippedToolTier = primaryCalc.toolStatus.effectivePower;
      for (const b of primaryCalc.activeBuffModifiers) {
        if (b.craftingSpeedBonus !== 0) {
          activeBuffsSummary.push(
            `${b.name} (${b.craftingSpeedBonus > 0 ? '+' : ''}${(b.craftingSpeedBonus * 100).toFixed(0)}% Speed)`
          );
        }
      }
    } else if (payload.stats || payload.equipment || payload.buffs) {
      // Calculate from contributor payload
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

      let totalSpeed = 1.0;
      if (payload.stats?.values && typeof payload.stats.values[15] === 'number' && payload.stats.values[15] > 0) {
        totalSpeed = payload.stats.values[15];
      } else {
        totalSpeed = Math.max(0.1, 1.0 + equipSpeed + buffSpeed);
      }

      craftingSpeedBonusPercent = Math.round((totalSpeed - 1.0) * 100 * 10) / 10;
      secondsPerAction = BASE_ACTION_DURATION_SECONDS / totalSpeed;
      xpMultiplier = 1.0 + expRateBonus;
    }

    const effortPerSecond = secondsPerAction > 0 ? ppa / secondsPerAction : 0;
    const xpPerHour = Math.round(effortPerSecond * primaryCalc.baseXpPerAction * xpMultiplier * 3600);
    const earnedXp = Math.round(cb.totalProgressContributed * primaryCalc.baseXpPerAction * xpMultiplier);

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

  // Calculate time already saved by helpers' historical contributions
  let helperEffortContributed = 0;
  for (const p of participants) {
    const isPrimary = Boolean(
      primaryPlayer &&
        (p.entityId === primaryPlayer.entityId ||
          p.username?.toLowerCase() === primaryPlayer.username.toLowerCase())
    );
    if (!isPrimary) {
      helperEffortContributed += Math.max(0, p.totalProgressContributed);
    }
  }

  const helperActionsOwnerSaved =
    primaryCalc.progressPerAction > 0
      ? Math.ceil(helperEffortContributed / primaryCalc.progressPerAction)
      : 0;

  const secondsAlreadySaved = Math.round(
    helperActionsOwnerSaved * primaryCalc.secondsPerAction
  );

  const secondsTotalSaved = secondsAlreadySaved + secondsProjectedSaved;

  const soloEtaCompletionTime = primaryCalc.estimatedCompletionTime;
  let collaborativeEtaCompletionTime: string | null = null;
  if (collaborativeEstimatedSecondsRemaining > 0 && isFinite(collaborativeEstimatedSecondsRemaining)) {
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
