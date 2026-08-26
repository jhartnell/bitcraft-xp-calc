// TypeScript interfaces for BitJita API (https://bitjita.com/docs/api)

export interface PlayerExperience {
  skill_id: number;
  quantity: number;
}

export interface PlayerSummary {
  entityId: string;
  username: string;
  signedIn?: boolean;
  timePlayed?: number;
  timeSignedIn?: number;
  createdAt?: string;
  updatedAt?: string;
  lastLoginTimestamp?: string;
}

export interface PlayerDetails extends PlayerSummary {
  teleportLocationX?: number;
  teleportLocationZ?: number;
  teleportLocationDimension?: number;
  teleportLocationType?: string;
  sessionStartTimestamp?: string;
  signInTimestamp?: string;
  locationX?: number;
  locationZ?: number;
  regionId?: number;
  location?: {
    entityId?: string;
    name?: string;
    regionId?: number;
    locationX?: number;
    locationZ?: number;
  };
  experience?: PlayerExperience[];
}

export interface CraftedItemRef {
  item_id: number;
  quantity: number;
  item_type: string;
  durability: number;
}

export interface LevelRequirement {
  level: number;
  skill_id: number;
  skillName?: string;
  skillIcon?: string;
  skillTitle?: string;
}

export interface ToolRequirement {
  level: number;
  power: number;
  tool_type: number;
  name?: string;
  skill_id?: number;
}

export interface ExperiencePerProgress {
  quantity: number;
  skill_id: number;
}

export interface CraftResult {
  entityId: string;
  buildingEntityId: string;
  ownerEntityId: string;
  regionId: number;
  progress: number;
  recipeId: number;
  craftCount: number;
  lockExpiration: string;
  actionsRequiredPerItem: number;
  totalActionsRequired: number;
  craftedItem: CraftedItemRef[];
  levelRequirements?: LevelRequirement[];
  toolRequirements?: ToolRequirement[];
  experiencePerProgress?: ExperiencePerProgress[];
  buildingName?: string;
  ownerUsername?: string;
  claimEntityId?: string;
  claimName?: string;
  claimLocationX?: number;
  claimLocationZ?: number;
  regionName?: string;
  completed: boolean;
  isPublic?: boolean;
  functionType?: number;
}

export interface CraftContribution {
  id: string;
  contributorEntityId: string;
  contributorIdentity?: string;
  totalProgressContributed: number;
  contributionCount: number;
  firstContributedAt?: string;
  lastContributedAt?: string;
  contributorUsername?: string;
}

export interface CraftContributionsApiResponse {
  contributions: CraftContribution[];
}

export interface ItemMetadata {
  id: number | string;
  name: string;
  description?: string;
  iconAssetName?: string;
  tier?: number;
  rarity?: number;
  rarityStr?: string;
  rarityString?: string;
  tag?: string;
  tags?: string;
  volume?: number;
  durability?: number;
  stats?: ItemStat[];
}

export interface ItemStat {
  id: number;
  value: number;
  is_pct: boolean;
  name: string;
  suffix?: string;
}

export interface EquipmentSlot {
  primary: string;
  item: ItemMetadata | null;
}

export interface BuffStat {
  id: number;
  value: number;
  is_pct: boolean;
  name: string;
  suffix?: string;
}

export interface PlayerBuff {
  buffId: number;
  buffStartTimestamp: number;
  buffDuration: number;
  values?: number[];
  buffName: string;
  buffTypeName?: string;
  buffTypeCategory?: number;
  description: string;
  iconAssetName?: string;
  beneficial?: boolean;
  stats?: BuffStat[];
  status: 'active' | 'expired';
  timeRemaining: number;
}

export interface PlayerStatsData {
  entityId: string;
  values: number[];
  regionId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SkillInfo {
  id: number;
  name: string;
  title: string;
  iconAssetName?: string;
  skillCategoryStr?: string;
  maxLevel?: number;
}

export interface SkillsApiResponse {
  profession: SkillInfo[];
  adventure: SkillInfo[];
}

export interface PlayerCraftsApiResponse {
  craftResults: CraftResult[];
  items?: ItemMetadata[];
  cargos?: unknown[];
  count: number;
}

export interface PlayerEquipmentApiResponse {
  equipment: EquipmentSlot[];
}

export interface PlayerBuffsApiResponse {
  buffs: PlayerBuff[];
  count: number;
  regionId?: number;
  isOnline?: boolean;
}

export interface PlayerSearchApiResponse {
  players: PlayerSummary[];
  total: number;
}
