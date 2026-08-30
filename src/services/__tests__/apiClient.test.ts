import { describe, it, expect, beforeEach, vi } from 'vitest';
import { bitjitaApi } from '../apiClient';

describe('PoliteApiClient Cache & Inspector', () => {
  beforeEach(() => {
    bitjitaApi.clearCache();
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
});
