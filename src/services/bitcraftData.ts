// Game metadata constants, mappings, and XP curves for Bitcraft Online

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
export function calculateLevelDeltaXp(level: number): number {
  if (level <= 1) return 500;
  const rate = 1.115732232;
  const scale = 520.2624865;
  return Math.round(500 + scale * (Math.pow(rate, level - 1) - 1));
}

// Pre-computed cumulative lookup table for instant O(1) performance
// LEVEL_XP_TABLE[L] = Cumulative lifetime XP required to reach Level L (Level 1 = 0 XP)
export const LEVEL_XP_TABLE: number[] = (() => {
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
