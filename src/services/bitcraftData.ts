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
  4: 1.6,   // Masonry (Unfired bricks & stone)
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

// Calibrated BitCraft logarithmic/exponential level curve formula
export function calculateXpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level === 2) return 500;
  if (level === 3) return 1168;
  if (level === 4) return 1850;
  if (level === 5) return 2657;
  if (level === 6) return 3339;
  if (level === 7) return 4781;
  if (level === 8) return 5342;
  if (level === 9) return 7185;
  if (level === 10) return 8500;
  if (level === 15) return 17291;
  if (level === 20) return 31524;
  
  const base = 4385;
  const rate = 1.1161232;
  return Math.round(base * Math.pow(rate, level - 1));
}

// Pre-computed lookup table for instant O(1) performance
export const LEVEL_XP_TABLE: number[] = Array.from({ length: 111 }, (_, i) => calculateXpForLevel(i));

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
