import { describe, it, expect } from 'vitest';
import {
  resolveCraftCoordinates,
  getBitCraftMapUrl,
  toBitCraftCoords,
  getItemPower,
  getProfessionLevelStats,
  isProfessionSkill,
} from '../bitcraftData';

describe('resolveCraftCoordinates', () => {
  it('resolves camelCase claimLocationX and claimLocationZ', () => {
    const coords = resolveCraftCoordinates({
      claimLocationX: 20673,
      claimLocationZ: 10632,
    });
    expect(coords).toEqual({ x: 20673, z: 10632 });
  });

  it('resolves snake_case claim_location_x and claim_location_z', () => {
    const coords = resolveCraftCoordinates({
      claim_location_x: 20673,
      claim_location_z: 10632,
    });
    expect(coords).toEqual({ x: 20673, z: 10632 });
  });

  it('resolves nested location object (location.locationX, location.locationZ)', () => {
    const coords = resolveCraftCoordinates({
      location: {
        locationX: 1200,
        locationZ: -450,
      },
    });
    expect(coords).toEqual({ x: 1200, z: -450 });
  });

  it('resolves buildingLocationX and buildingLocationZ', () => {
    const coords = resolveCraftCoordinates({
      buildingLocationX: 850,
      buildingLocationZ: 920,
    });
    expect(coords).toEqual({ x: 850, z: 920 });
  });

  it('filters out unindexed dummy coordinates (0, 0)', () => {
    const coords = resolveCraftCoordinates({
      claimLocationX: 0,
      claimLocationZ: 0,
    });
    expect(coords).toBeNull();
  });

  it('returns null for null, undefined, or missing values', () => {
    expect(resolveCraftCoordinates(null)).toBeNull();
    expect(resolveCraftCoordinates(undefined)).toBeNull();
    expect(resolveCraftCoordinates({})).toBeNull();
    expect(resolveCraftCoordinates({ claimLocationX: 100 })).toBeNull();
  });
});

describe('toBitCraftCoords', () => {
  it('correctly converts raw game units (X, Z) to North (Z / 3) and East (X / 3)', () => {
    // Burnout Bay
    expect(toBitCraftCoords(20673, 10632)).toEqual({ n: 3544, e: 6891 });

    // La Reunion
    expect(toBitCraftCoords(17268, 10256)).toEqual({ n: 3419, e: 5756 });
  });

  it('filters out (0, 0)', () => {
    expect(toBitCraftCoords(0, 0)).toBeNull();
  });
});

describe('getBitCraftMapUrl', () => {
  it('generates correct bitcraftmap.com URL with North (Z / 3) and East (X / 3)', () => {
    // Burnout Bay
    const burnoutUrl = getBitCraftMapUrl(20673, 10632, 1.0);
    expect(burnoutUrl).toBe('https://bitcraftmap.com/?center=3544%2C6891&zoom=1.0');

    // La Reunion
    const reunionUrl = getBitCraftMapUrl(17268, 10256, 1.0);
    expect(reunionUrl).toBe('https://bitcraftmap.com/?center=3419%2C5756&zoom=1.0');
  });

  it('returns null for dummy origin coordinates (0, 0)', () => {
    expect(getBitCraftMapUrl(0, 0)).toBeNull();
  });

  it('returns null for undefined, NaN, or incomplete coordinates', () => {
    expect(getBitCraftMapUrl(undefined, undefined)).toBeNull();
    expect(getBitCraftMapUrl(123, undefined)).toBeNull();
    expect(getBitCraftMapUrl(NaN, 456)).toBeNull();
  });
});

describe('getItemPower', () => {
  it('extracts power from toolStats object (e.g. /api/items/{itemId})', () => {
    expect(getItemPower({
      tier: 10,
      toolStats: {
        power: 47,
        level: 11,
        toolType: 'Pickaxe',
        skillId: 5,
        skillName: 'Mining',
      },
    })).toBe(47);
  });

  it('extracts power from explicit stats (id 2 or Tool Power or Power)', () => {
    expect(getItemPower({
      tier: 2,
      stats: [{ id: 2, name: 'Tool Power', value: 3 }],
    })).toBe(3);

    expect(getItemPower({
      tier: 4,
      stats: [{ id: 99, name: 'Forestry Power', value: 5 }],
    })).toBe(5);
  });

  it('falls back to calibrated tier and rarity power when explicit stats are missing', () => {
    expect(getItemPower({ tier: 2 })).toBe(13); // T2 Common baseline
    expect(getItemPower({ tier: 2, rarityString: 'Uncommon' })).toBe(16); // T2 Uncommon (+3)
    expect(getItemPower({ tier: 1 })).toBe(5); // T1 baseline
    expect(getItemPower({ tier: 10 })).toBe(47); // T10 baseline
  });

  it('returns 0 for null or undefined items', () => {
    expect(getItemPower(null)).toBe(0);
    expect(getItemPower(undefined)).toBe(0);
  });
});

describe('getProfessionLevelStats and isProfessionSkill', () => {
  it('correctly identifies crafting and gathering professions', () => {
    expect(isProfessionSkill(2)).toBe(true);  // Forestry
    expect(isProfessionSkill(3)).toBe(true);  // Carpentry
    expect(isProfessionSkill(4)).toBe(true);  // Masonry
    expect(isProfessionSkill(5)).toBe(true);  // Mining
    expect(isProfessionSkill(6)).toBe(true);  // Smithing
    expect(isProfessionSkill(7)).toBe(true);  // Scholar
    expect(isProfessionSkill(8)).toBe(true);  // Leatherworking
    expect(isProfessionSkill(9)).toBe(true);  // Hunting
    expect(isProfessionSkill(10)).toBe(true); // Tailoring
    expect(isProfessionSkill(11)).toBe(true); // Farming
    expect(isProfessionSkill(12)).toBe(true); // Fishing
    expect(isProfessionSkill(14)).toBe(true); // Foraging

    // Excluded Adventuring / Other skills
    expect(isProfessionSkill(13)).toBe(false); // Cooking
    expect(isProfessionSkill(15)).toBe(false); // Construction
    expect(isProfessionSkill(17)).toBe(false); // Taming
    expect(isProfessionSkill(18)).toBe(false); // Slayer
    expect(isProfessionSkill(19)).toBe(false); // Merchanting
    expect(isProfessionSkill(21)).toBe(false); // Sailing
    expect(isProfessionSkill(22)).toBe(false); // Hexite Gathering
  });

  it('calculates cumulative stat increases per level from BitcraftLevelStatIncreases.csv', () => {
    expect(getProfessionLevelStats(2, 1)).toEqual({ speed: 0, power: 0, crit: 0 });
    expect(getProfessionLevelStats(2, 5)).toEqual({ speed: 0.2, power: 1, crit: 0.01 });
    expect(getProfessionLevelStats(2, 25)).toEqual({ speed: 1.2, power: 3, crit: 0.09 });
    expect(getProfessionLevelStats(2, 50)).toEqual({ speed: 2.5, power: 5, crit: 0.19 });
    expect(getProfessionLevelStats(2, 72)).toEqual({ speed: 3.6, power: 7, crit: 0.29 });
    expect(getProfessionLevelStats(2, 100)).toEqual({ speed: 5, power: 10, crit: 0.4 });
    expect(getProfessionLevelStats(2, 110)).toEqual({ speed: 5, power: 20, crit: 0.4 });
  });

  it('returns zero stats for non-profession skills', () => {
    expect(getProfessionLevelStats(13, 72)).toEqual({ speed: 0, power: 0, crit: 0 }); // Cooking
    expect(getProfessionLevelStats(15, 100)).toEqual({ speed: 0, power: 0, crit: 0 }); // Construction
    expect(getProfessionLevelStats(21, 50)).toEqual({ speed: 0, power: 0, crit: 0 }); // Sailing
  });
});
