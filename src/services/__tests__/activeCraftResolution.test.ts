import { describe, it, expect } from 'vitest';
import { CraftResult, CraftContribution } from '../../types/api';
import { getCraftSkillId, extractPlayerContribution } from '../bitcraftData';
import { resolveActiveCraftSelection, isCraftOngoing } from '../craftResolution';

describe('Active Craft Resolution & XP-Driven Persistence', () => {
  const playerEntityId = '1297036692699948454';
  const playerUsername = 'Niomore';

  const ownedCookingCraft: CraftResult = {
    entityId: 'craft-cooking-1',
    buildingEntityId: 'bld-cooking-1',
    ownerEntityId: playerEntityId,
    ownerUsername: playerUsername,
    buildingName: 'Cooking Station',
    regionId: 8,
    recipeId: 512007,
    lockExpiration: '2026-09-04T12:00:00Z',
    craftedItem: [{ item_id: 544662309, quantity: 1, item_type: 'item', durability: 0 }],
    progress: 27258,
    craftCount: 2000,
    actionsRequiredPerItem: 55,
    totalActionsRequired: 110000,
    completed: false,
    levelRequirements: [{ level: 50, skill_id: 13 }],
    experiencePerProgress: [{ skill_id: 13, quantity: 1.6 }],
  };

  const helperTailoringCraft: CraftResult = {
    entityId: 'craft-tailoring-1',
    buildingEntityId: 'bld-tailoring-1',
    ownerEntityId: '1008806316547497590',
    ownerUsername: 'SPancerfaustyna',
    buildingName: 'Ornate Tailoring Station',
    regionId: 8,
    recipeId: 209007,
    lockExpiration: '2026-09-04T12:00:00Z',
    craftedItem: [{ item_id: 2090008, quantity: 1, item_type: 'item', durability: 0 }],
    progress: 273455,
    craftCount: 9982,
    actionsRequiredPerItem: 65,
    totalActionsRequired: 648830,
    completed: false,
    levelRequirements: [{ level: 20, skill_id: 10 }],
    experiencePerProgress: [{ skill_id: 10, quantity: 2.0 }],
  };

  const helperCarpentryCraft: CraftResult = {
    entityId: 'craft-carpentry-1',
    buildingEntityId: 'bld-carpentry-1',
    ownerEntityId: '2009907771234567890',
    ownerUsername: 'BobTheBuilder',
    buildingName: 'Carpentry Workshop',
    regionId: 8,
    recipeId: 301002,
    lockExpiration: '2026-09-04T12:00:00Z',
    craftedItem: [{ item_id: 3010005, quantity: 1, item_type: 'item', durability: 0 }],
    progress: 1000,
    craftCount: 50,
    actionsRequiredPerItem: 100,
    totalActionsRequired: 5000,
    completed: false,
    toolRequirements: [{ level: 1, power: 1, tool_type: 2 }], // Tool type 2 -> Saw -> Carpentry (skill 3)
  };

  it('correctly identifies craft skill IDs across exp, level, toolRequirements, and building name', () => {
    expect(getCraftSkillId(ownedCookingCraft)).toBe(13); // Cooking
    expect(getCraftSkillId(helperTailoringCraft)).toBe(10); // Tailoring
    expect(getCraftSkillId(helperCarpentryCraft)).toBe(3); // Carpentry from toolRequirements tool_type 2
    expect(getCraftSkillId({ entityId: 'c1', buildingName: 'Ancient Smithy' } as CraftResult)).toBe(6); // Smithing
  });

  it('correctly filters player contributions versus third-party contributions', () => {
    const mixedContributions: CraftContribution[] = [
      {
        id: 'cb-1',
        contributorEntityId: '1008806316547497590',
        contributorUsername: 'SPancerfaustyna',
        totalProgressContributed: 228179,
        contributionCount: 6168,
        firstContributedAt: '2026-08-28T22:57:40Z',
      },
      {
        id: 'cb-2',
        contributorEntityId: playerEntityId,
        contributorUsername: playerUsername,
        totalProgressContributed: 45276,
        contributionCount: 1372,
        firstContributedAt: '2026-08-31T19:12:00Z',
      },
    ];

    expect(extractPlayerContribution(mixedContributions, playerEntityId, playerUsername)).toBe(45276);
    expect(extractPlayerContribution(mixedContributions, 'random-player', 'Random')).toBe(0);
  });

  it('auto-switches from Owned craft to Shared craft when gaining shared craft skill XP', () => {
    // Player is currently viewing owned cooking craft, but starts gaining Tailoring XP (skill 10)
    const res = resolveActiveCraftSelection({
      currentTargetCraftId: ownedCookingCraft.entityId,
      activeGainedSkillIds: new Set<number>([10]), // Tailoring XP gained!
      ownedActiveCrafts: [ownedCookingCraft],
      candidateSharedCrafts: [helperTailoringCraft],
      playerEntityId,
      playerUsername,
    });

    expect(res.isResolved).toBe(true);
    expect(res.selectedCraftId).toBe(helperTailoringCraft.entityId);
    expect(res.customCraft).toEqual(helperTailoringCraft);
    expect(res.reason).toBe('active_xp_match_shared');
  });

  it('preserves shared craft selection when actively gaining shared craft skill XP', () => {
    // Player is viewing shared tailoring craft and continues gaining Tailoring XP (skill 10)
    const res = resolveActiveCraftSelection({
      currentTargetCraftId: helperTailoringCraft.entityId,
      activeGainedSkillIds: new Set<number>([10]),
      ownedActiveCrafts: [ownedCookingCraft],
      candidateSharedCrafts: [helperTailoringCraft],
      playerEntityId,
      playerUsername,
    });

    expect(res.isResolved).toBe(true);
    expect(res.selectedCraftId).toBe(helperTailoringCraft.entityId);
    expect(res.customCraft).toEqual(helperTailoringCraft);
    expect(res.reason).toBe('active_xp_match_current');
  });

  it('preserves shared craft selection when third party contributes to owned craft', () => {
    // Third party contributes to Cooking craft -> Player's gained skill XP is empty (or Tailoring)
    const res = resolveActiveCraftSelection({
      currentTargetCraftId: helperTailoringCraft.entityId,
      activeGainedSkillIds: new Set<number>(), // No XP gained by player in this tick
      ownedActiveCrafts: [ownedCookingCraft],
      candidateSharedCrafts: [helperTailoringCraft],
      playerEntityId,
      playerUsername,
    });

    expect(res.isResolved).toBe(true);
    expect(res.selectedCraftId).toBe(helperTailoringCraft.entityId);
    expect(res.customCraft).toEqual(helperTailoringCraft);
    expect(res.reason).toBe('sticky_shared');
  });

  it('switches back to owned craft when player actively gains XP in owned craft skill', () => {
    // Player moves back to cooking station and gains Cooking XP (skill 13)
    const res = resolveActiveCraftSelection({
      currentTargetCraftId: helperTailoringCraft.entityId,
      activeGainedSkillIds: new Set<number>([13]), // Cooking XP gained!
      ownedActiveCrafts: [ownedCookingCraft],
      candidateSharedCrafts: [helperTailoringCraft],
      playerEntityId,
      playerUsername,
    });

    expect(res.isResolved).toBe(true);
    expect(res.selectedCraftId).toBe(ownedCookingCraft.entityId);
    expect(res.selectedCraftIndex).toBe(0);
    expect(res.customCraft).toBeNull();
    expect(res.reason).toBe('active_xp_match_owned');
  });

  it('auto-switches from Shared Craft A to Shared Craft B when player switches stations', () => {
    // Player was on Tailoring, but starts gaining Carpentry XP (skill 3) on Bob's Carpentry Station
    const res = resolveActiveCraftSelection({
      currentTargetCraftId: helperTailoringCraft.entityId,
      activeGainedSkillIds: new Set<number>([3]), // Carpentry XP gained!
      ownedActiveCrafts: [ownedCookingCraft],
      candidateSharedCrafts: [helperTailoringCraft, helperCarpentryCraft],
      playerEntityId,
      playerUsername,
    });

    expect(res.isResolved).toBe(true);
    expect(res.selectedCraftId).toBe(helperCarpentryCraft.entityId);
    expect(res.customCraft).toEqual(helperCarpentryCraft);
    expect(res.reason).toBe('active_xp_match_shared');
  });

  it('detects when helper craft finishes and falls back to owned craft', () => {
    const completedHelperCraft: CraftResult = {
      ...helperTailoringCraft,
      progress: 648830,
      totalActionsRequired: 648830,
      completed: true,
      status: 'completed',
    };

    expect(isCraftOngoing(completedHelperCraft)).toBe(false);

    const res = resolveActiveCraftSelection({
      currentTargetCraftId: completedHelperCraft.entityId,
      activeGainedSkillIds: new Set<number>(),
      ownedActiveCrafts: [ownedCookingCraft],
      candidateSharedCrafts: [completedHelperCraft],
      playerEntityId,
      playerUsername,
    });

    expect(res.isResolved).toBe(true);
    expect(res.selectedCraftId).toBe(ownedCookingCraft.entityId);
    expect(res.selectedCraftIndex).toBe(0);
    expect(res.customCraft).toBeNull();
    expect(res.reason).toBe('fallback_owned');
  });

  it('does not auto-select unverified nearby public crafts when player is idle with no owned crafts', () => {
    const res = resolveActiveCraftSelection({
      currentTargetCraftId: null,
      activeGainedSkillIds: new Set<number>(),
      ownedActiveCrafts: [],
      candidateSharedCrafts: [helperTailoringCraft],
      verifiedHelperCraftIds: new Set<string>(),
      playerEntityId,
      playerUsername,
    });

    expect(res.isResolved).toBe(false);
    expect(res.selectedCraftId).toBeNull();
    expect(res.customCraft).toBeNull();
    expect(res.reason).toBe('none');
  });

  it('auto-selects a verified helper craft when player has no owned crafts', () => {
    const res = resolveActiveCraftSelection({
      currentTargetCraftId: null,
      activeGainedSkillIds: new Set<number>(),
      ownedActiveCrafts: [],
      candidateSharedCrafts: [helperTailoringCraft],
      verifiedHelperCraftIds: new Set<string>([helperTailoringCraft.entityId]),
      playerEntityId,
      playerUsername,
    });

    expect(res.isResolved).toBe(true);
    expect(res.selectedCraftId).toBe(helperTailoringCraft.entityId);
    expect(res.customCraft).toEqual(helperTailoringCraft);
    expect(res.reason).toBe('fallback_shared');
  });

  it('does not auto-switch via XP gain to an unverified public craft', () => {
    const res = resolveActiveCraftSelection({
      currentTargetCraftId: null,
      activeGainedSkillIds: new Set<number>([10]), // Tailoring XP gained
      ownedActiveCrafts: [],
      candidateSharedCrafts: [helperTailoringCraft],
      verifiedHelperCraftIds: new Set<string>(), // Player is NOT a verified contributor
      playerEntityId,
      playerUsername,
    });

    expect(res.isResolved).toBe(false);
    expect(res.selectedCraftId).toBeNull();
    expect(res.customCraft).toBeNull();
    expect(res.reason).toBe('none');
  });
});

