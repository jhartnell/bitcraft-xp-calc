// Level Milestone and Progression Timing Calculator

import { LevelMilestone, LevelProgressForecast } from '../types/calculator';
import { calculateXpForLevel, getXpProgressForLevel } from './bitcraftData';

const MAX_SKILL_LEVEL = 120;

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

  // Guard max level (120): no further level milestones exist
  if (currentInfo.level >= MAX_SKILL_LEVEL) {
    return {
      currentLevel: MAX_SKILL_LEVEL,
      currentSkillXp,
      targetNextLevel: MAX_SKILL_LEVEL,
      xpNeededForNextLevel: 0,
      isNextLevelAchievable: false,
      secondsToNextLevel: null,
      nextLevelEtaTimestamp: null,
      itemsFinishedAtNextLevel: null,
      craftProgressPercentAtNextLevel: null,
      totalLevelsGained: 0,
      projectedFinalLevel: MAX_SKILL_LEVEL,
      projectedFinalXp,
      projectedFinalProgressPercent: 100,
      milestones: [],
    };
  }

  const targetNextLevel = Math.min(MAX_SKILL_LEVEL, currentInfo.level + 1);
  const xpForNext = calculateXpForLevel(targetNextLevel);
  const xpNeededForNextLevel = Math.max(0, xpForNext - currentSkillXp);
  const effortForNext =
    effectiveXpPerAction > 0 ? Math.ceil(xpNeededForNextLevel / effectiveXpPerAction) : 0;
  const isNextLevelAchievable =
    xpNeededForNextLevel > 0 && effortForNext > 0 && effortForNext <= remainingProgress;

  let secondsToNextLevel: number | null = null;
  let nextLevelEtaTimestamp: string | null = null;
  let itemsFinishedAtNextLevel: number | null = null;
  let craftProgressPercentAtNextLevel: number | null = null;

  if (isNextLevelAchievable && progressPerAction > 0) {
    const actionsToNext = Math.ceil(effortForNext / progressPerAction);
    secondsToNextLevel = Math.round(actionsToNext * secondsPerAction);
    const date = new Date(Date.now() + secondsToNextLevel * 1000);
    nextLevelEtaTimestamp = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const progressAtNext = Math.min(totalProgressRequired, completedProgress + effortForNext);
    itemsFinishedAtNextLevel =
      progressPerItem > 0 ? Math.min(itemsTotal, Math.floor(progressAtNext / progressPerItem)) : 0;
    craftProgressPercentAtNextLevel =
      totalProgressRequired > 0 ? (progressAtNext / totalProgressRequired) * 100 : 0;
  }

  // Generate milestone list for each level reached during craft
  const milestones: LevelMilestone[] = [];
  const maxForecastLevel = Math.min(MAX_SKILL_LEVEL, Math.max(targetNextLevel, finalInfo.level));

  for (let lvl = targetNextLevel; lvl <= maxForecastLevel; lvl++) {
    const threshold = calculateXpForLevel(lvl);
    const needed = Math.max(0, threshold - currentSkillXp);
    const effort = effectiveXpPerAction > 0 ? Math.ceil(needed / effectiveXpPerAction) : 0;
    const achievable = needed > 0 && effort > 0 && effort <= remainingProgress;
    const actions = progressPerAction > 0 ? Math.ceil(effort / progressPerAction) : 0;
    const secs = Math.round(actions * secondsPerAction);
    const progressAtMilestone = Math.min(totalProgressRequired, completedProgress + effort);
    const itemsAtMilestone =
      progressPerItem > 0
        ? Math.min(itemsTotal, Math.floor(progressAtMilestone / progressPerItem))
        : 0;
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
