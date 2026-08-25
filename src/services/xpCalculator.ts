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
} from '../types/calculator';
import {
  SKILL_DEFINITIONS,
  TOOL_TYPE_NAMES,
  DEFAULT_SKILL_BASE_XP,
  getXpProgressForLevel,
} from './bitcraftData';

// BitCraft Online base crafting station action tick duration is exactly 1.6 seconds
export const BASE_ACTION_DURATION_SECONDS = 1.6;

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

  // 2. Base XP per progress unit (Checking recipe experiencePerProgress, fallback default, or custom override)
  let baseXpPerAction = DEFAULT_SKILL_BASE_XP[skillId] || 1.6;
  if (overrideBaseXp && overrideBaseXp > 0) {
    baseXpPerAction = overrideBaseXp;
  } else if (craft.experiencePerProgress && craft.experiencePerProgress.length > 0) {
    const matched = craft.experiencePerProgress.find((ep) => ep.skill_id === skillId);
    baseXpPerAction = matched ? matched.quantity : craft.experiencePerProgress[0].quantity;
  }

  // 3. Progress and Items Breakdown (totalActionsRequired in API = Total Effort Points)
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

  // 7. Active Buff & Debuff Modifiers (Food buffs, rez sickness, potions, exp rate)
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

  // 8. Total Crafting Speed Multiplier (Using Server Stat Index 15 if available)
  let totalCraftingSpeedMultiplier: number;

  if (stats && stats.values && typeof stats.values[15] === 'number' && stats.values[15] > 0) {
    totalCraftingSpeedMultiplier = stats.values[15];
  } else {
    const calculatedSum = 1.0 + equipCraftingSpeedBonus + buffCraftingSpeedBonus;
    totalCraftingSpeedMultiplier = Math.max(0.1, calculatedSum);
  }

  const craftingSpeedBonusPercent = Math.round((totalCraftingSpeedMultiplier - 1.0) * 100 * 10) / 10;

  // In-Game action duration: 1.6s base divided by total crafting speed multiplier
  const secondsPerAction = BASE_ACTION_DURATION_SECONDS / totalCraftingSpeedMultiplier;
  const effectiveActionsPerSecond = 1.0 / secondsPerAction;

  // 9. XP Multiplier (from charms, instruments, and Experience Rate buffs/artifacts like EXP Pie / Librarian Book)
  let xpMultiplier = 1.0 + equipExpRateBonus + buffExpRateBonus;
  for (const slot of equipment) {
    if (slot.primary.includes('instrument') && slot.item) {
      xpMultiplier += 0.05;
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

  // 11. Exact In-Game Matched ETA & Completion Time
  const estimatedSecondsRemaining = Math.round(physicalActionsRemaining * secondsPerAction);

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
    estimatedSecondsRemaining,
    estimatedCompletionTime,
    
    toolStatus,
    activeBuffModifiers,
    equipmentModifiers,
  };
}
