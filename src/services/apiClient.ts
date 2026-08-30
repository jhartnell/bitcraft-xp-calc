// Polite API client for BitJita with caching, rate limiting, and request deduplication

import {
  PlayerSearchApiResponse,
  PlayerDetails,
  PlayerCraftsApiResponse,
  PlayerEquipmentApiResponse,
  PlayerBuffsApiResponse,
  PlayerStatsData,
  PlayerToolsApiResponse,
  SkillsApiResponse,
  CraftResult,
  ItemMetadata,
} from '../types/api';
import { ApiClientStatus, CachedEndpointInfo, EndpointAnomaly } from '../types/calculator';
import { resolveCraftCoordinates } from './bitcraftData';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

class PoliteApiClient {
  private cache = new Map<string, CacheEntry<unknown>>();
  private activeRequests = new Map<string, Promise<unknown>>();
  private requestQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;
  private minIntervalMs = 120; // 120ms minimum spacing between requests
  private lastRequestTime = 0;
  private backoffMs = 0;
  private anomalies: EndpointAnomaly[] = [];

  // Status tracking
  public status: ApiClientStatus = {
    lastFetchedAt: null,
    cachedEntriesCount: 0,
    cachedEntries: [],
    anomalies: [],
    activeRequestsCount: 0,
    isFetching: false,
    lastResponseTimeMs: null,
    rateLimitBackoffMs: 0,
    error: null,
  };

  private listeners: Array<(status: ApiClientStatus) => void> = [];

  public subscribe(listener: (status: ApiClientStatus) => void): () => void {
    this.listeners.push(listener);
    listener(this.status);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus(): void {
    this.status.cachedEntriesCount = this.cache.size;
    this.status.cachedEntries = this.getCachedEntries();
    this.status.anomalies = [...this.anomalies];
    this.status.activeRequestsCount = this.activeRequests.size;
    this.status.rateLimitBackoffMs = this.backoffMs;
    for (const listener of this.listeners) {
      listener({ ...this.status });
    }
  }

  private async enqueue<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          // Wait for polite spacing + any active backoff
          const now = Date.now();
          const elapsed = now - this.lastRequestTime;
          const waitTime = Math.max(0, this.minIntervalMs + this.backoffMs - elapsed);
          
          if (waitTime > 0) {
            await new Promise((r) => setTimeout(r, waitTime));
          }

          this.lastRequestTime = Date.now();
          const startTime = performance.now();
          this.status.isFetching = true;
          this.notifyStatus();

          const result = await requestFn();
          
          const duration = Math.round(performance.now() - startTime);
          this.status.lastResponseTimeMs = duration;
          this.status.lastFetchedAt = new Date();
          this.status.error = null;
          // Slowly decrease backoff if successful
          if (this.backoffMs > 0) {
            this.backoffMs = Math.max(0, this.backoffMs - 500);
          }
          resolve(result);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.status.error = errorMsg;
          
          if (errorMsg.includes('429')) {
            // Hit rate limit, increase backoff
            this.backoffMs = Math.min(30000, (this.backoffMs || 1000) * 2);
          }
          reject(err);
        } finally {
          this.status.isFetching = false;
          this.notifyStatus();
        }
      });

      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const nextReq = this.requestQueue.shift();
      if (nextReq) {
        await nextReq();
      }
    }

    this.isProcessingQueue = false;
  }

  public async fetchWithCache<T>(
    endpoint: string,
    ttlMs: number = 30000,
    forceFresh: boolean = false
  ): Promise<T> {
    const cached = this.cache.get(endpoint);
    const now = Date.now();

    if (!forceFresh && cached && now - cached.timestamp < cached.ttlMs) {
      return cached.data as T;
    }

    // Deduplicate in-flight requests for the exact same endpoint
    if (this.activeRequests.has(endpoint)) {
      return this.activeRequests.get(endpoint) as Promise<T>;
    }

    const requestPromise = this.enqueue(async () => {
      const isExtension =
        typeof window !== 'undefined' &&
        ((typeof chrome !== 'undefined' && chrome.runtime && Boolean(chrome.runtime.id)) ||
          window.location.protocol === 'chrome-extension:' ||
          window.location.protocol === 'moz-extension:');

      const apiBase = isExtension ? 'https://bitjita.com/api' : '/api';
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${cleanEndpoint}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`BitJita API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as T;
      this.cache.set(endpoint, {
        data,
        timestamp: Date.now(),
        ttlMs,
      });
      this.notifyStatus();
      return data;
    });

    this.activeRequests.set(endpoint, requestPromise);

    try {
      return await requestPromise;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.recordAnomaly({
        endpoint,
        method: 'GET',
        type: errorMsg.includes('429') ? 'rate_limited' : 'http_error',
        message: errorMsg,
        impact: 'Request failed; fallback or cached data will be used',
      });
      throw err;
    } finally {
      this.activeRequests.delete(endpoint);
    }
  }

  public clearCache(endpointPattern?: string): void {
    if (!endpointPattern) {
      this.cache.clear();
    } else {
      for (const key of this.cache.keys()) {
        if (key.includes(endpointPattern)) {
          this.cache.delete(key);
        }
      }
    }
    this.notifyStatus();
  }

  public evictEntry(endpoint: string): boolean {
    const deleted = this.cache.delete(endpoint);
    if (deleted) {
      this.notifyStatus();
    }
    return deleted;
  }

  public getCachedEntries(): CachedEndpointInfo[] {
    const now = Date.now();
    const entries: CachedEndpointInfo[] = [];

    for (const [endpoint, entry] of this.cache.entries()) {
      const expiresAt = entry.timestamp + entry.ttlMs;
      let category: CachedEndpointInfo['category'] = 'metadata';
      let categoryLabel = 'Items & Cargo Metadata';

      if (endpoint.includes('/players')) {
        category = 'character';
        categoryLabel = 'Character & Equipment';
      } else if (endpoint.includes('/crafts')) {
        category = 'craft';
        categoryLabel = 'Crafting & Contributions';
      } else if (endpoint.includes('/skills')) {
        category = 'catalog';
        categoryLabel = 'Master Catalogs';
      }

      entries.push({
        endpoint,
        timestamp: entry.timestamp,
        ttlMs: entry.ttlMs,
        expiresAt,
        isExpired: now > expiresAt,
        category,
        categoryLabel,
        method: 'GET',
      });
    }

    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }

  public recordAnomaly(anomaly: Omit<EndpointAnomaly, 'id' | 'timestamp'>): void {
    const id = `${anomaly.endpoint}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.anomalies = [
      {
        ...anomaly,
        id,
        timestamp: Date.now(),
      },
      ...this.anomalies.filter((a) => a.endpoint !== anomaly.endpoint),
    ].slice(0, 15);
    this.notifyStatus();
  }

  public dismissAnomaly(id: string): void {
    this.anomalies = this.anomalies.filter((a) => a.id !== id);
    this.notifyStatus();
  }

  public clearAnomalies(): void {
    this.anomalies = [];
    this.notifyStatus();
  }

  public getAnomalies(): EndpointAnomaly[] {
    return [...this.anomalies];
  }

  // --- API Endpoints ---

  // Search players by query (cached for 60s)
  public async searchPlayers(query: string): Promise<PlayerSearchApiResponse> {
    if (!query || query.trim().length < 1) {
      return { players: [], total: 0 };
    }
    return this.fetchWithCache<PlayerSearchApiResponse>(
      `/players?q=${encodeURIComponent(query.trim())}`,
      60000
    );
  }

  // Get full player details (experience, skills, session)
  public async getPlayerDetails(entityId: string, forceFresh = false): Promise<PlayerDetails> {
    const res = await this.fetchWithCache<{ player: PlayerDetails }>(
      `/players/${entityId}`,
      20000,
      forceFresh
    );
    if (!res?.player) {
      this.recordAnomaly({
        endpoint: `/players/${entityId}`,
        method: 'GET',
        type: 'null_payload',
        message: 'Player object returned null or undefined from BitJita',
        impact: 'Character profile cannot be resolved',
      });
    } else if (!res.player.experience || res.player.experience.length === 0) {
      this.recordAnomaly({
        endpoint: `/players/${entityId}`,
        method: 'GET',
        type: 'null_payload',
        message: 'player.experience array is null or empty in server response',
        impact: 'Baseline skill level inferred from station/equipment requirements',
      });
    }
    return res.player;
  }

  private recipeXpMap = new Map<number, { quantity: number; skill_id: number }[]>();

  public getRecipeExperience(recipeId?: number): { quantity: number; skill_id: number }[] | null {
    if (!recipeId) return null;
    return this.recipeXpMap.get(recipeId) || null;
  }

  // Get player active and completed crafts
  public async getPlayerCrafts(entityId: string, forceFresh = false): Promise<PlayerCraftsApiResponse> {
    const res = await this.fetchWithCache<PlayerCraftsApiResponse>(
      `/players/${entityId}/crafts?completed=all`,
      10000,
      forceFresh
    );

    // If recipe cache is empty, prime it from public crafts in background
    if (this.recipeXpMap.size === 0) {
      this.getPublicActiveCrafts().catch(() => {});
    }

    if (res && res.craftResults) {
      for (const craft of res.craftResults) {
        if ((!craft.experiencePerProgress || craft.experiencePerProgress.length === 0) && craft.recipeId) {
          const cachedExp = this.recipeXpMap.get(craft.recipeId);
          if (cachedExp) {
            craft.experiencePerProgress = cachedExp;
          }
        }
      }
    }

    return res;
  }

  // Get player equipment (auto-enriches items with toolStats & equipmentStats from /api/items/{itemId})
  public async getPlayerEquipment(entityId: string, forceFresh = false): Promise<PlayerEquipmentApiResponse> {
    const res = await this.fetchWithCache<PlayerEquipmentApiResponse>(
      `/players/${entityId}/equipment`,
      15000,
      forceFresh
    );

    if (res?.equipment && Array.isArray(res.equipment)) {
      await Promise.all(
        res.equipment.map(async (slot) => {
          if (slot.item && slot.item.id) {
            const itemIdNum = Number(slot.item.id);
            if (!isNaN(itemIdNum) && itemIdNum > 0) {
              const fullItem = await this.getItem(itemIdNum);
              if (fullItem) {
                slot.item = {
                  ...slot.item,
                  ...fullItem,
                  toolStats: fullItem.toolStats || slot.item.toolStats,
                  stats: fullItem.stats && fullItem.stats.length > 0 ? fullItem.stats : (slot.item.stats || []),
                };
              }
            }
          }
        })
      );
    }

    return res;
  }

  // Get player tools (/players/{id}/tools contains exact tool powers and levels across all 15 professions)
  public async getPlayerTools(entityId: string, forceFresh = false): Promise<PlayerToolsApiResponse> {
    return this.fetchWithCache<PlayerToolsApiResponse>(
      `/players/${entityId}/tools`,
      15000,
      forceFresh
    );
  }

  // Get player buffs (food, potions, wonder)
  public async getPlayerBuffs(entityId: string, forceFresh = false): Promise<PlayerBuffsApiResponse> {
    return this.fetchWithCache<PlayerBuffsApiResponse>(
      `/players/${entityId}/buffs`,
      15000,
      forceFresh
    );
  }

  // Get player stats
  public async getPlayerStats(entityId: string, forceFresh = false): Promise<PlayerStatsData> {
    try {
      const res = await this.fetchWithCache<{ stats: PlayerStatsData }>(
        `/players/${entityId}/stats`,
        30000,
        forceFresh
      );
      if (!res?.stats) {
        this.recordAnomaly({
          endpoint: `/players/${entityId}/stats`,
          method: 'GET',
          type: 'null_payload',
          message: 'Player stats object returned null or empty from BitJita',
          impact: 'Speed bonuses derived from equipment and skill level fallback',
        });
      }
      return res?.stats || ({} as PlayerStatsData);
    } catch {
      return {} as PlayerStatsData;
    }
  }

  // Get all skills catalog (cached for 1 hour)
  public async getSkills(): Promise<SkillsApiResponse> {
    return this.fetchWithCache<SkillsApiResponse>(`/skills`, 3600000);
  }

  // Get global public incomplete crafts, items, cargos, and seed recipe XP cache
  public async getPublicActiveCrafts(forceFresh = false): Promise<{
    craftResults: CraftResult[];
    items: ItemMetadata[];
    cargos: ItemMetadata[];
  }> {
    const res = await this.fetchWithCache<{
      craftResults: CraftResult[];
      items?: ItemMetadata[];
      cargos?: ItemMetadata[];
    }>(
      `/crafts?completed=false&limit=100`,
      20000,
      forceFresh
    );

    if (res && res.craftResults) {
      for (const c of res.craftResults) {
        if (c.recipeId && c.experiencePerProgress && c.experiencePerProgress.length > 0) {
          this.recipeXpMap.set(c.recipeId, c.experiencePerProgress);
        }
      }
    }

    return {
      craftResults: res?.craftResults || [],
      items: res?.items || [],
      cargos: res?.cargos || [],
    };
  }

  // Get single craft details and metadata
  public async getCraft(
    craftId: string,
    forceFresh = false
  ): Promise<{ craft: CraftResult; items?: ItemMetadata[]; cargos?: ItemMetadata[] }> {
    const res = await this.fetchWithCache<{ craft: CraftResult; items?: ItemMetadata[]; cargos?: ItemMetadata[] }>(
      `/crafts/${craftId}`,
      10000,
      forceFresh
    );
    if (res?.craft) {
      if ((!res.craft.experiencePerProgress || res.craft.experiencePerProgress.length === 0) && res.craft.recipeId) {
        const cachedXp = this.recipeXpMap.get(res.craft.recipeId);
        if (cachedXp) {
          res.craft.experiencePerProgress = cachedXp;
        }
      }
    }
    return res;
  }

  // Get craft contributions (history of player actions and progress per action)
  public async getCraftContributions(craftId: string, forceFresh = false): Promise<import('../types/api').CraftContribution[]> {
    const res = await this.fetchWithCache<import('../types/api').CraftContributionsApiResponse>(
      `/crafts/${craftId}/contributions`,
      15000,
      forceFresh
    );
    return res.contributions || [];
  }

  // Get active crafts in player's region ranked by Euclidean distance (meters)
  public async getNearbyActiveCrafts(
    regionId: number,
    playerX?: number,
    playerZ?: number,
    maxDistanceMeters = 500,
    forceFresh = false
  ): Promise<{
    craft: CraftResult;
    distanceMeters: number;
    itemName?: string;
    itemTier?: number;
    itemMetadata?: ItemMetadata;
  }[]> {
    if (!regionId) return [];

    const res = await this.fetchWithCache<{
      craftResults: CraftResult[];
      items?: ItemMetadata[];
      cargos?: ItemMetadata[];
    }>(
      `/crafts?completed=false&region_id=${regionId}&limit=100`,
      20000,
      forceFresh
    );

    if (!res || !res.craftResults) return [];

    const itemsMap = new Map<number, ItemMetadata>();
    if (res.items) {
      for (const itm of res.items) {
        itemsMap.set(Number(itm.id), itm);
      }
    }
    if (res.cargos) {
      for (const crg of res.cargos) {
        itemsMap.set(Number(crg.id), crg);
      }
    }

    // Cache recipe XP metadata
    for (const c of res.craftResults) {
      if (c.recipeId && c.experiencePerProgress && c.experiencePerProgress.length > 0) {
        this.recipeXpMap.set(c.recipeId, c.experiencePerProgress);
      }
    }

    const nearbyList: {
      craft: CraftResult;
      distanceMeters: number;
      itemName?: string;
      itemTier?: number;
      itemMetadata?: ItemMetadata;
    }[] = [];

    for (const c of res.craftResults) {
      // 1. Client-side region verification (BitJita backend query param does not filter server-side)
      if (c.regionId && Number(c.regionId) !== Number(regionId)) {
        continue;
      }

      // 2. Strict coordinate resolution (stations without coordinates cannot be verified as nearby)
      const coords = resolveCraftCoordinates(c as unknown as Record<string, unknown>);
      if (!coords) {
        continue;
      }

      // 3. Euclidean distance calculation
      let distance = 0;
      if (playerX !== undefined && playerZ !== undefined) {
        distance = Math.round(Math.hypot(playerX - coords.x, playerZ - coords.z));
        if (distance > maxDistanceMeters) {
          continue;
        }
      }

      const itemId = c.craftedItem?.[0]?.item_id;
      const itm = itemId ? itemsMap.get(Number(itemId)) : undefined;

      nearbyList.push({
        craft: c,
        distanceMeters: distance,
        itemName: itm?.name,
        itemTier: itm?.tier,
        itemMetadata: itm,
      });
    }

    nearbyList.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return nearbyList;
  }

  // Get item metadata by ID (caches for 1 hour)
  public async getItem(itemId: number, forceFresh = false): Promise<ItemMetadata | null> {
    try {
      const res = await this.fetchWithCache<{
        item?: ItemMetadata;
        toolStats?: import('../types/api').ToolStats;
        equipmentStats?: import('../types/api').ItemStat[];
        craftingRecipes?: Array<{
          id: number;
          experiencePerProgress?: { quantity: number; skill_id: number }[];
        }>;
      } & ItemMetadata>(`/items/${itemId}`, 3600000, forceFresh);

      if (!res) return null;

      const rawItem: ItemMetadata = res.item || (res.name ? res : ({} as ItemMetadata));
      const itemData: ItemMetadata = {
        ...rawItem,
        toolStats: res.toolStats || rawItem.toolStats,
        stats: res.equipmentStats && res.equipmentStats.length > 0 ? res.equipmentStats : (rawItem.stats || []),
      };

      if (res.craftingRecipes) {
        for (const r of res.craftingRecipes) {
          if (r.id && r.experiencePerProgress && r.experiencePerProgress.length > 0) {
            this.recipeXpMap.set(r.id, r.experiencePerProgress);
          }
        }
      }

      return itemData.name ? itemData : null;
    } catch {
      return null;
    }
  }

  // Get cargo metadata by ID (caches for 1 hour)
  public async getCargo(cargoId: number, forceFresh = false): Promise<ItemMetadata | null> {
    try {
      const res = await this.fetchWithCache<{ cargo: ItemMetadata }>(`/cargos/${cargoId}`, 3600000, forceFresh);
      return res?.cargo || null;
    } catch {
      return null;
    }
  }
}

export const bitjitaApi = new PoliteApiClient();
