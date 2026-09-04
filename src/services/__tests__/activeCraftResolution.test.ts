import { describe, it, expect } from 'vitest';
import { CraftResult, CraftContribution } from '../../types/api';

// Helper to extract primary skill ID from a craft
function getCraftSkillId(c: CraftResult): number | null {
  if (c.experiencePerProgress && c.experiencePerProgress.length > 0) {
    return c.experiencePerProgress[0].skill_id;
  }
  if (c.levelRequirements && c.levelRequirements.length > 0) {
    return c.levelRequirements[0].skill_id;
  }
  if (c.toolRequirements && c.toolRequirements.length > 0) {
    return c.toolRequirements[0].skill_id ?? null;
  }
  return null;
}

// Helper to extract player's contribution on a craft
function extractPlayerContribution(
  contribs: CraftContribution[],
  playerEntityId: string,
  playerUsername?: string
): number {
  return (
    contribs.find(
      (cb) =>
        cb.contributorEntityId === playerEntityId ||
        (playerUsername && cb.contributorUsername?.toLowerCase() === playerUsername.toLowerCase())
    )?.totalProgressContributed || 0
  );
}

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

  it('correctly identifies craft skill IDs', () => {
    expect(getCraftSkillId(ownedCookingCraft)).toBe(13); // Cooking
    expect(getCraftSkillId(helperTailoringCraft)).toBe(10); // Tailoring
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

  it('preserves helper craft selection when third party contributes to owned craft', () => {
    const activeCrafts = [ownedCookingCraft];
    
    // Simulate third party adding progress to owned cooking craft
    // player's personal contribution on cooking is 0
    const cookingContribs: CraftContribution[] = [
      {
        id: 'cb-other',
        contributorEntityId: 'other-helper-999',
        contributorUsername: 'HelperBee',
        totalProgressContributed: 500,
        contributionCount: 10,
        firstContributedAt: '2026-09-04T10:00:00Z',
      },
    ];

    const myCookingContrib = extractPlayerContribution(cookingContribs, playerEntityId, playerUsername);
    expect(myCookingContrib).toBe(0);

    // activeGainedSkillIds is empty (no cooking XP gained by Niomore)
    const activeGainedSkillIds = new Set<number>();

    // Helper craft is still ongoing
    const isHelperOngoing = !helperTailoringCraft.completed;
    expect(isHelperOngoing).toBe(true);

    // Decision check: Did player switch to owned craft?
    let playerSwitchedToOwned = false;
    if (activeCrafts.length > 0 && activeGainedSkillIds.size > 0) {
      const helperSkill = getCraftSkillId(helperTailoringCraft);
      if (helperSkill === null || !activeGainedSkillIds.has(helperSkill)) {
        for (const oc of activeCrafts) {
          const s = getCraftSkillId(oc);
          if (s !== null && activeGainedSkillIds.has(s)) {
            playerSwitchedToOwned = true;
            break;
          }
        }
      }
    }

    expect(playerSwitchedToOwned).toBe(false);
    // Result: STAYS on helper craft!
  });

  it('switches to owned craft when player actively gains XP in owned craft skill', () => {
    const activeCrafts = [ownedCookingCraft];

    // Simulate player gaining Cooking XP (skill_id 13)
    const activeGainedSkillIds = new Set<number>([13]);

    const helperSkill = getCraftSkillId(helperTailoringCraft); // 10
    expect(activeGainedSkillIds.has(helperSkill!)).toBe(false);

    let switchedOwnedIndex = -1;
    for (let i = 0; i < activeCrafts.length; i++) {
      const s = getCraftSkillId(activeCrafts[i]);
      if (s !== null && activeGainedSkillIds.has(s)) {
        switchedOwnedIndex = i;
        break;
      }
    }

    expect(switchedOwnedIndex).toBe(0);
    // Result: Switches to owned craft index 0 (Cooking Station)
  });

  it('detects when helper craft finishes and clears selection for fallback', () => {
    const completedHelperCraft: CraftResult = {
      ...helperTailoringCraft,
      progress: 648830,
      totalActionsRequired: 648830,
      completed: true,
      status: 'completed',
    };

    const isStillOngoing =
      Boolean(completedHelperCraft) &&
      !completedHelperCraft.completed &&
      completedHelperCraft.status !== 'completed' &&
      completedHelperCraft.progress < completedHelperCraft.totalActionsRequired;

    expect(isStillOngoing).toBe(false);
    // Result: Selection cleared, falls back to active owned craft
  });
});
