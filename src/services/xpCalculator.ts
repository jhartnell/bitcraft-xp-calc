// Comprehensive XP and Crafting Calculation Engine for Bitcraft Online

import {
  CraftResult,
  PlayerDetails,
  EquipmentSlot,
  PlayerBuff,
  PlayerStatsData,
  PlayerToolEntry,
  CraftContribution,
} from '../types/api';
import {
  XpCalculationResult,
  ToolStatusInfo,
  ActiveBuffModifier,
  EquipmentModifier,
  FoodBuffOverride,
  SpeedBreakdownInfo,
  SpeedContributorItem,
  SkillOverrideMap,
} from '../types/calculator';
import {
  SKILL_DEFINITIONS,
  TOOL_TYPE_NAMES,
  DEFAULT_SKILL_BASE_XP,
  calculateXpForLevel,
  getXpProgressForLevel,
  getItemPower,
  getProfessionLevelStats,
  getTierRequiredLevel,
  getCraftSkillId,
} from './bitcraftData';
import { bitjitaApi } from './apiClient';
import {
  ALL_PROFESSION_NAMES,
  BASE_ACTION_DURATION_SECONDS,
  PROFESSION_SPEED_STAT_IDS,
  resolveEquippedTool,
} from './toolMatching';
import { calculateLevelProgressForecast } from './levelForecast';

export {
  calculateMultiUserCraftProjection,
  type ContributorDetailPayload,
} from './multiUserProjection';

export function calculateCraftXp(
  craft: CraftResult,
  player: PlayerDetails | null,
  equipment: EquipmentSlot[] = [],
  buffs: PlayerBuff[] = [],
  stats: PlayerStatsData | null = null,
  contributions: CraftContribution[] = [],
  overrideProgressPerAction: number | null = null,
  overrideBaseXp: number | null = null,
  foodBuffOverride: FoodBuffOverride | null = null,
  playerTools: PlayerToolEntry[] = [],
  skillOverrides: SkillOverrideMap | null = null
): XpCalculationResult {
  // 1. Identify primary skill for the craft
  const recipeExp =
    craft.experiencePerProgress && craft.experiencePerProgress.length > 0
      ? craft.experiencePerProgress
      : bitjitaApi.getRecipeExperience(craft.recipeId);

  const skillId = getCraftSkillId(craft, recipeExp) || 4; // default masonry fallback

  const skillDef = SKILL_DEFINITIONS[skillId] || {
    id: skillId,
    name: `Skill #${skillId}`,
    category: 'Profession' as const,
    icon: '✨',
    color: '#10b981',
  };

  // Current Player Level Progress for the Craft's Skill
  const manualOverride = skillOverrides?.[skillId];
  let currentSkillXp = 0;
  let hasManualOverride = false;

  if (manualOverride) {
    if (typeof manualOverride.xp === 'number' && manualOverride.xp > 0) {
      currentSkillXp = manualOverride.xp;
      hasManualOverride = true;
    } else if (typeof manualOverride.level === 'number' && manualOverride.level > 0) {
      currentSkillXp = calculateXpForLevel(manualOverride.level);
      hasManualOverride = true;
    }
  }

  if (
    !hasManualOverride &&
    player &&
    player.experience &&
    Array.isArray(player.experience) &&
    player.experience.length > 0
  ) {
    const expObj = player.experience.find(
      (e) =>
        e.skill_id === skillId ||
        (e as unknown as Record<string, unknown>).skillId === skillId ||
        (e as unknown as Record<string, unknown>).id === skillId
    );
    if (expObj) {
      const rawQty =
        expObj.quantity ??
        (expObj as unknown as Record<string, unknown>).experience ??
        (expObj as unknown as Record<string, unknown>).xp ??
        0;
      currentSkillXp = typeof rawQty === 'number' ? rawQty : Number(rawQty) || 0;
    }
  }

  let currentLevelProgress = getXpProgressForLevel(currentSkillXp);

  // 2. Base XP per progress unit
  let baseXpPerAction = DEFAULT_SKILL_BASE_XP[skillId] || 1.6;

  if (overrideBaseXp && overrideBaseXp > 0) {
    baseXpPerAction = overrideBaseXp;
  } else if (recipeExp && recipeExp.length > 0) {
    const matched = recipeExp.find((ep) => ep.skill_id === skillId);
    baseXpPerAction = matched ? matched.quantity : recipeExp[0].quantity;
  }

  // 3. Progress and Items Breakdown
  const progressPerItem = craft.actionsRequiredPerItem || 1;
  const itemsTotal = craft.craftCount || 1;
  const totalProgressRequired = craft.totalActionsRequired || progressPerItem * itemsTotal;
  const completedProgress = Math.min(totalProgressRequired, Math.max(0, craft.progress || 0));
  const remainingProgress = Math.max(0, totalProgressRequired - completedProgress);
  const progressPercent =
    totalProgressRequired > 0 ? (completedProgress / totalProgressRequired) * 100 : 0;

  const itemsCompleted = Math.min(itemsTotal, Math.floor(completedProgress / progressPerItem));
  const itemsRemaining = Math.max(0, itemsTotal - itemsCompleted);

  // 4. Required Tool & Equipped Tool Matching
  const toolReq =
    craft.toolRequirements && craft.toolRequirements.length > 0 ? craft.toolRequirements[0] : null;
  const reqToolType = toolReq?.tool_type ?? skillDef.toolType ?? 0;
  const reqToolLevel = toolReq?.level ?? 1;
  const reqToolPower = toolReq?.power ?? 1;
  const reqToolName = TOOL_TYPE_NAMES[reqToolType] || toolReq?.name || 'Tool';
  const skillNameLower = (skillDef?.name || '').toLowerCase();
  const profStatId = PROFESSION_SPEED_STAT_IDS[skillId];
  const isGatheringSkill = [2, 5, 11, 12, 14].includes(skillId);

  const { equippedTool, isEquipped } = resolveEquippedTool({
    skillId,
    skillDef,
    reqToolType,
    reqToolLevel,
    reqToolName,
    craft,
    player,
    equipment,
    contributions,
    playerTools,
  });

  // Smart Level Floor: Higher of Craft Level Requirement vs. Equipped Tool Tier Level Requirement
  let isSkillLevelInferred = false;
  const isSkillLevelOverridden = hasManualOverride;

  if (
    !hasManualOverride &&
    (!player?.experience || player.experience.length === 0 || currentLevelProgress.level <= 1)
  ) {
    const craftReqLevel =
      craft.levelRequirements?.find((r) => r.skill_id === skillId)?.level ||
      craft.levelRequirements?.[0]?.level ||
      1;
    const toolReqLevel = getTierRequiredLevel(equippedTool?.tier);
    const smartFloorLevel = Math.max(1, craftReqLevel, toolReqLevel);
    if (smartFloorLevel > currentLevelProgress.level) {
      currentSkillXp = calculateXpForLevel(smartFloorLevel);
      currentLevelProgress = getXpProgressForLevel(currentSkillXp);
      isSkillLevelInferred = true;
    } else if (!player?.experience || player.experience.length === 0) {
      isSkillLevelInferred = true;
    }
  }

  // 5. Equipment Modifiers
  const equipmentModifiers: EquipmentModifier[] = [];
  let equipCraftingSpeedBonus = 0;
  let equipExpRateBonus = 0;
  let totalExtraPowerFromGear = 0;

  for (const slot of equipment) {
    if (slot.item && slot.item.stats) {
      let slotCraftingSpeed = 0;
      let slotGatheringSpeed = 0;
      let slotProfessionSpeed = 0;
      let slotPowerBonus = 0;
      let slotStamina = 0;
      let slotExpBonus = 0;

      for (const stat of slot.item.stats) {
        const statNameLower = (stat.name || '').toLowerCase();
        const belongsToOtherProfession = ALL_PROFESSION_NAMES.some(
          (p) => p !== skillNameLower && statNameLower.includes(p)
        );

        if (belongsToOtherProfession) {
          continue;
        }

        if (stat.id === 15 || statNameLower.includes('crafting speed')) {
          slotCraftingSpeed += stat.value;
        }

        if (
          (profStatId && stat.id === profStatId) ||
          (skillNameLower && statNameLower.includes(`${skillNameLower} speed`))
        ) {
          slotProfessionSpeed += stat.value;
        }

        if (stat.id === 16 || statNameLower.includes('gathering speed')) {
          slotGatheringSpeed += stat.value;
        }

        if (
          stat.id === 2 ||
          statNameLower.includes('tool power') ||
          (skillNameLower && statNameLower.includes(`${skillNameLower} power`)) ||
          statNameLower === 'power'
        ) {
          if (slot.item !== equippedTool) {
            slotPowerBonus += stat.value;
          }
        }

        if (stat.id === 1 || statNameLower.includes('stamina')) {
          slotStamina += stat.value;
        }

        if (
          stat.id === 50 ||
          statNameLower.includes('experience rate') ||
          (skillNameLower && statNameLower.includes(`${skillNameLower} exp`))
        ) {
          slotExpBonus += stat.value;
        }
      }

      const applicableSpeedForCraft =
        slotCraftingSpeed + slotProfessionSpeed + (isGatheringSkill ? slotGatheringSpeed : 0);

      if (
        applicableSpeedForCraft !== 0 ||
        slotGatheringSpeed !== 0 ||
        slotPowerBonus !== 0 ||
        slotStamina !== 0 ||
        slotExpBonus !== 0
      ) {
        equipCraftingSpeedBonus += applicableSpeedForCraft;
        equipExpRateBonus += slotExpBonus;
        totalExtraPowerFromGear += slotPowerBonus;

        equipmentModifiers.push({
          slot: slot.primary,
          itemName: slot.item.name,
          tier: slot.item.tier || 1,
          rarity: slot.item.rarityString || slot.item.rarityStr || 'Common',
          craftingSpeedBonus: applicableSpeedForCraft,
          gatheringSpeedBonus: slotGatheringSpeed,
          professionSpeedBonus: slotProfessionSpeed,
          powerBonus: slotPowerBonus,
          staminaBonus: slotStamina,
          xpRateBonus: slotExpBonus,
        });
      }
    }
  }

  // Cumulative Profession Level Stat Increases
  const professionLevelStats = getProfessionLevelStats(skillId, currentLevelProgress.level);
  const levelPowerBonus = professionLevelStats.power;
  const levelSpeedBonus = professionLevelStats.speed;
  const levelCritBonus = professionLevelStats.crit;

  const baseToolPower = equippedTool ? getItemPower(equippedTool) : 1;
  const effectivePower = baseToolPower + totalExtraPowerFromGear + levelPowerBonus;

  const toolStatus: ToolStatusInfo = {
    requiredToolName: reqToolName,
    requiredToolType: reqToolType,
    requiredToolLevel: reqToolLevel,
    requiredToolPower: reqToolPower,
    equippedTool,
    isEquipped,
    meetsLevelReq: equippedTool ? (equippedTool.tier || 1) >= reqToolLevel : false,
    meetsPowerReq: effectivePower >= reqToolPower,
    effectivePower,
    levelPowerBonus,
    levelSpeedBonus,
    levelCritBonus,
  };

  // 6. Progress Per Physical Action
  // Authoritative tool power (from /players/{id}/tools or enriched equipment item stats)
  // takes precedence over BitJita's historical totalProgressContributed / contributionCount,
  // because BitJita's contributionCount includes an off-by-one (+1) station initiation entry
  // that systematically underestimates effort/action (e.g. 2261/134 = 16.9 instead of 17).
  const hasAuthoritativeToolPower = Boolean(
    equippedTool &&
      equippedTool.id !== 'active_tool' &&
      ((equippedTool.toolStats &&
        typeof equippedTool.toolStats.power === 'number' &&
        equippedTool.toolStats.power > 0) ||
        equippedTool.stats?.some(
          (st) => st.id === 2 || (st.name || '').toLowerCase().includes('power')
        ))
  );

  let progressPerAction = 20;
  let isMeasuredProgressPerAction = false;

  if (overrideProgressPerAction && overrideProgressPerAction > 0) {
    progressPerAction = overrideProgressPerAction;
  } else if (hasAuthoritativeToolPower) {
    progressPerAction = Math.max(1, effectivePower);
  } else {
    if (player && contributions.length > 0) {
      const userContrib = contributions.find(
        (c) =>
          c.contributorEntityId === player.entityId ||
          c.contributorUsername?.toLowerCase() === player.username.toLowerCase()
      );
      if (
        userContrib &&
        userContrib.contributionCount > 0 &&
        userContrib.totalProgressContributed > 0
      ) {
        progressPerAction =
          Math.round((userContrib.totalProgressContributed / userContrib.contributionCount) * 10) /
          10;
        isMeasuredProgressPerAction = true;
      }
    }

    if (!isMeasuredProgressPerAction) {
      progressPerAction = Math.max(1, effectivePower);
    }
  }

  const physicalActionsTotal = Math.ceil(totalProgressRequired / progressPerAction);
  const physicalActionsRemaining = Math.ceil(remainingProgress / progressPerAction);
  const physicalActionsCompleted = Math.max(0, physicalActionsTotal - physicalActionsRemaining);

  // 7. Active Buff & Debuff Modifiers
  const activeBuffModifiers: ActiveBuffModifier[] = [];
  let buffCraftingSpeedBonus = 0;
  let buffStaminaRegenBonus = 0;
  let serverBuffExpRateBonus = 0;

  for (const buff of buffs) {
    const isBuffActive = buff.status === 'active' || (buff.timeRemaining && buff.timeRemaining > 0);
    if (!isBuffActive) continue;

    let buffCraftSpeed = 0;
    let buffGatherSpeed = 0;
    let buffStaminaRegen = 0;
    let buffExpRate = 0;

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
          buffExpRate += st.value;
          serverBuffExpRateBonus += st.value;
        }
      }
    }

    buffCraftingSpeedBonus += buffCraftSpeed;
    buffStaminaRegenBonus += buffStaminaRegen;

    const remainingSecs = Math.max(0, buff.timeRemaining || 0);

    activeBuffModifiers.push({
      name: buff.description || buff.buffName || 'Buff',
      category: buff.buffName || 'Buff',
      craftingSpeedBonus: buffCraftSpeed,
      gatheringSpeedBonus: buffGatherSpeed,
      staminaRegenBonus: buffStaminaRegen,
      xpRateBonus: buffExpRate,
      durationSeconds: buff.buffDuration || 0,
      remainingSeconds: remainingSecs,
      isExpiringSoon: remainingSecs > 0 && remainingSecs < 120,
      isDebuff: buffCraftSpeed < 0,
    });
  }

  // Inject user active food buff override if enabled and valid
  const serverBuffCraftingSpeedBonus = buffCraftingSpeedBonus;
  let buffExpRateBonus = serverBuffExpRateBonus;
  let appliedManualFoodXpBonus = 0;

  if (foodBuffOverride && foodBuffOverride.enabled) {
    const elapsedSecs = Math.max(0, (Date.now() - foodBuffOverride.startedAt) / 1000);
    const remainingSecs = Math.max(0, Math.round(foodBuffOverride.durationSeconds - elapsedSecs));

    if (remainingSecs > 0) {
      const manualFoodSpeedBonus = foodBuffOverride.craftingSpeedBonus || 0;
      const manualFoodXpBonus = foodBuffOverride.xpRateBonus || 0;

      if (buffCraftingSpeedBonus === 0 && manualFoodSpeedBonus !== 0) {
        buffCraftingSpeedBonus += manualFoodSpeedBonus;
      }
      if (serverBuffExpRateBonus === 0 && manualFoodXpBonus !== 0) {
        buffExpRateBonus += manualFoodXpBonus;
        appliedManualFoodXpBonus = manualFoodXpBonus;
      }
      if (buffStaminaRegenBonus === 0 && foodBuffOverride.staminaRegenBonus !== 0) {
        buffStaminaRegenBonus += foodBuffOverride.staminaRegenBonus;
      }

      const isDebuff = manualFoodSpeedBonus < 0 || manualFoodXpBonus < 0;

      activeBuffModifiers.push({
        name: `${foodBuffOverride.name} (Active Override)`,
        category: isDebuff ? 'Debuff' : 'Food Buff',
        craftingSpeedBonus: manualFoodSpeedBonus,
        gatheringSpeedBonus: foodBuffOverride.gatheringSpeedBonus || 0,
        staminaRegenBonus: foodBuffOverride.staminaRegenBonus,
        xpRateBonus: manualFoodXpBonus,
        durationSeconds: foodBuffOverride.durationSeconds,
        remainingSeconds: remainingSecs,
        isExpiringSoon: remainingSecs < 120,
        isDebuff,
      });
    }
  }

  // 8. Total Crafting Speed Multiplier
  let professionSkillSpeedBonus = 0;
  if (
    profStatId &&
    stats &&
    stats.values &&
    typeof stats.values[profStatId] === 'number' &&
    stats.values[profStatId] > 0
  ) {
    professionSkillSpeedBonus = stats.values[profStatId] - 1.0;
  } else if (levelSpeedBonus > 0) {
    professionSkillSpeedBonus = levelSpeedBonus;
  }

  // Only bypass server stat #15 when equipment items actually contribute crafting speed;
  // wearing non-speed gear (e.g. stamina/power) must not discard server stat #15.
  // Subtract serverBuffCraftingSpeedBonus so active server buffs are never double-counted.
  const effectiveEquipmentSpeedBonus =
    equipCraftingSpeedBonus > 0
      ? equipCraftingSpeedBonus
      : stats && stats.values && typeof stats.values[15] === 'number' && stats.values[15] > 0
        ? Math.max(0, stats.values[15] - 1.0 - serverBuffCraftingSpeedBonus)
        : 0;

  const calculatedSum =
    1.0 + effectiveEquipmentSpeedBonus + buffCraftingSpeedBonus + professionSkillSpeedBonus;
  const totalCraftingSpeedMultiplier = Math.max(0.1, calculatedSum);

  const craftingSpeedBonusPercent = Math.round((totalCraftingSpeedMultiplier - 1.0) * 100 * 10) / 10;

  const secondsPerAction = BASE_ACTION_DURATION_SECONDS / totalCraftingSpeedMultiplier;
  const effectiveActionsPerSecond = 1.0 / secondsPerAction;

  // 8.1 Detailed Speed Contributor Breakdown
  const equipmentItemsWithSpeed = equipmentModifiers
    .filter((e) => e.craftingSpeedBonus > 0)
    .map((e) => ({
      slot: e.slot.replace('_', ' '),
      name: e.itemName,
      bonusPercent: Math.round(e.craftingSpeedBonus * 100 * 10) / 10,
    }));

  const equipmentBonusPercent = Math.round(effectiveEquipmentSpeedBonus * 100 * 10) / 10;

  const buffItemsWithSpeed = activeBuffModifiers
    .filter((b) => b.craftingSpeedBonus !== 0)
    .map((b) => ({
      name: b.name,
      bonusPercent: Math.round(b.craftingSpeedBonus * 100 * 10) / 10,
      isOverride: b.name.includes('Override'),
    }));

  const buffBonusPercent = Math.round(buffCraftingSpeedBonus * 100 * 10) / 10;
  const professionSkillBonusPercent = Math.round(professionSkillSpeedBonus * 100 * 10) / 10;

  const speedContributors: SpeedContributorItem[] = [
    {
      label: 'Base Station',
      category: 'base',
      bonusPercent: 0,
      multiplierDelta: 1.0,
      detail: 'Base crafting tick is 1.60s (1.000x)',
    },
  ];

  if (equipmentBonusPercent !== 0) {
    speedContributors.push({
      label: 'Equipment & Gear',
      category: 'equipment',
      bonusPercent: equipmentBonusPercent,
      multiplierDelta: equipmentBonusPercent / 100,
      detail:
        equipmentItemsWithSpeed.map((e) => `${e.name} (+${e.bonusPercent}%)`).join(', ') ||
        'Gear Stat #15',
    });
  }

  if (buffBonusPercent !== 0) {
    speedContributors.push({
      label: 'Food Buffs & Potions',
      category: 'buff',
      bonusPercent: buffBonusPercent,
      multiplierDelta: buffBonusPercent / 100,
      detail: buffItemsWithSpeed
        .map((b) => `${b.name} (${b.bonusPercent >= 0 ? '+' : ''}${b.bonusPercent}%)`)
        .join(', '),
    });
  }

  if (professionSkillBonusPercent !== 0) {
    speedContributors.push({
      label: `${skillDef.name} Skill Level`,
      category: 'skill',
      bonusPercent: professionSkillBonusPercent,
      multiplierDelta: professionSkillSpeedBonus,
      detail: `Profession Level Stat #${profStatId || ''}`,
    });
  }

  const speedBreakdown: SpeedBreakdownInfo = {
    baseActionDurationSeconds: BASE_ACTION_DURATION_SECONDS,
    baseMultiplier: 1.0,
    equipmentBonusPercent,
    equipmentItems: equipmentItemsWithSpeed,
    buffBonusPercent,
    buffItems: buffItemsWithSpeed,
    professionSkillBonusPercent,
    professionSkillName: skillDef.name,
    totalMultiplier: totalCraftingSpeedMultiplier,
    totalBonusPercent: craftingSpeedBonusPercent,
    finalSecondsPerAction: secondsPerAction,
    effectiveActionsPerSecond,
    contributors: speedContributors,
  };

  // 9. XP Multiplier (Server authoritative or equipment + buffs, preventing double-counting)
  let xpMultiplier = 1.0;
  if (stats && stats.values && typeof stats.values[50] === 'number' && stats.values[50] > 0) {
    xpMultiplier = Math.max(0.1, Math.max(1.0, stats.values[50] / 100.0) + appliedManualFoodXpBonus);
  } else {
    xpMultiplier = Math.max(0.1, 1.0 + equipExpRateBonus + buffExpRateBonus);
    for (const slot of equipment) {
      if (slot.primary.includes('instrument') && slot.item) {
        if (
          slot.primary.includes(skillNameLower) ||
          slot.item.name.toLowerCase().includes(skillNameLower)
        ) {
          xpMultiplier += 0.05;
        }
      }
    }
  }

  const effectiveXpPerAction = baseXpPerAction * xpMultiplier;
  const totalCraftXp = Math.round(totalProgressRequired * effectiveXpPerAction);
  const earnedXp = Math.round(completedProgress * effectiveXpPerAction);
  const remainingXp = Math.max(0, totalCraftXp - earnedXp);

  // 10. Projected Player Level Progress
  const projectedSkillXp = currentSkillXp + remainingXp;
  const projectedLevelProgress = getXpProgressForLevel(projectedSkillXp);
  const levelsGained = Math.max(0, projectedLevelProgress.level - currentLevelProgress.level);

  // 11. Rates and Completion Forecast
  const effortPerHour = effectiveActionsPerSecond * progressPerAction * 3600;
  const xpPerHour = Math.round(effortPerHour * effectiveXpPerAction);

  const estimatedSecondsRemaining = physicalActionsRemaining * secondsPerAction;
  const estimatedCompletionTime =
    estimatedSecondsRemaining > 0
      ? new Date(Date.now() + estimatedSecondsRemaining * 1000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

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
    xpInCurrentLevel: currentLevelProgress.xpInCurrentLevel,
    xpSpanForCurrentLevel: currentLevelProgress.levelSpan,
    xpRemainingToNextLevel: currentLevelProgress.xpNeededForNext,
    currentLevelProgressPct: currentLevelProgress.progressPercent,
    projectedLevelProgressPct: projectedLevelProgress.progressPercent,
    levelsGained,
    isSkillLevelInferred,
    isSkillLevelOverridden,

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
    activeFoodOverride: foodBuffOverride,
    speedBreakdown,
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
