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
  craftingSpeedBonus: number; // e.g. +0.2 for +20%, -0.2 for -20%
  gatheringSpeedBonus: number;
  staminaRegenBonus: number;
  xpRateBonus?: number;       // e.g. +0.05 for +5% XP rate
  durationSeconds: number;
  remainingSeconds: number;
  isExpiringSoon: boolean;
  isDebuff: boolean;
}

export interface FoodBuffOverride {
  id: string;
  name: string;
  craftingSpeedBonus: number; // e.g. 0.094 for +9.4%
  gatheringSpeedBonus?: number;
  xpRateBonus: number;        // e.g. 0.05 for +5%
  staminaRegenBonus: number;  // e.g. 19 for +19 stamina regen
  durationSeconds: number;    // e.g. 3600
  startedAt: number;          // timestamp in ms
  remainingSeconds: number;
  enabled: boolean;
}

export interface SpeedContributorItem {
  label: string;
  category: 'base' | 'equipment' | 'buff' | 'skill' | 'override';
  bonusPercent: number; // e.g. 18.2 for +18.2%
  multiplierDelta: number; // e.g. 0.182
  detail?: string;
}

export interface SpeedBreakdownInfo {
  baseActionDurationSeconds: number; // 1.60s
  baseMultiplier: number; // 1.00
  equipmentBonusPercent: number; // e.g. +18.2%
  equipmentItems: { slot: string; name: string; bonusPercent: number }[];
  buffBonusPercent: number; // e.g. +9.4%
  buffItems: { name: string; bonusPercent: number; isOverride?: boolean }[];
  professionSkillBonusPercent: number; // e.g. +4.0%
  professionSkillName: string;
  totalMultiplier: number; // 1.418
  totalBonusPercent: number; // +41.8%
  finalSecondsPerAction: number; // 1.13
  effectiveActionsPerSecond: number; // 0.89
  contributors: SpeedContributorItem[];
}

export interface EquipmentModifier {
  slot: string;
  itemName: string;
  tier: number;
  rarity: string;
  craftingSpeedBonus: number;
  gatheringSpeedBonus: number;
  professionSpeedBonus?: number;
  powerBonus?: number;
  staminaBonus: number;
  xpRateBonus?: number;
}

export interface ParticipantContributionSummary {
  entityId: string;
  username: string;
  isOnline: boolean;
  isActive: boolean; // active recency <= inactivityTimeoutMinutes
  isCurrentlyCrafting: boolean; // recency <= 1 min
  isIncludedInProjection: boolean; // user toggle or dynamic isActive
  lastContributedAt?: string;
  minutesSinceLastContribution: number;
  secondsUntilInactive: number;
  totalProgressContributed: number;
  contributionCount: number;
  progressPerAction: number;
  equippedToolName?: string;
  equippedToolTier?: number;
  craftingSpeedBonusPercent: number;
  secondsPerAction: number;
  effortPerSecond: number;
  xpPerHour: number;
  xpMultiplier: number;
  earnedXp: number;
  projectedRemainingEffort: number;
  projectedRemainingXp: number;
  totalExpectedXp: number;
  projectedSharePercent: number;
  activeBuffsSummary: string[];
}

export interface MultiUserCraftProjection {
  activeParticipantsCount: number;
  totalContributorsCount: number;
  inactivityTimeoutMinutes: number;
  soloEstimatedSecondsRemaining: number;
  collaborativeEstimatedSecondsRemaining: number;
  secondsSaved: number; // backwards compatibility alias for secondsProjectedSaved
  secondsProjectedSaved: number;
  secondsAlreadySaved: number;
  secondsTotalSaved: number;
  soloEtaCompletionTime: string | null;
  collaborativeEtaCompletionTime: string | null;
  combinedEffortPerSecond: number;
  participants: ParticipantContributionSummary[];
}

export interface LevelMilestone {
  level: number;
  xpThreshold: number;
  xpNeededFromCurrent: number;
  effortRequired: number;
  physicalActionsRequired: number;
  itemsFinishedAtMilestone: number;
  craftProgressPercentAtMilestone: number;
  estimatedSecondsFromNow: number;
  estimatedTimestamp: string | null;
  isAchievableInThisCraft: boolean;
}

export interface LevelProgressForecast {
  currentLevel: number;
  currentSkillXp: number;
  targetNextLevel: number;
  xpNeededForNextLevel: number;
  isNextLevelAchievable: boolean;
  secondsToNextLevel: number | null;
  nextLevelEtaTimestamp: string | null;
  itemsFinishedAtNextLevel: number | null;
  craftProgressPercentAtNextLevel: number | null;
  totalLevelsGained: number;
  projectedFinalLevel: number;
  projectedFinalXp: number;
  projectedFinalProgressPercent: number;
  milestones: LevelMilestone[];
}

export interface SessionRatePoint {
  timestamp: number;
  timeLabel: string;
  xpPerHour: number;
  theoreticalXpPerHour: number;
  deltaXp: number;
}

export interface SessionRateStats {
  sessionXpGained: number;
  sessionDurationSeconds: number;
  measuredXpPerHour: number | null;
  peakXpPerHour: number | null;
  efficiencyPercent: number | null;
  isWarmingUp: boolean;
  history: SessionRatePoint[];
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
  effortPerHour: number;
  xpPerHour: number;
  estimatedSecondsRemaining: number;
  estimatedCompletionTime: string | null;
  
  toolStatus: ToolStatusInfo;
  activeBuffModifiers: ActiveBuffModifier[];
  equipmentModifiers: EquipmentModifier[];
  activeFoodOverride?: FoodBuffOverride | null;
  speedBreakdown: SpeedBreakdownInfo;
  
  multiUserProjection?: MultiUserCraftProjection | null;
  levelForecast: LevelProgressForecast;
  sessionStats?: SessionRateStats | null;
}

export interface ApiClientStatus {
  lastFetchedAt: Date | null;
  cachedEntriesCount: number;
  isFetching: boolean;
  lastResponseTimeMs: number | null;
  rateLimitBackoffMs: number;
  error: string | null;
}
