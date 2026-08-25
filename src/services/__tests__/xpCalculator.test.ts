import { describe, it, expect } from 'vitest';
import { calculateCraftXp } from '../xpCalculator';
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
    const mockContributions: CraftContribution[] = [
      {
        id: '1',
        contributorEntityId: '1369094286737073541',
        contributorUsername: 'wiz',
        totalProgressContributed: 50000,
        contributionCount: 2000, // 50000 / 2000 = 25 progress / action
      },
    ];

    const result = calculateCraftXp(mockCraft, mockPlayer, [], [], null, mockContributions);

    expect(result.isMeasuredProgressPerAction).toBe(true);
    expect(result.progressPerAction).toBe(25);
    // Remaining physical actions = 4000 / 25 = 160
    expect(result.physicalActionsRemaining).toBe(160);
  });

  it('compounds equipment crafting speed modifiers with 1.6s base action duration', () => {
    const mockEquipment: EquipmentSlot[] = [
      {
        primary: 'torso_clothing',
        item: {
          id: 1,
          name: 'Fine Shirt',
          tier: 4,
          stats: [{ id: 15, value: 0.15, is_pct: true, name: 'Crafting Speed' }],
        },
      },
      {
        primary: 'hand_clothing',
        item: {
          id: 2,
          name: 'Fine Gloves',
          tier: 4,
          stats: [{ id: 15, value: 0.05, is_pct: true, name: 'Crafting Speed' }],
        },
      },
    ];

    const result = calculateCraftXp(mockCraft, mockPlayer, mockEquipment, [], null, [], 20);

    // Speed bonus: 0.15 + 0.05 = +20% (multiplier = 1.20)
    expect(result.craftingSpeedBonusPercent).toBe(20);
    expect(result.totalCraftingSpeedMultiplier).toBe(1.2);
    // Seconds per action = 1.6 / 1.2 = 1.333s
    expect(result.secondsPerAction).toBeCloseTo(1.333, 2);
    // Remaining physical actions = 4000 / 20 = 200 actions
    // Remaining seconds = 200 * 1.333 = 267s
    expect(result.estimatedSecondsRemaining).toBe(267);
  });

  it('accurately accounts for negative crafting speed food debuffs and XP rate bonus', () => {
    const mockDebuff: PlayerBuff[] = [
      {
        buffId: 1016481604,
        buffName: 'Food Buffs',
        buffStartTimestamp: 1000,
        buffDuration: 1800,
        description: 'High Quality EXP Pie',
        status: 'active',
        timeRemaining: 1200,
        stats: [
          { id: 15, value: -0.2, is_pct: true, name: 'Crafting Speed' },
          { id: 50, value: 0.1, is_pct: true, name: 'Experience Rate' },
        ],
      },
    ];

    const result = calculateCraftXp(mockCraft, mockPlayer, [], mockDebuff, null, [], 20);

    // Debuff of -20% means speed multiplier is 1.0 - 0.20 = 0.80
    expect(result.craftingSpeedBonusPercent).toBe(-20);
    expect(result.totalCraftingSpeedMultiplier).toBeCloseTo(0.8, 2);
    // Action duration increases from 1.6s to 1.6 / 0.80 = 2.0s
    expect(result.secondsPerAction).toBe(2.0);
    expect(result.activeBuffModifiers[0].isDebuff).toBe(true);
    // Remaining time = 200 * 2.0s = 400s
    expect(result.estimatedSecondsRemaining).toBe(400);
    // Experience Rate +10% applied
    expect(result.xpMultiplier).toBe(1.1);
  });

  it('validates tool requirements correctly for Masonry and Chisel', () => {
    const mockMasonryCraft: CraftResult = {
      ...mockCraft,
      experiencePerProgress: [{ quantity: 2.5, skill_id: 4 }],
      levelRequirements: [{ level: 40, skill_id: 4, skillName: 'Masonry' }],
      toolRequirements: [{ level: 4, power: 1, tool_type: 3, name: 'Chisel' }],
    };

    const mockEquipmentWithChisel: EquipmentSlot[] = [
      {
        primary: 'main_hand',
        item: {
          id: 55,
          name: 'Fine Chisel',
          tag: 'Mason Tool',
          tier: 4,
        },
      },
    ];

    const result = calculateCraftXp(mockMasonryCraft, mockPlayer, mockEquipmentWithChisel, []);

    expect(result.skillId).toBe(4);
    expect(result.skillName).toBe('Masonry');
    expect(result.toolStatus.requiredToolName).toBe('Chisel');
    expect(result.toolStatus.isEquipped).toBe(true);
    expect(result.toolStatus.meetsLevelReq).toBe(true);
    expect(result.toolStatus.effectivePower).toBe(4);
  });
});

describe('Bitcraft XP and Level Progression Curve', () => {
  it('correctly maps base level thresholds', () => {
    expect(calculateXpForLevel(1)).toBe(0);
    expect(calculateXpForLevel(2)).toBe(500);
    expect(calculateXpForLevel(50)).toBeGreaterThan(900000);
    expect(calculateXpForLevel(60)).toBeGreaterThan(2800000);
    expect(calculateXpForLevel(100)).toBeGreaterThan(200000000);
  });

  it('correctly converts arbitrary XP to skill levels', () => {
    expect(getLevelFromXp(0)).toBe(1);
    expect(getLevelFromXp(2876143)).toBe(60);
    expect(getLevelFromXp(8649354)).toBe(70);
  });

  it('calculates level progress percentage and remaining XP to next level', () => {
    const lvl60Xp = calculateXpForLevel(60);
    const lvl61Xp = calculateXpForLevel(61);
    const halfXp = lvl60Xp + (lvl61Xp - lvl60Xp) / 2;

    const progress = getXpProgressForLevel(halfXp);
    expect(progress.level).toBe(60);
    expect(progress.progressPercent).toBeCloseTo(50, 0);
    expect(progress.xpNeededForNext).toBeCloseTo((lvl61Xp - lvl60Xp) / 2, 0);
  });

  it('formats large XP numbers and timestamps cleanly', () => {
    expect(formatXp(500)).toBe('500');
    expect(formatXp(15000)).toBe('15.0k');
    expect(formatXp(2850000)).toBe('2.85M');
    expect(formatXp(1200000000)).toBe('1.20B');

    expect(formatTimeSeconds(45)).toBe('45s');
    expect(formatTimeSeconds(125)).toBe('2m 5s');
    expect(formatTimeSeconds(3665)).toBe('1h 1m 5s');
  });
});
