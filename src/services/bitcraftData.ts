// Game metadata constants, mappings, and XP curves for Bitcraft Online

import { ToolStats, ItemStat } from '../types/api';

export interface SkillDefinition {
  id: number;
  name: string;
  category: 'Profession' | 'Adventure' | 'Other';
  icon: string;
  color: string;
  toolType?: number;
}

export const SKILL_DEFINITIONS: Record<number, SkillDefinition> = {
  2: { id: 2, name: 'Forestry', category: 'Profession', icon: '🪓', color: '#10b981', toolType: 1 },
  3: { id: 3, name: 'Carpentry', category: 'Profession', icon: '🪵', color: '#d97706', toolType: 2 },
  4: { id: 4, name: 'Masonry', category: 'Profession', icon: '🧱', color: '#78716c', toolType: 3 },
  5: { id: 5, name: 'Mining', category: 'Profession', icon: '⛏️', color: '#64748b', toolType: 4 },
  6: { id: 6, name: 'Smithing', category: 'Profession', icon: '⚒️', color: '#ef4444', toolType: 5 },
  7: { id: 7, name: 'Scholar', category: 'Profession', icon: '📜', color: '#8b5cf6', toolType: 13 },
  8: { id: 8, name: 'Leatherworking', category: 'Profession', icon: '🥋', color: '#b45309', toolType: 6 },
  9: { id: 9, name: 'Hunting', category: 'Profession', icon: '🏹', color: '#84cc16', toolType: 7 },
  10: { id: 10, name: 'Tailoring', category: 'Profession', icon: '🧵', color: '#ec4899', toolType: 8 },
  11: { id: 11, name: 'Farming', category: 'Profession', icon: '🌾', color: '#eab308', toolType: 9 },
  12: { id: 12, name: 'Fishing', category: 'Profession', icon: '🎣', color: '#06b6d4', toolType: 10 },
  13: { id: 13, name: 'Cooking', category: 'Profession', icon: '🍲', color: '#f97316', toolType: 11 },
  14: { id: 14, name: 'Foraging', category: 'Profession', icon: '🍄', color: '#14b8a6', toolType: 12 },
  15: { id: 15, name: 'Construction', category: 'Profession', icon: '🏗️', color: '#f59e0b', toolType: 14 },
  17: { id: 17, name: 'Taming', category: 'Adventure', icon: '🐾', color: '#a855f7' },
  18: { id: 18, name: 'Slayer', category: 'Adventure', icon: '⚔️', color: '#dc2626' },
  19: { id: 19, name: 'Merchanting', category: 'Adventure', icon: '🪙', color: '#eab308' },
  21: { id: 21, name: 'Sailing', category: 'Adventure', icon: '⛵', color: '#3b82f6' },
  22: { id: 22, name: 'Hexite Gathering', category: 'Other', icon: '🔮', color: '#6366f1' },
};

export const TOOL_TYPE_NAMES: Record<number, string> = {
  1: 'Axe',
  2: 'Saw',
  3: 'Chisel',
  4: 'Pickaxe',
  5: 'Smithing Hammer',
  6: 'Leatherworking Knife',
  7: 'Hunting Bow',
  8: 'Tailoring Needle / Shears',
  9: 'Hoe / Sickle',
  10: 'Fishing Rod',
  11: 'Cooking Pot / Pan',
  12: 'Foraging Sickle / Basket',
  13: 'Quill / Codex',
  14: 'Construction Mallet',
};

export const TOOL_TYPE_TO_SKILL_ID: Record<number, number> = {
  1: 2,   // Axe -> Forestry
  2: 3,   // Saw -> Carpentry
  3: 4,   // Chisel -> Masonry
  4: 5,   // Pickaxe -> Mining
  5: 6,   // Hammer -> Smithing
  6: 8,   // Leather Knife -> Leatherworking
  7: 9,   // Hunting Bow -> Hunting
  8: 10,  // Needle -> Tailoring
  9: 11,  // Hoe -> Farming
  10: 12, // Fishing Rod -> Fishing
  11: 13, // Cooking Pot -> Cooking
  12: 14, // Sickle -> Foraging
  13: 7,  // Quill / Codex -> Scholar
  14: 15, // Construction Mallet -> Construction
};

const TOOL_BASE_NAMES: Record<number, string> = {
  1: 'Axe',
  2: 'Saw',
  3: 'Chisel',
  4: 'Pickaxe',
  5: 'Hammer',
  6: 'Knife',
  7: 'Bow',
  8: 'Shears',
  9: 'Hoe',
  10: 'Rod',
  11: 'Cooking Pan',
  12: 'Sickle',
  13: 'Quill',
  14: 'Mallet',
};

const LEVEL_TO_MATERIAL: Record<number, string> = {
  1: 'Flint',
  2: 'Flint',
  3: 'Pyrelite',
  4: 'Emarium',
  5: 'Elenvar',
  6: 'Luminite',
  7: 'Rathium',
  8: 'Aurumite',
  9: 'Celestium',
  10: 'Umbracite',
  11: 'Astralite',
};

export const LEVEL_TO_TIER: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
  10: 9,
  11: 10,
};

const TIER_TO_REQUIRED_LEVEL: Record<number, number> = {
  1: 1,
  2: 20,
  3: 30,
  4: 40,
  5: 50,
  6: 60,
  7: 70,
  8: 80,
  9: 90,
  10: 100,
};

export function getTierRequiredLevel(tier?: number): number {
  if (!tier || tier <= 1) return 1;
  return TIER_TO_REQUIRED_LEVEL[tier] || Math.min(100, tier * 10);
}

export function resolveToolName(toolType: number, level: number = 1): string {
  const material = LEVEL_TO_MATERIAL[level] || 'Flint';
  const baseName = TOOL_BASE_NAMES[toolType] || TOOL_TYPE_NAMES[toolType] || 'Tool';
  return `${material} ${baseName}`;
}

const TIER_BASE_COMMON_POWER: Record<number, number> = {
  1: 8,
  2: 13,
  3: 14,
  4: 16,
  5: 18,
  6: 20,
  7: 23,
  8: 26,
  9: 29,
  10: 32,
};

export function resolveToolRarity(tier: number, power?: number): string {
  if (!power) return 'Common';
  const baseCommon = TIER_BASE_COMMON_POWER[tier] || 5;
  const diff = power - baseCommon;
  if (diff <= 0) return 'Common';
  const step = Math.round(diff / 3);
  if (step === 1) return 'Uncommon';
  if (step === 2) return 'Rare';
  if (step === 3) return 'Epic';
  if (step === 4) return 'Legendary';
  if (step >= 5) return 'Mythic';
  return 'Common';
}

// Comprehensive profession tool synonym and keyword lookup for resilient gear matching
export const SKILL_TOOL_KEYWORDS: Record<number, string[]> = {
  2: ['axe', 'hatchet', 'adze', 'broadaxe', 'chopper', 'cleaver', 'drawknife', 'saw', 'felling', 'lumberjack', 'woodcutter', 'forestry'], // Forestry
  3: ['saw', 'hammer', 'mallet', 'chisel', 'drawknife', 'carpentry', 'plane', 'adz', 'bench', 'carpenter'], // Carpentry
  4: ['chisel', 'hammer', 'trowel', 'pick', 'masonry', 'mason', 'mallet', 'stone'], // Masonry
  5: ['pickaxe', 'pick', 'mattock', 'mining', 'drill', 'miner'], // Mining
  6: ['hammer', 'sledge', 'tongs', 'smithing', 'smith', 'blacksmith', 'forge', 'anvil'], // Smithing
  7: ['quill', 'codex', 'pen', 'ink', 'magnifying', 'scribe', 'scholar', 'book', 'tome', 'scroll'], // Scholar
  8: ['knife', 'awl', 'skiving', 'shears', 'leatherworking', 'leather', 'tannery', 'tanner'], // Leatherworking
  9: ['bow', 'crossbow', 'spear', 'knife', 'dagger', 'hunting', 'hunter', 'weapon', 'quiver'], // Hunting
  10: ['needle', 'shears', 'scissors', 'spindle', 'tailoring', 'tailor', 'loom', 'thread'], // Tailoring
  11: ['hoe', 'sickle', 'pitchfork', 'rake', 'watering', 'farming', 'farm', 'farmer', 'scythe', 'spade'], // Farming
  12: ['rod', 'pole', 'net', 'harpoon', 'fishing', 'fish', 'fisher', 'lure', 'reel'], // Fishing
  13: ['pot', 'pan', 'skillet', 'knife', 'spatula', 'ladle', 'cooking', 'cook', 'cauldron'], // Cooking
  14: ['sickle', 'basket', 'knife', 'trowel', 'foraging', 'forage', 'forager', 'scythe', 'pouch'], // Foraging
  15: ['mallet', 'hammer', 'wrench', 'construction', 'builder', 'trowel', 'build'], // Construction
};

// Baseline BitCraft tool power by tier when /api/items/{itemId} metadata is not yet resolved
const DEFAULT_TOOL_POWER_BY_TIER: Record<number, number> = {
  1: 5,
  2: 13,
  3: 18,
  4: 23,
  5: 28,
  6: 32,
  7: 36,
  8: 40,
  9: 44,
  10: 47,
};

/**
 * Computes default tool power based on item tier and rarity grade.
 */
function getTierDefaultPower(tier?: number, rarity?: string): number {
  if (!tier || tier <= 0) return 5;
  const base = DEFAULT_TOOL_POWER_BY_TIER[tier] || Math.max(5, tier * 4 + 5);
  const r = (rarity || '').toLowerCase();
  if (r === 'uncommon') return base + 3;
  if (r === 'rare') return base + 6;
  if (r === 'epic') return base + 9;
  if (r === 'legendary') return base + 12;
  if (r === 'mythic') return base + 15;
  return base;
}

/**
 * Extracts effective power rating from an item, prioritizing explicit toolStats.power,
 * Power / Tool Power stats, and falling back to calibrated tier/rarity baseline power.
 */
export function getItemPower(item?: {
  tier?: number;
  rarityStr?: string;
  rarityString?: string;
  toolStats?: Partial<ToolStats> | null;
  stats?: ItemStat[] | { id: number; name?: string; value: number }[];
} | null): number {
  if (!item) return 0;

  // 1. Check explicit toolStats.power from /api/items/{itemId} (Highest authority)
  if (item.toolStats && typeof item.toolStats.power === 'number' && item.toolStats.power > 0) {
    return item.toolStats.power;
  }

  // 2. Check explicit stats array for Power / Tool Power
  let powerFromStats = 0;
  if (item.stats && item.stats.length > 0) {
    for (const st of item.stats) {
      const nameLower = (st.name || '').toLowerCase();
      if (st.id === 2 || nameLower.includes('tool power') || nameLower.includes('power')) {
        powerFromStats += st.value;
      }
    }
  }
  if (powerFromStats > 0) {
    return powerFromStats;
  }

  // 3. Fallback to calibrated tier and rarity power (e.g. T2 Common -> 13, T2 Uncommon -> 16, T10 -> 47)
  if (item.tier && item.tier > 0) {
    return getTierDefaultPower(item.tier, item.rarityStr || item.rarityString);
  }

  return 5;
}

// Default base XP per progress unit by Skill ID when recipe metadata is omitted by the API
export const DEFAULT_SKILL_BASE_XP: Record<number, number> = {
  2: 2.24,  // Forestry
  3: 2.08,  // Carpentry
  4: 2.08,  // Masonry (Standard refined recipes)
  5: 2.56,  // Mining
  6: 2.0,   // Smithing
  7: 1.76,  // Scholar
  8: 1.6,   // Leatherworking
  9: 2.0,   // Hunting
  10: 2.4,  // Tailoring
  11: 2.08, // Farming
  12: 2.56, // Fishing
  13: 2.4,  // Cooking
  14: 2.24, // Foraging
  15: 1.0,  // Construction
  17: 15.0, // Taming
  21: 13.0, // Sailing
};

// Calibrated BitCraft incremental level delta XP (XP needed to complete level L and reach L + 1)
function calculateLevelDeltaXp(level: number): number {
  if (level <= 1) return 500;
  const rate = 1.115732232;
  const scale = 520.2624865;
  return Math.round(500 + scale * (Math.pow(rate, level - 1) - 1));
}

// Pre-computed cumulative lookup table for instant O(1) performance
// LEVEL_XP_TABLE[L] = Cumulative lifetime XP required to reach Level L (Level 1 = 0 XP)
const LEVEL_XP_TABLE: number[] = (() => {
  const table = new Array<number>(111).fill(0);
  table[0] = 0;
  table[1] = 0;
  for (let l = 1; l < 110; l++) {
    table[l + 1] = table[l] + calculateLevelDeltaXp(l);
  }
  return table;
})();

// Cumulative lifetime XP required to reach a specific level
export function calculateXpForLevel(level: number): number {
  if (level <= 1) return 0;
  const clamped = Math.min(110, Math.max(1, level));
  return LEVEL_XP_TABLE[clamped];
}

export function getLevelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  for (let lvl = 110; lvl >= 1; lvl--) {
    if (xp >= LEVEL_XP_TABLE[lvl]) {
      return lvl;
    }
  }
  return 1;
}

export function getXpProgressForLevel(xp: number): {
  level: number;
  currentXp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpNeededForNext: number;
  progressPercent: number;
} {
  const level = getLevelFromXp(xp);
  const currentLevelXp = LEVEL_XP_TABLE[level];
  const nextLevel = Math.min(110, level + 1);
  const nextLevelXp = LEVEL_XP_TABLE[nextLevel];
  
  if (level >= 110) {
    return {
      level: 110,
      currentXp: xp,
      currentLevelXp,
      nextLevelXp: currentLevelXp,
      xpNeededForNext: 0,
      progressPercent: 100,
    };
  }

  const xpInCurrentLevel = Math.max(0, xp - currentLevelXp);
  const levelSpan = Math.max(1, nextLevelXp - currentLevelXp);
  const progressPercent = Math.min(100, Math.max(0, (xpInCurrentLevel / levelSpan) * 100));

  return {
    level,
    currentXp: xp,
    currentLevelXp,
    nextLevelXp,
    xpNeededForNext: Math.max(0, nextLevelXp - xp),
    progressPercent,
  };
}

export function formatXp(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`;
  }
  return num.toLocaleString();
}

export function formatTimeSeconds(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

export interface WorldCoordinates {
  x: number;
  z: number;
}

/**
 * Resolves world coordinates from any craft/claim object across different API serialization formats.
 * Filters out unindexed dummy origin coordinates (0, 0).
 */
export function resolveCraftCoordinates(obj?: Record<string, unknown> | null): WorldCoordinates | null {
  if (!obj) return null;

  const rawX =
    obj.claimLocationX ??
    obj.claim_location_x ??
    obj.locationX ??
    obj.location_x ??
    obj.buildingLocationX ??
    obj.building_location_x ??
    (obj.location as Record<string, unknown> | undefined)?.locationX ??
    (obj.location as Record<string, unknown> | undefined)?.location_x ??
    (obj.location as Record<string, unknown> | undefined)?.x ??
    (obj.claim as Record<string, unknown> | undefined)?.locationX ??
    (obj.claim as Record<string, unknown> | undefined)?.location_x ??
    (obj.claim as Record<string, unknown> | undefined)?.x ??
    (obj.claimLocation as Record<string, unknown> | undefined)?.x;

  const rawZ =
    obj.claimLocationZ ??
    obj.claim_location_z ??
    obj.locationZ ??
    obj.location_z ??
    obj.buildingLocationZ ??
    obj.building_location_z ??
    (obj.location as Record<string, unknown> | undefined)?.locationZ ??
    (obj.location as Record<string, unknown> | undefined)?.location_z ??
    (obj.location as Record<string, unknown> | undefined)?.z ??
    (obj.claim as Record<string, unknown> | undefined)?.locationZ ??
    (obj.claim as Record<string, unknown> | undefined)?.location_z ??
    (obj.claim as Record<string, unknown> | undefined)?.z ??
    (obj.claimLocation as Record<string, unknown> | undefined)?.z;

  if (rawX === undefined || rawZ === undefined || rawX === null || rawZ === null) {
    return null;
  }

  const numX = Number(rawX);
  const numZ = Number(rawZ);

  if (isNaN(numX) || isNaN(numZ)) {
    return null;
  }

  // Filter out unindexed dummy coordinates (0, 0)
  if (numX === 0 && numZ === 0) {
    return null;
  }

  return { x: numX, z: numZ };
}

/**
 * Converts raw SpacetimeDB / BitJita world units (X, Z) to in-game / BitCraftMap (North, East) coordinates.
 * Formula: North = round(Z / 3), East = round(X / 3).
 */
export function toBitCraftCoords(rawX?: number, rawZ?: number): { n: number; e: number } | null {
  if (rawX === undefined || rawZ === undefined || isNaN(rawX) || isNaN(rawZ)) return null;
  if (rawX === 0 && rawZ === 0) return null;
  return {
    n: Math.round(rawZ / 3),
    e: Math.round(rawX / 3),
  };
}

/**
 * Generates a direct bitcraftmap.com link centered at the given station's coordinates.
 * BitCraftMap URL format: ?center=N%2CE&zoom=1.0
 */
export function getBitCraftMapUrl(rawX?: number, rawZ?: number, zoom: number = 1.0): string | null {
  const coords = toBitCraftCoords(rawX, rawZ);
  if (!coords) return null;
  return `https://bitcraftmap.com/?center=${encodeURIComponent(`${coords.n},${coords.e}`)}&zoom=${zoom.toFixed(1)}`;
}

export interface ProfessionLevelStatBonus {
  speed: number;
  power: number;
  crit: number;
}

// All 12 crafting & gathering professions that receive cumulative level stat increases (Power, Speed, Crit)
// Excludes Adventuring abilities: Cooking (13), Construction (15), Taming (17), Slayer (18), Merchanting (19), Sailing (21), Hexite Gathering (22)
const PROFESSION_SKILL_IDS = new Set<number>([
  2,  // Forestry
  3,  // Carpentry
  4,  // Masonry
  5,  // Mining
  6,  // Smithing
  7,  // Scholar
  8,  // Leatherworking
  9,  // Hunting
  10, // Tailoring
  11, // Farming
  12, // Fishing
  14, // Foraging
]);

export function isProfessionSkill(skillId: number): boolean {
  return PROFESSION_SKILL_IDS.has(skillId);
}

// Cumulative stat increases per profession level compiled from BitcraftLevelStatIncreases.csv (Levels 1 to 110)
const PROFESSION_LEVEL_STAT_TABLE: Record<number, ProfessionLevelStatBonus> = {
  1: { speed: 0, power: 0, crit: 0 },
  2: { speed: 0.1, power: 0, crit: 0 },
  3: { speed: 0.1, power: 0, crit: 0.01 },
  4: { speed: 0.2, power: 0, crit: 0.01 },
  5: { speed: 0.2, power: 1, crit: 0.01 },
  6: { speed: 0.3, power: 1, crit: 0.01 },
  7: { speed: 0.3, power: 1, crit: 0.02 },
  8: { speed: 0.4, power: 1, crit: 0.02 },
  9: { speed: 0.4, power: 1, crit: 0.03 },
  10: { speed: 0.5, power: 1, crit: 0.03 },
  11: { speed: 0.5, power: 1, crit: 0.04 },
  12: { speed: 0.6, power: 1, crit: 0.04 },
  13: { speed: 0.6, power: 1, crit: 0.05 },
  14: { speed: 0.7, power: 1, crit: 0.05 },
  15: { speed: 0.7, power: 2, crit: 0.05 },
  16: { speed: 0.8, power: 2, crit: 0.05 },
  17: { speed: 0.8, power: 2, crit: 0.06 },
  18: { speed: 0.9, power: 2, crit: 0.06 },
  19: { speed: 0.9, power: 2, crit: 0.07 },
  20: { speed: 1, power: 2, crit: 0.07 },
  21: { speed: 1, power: 2, crit: 0.08 },
  22: { speed: 1.1, power: 2, crit: 0.08 },
  23: { speed: 1.1, power: 2, crit: 0.09 },
  24: { speed: 1.2, power: 2, crit: 0.09 },
  25: { speed: 1.2, power: 3, crit: 0.09 },
  26: { speed: 1.3, power: 3, crit: 0.09 },
  27: { speed: 1.3, power: 3, crit: 0.1 },
  28: { speed: 1.4, power: 3, crit: 0.1 },
  29: { speed: 1.4, power: 3, crit: 0.11 },
  30: { speed: 1.5, power: 3, crit: 0.11 },
  31: { speed: 1.5, power: 3, crit: 0.12 },
  32: { speed: 1.6, power: 3, crit: 0.12 },
  33: { speed: 1.6, power: 3, crit: 0.13 },
  34: { speed: 1.7, power: 3, crit: 0.13 },
  35: { speed: 1.7, power: 4, crit: 0.13 },
  36: { speed: 1.8, power: 4, crit: 0.13 },
  37: { speed: 1.8, power: 4, crit: 0.14 },
  38: { speed: 1.9, power: 4, crit: 0.14 },
  39: { speed: 1.9, power: 4, crit: 0.15 },
  40: { speed: 2, power: 4, crit: 0.15 },
  41: { speed: 2, power: 4, crit: 0.16 },
  42: { speed: 2.1, power: 4, crit: 0.16 },
  43: { speed: 2.1, power: 4, crit: 0.17 },
  44: { speed: 2.2, power: 4, crit: 0.17 },
  45: { speed: 2.2, power: 5, crit: 0.17 },
  46: { speed: 2.3, power: 5, crit: 0.17 },
  47: { speed: 2.3, power: 5, crit: 0.18 },
  48: { speed: 2.4, power: 5, crit: 0.18 },
  49: { speed: 2.4, power: 5, crit: 0.19 },
  50: { speed: 2.5, power: 5, crit: 0.19 },
  51: { speed: 2.5, power: 5, crit: 0.2 },
  52: { speed: 2.6, power: 5, crit: 0.2 },
  53: { speed: 2.6, power: 5, crit: 0.21 },
  54: { speed: 2.7, power: 5, crit: 0.21 },
  55: { speed: 2.7, power: 6, crit: 0.21 },
  56: { speed: 2.8, power: 6, crit: 0.21 },
  57: { speed: 2.8, power: 6, crit: 0.22 },
  58: { speed: 2.9, power: 6, crit: 0.22 },
  59: { speed: 2.9, power: 6, crit: 0.23 },
  60: { speed: 3, power: 6, crit: 0.23 },
  61: { speed: 3, power: 6, crit: 0.24 },
  62: { speed: 3.1, power: 6, crit: 0.24 },
  63: { speed: 3.1, power: 6, crit: 0.25 },
  64: { speed: 3.2, power: 6, crit: 0.25 },
  65: { speed: 3.2, power: 7, crit: 0.26 },
  66: { speed: 3.3, power: 7, crit: 0.26 },
  67: { speed: 3.3, power: 7, crit: 0.27 },
  68: { speed: 3.4, power: 7, crit: 0.27 },
  69: { speed: 3.4, power: 7, crit: 0.28 },
  70: { speed: 3.5, power: 7, crit: 0.28 },
  71: { speed: 3.5, power: 7, crit: 0.29 },
  72: { speed: 3.6, power: 7, crit: 0.29 },
  73: { speed: 3.6, power: 7, crit: 0.3 },
  74: { speed: 3.7, power: 7, crit: 0.3 },
  75: { speed: 3.7, power: 8, crit: 0.3 },
  76: { speed: 3.8, power: 8, crit: 0.3 },
  77: { speed: 3.8, power: 8, crit: 0.31 },
  78: { speed: 3.9, power: 8, crit: 0.31 },
  79: { speed: 3.9, power: 8, crit: 0.32 },
  80: { speed: 4, power: 8, crit: 0.32 },
  81: { speed: 4, power: 8, crit: 0.33 },
  82: { speed: 4.1, power: 8, crit: 0.33 },
  83: { speed: 4.1, power: 8, crit: 0.34 },
  84: { speed: 4.2, power: 8, crit: 0.34 },
  85: { speed: 4.2, power: 9, crit: 0.34 },
  86: { speed: 4.3, power: 9, crit: 0.34 },
  87: { speed: 4.3, power: 9, crit: 0.35 },
  88: { speed: 4.4, power: 9, crit: 0.35 },
  89: { speed: 4.4, power: 9, crit: 0.36 },
  90: { speed: 4.5, power: 9, crit: 0.36 },
  91: { speed: 4.5, power: 9, crit: 0.37 },
  92: { speed: 4.6, power: 9, crit: 0.37 },
  93: { speed: 4.6, power: 9, crit: 0.38 },
  94: { speed: 4.7, power: 9, crit: 0.38 },
  95: { speed: 4.7, power: 10, crit: 0.38 },
  96: { speed: 4.8, power: 10, crit: 0.38 },
  97: { speed: 4.8, power: 10, crit: 0.39 },
  98: { speed: 4.9, power: 10, crit: 0.39 },
  99: { speed: 4.9, power: 10, crit: 0.4 },
  100: { speed: 5, power: 10, crit: 0.4 },
  101: { speed: 5, power: 11, crit: 0.4 },
  102: { speed: 5, power: 12, crit: 0.4 },
  103: { speed: 5, power: 13, crit: 0.4 },
  104: { speed: 5, power: 14, crit: 0.4 },
  105: { speed: 5, power: 15, crit: 0.4 },
  106: { speed: 5, power: 16, crit: 0.4 },
  107: { speed: 5, power: 17, crit: 0.4 },
  108: { speed: 5, power: 18, crit: 0.4 },
  109: { speed: 5, power: 19, crit: 0.4 },
  110: { speed: 5, power: 20, crit: 0.4 },
};

export function getProfessionLevelStats(skillId: number, level: number = 1): ProfessionLevelStatBonus {
  if (!isProfessionSkill(skillId)) {
    return { speed: 0, power: 0, crit: 0 };
  }
  const clampedLevel = Math.max(1, Math.min(110, Math.floor(level)));
  return PROFESSION_LEVEL_STAT_TABLE[clampedLevel] || { speed: 0, power: 0, crit: 0 };
}
