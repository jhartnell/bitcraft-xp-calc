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
    expect(result.effortPerHour).toBe(45000);
    expect(result.xpPerHour).toBe(112500);
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
    expect(multiProjection.secondsProjectedSaved).toBeGreaterThan(0);
    expect(multiProjection.secondsAlreadySaved).toBeGreaterThan(0);
    expect(multiProjection.secondsTotalSaved).toBe(
      multiProjection.secondsAlreadySaved + multiProjection.secondsProjectedSaved
    );

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
    expect(calculateXpForLevel(10)).toBe(7366);
    expect(calculateXpForLevel(79)).toBe(23032020);
    expect(calculateXpForLevel(80)).toBe(25698250);
  });

  it('correctly converts arbitrary XP to skill levels', () => {
    expect(getLevelFromXp(0)).toBe(1);
    expect(getLevelFromXp(500)).toBe(2);
    expect(getLevelFromXp(4000)).toBe(6);
    expect(getLevelFromXp(25694018)).toBe(79); // Ikuria's live Masonry level
  });

  it('calculates level progress percentage and remaining XP to next level', () => {
    const progress = getXpProgressForLevel(750);
    expect(progress.level).toBe(2); // level 2 is 500..1060
    expect(progress.currentLevelXp).toBe(500);
    expect(progress.nextLevelXp).toBe(1060);
    expect(progress.xpNeededForNext).toBe(310); // 1060 - 750
    expect(progress.progressPercent).toBeGreaterThan(40);

    // Test with Ikuria's exact level 79 Masonry XP
    const ikuriaProgress = getXpProgressForLevel(25694018);
    expect(ikuriaProgress.level).toBe(79);
    expect(ikuriaProgress.currentLevelXp).toBe(23032020);
    expect(ikuriaProgress.nextLevelXp).toBe(25698250);
    expect(ikuriaProgress.xpNeededForNext).toBe(4232);
    expect(ikuriaProgress.progressPercent).toBeGreaterThan(99);
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

  it('correctly calculates XP and items for cargo crafts', () => {
    const cargoCraft: CraftResult = {
      entityId: '576460755398775900',
      buildingEntityId: '576460752349010670',
      ownerEntityId: '1224979098660021941',
      regionId: 8,
      progress: 5000,
      recipeId: 601004,
      craftCount: 50,
      lockExpiration: '2026-08-27T00:00:00Z',
      actionsRequiredPerItem: 100,
      totalActionsRequired: 5000,
      craftedItem: [
        {
          item_id: 302152262,
          quantity: 1,
          item_type: 'cargo',
          durability: 0,
        },
      ],
      experiencePerProgress: [{ quantity: 2.24, skill_id: 2 }],
      completed: false,
    };

    const mockPlayer: PlayerDetails = {
      entityId: '1224979098660021941',
      username: 'Ikuria',
      experience: [{ skill_id: 2, quantity: 50000 }],
    };

    const result = calculateCraftXp(cargoCraft, mockPlayer, [], [], null, [], 25);

    expect(result.itemsTotal).toBe(50);
    expect(result.itemsCompleted).toBe(50);
    expect(result.itemsRemaining).toBe(0);
    expect(result.totalCraftXp).toBe(11200);
  });

  it('correctly applies active food buff overrides when server buffs are absent', () => {
    const testCraft: CraftResult = {
      entityId: '576460755568594225',
      buildingEntityId: '576460752317788935',
      ownerEntityId: '1224979098660021941',
      regionId: 8,
      progress: 1000,
      recipeId: 1632810221,
      craftCount: 100,
      actionsRequiredPerItem: 50,
      totalActionsRequired: 5000,
      craftedItem: [{ item_id: 102576945, quantity: 1, item_type: 'item', durability: 0 }],
      experiencePerProgress: [{ quantity: 2.0, skill_id: 13 }],
      lockExpiration: '2026-08-28T20:00:00Z',
      completed: false,
    };

    const testPlayer: PlayerDetails = {
      entityId: '1224979098660021941',
      username: 'Ikuria',
      experience: [{ skill_id: 13, quantity: 100000 }],
    };

    const mockOverride = {
      id: 'food_1',
      name: 'Fine Crafting Feast (+9.4%)',
      craftingSpeedBonus: 0.094,
      xpRateBonus: 0.05,
      staminaRegenBonus: 10,
      durationSeconds: 3600,
      startedAt: Date.now() - 600000, // 10 minutes ago
      remainingSeconds: 3000,
      enabled: true,
    };

    const result = calculateCraftXp(
      testCraft,
      testPlayer,
      [],
      [], // no server buffs
      null,
      [],
      20,
      null,
      mockOverride
    );

    expect(result.activeBuffModifiers.length).toBe(1);
    expect(result.activeBuffModifiers[0].name).toContain('Fine Crafting Feast');
    expect(result.activeBuffModifiers[0].craftingSpeedBonus).toBe(0.094);
    expect(result.activeBuffModifiers[0].xpRateBonus).toBe(0.05);
    expect(result.craftingSpeedBonusPercent).toBe(9.4);
    expect(result.xpMultiplier).toBe(1.05);

    // Verify speedBreakdown is accurately populated
    expect(result.speedBreakdown).toBeDefined();
    expect(result.speedBreakdown.baseMultiplier).toBe(1.0);
    expect(result.speedBreakdown.buffBonusPercent).toBe(9.4);
    expect(result.speedBreakdown.totalMultiplier).toBeCloseTo(1.094, 3);
    expect(result.speedBreakdown.finalSecondsPerAction).toBeCloseTo(1.6 / 1.094, 3);
    expect(result.speedBreakdown.contributors.length).toBeGreaterThanOrEqual(2);
  });

  it('generates itemized speedBreakdown across equipment, food, and profession skill stats', () => {
    const testCraft: CraftResult = {
      entityId: '576460755568594225',
      buildingEntityId: '576460752317788935',
      ownerEntityId: '1224979098660021941',
      regionId: 8,
      progress: 1000,
      recipeId: 1632810221,
      craftCount: 100,
      actionsRequiredPerItem: 50,
      totalActionsRequired: 5000,
      craftedItem: [{ item_id: 102576945, quantity: 1, item_type: 'item', durability: 0 }],
      experiencePerProgress: [{ quantity: 2.0, skill_id: 13 }],
      lockExpiration: '2026-08-28T20:00:00Z',
      completed: false,
    };

    const testPlayer: PlayerDetails = {
      entityId: '1224979098660021941',
      username: 'Ikuria',
      experience: [{ skill_id: 13, quantity: 100000 }],
    };

    const mockEquipment: EquipmentSlot[] = [
      {
        primary: 'torso_clothing',
        item: {
          id: 2001,
          name: 'Crafter Shirt',
          tier: 3,
          rarityString: 'Rare',
          stats: [{ id: 15, name: 'Crafting Speed', value: 0.0528, is_pct: true }],
        },
      },
      {
        primary: 'hand_artifact_1',
        item: {
          id: 2002,
          name: 'Silver Band',
          tier: 4,
          rarityString: 'Epic',
          stats: [{ id: 15, name: 'Crafting Speed', value: 0.088, is_pct: true }],
        },
      },
    ];

    const mockStatsValues: number[] = Array(60).fill(0);
    mockStatsValues[15] = 1.182; // General Crafting Speed (+18.2%)
    mockStatsValues[32] = 1.040; // Cooking Skill Speed Stat (+4.0%)

    const mockStats = {
      entityId: '1224979098660021941',
      values: mockStatsValues,
    };

    const mockOverride = {
      id: 'food_1',
      name: 'Fine Feast (+9.4%)',
      craftingSpeedBonus: 0.094,
      xpRateBonus: 0,
      staminaRegenBonus: 0,
      durationSeconds: 3600,
      startedAt: Date.now(),
      remainingSeconds: 3600,
      enabled: true,
    };

    const result = calculateCraftXp(
      testCraft,
      testPlayer,
      mockEquipment,
      [],
      mockStats,
      [],
      20,
      null,
      mockOverride
    );

    expect(result.speedBreakdown).toBeDefined();
    expect(result.speedBreakdown.equipmentBonusPercent).toBe(14.1);
    expect(result.speedBreakdown.equipmentItems.length).toBe(2);
    expect(result.speedBreakdown.equipmentItems[0].name).toBe('Crafter Shirt');
    expect(result.speedBreakdown.equipmentItems[0].bonusPercent).toBe(5.3);
    expect(result.speedBreakdown.buffBonusPercent).toBe(9.4);
    expect(result.speedBreakdown.professionSkillBonusPercent).toBe(4.0);
    expect(result.speedBreakdown.professionSkillName).toBe('Cooking');
    // Total multiplier = 1.0 + 0.1408 (gear) + 0.040 (skill) + 0.094 (food) = 1.2748
    expect(result.speedBreakdown.totalMultiplier).toBeCloseTo(1.275, 3);
    expect(result.speedBreakdown.totalBonusPercent).toBe(27.5);
    expect(result.speedBreakdown.finalSecondsPerAction).toBeCloseTo(1.6 / 1.2748, 2);
  });

  it('correctly applies negative speed and XP rate debuff overrides', () => {
    const testCraft: CraftResult = {
      entityId: '576460755568594225',
      buildingEntityId: '576460752317788935',
      ownerEntityId: '1224979098660021941',
      regionId: 8,
      progress: 1000,
      recipeId: 1632810221,
      craftCount: 100,
      actionsRequiredPerItem: 50,
      totalActionsRequired: 5000,
      craftedItem: [{ item_id: 102576945, quantity: 1, item_type: 'item', durability: 0 }],
      experiencePerProgress: [{ quantity: 2.0, skill_id: 13 }],
      lockExpiration: '2026-08-28T20:00:00Z',
      completed: false,
    };

    const testPlayer: PlayerDetails = {
      entityId: '1224979098660021941',
      username: 'Ikuria',
      experience: [{ skill_id: 13, quantity: 100000 }],
    };

    const mockDebuffOverride = {
      id: 'debuff_1',
      name: 'Exhausted & Encumbered',
      craftingSpeedBonus: -0.20, // -20% speed
      xpRateBonus: -0.10,        // -10% XP
      staminaRegenBonus: 0,
      durationSeconds: 1800,
      startedAt: Date.now(),
      remainingSeconds: 1800,
      enabled: true,
    };

    const result = calculateCraftXp(
      testCraft,
      testPlayer,
      [],
      [],
      null,
      [],
      20,
      null,
      mockDebuffOverride
    );

    expect(result.activeBuffModifiers.length).toBe(1);
    expect(result.activeBuffModifiers[0].isDebuff).toBe(true);
    expect(result.activeBuffModifiers[0].category).toBe('Debuff');
    expect(result.activeBuffModifiers[0].craftingSpeedBonus).toBe(-0.20);
    expect(result.activeBuffModifiers[0].xpRateBonus).toBe(-0.10);
    expect(result.craftingSpeedBonusPercent).toBe(-20);
    expect(result.totalCraftingSpeedMultiplier).toBeCloseTo(0.80, 2);
    expect(result.secondsPerAction).toBeCloseTo(1.6 / 0.8, 2); // 2.0s per action
    expect(result.xpMultiplier).toBeCloseTo(0.90, 2);
  });

  it('correctly calculates Speed and Power bonuses from Fishing Charms and Instruments for Fishing crafts', () => {
    const fishingCraft: CraftResult = {
      entityId: 'fishing_station_1',
      buildingEntityId: 'b_1',
      ownerEntityId: 'p_1',
      regionId: 14,
      progress: 0,
      recipeId: 70001,
      craftCount: 10,
      lockExpiration: '2026-08-25T12:00:00Z',
      actionsRequiredPerItem: 100,
      totalActionsRequired: 1000,
      craftedItem: [{ item_id: 1234, quantity: 1, item_type: 'item', durability: 0 }],
      levelRequirements: [{ level: 20, skill_id: 12, skillName: 'Fishing' }],
      toolRequirements: [{ level: 3, power: 4, tool_type: 10, name: 'Fishing Rod' }],
      experiencePerProgress: [{ quantity: 2.0, skill_id: 12 }],
      buildingName: 'Fishery Station',
      completed: false,
    };

    const fishingPlayer: PlayerDetails = {
      entityId: 'p_1',
      username: 'Angler',
      experience: [{ skill_id: 12, quantity: 50000 }], // Fishing Lvl ~23 (+1.15% skill speed)
    };

    const equippedGear: EquipmentSlot[] = [
      {
        primary: 'main_hand',
        item: {
          id: 5001,
          name: 'Sturdy Fishing Rod',
          tier: 3,
          stats: [{ id: 2, name: 'Tool Power', value: 3, is_pct: false }],
        },
      },
      {
        primary: 'charm_1',
        item: {
          id: 6001,
          name: 'Charm of the Master Angler',
          tier: 2,
          rarityString: 'Rare',
          stats: [
            { id: 31, name: 'Fishing Speed', value: 0.05, is_pct: true }, // +5% Fishing Speed
            { id: 2, name: 'Fishing Power', value: 1, is_pct: false },    // +1 Fishing Power
          ],
        },
      },
      {
        primary: 'instrument',
        item: {
          id: 7001,
          name: 'River Melody Flute',
          tier: 2,
          rarityString: 'Uncommon',
          stats: [
            { id: 16, name: 'Gathering Speed', value: 0.08, is_pct: true }, // +8% Gathering Speed
            { id: 2, name: 'Power', value: 1, is_pct: false },              // +1 Power
          ],
        },
      },
    ];

    const result = calculateCraftXp(fishingCraft, fishingPlayer, equippedGear, [], null, [], null);

    // Base Rod (3) + Charm (+1) + Flute (+1) + Lvl 15 Fishing (+2) = 7
    expect(result.toolStatus.effectivePower).toBe(7);
    expect(result.toolStatus.meetsPowerReq).toBe(true); // 7 >= required 4

    // Theoretical Progress Per Action with Power 7 = 7 (1:1 Effective Power)
    expect(result.progressPerAction).toBe(7);

    // Total Gear Speed = +5% (Charm) + 8% (Flute gathering speed) = +13.0%
    const gearModifierNames = result.equipmentModifiers.map((e) => e.itemName);
    expect(gearModifierNames).toContain('Charm of the Master Angler');
    expect(gearModifierNames).toContain('River Melody Flute');

    // Main tool verification: equipped tool MUST be the main-hand tool, not the charm or instrument
    expect(result.toolStatus.equippedTool?.name).toBe('Sturdy Fishing Rod');
    expect(result.toolStatus.isEquipped).toBe(true);
  });

  it('ensures profession-specific charms do not leak into unrelated crafts', () => {
    const smithingCraft: CraftResult = {
      entityId: 'craft_smithing_1',
      buildingEntityId: 'b_forge_1',
      buildingName: 'Blacksmith Forge',
      ownerEntityId: 'p1',
      regionId: 14,
      recipeId: 401,
      progress: 0,
      craftCount: 1,
      actionsRequiredPerItem: 100,
      totalActionsRequired: 100,
      completed: false,
      craftedItem: [],
      experiencePerProgress: [{ skill_id: 6, quantity: 1.0 }], // Skill 6 = Smithing
      toolRequirements: [{ level: 1, power: 1, tool_type: 5 }],
      lockExpiration: '2026-08-30T00:00:00Z',
    };

    const smithingPlayer: PlayerDetails = {
      entityId: 'p1',
      username: 'Smithy',
      experience: [{ skill_id: 6, quantity: 0 }], // Level 1 Smithing
    };

    const fishingGearOnly: EquipmentSlot[] = [
      {
        primary: 'fishing_charm',
        item: {
          id: 1001,
          name: 'Charm of the Master Angler',
          tier: 3,
          stats: [
            { id: 31, name: 'Fishing Speed', value: 0.1, is_pct: true },
            { id: 44, name: 'Fishing Power', value: 2, is_pct: false },
          ],
        },
      },
      {
        primary: 'fishing_instrument',
        item: {
          id: 1002,
          name: 'Angler Reel',
          tier: 3,
          stats: [
            { id: 44, name: 'Fishing Power', value: 2, is_pct: false },
          ],
        },
      },
    ];

    const result = calculateCraftXp(smithingCraft, smithingPlayer, fishingGearOnly, [], null, [], null);

    // Fishing speed & power should NOT apply to Smithing craft
    expect(result.equipmentModifiers.length).toBe(0);
    expect(result.toolStatus.effectivePower).toBe(1); // Default 1
    expect(result.toolStatus.equippedTool).toBeNull();
    expect(result.toolStatus.isEquipped).toBe(false);
    expect(result.toolStatus.meetsPowerReq).toBe(true);
  });

  it('ensures charms and instruments are never mistaken for the equipped main tool', () => {
    const cookingCraft: CraftResult = {
      entityId: 'kitchen_1',
      buildingEntityId: 'b_3',
      ownerEntityId: 'p_1',
      regionId: 14,
      progress: 0,
      recipeId: 60001,
      craftCount: 1,
      lockExpiration: '2026-08-25T12:00:00Z',
      actionsRequiredPerItem: 50,
      totalActionsRequired: 50,
      craftedItem: [{ item_id: 9999, quantity: 1, item_type: 'item', durability: 0 }],
      levelRequirements: [{ level: 1, skill_id: 13, skillName: 'Cooking' }],
      toolRequirements: [{ level: 1, power: 1, tool_type: 11, name: 'Pot' }],
      experiencePerProgress: [{ quantity: 2.0, skill_id: 13 }],
      buildingName: 'Cooking Station',
      completed: false,
    };

    const player: PlayerDetails = {
      entityId: 'p_1',
      username: 'Chef',
      experience: [{ skill_id: 13, quantity: 1000 }],
    };

    // Equipping a Cooking Charm and Instrument, but NO Pot in main_hand
    const gearWithoutPot: EquipmentSlot[] = [
      {
        primary: 'charm_1',
        item: {
          id: 8001,
          name: 'Gourmet Cooking Charm',
          tier: 2,
          stats: [
            { id: 32, name: 'Cooking Speed', value: 0.05, is_pct: true },
            { id: 2, name: 'Power', value: 1, is_pct: false },
          ],
        },
      },
      {
        primary: 'instrument',
        item: {
          id: 8002,
          name: 'Chef Flute',
          tier: 1,
          stats: [{ id: 15, name: 'Crafting Speed', value: 0.03, is_pct: true }],
        },
      },
    ];

    const result = calculateCraftXp(cookingCraft, player, gearWithoutPot, [], null, [], null);

    // Equipped tool must NOT be set to the charm or instrument
    expect(result.toolStatus.equippedTool).toBeNull();
    expect(result.toolStatus.isEquipped).toBe(false);
    expect(result.toolStatus.meetsLevelReq).toBe(false);

    // But speed and power modifiers from the charm and instrument must still be ingested
    expect(result.equipmentModifiers.length).toBe(2);
    expect(result.craftingSpeedBonusPercent).toBe(8.0); // +5% + 3% = +8%
  });

  it('matches Forestry tools like Hatchet in various tool and hand slots', () => {
    const forestryCraft: CraftResult = {
      entityId: 'craft_forestry_1',
      buildingEntityId: 'b_f1',
      buildingName: 'Timber Bench',
      ownerEntityId: 'p_forester',
      regionId: 14,
      recipeId: 201,
      progress: 50,
      craftCount: 10,
      actionsRequiredPerItem: 10,
      totalActionsRequired: 100,
      completed: false,
      craftedItem: [],
      experiencePerProgress: [{ skill_id: 2, quantity: 2.24 }],
      toolRequirements: [{ level: 1, power: 1, tool_type: 1 }],
      lockExpiration: '2026-08-30T00:00:00Z',
    };

    const foresterPlayer: PlayerDetails = {
      entityId: 'p_forester',
      username: 'Woodcutter',
      experience: [{ skill_id: 2, quantity: 0 }],
    };

    // Equipping a Common T2 Pyrelite Axe (13 power)
    const gearWithCommonAxe: EquipmentSlot[] = [
      {
        primary: 'tool_1',
        item: {
          id: 2001,
          name: 'Pyrelite Axe',
          tier: 2,
          rarityString: 'Common',
          stats: [{ id: 2, name: 'Tool Power', value: 13, is_pct: false }],
        },
      },
    ];

    const resultCommon = calculateCraftXp(forestryCraft, foresterPlayer, gearWithCommonAxe, []);
    expect(resultCommon.toolStatus.isEquipped).toBe(true);
    expect(resultCommon.toolStatus.equippedTool?.name).toBe('Pyrelite Axe');
    // Tier 2 Tool = Level 20 floor (+2 Power): 13 + 2 = 15
    expect(resultCommon.toolStatus.effectivePower).toBe(15);
    expect(resultCommon.toolStatus.meetsPowerReq).toBe(true);

    // Equipping an Uncommon T2 Pyrelite Axe (16 power)
    const gearWithUncommonAxe: EquipmentSlot[] = [
      {
        primary: 'tool_1',
        item: {
          id: 2002,
          name: 'Pyrelite Axe',
          tier: 2,
          rarityString: 'Uncommon',
          stats: [{ id: 2, name: 'Tool Power', value: 16, is_pct: false }],
        },
      },
    ];

    const resultUncommon = calculateCraftXp(forestryCraft, foresterPlayer, gearWithUncommonAxe, []);
    expect(resultUncommon.toolStatus.isEquipped).toBe(true);
    // Tier 2 Tool = Level 20 floor (+2 Power): 16 + 2 = 18
    expect(resultUncommon.toolStatus.effectivePower).toBe(18);
  });

  it('infers valid tool status when player is actively contributing to a craft', () => {
    const masonryCraft: CraftResult = {
      entityId: 'craft_masonry_active',
      buildingEntityId: 'b_m1',
      buildingName: 'Masonry Bench',
      ownerEntityId: 'p_mason',
      regionId: 14,
      recipeId: 201,
      progress: 50,
      craftCount: 1,
      actionsRequiredPerItem: 100,
      totalActionsRequired: 100,
      completed: false,
      craftedItem: [],
      experiencePerProgress: [{ skill_id: 4, quantity: 1.5 }],
      toolRequirements: [{ level: 2, power: 1, tool_type: 3, name: 'Chisel' }],
      lockExpiration: '2026-08-30T00:00:00Z',
    };

    const activePlayer: PlayerDetails = {
      entityId: 'p_mason',
      username: 'MasonMaster',
      experience: [{ skill_id: 4, quantity: 1000 }],
    };

    const result = calculateCraftXp(masonryCraft, activePlayer, [], []);
    expect(result.toolStatus.isEquipped).toBe(true);
    expect(result.toolStatus.equippedTool).not.toBeNull();
    expect(result.toolStatus.meetsLevelReq).toBe(true);
    expect(result.toolStatus.meetsPowerReq).toBe(true);
  });

  it('matches tool and extracts exact power from toolStats metadata (e.g. T10 Pickaxe with power 47)', () => {
    const miningCraft: CraftResult = {
      entityId: 'craft_mining_1',
      buildingEntityId: 'b_m1',
      buildingName: 'Mining Quarry',
      ownerEntityId: 'p_miner',
      regionId: 14,
      recipeId: 501,
      progress: 0,
      craftCount: 10,
      actionsRequiredPerItem: 50,
      totalActionsRequired: 500,
      completed: false,
      craftedItem: [],
      experiencePerProgress: [{ skill_id: 5, quantity: 2.56 }],
      toolRequirements: [{ level: 10, power: 40, tool_type: 4, name: 'Pickaxe' }],
      lockExpiration: '2026-08-30T00:00:00Z',
    };

    const minerPlayer: PlayerDetails = {
      entityId: 'p_miner',
      username: 'DeepDelver',
      experience: [{ skill_id: 5, quantity: 0 }],
    };

    const equipmentWithT10Pick: EquipmentSlot[] = [
      {
        primary: 'main_hand',
        item: {
          id: 1421716234,
          name: 'Mythic Pickaxe',
          tier: 10,
          rarityString: 'Mythic',
          toolStats: {
            power: 47,
            level: 11,
            toolType: 'Pickaxe',
            skillId: 5,
            skillName: 'Mining',
          },
        },
      },
    ];

    const result = calculateCraftXp(miningCraft, minerPlayer, equipmentWithT10Pick, []);
    expect(result.toolStatus.isEquipped).toBe(true);
    expect(result.toolStatus.equippedTool?.name).toBe('Mythic Pickaxe');
    // Tier 10 Tool = Level 100 floor (+10 Power): 47 + 10 = 57
    expect(result.toolStatus.effectivePower).toBe(57);
    expect(result.toolStatus.meetsPowerReq).toBe(true);
    expect(result.toolStatus.meetsLevelReq).toBe(true);
  });

  it('accurately resolves tool power from dedicated playerTools system and combines with instrument power', () => {
    const forestryCraft: CraftResult = {
      entityId: 'craft_forestry_ikuria',
      buildingEntityId: 'b_f_exquisite',
      buildingName: 'Exquisite Forestry Station',
      ownerEntityId: 'p_ikuria',
      regionId: 14,
      recipeId: 301003,
      progress: 17785,
      craftCount: 1,
      actionsRequiredPerItem: 63000,
      totalActionsRequired: 63000,
      completed: false,
      craftedItem: [{ item_id: 27993326, quantity: 1, item_type: 'item', durability: 0 }],
      experiencePerProgress: [{ skill_id: 2, quantity: 2.24 }],
      toolRequirements: [{ level: 3, power: 1, tool_type: 1, name: 'Axe' }],
      lockExpiration: '2026-08-30T00:00:00Z',
    };

    const ikuriaPlayer: PlayerDetails = {
      entityId: 'p_ikuria',
      username: 'Ikuria',
      experience: [{ skill_id: 2, quantity: 22617055 }],
    };

    // Equipment only has instruments/charms (main_hand is null)
    const equipmentWithWedge: EquipmentSlot[] = [
      {
        primary: 'forestry_instrument',
        item: {
          id: 521974955,
          name: 'Hexite Wooden Wedge',
          tier: -1,
          rarityString: 'Common',
          stats: [{ id: 34, name: 'Forestry Power', value: 2, is_pct: false }],
        },
      },
    ];

    // Dedicated playerTools array from /players/{id}/tools
    const playerTools = [
      { toolType: 1, power: 35, level: 8 }, // Axe
      { toolType: 2, power: 32, level: 8 }, // Saw
      { toolType: 3, power: 32, level: 8 }, // Chisel
      { toolType: 4, power: 35, level: 9 }, // Pickaxe
    ];

    const result = calculateCraftXp(
      forestryCraft,
      ikuriaPlayer,
      equipmentWithWedge,
      [],
      null,
      [],
      null,
      null,
      null,
      playerTools
    );

    expect(result.toolStatus.isEquipped).toBe(true);
    expect(result.toolStatus.equippedTool?.name).toBe('Aurumite Axe');
    expect(result.toolStatus.equippedTool?.tier).toBe(7);
    expect(result.toolStatus.equippedTool?.rarityString).toBe('Legendary');
    expect(result.toolStatus.meetsLevelReq).toBe(true); // Level 8 >= 3
    expect(result.toolStatus.meetsPowerReq).toBe(true); // 45 >= 1
    // Level 78 Forestry Bonus: +8 Power, +390% Speed, +31% Crit
    expect(result.toolStatus.levelPowerBonus).toBe(8);
    expect(result.toolStatus.levelSpeedBonus).toBe(3.9);
    expect(result.toolStatus.levelCritBonus).toBe(0.31);
    // Base Tool (35) + Hexite Wooden Wedge (+2) + Level Bonus (+8) = 45 Total Effective Power
    expect(result.toolStatus.effectivePower).toBe(45);
  });

  it('infers Scholar skillId from tool_type: 13 when experiencePerProgress is absent and calculates level power bonus', () => {
    const scholarSharedCraft: CraftResult = {
      entityId: 'craft_scholar_t2',
      buildingEntityId: 'b_s1',
      buildingName: 'Research Desk',
      ownerEntityId: 'p_other',
      regionId: 14,
      recipeId: 7001,
      progress: 0,
      craftCount: 1,
      actionsRequiredPerItem: 100,
      totalActionsRequired: 100,
      completed: false,
      craftedItem: [],
      toolRequirements: [{ level: 2, power: 1, tool_type: 13, name: 'Quill / Codex' }],
      lockExpiration: '2026-08-30T00:00:00Z',
    };

    const scholarPlayer: PlayerDetails = {
      entityId: 'p_scholar',
      username: 'Sage',
      experience: [
        { skill_id: 7, quantity: 50000 }, // Level 25 Scholar -> +3 Power, +120% Speed, +9% Crit
      ],
    };

    const playerTools = [
      { toolType: 13, power: 29, level: 8 }, // Aurumite Quill (29 Power)
    ];

    const result = calculateCraftXp(
      scholarSharedCraft,
      scholarPlayer,
      [],
      [],
      null,
      [],
      null,
      null,
      null,
      playerTools
    );

    expect(result.skillId).toBe(7);
    expect(result.skillName).toBe('Scholar');
    expect(result.toolStatus.isEquipped).toBe(true);
    expect(result.toolStatus.equippedTool?.name).toBe('Aurumite Quill');
    expect(result.toolStatus.levelPowerBonus).toBe(2); // Level 24 Scholar = +2 Power
    expect(result.toolStatus.levelSpeedBonus).toBe(1.1); // Level 24 Scholar = +110% Speed
    expect(result.toolStatus.levelCritBonus).toBe(0.09); // Level 24 Scholar = +9% Crit
    // Base Tool (29) + Level Bonus (2) = 31 Total Effective Power
    expect(result.toolStatus.effectivePower).toBe(31);
    // Theoretical 1:1 fallback progress per action
    expect(result.progressPerAction).toBe(31);
  });

  it('floors to tool requirement when player has a T7 tool (Level 70) on a T5 craft (Level 50)', () => {
    const peerlessForestryCraft: CraftResult = {
      entityId: 'craft_forestry_t5',
      buildingEntityId: 'b_f1',
      buildingName: 'Peerless Forestry Station',
      ownerEntityId: '1224979098660021941',
      regionId: 12,
      recipeId: 501003,
      progress: 0,
      craftCount: 100,
      actionsRequiredPerItem: 115,
      totalActionsRequired: 11500,
      completed: false,
      craftedItem: [],
      levelRequirements: [{ level: 50, skill_id: 2 }],
      toolRequirements: [{ level: 5, power: 1, tool_type: 1 }],
      lockExpiration: '2026-08-30T00:00:00Z',
    };

    const playerWithNullExp: PlayerDetails = {
      entityId: '1224979098660021941',
      username: 'Ikuria',
      experience: null as any,
    };

    // Aurumite Axe is level 8 = Tier 7 (Level 70 requirement)
    const playerTools = [
      { toolType: 1, power: 35, level: 8 },
    ];

    const result = calculateCraftXp(
      peerlessForestryCraft,
      playerWithNullExp,
      [],
      [],
      null,
      [],
      null,
      null,
      null,
      playerTools
    );

    expect(result.skillId).toBe(2);
    expect(result.skillName).toBe('Forestry');
    // Floored to higher of Craft (50) vs Tool (70) -> Level 70 Forestry
    expect(result.currentSkillLevel).toBe(70);
    expect(result.toolStatus.levelPowerBonus).toBe(7); // Level 70 Forestry = +7 Power
    expect(result.toolStatus.levelSpeedBonus).toBe(3.5); // Level 70 Forestry = +350% Speed
    expect(result.toolStatus.levelCritBonus).toBe(0.28); // Level 70 Forestry = +28% Crit
    // Base Tool (35) + Level 70 Floor Bonus (7) = 42 Total Effective Power
    expect(result.toolStatus.effectivePower).toBe(42);
    expect(result.isSkillLevelInferred).toBe(true);
    expect(result.isSkillLevelOverridden).toBe(false);
  });

  it('floors to craft requirement when craft requires Level 60 but tool requires Level 50', () => {
    const t6Craft: CraftResult = {
      entityId: 'craft_forestry_t6',
      buildingEntityId: 'b_f2',
      buildingName: 'Mythic Forestry Station',
      ownerEntityId: '1224979098660021941',
      regionId: 12,
      recipeId: 601003,
      progress: 0,
      craftCount: 100,
      actionsRequiredPerItem: 150,
      totalActionsRequired: 15000,
      completed: false,
      craftedItem: [],
      levelRequirements: [{ level: 60, skill_id: 2 }],
      toolRequirements: [{ level: 5, power: 1, tool_type: 1 }],
      lockExpiration: '2026-08-30T00:00:00Z',
    };

    const playerWithNullExp: PlayerDetails = {
      entityId: '1224979098660021941',
      username: 'Ikuria',
      experience: null as any,
    };

    // Luminite Axe is level 6 = Tier 5 (Level 50 requirement)
    const playerTools = [
      { toolType: 1, power: 23, level: 6 },
    ];

    const result = calculateCraftXp(
      t6Craft,
      playerWithNullExp,
      [],
      [],
      null,
      [],
      null,
      null,
      null,
      playerTools
    );

    expect(result.skillId).toBe(2);
    expect(result.skillName).toBe('Forestry');
    // Floored to higher of Craft (60) vs Tool (50) -> Level 60 Forestry
    expect(result.currentSkillLevel).toBe(60);
    expect(result.toolStatus.levelPowerBonus).toBe(6); // Level 60 Forestry = +6 Power
    expect(result.toolStatus.levelSpeedBonus).toBe(3.0); // Level 60 Forestry = +300% Speed
    expect(result.toolStatus.levelCritBonus).toBe(0.23); // Level 60 Forestry = +23% Crit
    // Base Tool (23) + Level 60 Floor Bonus (6) = 29 Total Effective Power
    expect(result.toolStatus.effectivePower).toBe(29);
    expect(result.isSkillLevelInferred).toBe(true);
    expect(result.isSkillLevelOverridden).toBe(false);
  });

  it('applies user manual skill level override when provided in skillOverrides map', () => {
    const peerlessForestryCraft: CraftResult = {
      entityId: 'craft_forestry_t5',
      buildingEntityId: 'b_f1',
      buildingName: 'Peerless Forestry Station',
      ownerEntityId: '1224979098660021941',
      regionId: 12,
      recipeId: 501003,
      progress: 0,
      craftCount: 100,
      actionsRequiredPerItem: 115,
      totalActionsRequired: 11500,
      completed: false,
      craftedItem: [],
      levelRequirements: [{ level: 50, skill_id: 2 }],
      toolRequirements: [{ level: 5, power: 1, tool_type: 1 }],
      lockExpiration: '2026-08-30T00:00:00Z',
    };

    const playerWithNullExp: PlayerDetails = {
      entityId: '1224979098660021941',
      username: 'Ikuria',
      experience: null as any,
    };

    const playerTools = [
      { toolType: 1, power: 35, level: 8 }, // Aurumite Axe (Tier 7)
    ];

    const skillOverrides = {
      2: { level: 78 }, // Manual override to Level 78 Forestry
    };

    const result = calculateCraftXp(
      peerlessForestryCraft,
      playerWithNullExp,
      [],
      [],
      null,
      [],
      null,
      null,
      null,
      playerTools,
      skillOverrides
    );

    expect(result.skillId).toBe(2);
    expect(result.currentSkillLevel).toBe(78);
    // Level 78 Forestry = +8 Power, +390% Speed, +31% Crit
    expect(result.toolStatus.levelPowerBonus).toBe(8);
    expect(result.toolStatus.levelSpeedBonus).toBe(3.9);
    expect(result.toolStatus.levelCritBonus).toBe(0.31);
    // Base Tool (35) + Level 78 Bonus (8) = 43 Total Effective Power
    expect(result.toolStatus.effectivePower).toBe(43);
    // 1:1 Fallback Effort
    expect(result.progressPerAction).toBe(43);
    expect(result.isSkillLevelInferred).toBe(false);
    expect(result.isSkillLevelOverridden).toBe(true);
  });
});
