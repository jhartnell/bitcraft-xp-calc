// Polite API client for BitJita with caching, rate limiting, and request deduplication

import {
  PlayerSearchApiResponse,
  PlayerDetails,
  PlayerCraftsApiResponse,
  PlayerEquipmentApiResponse,
  PlayerBuffsApiResponse,
  PlayerStatsData,
  SkillsApiResponse,
  CraftResult,
} from '../types/api';
import { ApiClientStatus } from '../types/calculator';

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

  // Status tracking
  public status: ApiClientStatus = {
    lastFetchedAt: null,
    cachedEntriesCount: 0,
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
    return res.player;
  }

  private recipeXpMap = new Map<number, { quantity: number; skill_id: number }[]>();

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

  // Get player equipment
  public async getPlayerEquipment(entityId: string, forceFresh = false): Promise<PlayerEquipmentApiResponse> {
    return this.fetchWithCache<PlayerEquipmentApiResponse>(
      `/players/${entityId}/equipment`,
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
    const res = await this.fetchWithCache<{ stats: PlayerStatsData }>(
      `/players/${entityId}/stats`,
      30000,
      forceFresh
    );
    return res.stats;
  }

  // Get all skills catalog (cached for 1 hour)
  public async getSkills(): Promise<SkillsApiResponse> {
    return this.fetchWithCache<SkillsApiResponse>(`/skills`, 3600000);
  }

  // Get global public incomplete crafts and seed recipe XP cache
  public async getPublicActiveCrafts(forceFresh = false): Promise<CraftResult[]> {
    const res = await this.fetchWithCache<{ craftResults: CraftResult[] }>(
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

    return res.craftResults || [];
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
}

export const bitjitaApi = new PoliteApiClient();
