import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { ApiHttpError, bitjitaApi, isHttpStatusError } from '../apiClient';

describe('PoliteApiClient Cache & Inspector', () => {
  beforeEach(() => {
    bitjitaApi.clearCache();
    bitjitaApi.clearAnomalies();
    bitjitaApi.resetBackoff();
    bitjitaApi.setMinIntervalMs(0);
  });

  afterAll(() => {
    bitjitaApi.setMinIntervalMs(120);
  });

  it('starts with an empty cache list', () => {
    const entries = bitjitaApi.getCachedEntries();
    expect(entries).toEqual([]);
    expect(bitjitaApi.status.cachedEntriesCount).toBe(0);
  });

  it('correctly categorizes cached endpoints and provides TTL metadata', async () => {
    const fakePlayer = { player: { entityId: 'p123', username: 'TestPlayer', experience: [] } };
    
    // Mock global fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakePlayer,
    }));

    await bitjitaApi.getPlayerDetails('p123');

    const entries = bitjitaApi.getCachedEntries();
    expect(entries.length).toBe(1);
    expect(entries[0].endpoint).toBe('/players/p123');
    expect(entries[0].category).toBe('character');
    expect(entries[0].categoryLabel).toBe('Character & Equipment');
    expect(entries[0].method).toBe('GET');
    expect(entries[0].ttlMs).toBe(20000);
    expect(entries[0].isExpired).toBe(false);
    expect(entries[0].timestamp).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });

  it('allows granular eviction of a single cached endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ player: { entityId: 'p123' } }),
    }));

    await bitjitaApi.getPlayerDetails('p123');
    expect(bitjitaApi.getCachedEntries().length).toBe(1);

    const evicted = bitjitaApi.evictEntry('/players/p123');
    expect(evicted).toBe(true);
    expect(bitjitaApi.getCachedEntries().length).toBe(0);
    expect(bitjitaApi.status.cachedEntriesCount).toBe(0);

    vi.unstubAllGlobals();
  });

  it('categorizes crafts, items, and catalog skills into proper buckets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/skills')) {
        return Promise.resolve({ ok: true, json: async () => ({ skills: [] }) });
      }
      if (url.includes('/items')) {
        return Promise.resolve({ ok: true, json: async () => ({ id: 4001, name: 'Axe' }) });
      }
      if (url.includes('/crafts')) {
        return Promise.resolve({ ok: true, json: async () => ({ craftResults: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }));

    await bitjitaApi.getSkills();
    await bitjitaApi.getItem(4001);
    await bitjitaApi.getPublicActiveCrafts();

    const entries = bitjitaApi.getCachedEntries();
    expect(entries.length).toBe(3);

    const skillsEntry = entries.find((e) => e.endpoint === '/skills');
    expect(skillsEntry?.category).toBe('catalog');
    expect(skillsEntry?.categoryLabel).toBe('Master Catalogs');

    const itemEntry = entries.find((e) => e.endpoint === '/items/4001');
    expect(itemEntry?.category).toBe('metadata');
    expect(itemEntry?.categoryLabel).toBe('Items & Cargo Metadata');

    const craftsEntry = entries.find((e) => e.endpoint.includes('/crafts'));
    expect(craftsEntry?.category).toBe('craft');
    expect(craftsEntry?.categoryLabel).toBe('Crafting & Contributions');

    vi.unstubAllGlobals();
  });

  it('records an anomaly when player experience payload is null or empty', async () => {
    bitjitaApi.clearAnomalies();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ player: { entityId: 'p_null', username: 'Ikuria', experience: null } }),
    }));

    await bitjitaApi.getPlayerDetails('p_null');

    const anomalies = bitjitaApi.getAnomalies();
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].endpoint).toBe('/players/p_null');
    expect(anomalies[0].type).toBe('null_payload');
    expect(anomalies[0].message).toContain('player.experience array is null or empty');
    expect(anomalies[0].impact).toContain('Baseline skill level inferred');

    // Test dismissal
    bitjitaApi.dismissAnomaly(anomalies[0].id);
    expect(bitjitaApi.getAnomalies().length).toBe(0);

    vi.unstubAllGlobals();
  });

  it('records an anomaly when a network error or rate limit occurs', async () => {
    bitjitaApi.clearAnomalies();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    }));

    await expect(bitjitaApi.getPlayerDetails('p_err')).rejects.toThrow();

    const anomalies = bitjitaApi.getAnomalies();
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].type).toBe('rate_limited');
    expect(anomalies[0].message).toContain('429');

    // Test clear all
    bitjitaApi.clearAnomalies();
    expect(bitjitaApi.getAnomalies().length).toBe(0);

    vi.unstubAllGlobals();
  });

  it('filters out crafts from different regions and unindexed coordinates in getNearbyActiveCrafts', async () => {
    const fakeCraftsResponse = {
      craftResults: [
        // Craft 1: Region 19 (wrong region), no coords -> MUST be filtered out
        { entityId: 'c1', regionId: 19, buildingName: 'Station 1' },
        // Craft 2: Region 8 (correct region), no coords -> MUST be filtered out
        { entityId: 'c2', regionId: 8, buildingName: 'Station 2' },
        // Craft 3: Region 8 (correct region), coords at 17268, 10256 (31m from 17241, 10241) -> MUST be included
        { entityId: 'c3', regionId: 8, buildingName: 'Nearby Station', claimLocationX: 17268, claimLocationZ: 10256 },
        // Craft 4: Region 8 (correct region), coords at 25000, 20000 (> 500m away) -> MUST be filtered out
        { entityId: 'c4', regionId: 8, buildingName: 'Far Station', claimLocationX: 25000, claimLocationZ: 20000 },
      ],
      items: [],
      cargos: [],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeCraftsResponse,
    }));

    const nearby = await bitjitaApi.getNearbyActiveCrafts(8, 17241, 10241, 500, true);

    expect(nearby.length).toBe(1);
    expect(nearby[0].craft.entityId).toBe('c3');
    expect(nearby[0].distanceMeters).toBe(31);

    vi.unstubAllGlobals();
  });

  it('automatically clears anomalies when a previously failed endpoint succeeds', async () => {
    bitjitaApi.clearAnomalies();

    // 1. Initial fetch returns null experience -> anomaly recorded
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ player: { entityId: 'p_heal', username: 'Healer', experience: null } }),
    }));

    await bitjitaApi.getPlayerDetails('p_heal', true);
    expect(bitjitaApi.getAnomalies().length).toBe(1);
    expect(bitjitaApi.getAnomalies()[0].endpoint).toBe('/players/p_heal');

    // 2. Subsequent fetch returns valid experience array -> anomaly automatically cleared!
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        player: {
          entityId: 'p_heal',
          username: 'Healer',
          experience: [{ skill_id: 1, quantity: 5000 }],
        },
      }),
    }));

    await bitjitaApi.getPlayerDetails('p_heal', true);
    expect(bitjitaApi.getAnomalies().length).toBe(0);

    vi.unstubAllGlobals();
  });

  it('automatically clears HTTP error anomalies when network request succeeds', async () => {
    bitjitaApi.clearAnomalies();

    // 1. Initial request fails with 500 -> anomaly recorded
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }));

    await expect(bitjitaApi.getSkills()).rejects.toThrow();
    expect(bitjitaApi.getAnomalies().length).toBe(1);
    expect(bitjitaApi.getAnomalies()[0].endpoint).toBe('/skills');

    // 2. Subsequent request succeeds -> anomaly automatically cleared!
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ skills: [{ id: 1, name: 'Carpentry' }] }),
    }));

    await bitjitaApi.getSkills();
    expect(bitjitaApi.getAnomalies().length).toBe(0);

    vi.unstubAllGlobals();
  });

  it('encodes path parameters safely to prevent URL path injection', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ player: { entityId: 'a/b?c=1', username: 'Safe', experience: [{ skill_id: 2, quantity: 100 }] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await bitjitaApi.getPlayerDetails('../admin?foo=bar');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/players/..%2Fadmin%3Ffoo%3Dbar',
      expect.any(Object)
    );

    vi.unstubAllGlobals();
  });

  it('enriches equipment without mutating the cached equipment payload in-place', async () => {
    const rawEquipmentPayload = {
      equipment: [
        {
          primary: 'main_hand',
          item: { id: 9001, name: 'Basic Axe', tier: 2 },
        },
      ],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/equipment')) {
          return Promise.resolve({ ok: true, json: async () => rawEquipmentPayload });
        }
        if (url.includes('/items/9001')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              item: { id: 9001, name: 'Basic Axe', tier: 2 },
              toolStats: { power: 16, level: 3, toolType: 'Axe', skillId: 2, skillName: 'Forestry' },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    const enriched = await bitjitaApi.getPlayerEquipment('p_equip');
    expect(enriched.equipment[0].item?.toolStats?.power).toBe(16);
    // Original raw response object should remain unmutated
    expect((rawEquipmentPayload.equipment[0].item as Record<string, unknown>).toolStats).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('throws typed ApiHttpError with statusCode on 404 and matches isHttpStatusError', async () => {
    bitjitaApi.clearAnomalies();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
    );

    let caughtError: unknown;
    try {
      await bitjitaApi.getCraft('expired_craft_1', true);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ApiHttpError);
    expect(isHttpStatusError(caughtError, 404)).toBe(true);
    expect(isHttpStatusError(caughtError, 500)).toBe(false);

    const anomalies = bitjitaApi.getAnomalies();
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].endpoint).toBe('/crafts/expired_craft_1');
    expect(anomalies[0].statusCode).toBe(404);

    vi.unstubAllGlobals();
  });

  it('retireCraft evicts cached craft endpoints and clears only matching craft anomalies', async () => {
    bitjitaApi.clearAnomalies();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/crafts/c_old/contributions')) {
          return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });
        }
        if (url.includes('/crafts/c_old')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ craft: { entityId: 'c_old', completed: true }, items: [], cargos: [] }),
          });
        }
        if (url.includes('/crafts/c_active')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ craft: { entityId: 'c_active', completed: false }, items: [], cargos: [] }),
          });
        }
        if (url.includes('/skills')) {
          return Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    await bitjitaApi.getCraft('c_old', true);
    await bitjitaApi.getCraft('c_active', true);
    await expect(bitjitaApi.getCraftContributions('c_old', true)).rejects.toThrow();
    await expect(bitjitaApi.getSkills()).rejects.toThrow();

    expect(bitjitaApi.getCachedEntries().map((e) => e.endpoint)).toContain('/crafts/c_old');
    expect(bitjitaApi.getCachedEntries().map((e) => e.endpoint)).toContain('/crafts/c_active');
    expect(bitjitaApi.getAnomalies().length).toBe(2);

    bitjitaApi.retireCraft('c_old');

    const remainingEndpoints = bitjitaApi.getCachedEntries().map((e) => e.endpoint);
    expect(remainingEndpoints).not.toContain('/crafts/c_old');
    expect(remainingEndpoints).toContain('/crafts/c_active');

    const remainingAnomalies = bitjitaApi.getAnomalies();
    expect(remainingAnomalies.length).toBe(1);
    expect(remainingAnomalies[0].endpoint).toBe('/skills');

    vi.unstubAllGlobals();
  });
});
