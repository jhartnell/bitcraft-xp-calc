import { describe, it, expect } from 'vitest';
import { calculateCraftXp, calculateMultiUserCraftProjection } from '../xpCalculator';
import {
  calculateXpForLevel,
  getLevelFromXp,
  getXpProgressForLevel,
  formatXp,
  formatTimeSeconds,
} from '../bitcraftData';
import { CraftResult, PlayerDetails, EquipmentSlot, PlayerBuff, CraftContribution } from '../../types/api';

describe('Bitcraft XP Calculation Engine', () => {
  const mockCraft: CraftResult = {
    entityId: '1008806318481267092',
    buildingEntityId: '1008806316550935447',
    ownerEntityId: '1369094286737073541',
    regionId: 14,
    progress: 1000,
    recipeId: 612010,
    craftCount: 100,
    lockExpiration: '2026-08-25T12:00:00Z',
    actionsRequiredPerItem: 50,
    totalActionsRequired: 5000,
    craftedItem: [{ item_id: 6170007, quantity: 1, item_type: 'item', durability: 0 }],
    levelRequirements: [{ level: 60, skill_id: 13, skillName: 'Cooking' }],
    toolRequirements: [{ level: 1, power: 1, tool_type: 11, name: 'Pot' }],
    experiencePerProgress: [{ quantity: 2.5, skill_id: 13 }],
    buildingName: 'Cooking Station',
    ownerUsername: 'wiz',
    completed: false,
  };

  const mockPlayer: PlayerDetails = {
    entityId: '1369094286737073541',
    username: 'wiz',
    experience: [
      { skill_id: 13, quantity: 2876143 },
    ],
  };

  it('calculates total, earned, and remaining XP accurately', () => {
    const result = calculateCraftXp(mockCraft, mockPlayer, [], [], null, [], 20);

    expect(result.skillId).toBe(13);
    expect(result.skillName).toBe('Cooking');
    expect(result.baseXpPerAction).toBe(2.5);
    expect(result.totalProgressRequired).toBe(5000);
    expect(result.completedProgress).toBe(1000);
    expect(result.remainingProgress).toBe(4000);
    expect(result.progressPercent).toBe(20);

    // Total XP = 5000 * 2.5 = 12,500
    expect(result.totalCraftXp).toBe(12500);
    // Earned XP = 1000 * 2.5 = 2,500
    expect(result.earnedXp).toBe(2500);
    // Remaining XP = 4000 * 2.5 = 10,000
    expect(result.remainingXp).toBe(10000);

    // Physical Actions (4000 / 20 = 200 actions)
    expect(result.physicalActionsRemaining).toBe(200);
    expect(result.baseActionDurationSeconds).toBe(1.6);
  });

  it('computes items completed and remaining accurately', () => {
    const result = calculateCraftXp(mockCraft, mockPlayer, [], []);

    expect(result.itemsTotal).toBe(100);
    expect(result.itemsCompleted).toBe(20); // 1000 / 50 = 20
    expect(result.itemsRemaining).toBe(80);
  });

  it('uses historical player contribution rate when available', () => {
    const mockContrib: CraftContribution[] = [
      {
        id: 'c1',
        contributorEntityId: mockPlayer.entityId,
        contributorUsername: 'wiz',
        contributionCount: 30,
        totalProgressContributed: 960, // 960 / 30 = 32.0 progress/action
        firstContributedAt: '2026-08-25T10:00:00Z',
        lastContributedAt: '2026-08-25T11:00:00Z',
      },
    ];

    const result = calculateCraftXp(mockCraft, mockPlayer, [], [], null, mockContrib);
    expect(result.isMeasuredProgressPerAction).toBe(true);
    expect(result.progressPerAction).toBe(32);
    // 4000 remaining progress / 32 = 125 physical actions
    expect(result.physicalActionsRemaining).toBe(125);
  });

  it('compounds equipment crafting speed modifiers with 1.6s base action duration', () => {
    const mockEquipment: EquipmentSlot[] = [
      {
        primary: 'chest',
        item: {
          id: 1001,
          name: 'Crafter Tunic',
          tier: 4,
          rarityString: 'Rare',
          stats: [{ id: 15, name: 'Crafting Speed', value: 0.15, is_pct: true }],
        },
      },
      {
        primary: 'finger_1',
        item: {
          id: 1002,
          name: 'Swift Ring',
          tier: 5,
          rarityString: 'Epic',
          stats: [{ id: 15, name: 'Crafting Speed', value: 0.10, is_pct: true }],
        },
      },
    ];

    const result = calculateCraftXp(mockCraft, mockPlayer, mockEquipment, []);
    // Total multiplier = 1 + 0.15 + 0.10 = 1.25 (+25%)
    expect(result.totalCraftingSpeedMultiplier).toBe(1.25);
    expect(result.craftingSpeedBonusPercent).toBe(25);
    // seconds per action = 1.6s / 1.25 = 1.28s
    expect(result.secondsPerAction).toBe(1.28);
  });

  it('accurately accounts for negative crafting speed food debuffs and XP rate bonus', () => {
    const mockBuffs: PlayerBuff[] = [
      {
        buffId: 101,
        buffStartTimestamp: 0,
        buffName: 'EXP Pie',
        description: 'High Quality EXP Pie',
        status: 'active',
        buffDuration: 3600,
        timeRemaining: 1800,
        stats: [
          { id: 15, name: 'Crafting Speed', value: -0.20, is_pct: true }, // -20% crafting speed debuff
          { id: 50, name: 'Experience Rate', value: 0.10, is_pct: true }, // +10% XP bonus
        ],
      },
    ];

    const result = calculateCraftXp(mockCraft, mockPlayer, [], mockBuffs);
    // Multiplier = 1 - 0.20 = 0.80 (-20%)
    expect(result.totalCraftingSpeedMultiplier).toBe(0.80);
    expect(result.craftingSpeedBonusPercent).toBe(-20);
    // seconds per action = 1.6 / 0.8 = 2.0s
    expect(result.secondsPerAction).toBe(2.0);
    // XP Multiplier = 1 + 0.10 = 1.10
    expect(result.xpMultiplier).toBe(1.10);
    expect(result.effectiveXpPerAction).toBe(2.5 * 1.10);
  });

  it('validates tool requirements correctly for Masonry and Chisel', () => {
    const masonryCraft: CraftResult = {
      ...mockCraft,
      toolRequirements: [{ level: 4, power: 4, tool_type: 3, name: 'Chisel' }],
    };

    const gearWithT4Chisel: EquipmentSlot[] = [
      {
        primary: 'main_hand',
        item: {
          id: 5001,
          name: 'Flawless Steel Chisel',
          tier: 4,
          tag: 'tool_chisel',
          stats: [],
        },
      },
    ];

    const result = calculateCraftXp(masonryCraft, mockPlayer, gearWithT4Chisel, []);
    expect(result.toolStatus.requiredToolType).toBe(3);
    expect(result.toolStatus.requiredToolName).toBe('Chisel');
    expect(result.toolStatus.isEquipped).toBe(true);
    expect(result.toolStatus.meetsLevelReq).toBe(true);
  });
});

describe('Multi-User Collaborative Crafting Engine', () => {
  const mockCraft: CraftResult = {
    entityId: '1008806318481267092',
    buildingEntityId: '1008806316550935447',
    ownerEntityId: '1224979098660021941',
    regionId: 14,
    progress: 20000,
    recipeId: 489054866,
    craftCount: 1000,
    lockExpiration: '2026-08-25T12:00:00Z',
    actionsRequiredPerItem: 100,
    totalActionsRequired: 100000, // 80,000 effort remaining
    craftedItem: [{ item_id: 101, quantity: 1, item_type: 'item', durability: 0 }],
    levelRequirements: [{ level: 1, skill_id: 4, skillName: 'Masonry' }],
    toolRequirements: [{ level: 1, power: 1, tool_type: 3, name: 'Chisel' }],
    experiencePerProgress: [{ quantity: 1.6, skill_id: 4 }],
    buildingName: 'Masonry Station',
    ownerUsername: 'Ikuria',
    completed: false,
  };

  const playerIkuria: PlayerDetails = {
    entityId: '1224979098660021941',
    username: 'Ikuria',
    experience: [{ skill_id: 4, quantity: 50000 }],
  };

  it('calculates collaborative speed compounding and time saved for multiple active participants', () => {
    const primaryCalc = calculateCraftXp(mockCraft, playerIkuria, [], [], null, [], 32);

    const nowIso = new Date().toISOString();
    const contributorPayloads = [
      {
        contribution: {
          id: 'c1',
          contributorEntityId: '1224979098660021941',
          contributorUsername: 'Ikuria',
          contributionCount: 500,
          totalProgressContributed: 16000, // 32.0 effort / action
          firstContributedAt: nowIso,
          lastContributedAt: nowIso, // Active (0 mins ago)
        },
        isIncluded: true,
      },
      {
        contribution: {
          id: 'c2',
          contributorEntityId: '999999999',
          contributorUsername: 'DOOM',
          contributionCount: 100,
          totalProgressContributed: 3200, // 32.0 effort / action
          firstContributedAt: nowIso,
          lastContributedAt: nowIso, // Active (0 mins ago)
        },
        isIncluded: true,
      },
      {
        contribution: {
          id: 'c3',
          contributorEntityId: '888888888',
          contributorUsername: 'OldCrafter',
          contributionCount: 20,
          totalProgressContributed: 640,
          firstContributedAt: '2026-08-20T00:00:00Z',
          lastContributedAt: '2026-08-20T01:00:00Z', // Inactive (days ago)
        },
        isIncluded: false,
      },
    ];

    const multiProjection = calculateMultiUserCraftProjection(
      mockCraft,
      playerIkuria,
      primaryCalc,
      contributorPayloads,
      5.0
    );

    expect(multiProjection.totalContributorsCount).toBe(3);
    expect(multiProjection.activeParticipantsCount).toBe(2);

    // 2 equal crafters cut the remaining time in half
    expect(multiProjection.collaborativeEstimatedSecondsRemaining).toBeLessThan(
      multiProjection.soloEstimatedSecondsRemaining
    );
    expect(multiProjection.secondsSaved).toBeGreaterThan(0);

    // Ikuria and DOOM each get 50% of the remaining projected effort
    const ikuriaPart = multiProjection.participants.find((p) => p.username === 'Ikuria');
    const doomPart = multiProjection.participants.find((p) => p.username === 'DOOM');
    const oldPart = multiProjection.participants.find((p) => p.username === 'OldCrafter');

    expect(ikuriaPart?.projectedSharePercent).toBe(50);
    expect(doomPart?.projectedSharePercent).toBe(50);
    expect(oldPart?.projectedSharePercent).toBe(0);

    // Total expected XP = earned + projected
    expect(ikuriaPart?.totalExpectedXp).toBeGreaterThan(ikuriaPart?.earnedXp || 0);
    expect(oldPart?.totalExpectedXp).toBe(oldPart?.earnedXp || 0);
  });
});

describe('Bitcraft XP and Level Progression Curve', () => {
  it('correctly maps base level thresholds', () => {
    expect(calculateXpForLevel(1)).toBe(0);
    expect(calculateXpForLevel(2)).toBe(500);
    expect(calculateXpForLevel(10)).toBe(8500);
  });

  it('correctly converts arbitrary XP to skill levels', () => {
    expect(getLevelFromXp(0)).toBe(1);
    expect(getLevelFromXp(500)).toBe(2);
    expect(getLevelFromXp(4000)).toBe(6);
    expect(getLevelFromXp(2876143)).toBeGreaterThanOrEqual(60);
  });

  it('calculates level progress percentage and remaining XP to next level', () => {
    const progress = getXpProgressForLevel(750);
    expect(progress.level).toBe(2); // level 2 is 500..1168
    expect(progress.currentLevelXp).toBe(500);
    expect(progress.nextLevelXp).toBe(1168);
    expect(progress.xpNeededForNext).toBe(418); // 1168 - 750
    expect(progress.progressPercent).toBeGreaterThan(30);
  });

  it('formats large XP numbers and timestamps cleanly', () => {
    expect(formatXp(2263344)).toBe('2.26M');
    expect(formatTimeSeconds(3600)).toBe('1h 0m 0s');
    expect(formatTimeSeconds(49500)).toBe('13h 45m 0s');
  });
});

describe('Level Milestone Timing & Multi-Level Forecast Engine', () => {
  const craft: CraftResult = {
    entityId: 'craft-123',
    buildingEntityId: 'bld-123',
    ownerEntityId: 'player-1',
    regionId: 1,
    progress: 0,
    recipeId: 101,
    craftCount: 100,
    lockExpiration: '2026-08-25T12:00:00Z',
    actionsRequiredPerItem: 100,
    totalActionsRequired: 10000,
    craftedItem: [{ item_id: 1, quantity: 1, item_type: 'item', durability: 0 }],
    levelRequirements: [],
    toolRequirements: [],
    experiencePerProgress: [{ quantity: 2.0, skill_id: 4 }], // Masonry 2.0 XP/action
    completed: false,
  };

  it('accurately forecasts single next level ETA and craft benchmark item', () => {
    // Current XP = 4,000 (Level 6). Next level 7 threshold is 4,942.
    // XP needed = 942. At 2.0 XP/action, effort needed = 471.
    // Progress per action = 20 -> 24 actions * 1.6s = ~38s.
    const player: PlayerDetails = {
      entityId: 'player-1',
      username: 'Tester',
      experience: [{ skill_id: 4, quantity: 4000 }],
    };

    const result = calculateCraftXp(craft, player, [], [], null, [], 20);

    expect(result.levelForecast.currentLevel).toBe(6);
    expect(result.levelForecast.targetNextLevel).toBe(7);
    expect(result.levelForecast.isNextLevelAchievable).toBe(true);
    expect(result.levelForecast.xpNeededForNextLevel).toBeGreaterThan(0);
    expect(result.levelForecast.secondsToNextLevel).toBeGreaterThan(0);
    expect(result.levelForecast.itemsFinishedAtNextLevel).toBeDefined();
    expect(result.levelForecast.craftProgressPercentAtNextLevel).toBeGreaterThan(0);
  });

  it('generates multi-level milestone roadmap when craft yields multiple levels', () => {
    // Current XP = 0 (Level 1). Craft yields 20,000 XP (10,000 effort * 2.0).
    // 20,000 XP reaches Level 18+.
    const player: PlayerDetails = {
      entityId: 'player-1',
      username: 'Tester',
      experience: [{ skill_id: 4, quantity: 0 }],
    };

    const result = calculateCraftXp(craft, player, [], [], null, [], 20);

    expect(result.levelForecast.totalLevelsGained).toBeGreaterThanOrEqual(10);
    expect(result.levelForecast.milestones.length).toBeGreaterThanOrEqual(10);

    // Verify milestone properties
    const firstMilestone = result.levelForecast.milestones[0];
    expect(firstMilestone.level).toBe(2);
    expect(firstMilestone.isAchievableInThisCraft).toBe(true);
    expect(firstMilestone.estimatedSecondsFromNow).toBeGreaterThan(0);
    expect(firstMilestone.itemsFinishedAtMilestone).toBeGreaterThanOrEqual(0);
  });
});

