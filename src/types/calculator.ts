// Calculation and state types for Bitcraft XP Calculator

import { ItemMetadata } from './api';

export interface ToolStatusInfo {
  requiredToolName?: string;
  requiredToolType: number;
  requiredToolLevel: number;
  requiredToolPower: number;
  equippedTool: ItemMetadata | null;
  isEquipped: boolean;
  meetsLevelReq: boolean;
  meetsPowerReq: boolean;
  effectivePower: number;
}

export interface ActiveBuffModifier {
  name: string;
  category: string;
  craftingSpeedBonus: number; // e.g. +0.2 for +20%, -0.115 for -11.5%
  gatheringSpeedBonus: number;
  staminaRegenBonus: number;
  durationSeconds: number;
  remainingSeconds: number;
  isExpiringSoon: boolean;
  isDebuff: boolean;
}

export interface EquipmentModifier {
  slot: string;
  itemName: string;
  tier: number;
  rarity: string;
  craftingSpeedBonus: number;
  gatheringSpeedBonus: number;
  staminaBonus: number;
}

export interface XpCalculationResult {
  skillId: number;
  skillName: string;
  baseXpPerAction: number;
  effectiveXpPerAction: number;
  xpMultiplier: number;
  
  totalCraftXp: number;
  earnedXp: number;
  remainingXp: number;
  
  totalProgressRequired: number;
  completedProgress: number;
  remainingProgress: number;
  progressPercent: number;

  progressPerAction: number;
  isMeasuredProgressPerAction: boolean;
  physicalActionsTotal: number;
  physicalActionsCompleted: number;
  physicalActionsRemaining: number;
  
  itemsTotal: number;
  itemsCompleted: number;
  itemsRemaining: number;
  progressPerItem: number;
  
  currentSkillLevel: number;
  currentSkillXp: number;
  projectedSkillXp: number;
  projectedSkillLevel: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  currentLevelProgressPct: number;
  projectedLevelProgressPct: number;
  levelsGained: number;
  
  baseActionDurationSeconds: number;
  secondsPerAction: number;
  totalCraftingSpeedMultiplier: number;
  craftingSpeedBonusPercent: number;
  effectiveActionsPerSecond: number;
  estimatedSecondsRemaining: number;
  estimatedCompletionTime: string | null;
  
  toolStatus: ToolStatusInfo;
  activeBuffModifiers: ActiveBuffModifier[];
  equipmentModifiers: EquipmentModifier[];
}

export interface ApiClientStatus {
  lastFetchedAt: Date | null;
  cachedEntriesCount: number;
  isFetching: boolean;
  lastResponseTimeMs: number | null;
  rateLimitBackoffMs: number;
  error: string | null;
}
