// Tool matching and profession stat constants for BitCraft XP Calculator

import {
  CraftContribution,
  CraftResult,
  EquipmentSlot,
  ItemMetadata,
  PlayerDetails,
  PlayerToolEntry,
} from '../types/api';
import {
  LEVEL_TO_TIER,
  SKILL_TOOL_KEYWORDS,
  SkillDefinition,
  resolveToolName,
  resolveToolRarity,
} from './bitcraftData';

// BitCraft Online base crafting station action tick duration is exactly 1.6 seconds
export const BASE_ACTION_DURATION_SECONDS = 1.6;

// BitCraft Profession-Specific Speed Multiplier Stat IDs (Stats 21 to 33 in SpacetimeDB)
export const PROFESSION_SPEED_STAT_IDS: Record<number, number> = {
  2: 21,  // Forestry Speed
  3: 22,  // Carpentry Speed
  4: 23,  // Masonry Speed
  5: 24,  // Mining Speed
  6: 25,  // Smithing Speed
  7: 26,  // Scholar Speed
  8: 27,  // Leatherworking Speed
  9: 28,  // Hunting Speed
  10: 29, // Tailoring Speed
  11: 30, // Farming Speed
  12: 31, // Fishing Speed
  13: 32, // Cooking Speed
  14: 33, // Foraging Speed
  15: 17, // Construction / Building Speed
};

export const ALL_PROFESSION_NAMES = [
  'forestry',
  'carpentry',
  'masonry',
  'mining',
  'smithing',
  'scholar',
  'leatherworking',
  'hunting',
  'tailoring',
  'farming',
  'fishing',
  'cooking',
  'foraging',
  'construction',
];

const ACCESSORY_WORDS = new Set([
  'charm', 'flute', 'lute', 'drum', 'horn', 'harp', 'instrument',
  'ring', 'amulet', 'necklace', 'pendant', 'talisman', 'artifact',
  'tunic', 'robe', 'shirt', 'vest', 'jacket', 'cloak', 'cape',
  'pants', 'trousers', 'leggings', 'boots', 'shoes', 'gloves',
  'gauntlets', 'bracers', 'belt', 'hat', 'helm', 'helmet', 'cap',
  'hood', 'circlet', 'crown',
]);

function isHandOrToolSlot(slotPrimary?: string): boolean {
  if (!slotPrimary) return false;
  const s = slotPrimary.toLowerCase();
  return (
    s.includes('tool') ||
    s.includes('hand') ||
    s.includes('weapon') ||
    s.includes('pocket') ||
    s.includes('held') ||
    s.includes('primary') ||
    s.includes('active')
  );
}

function isExcludedAccessoryOrGear(item: ItemMetadata, slotPrimary?: string): boolean {
  const slot = (slotPrimary || '').toLowerCase();
  if (
    slot.includes('charm') ||
    slot.includes('instrument') ||
    slot.includes('finger') ||
    slot.includes('ring') ||
    slot.includes('neck') ||
    slot.includes('amulet') ||
    slot.includes('artifact') ||
    slot.includes('torso') ||
    slot.includes('chest') ||
    slot.includes('legs') ||
    slot.includes('feet') ||
    slot.includes('head') ||
    slot.includes('cape') ||
    slot.includes('back')
  ) {
    return true;
  }
  const nameWords = item.name.toLowerCase().split(/[\s\-_,]+/);
  return nameWords.some((w) => ACCESSORY_WORDS.has(w));
}

export interface ResolvedToolResult {
  equippedTool: EquipmentSlot['item'];
  isEquipped: boolean;
}

export function resolveEquippedTool(params: {
  skillId: number;
  skillDef: SkillDefinition;
  reqToolType: number;
  reqToolLevel: number;
  reqToolName: string;
  craft: CraftResult;
  player: PlayerDetails | null;
  equipment: EquipmentSlot[];
  contributions: CraftContribution[];
  playerTools: PlayerToolEntry[];
}): ResolvedToolResult {
  const {
    skillId,
    skillDef,
    reqToolType,
    reqToolLevel,
    reqToolName,
    craft,
    player,
    equipment,
    contributions,
    playerTools,
  } = params;

  const toolKeywords = new Set<string>();
  if (SKILL_TOOL_KEYWORDS[skillId]) {
    for (const kw of SKILL_TOOL_KEYWORDS[skillId]) {
      toolKeywords.add(kw.toLowerCase());
    }
  }
  if (reqToolName) {
    const parts = reqToolName.toLowerCase().split(/[\s/\-_,]+/);
    for (const p of parts) {
      if (p.length >= 3 && p !== 'tool' && p !== 'type') toolKeywords.add(p);
    }
  }

  const matchesToolKeywords = (item: ItemMetadata, slotPrimary?: string): boolean => {
    if (isExcludedAccessoryOrGear(item, slotPrimary)) return false;

    if (item.toolStats) {
      if (item.toolStats.skillId === skillId) return true;
      if (reqToolName && item.toolStats.toolType?.toLowerCase().includes(reqToolName.toLowerCase())) {
        return true;
      }
    }

    const name = item.name.toLowerCase();
    const tag = (item.tag || item.tags || '').toLowerCase();
    for (const kw of toolKeywords) {
      if (name.includes(kw) || tag.includes(kw)) return true;
    }
    return false;
  };

  let equippedTool: EquipmentSlot['item'] = null;
  let isEquipped = false;

  // Pass 0: Authoritative Player Tools System (/players/{id}/tools)
  if (playerTools && playerTools.length > 0) {
    const matchedTool = playerTools.find((t) => t.toolType === reqToolType);
    if (matchedTool) {
      const toolTier = LEVEL_TO_TIER[matchedTool.level] || matchedTool.level;
      const resolvedToolName = resolveToolName(reqToolType, matchedTool.level);
      const toolRarity = resolveToolRarity(toolTier, matchedTool.power);
      isEquipped = true;
      equippedTool = {
        id: `tool_${reqToolType}`,
        name: resolvedToolName,
        tier: toolTier,
        rarityStr: toolRarity,
        rarityString: toolRarity,
        toolStats: {
          power: matchedTool.power,
          level: matchedTool.level,
          toolType: reqToolName,
          skillId,
          skillName: skillDef.name,
        },
      };
    }
  }

  // Pass 1: Hand/tool slots with keyword or skill match
  if (!equippedTool) {
    for (const slot of equipment) {
      if (slot.item && isHandOrToolSlot(slot.primary) && matchesToolKeywords(slot.item, slot.primary)) {
        equippedTool = slot.item;
        break;
      }
    }
  }

  // Pass 2: Hand/tool slots with power stat or tier
  if (!equippedTool) {
    for (const slot of equipment) {
      if (slot.item && isHandOrToolSlot(slot.primary) && !isExcludedAccessoryOrGear(slot.item, slot.primary)) {
        const hasPowerStat = slot.item.stats?.some(
          (st) => (st.name || '').toLowerCase().includes('power') || st.id === 2
        );
        if (hasPowerStat || (slot.item.tier && slot.item.tier > 0)) {
          equippedTool = slot.item;
          break;
        }
      }
    }
  }

  // Pass 3: main_hand fallback
  if (!equippedTool) {
    const mainHandSlot = equipment.find(
      (s) =>
        s.item &&
        s.primary.toLowerCase().includes('main_hand') &&
        !isExcludedAccessoryOrGear(s.item, s.primary)
    );
    if (mainHandSlot?.item) {
      equippedTool = mainHandSlot.item;
    }
  }

  // Pass 4: Any equipment slot matching this skill's tool keywords
  if (!equippedTool) {
    for (const slot of equipment) {
      if (slot.item && matchesToolKeywords(slot.item, slot.primary)) {
        equippedTool = slot.item;
        break;
      }
    }
  }

  // Pass 5: Infer tool if player is actively crafting at the station
  const userContrib =
    player && contributions.length > 0
      ? contributions.find(
          (c) =>
            c.contributorEntityId === player.entityId ||
            c.contributorUsername?.toLowerCase() === player.username.toLowerCase()
        )
      : null;
  const isActivelyCrafting = Boolean(
    (userContrib && userContrib.contributionCount > 0) ||
      (player && craft.ownerEntityId === player.entityId && (craft.progress || 0) > 0)
  );

  if (equippedTool) {
    isEquipped = true;
  } else if (isActivelyCrafting) {
    const inferredTier = Math.max(reqToolLevel, 1);
    const inferredName = resolveToolName(reqToolType, inferredTier);
    isEquipped = true;
    equippedTool = {
      id: 'active_tool',
      name: inferredName,
      tier: inferredTier,
    };
  }

  return { equippedTool, isEquipped };
}
