import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_ASSISTED_CRAFTS_PER_PLAYER,
  addAssistedCraftId,
  clearAssistedCraftIds,
  getAssistedCraftIds,
  pruneOversizedAssistedCraftStores,
  removeAssistedCraftIds,
  toggleAssistedCraftId,
} from '../assistedCraftsStorage';

describe('assistedCraftsStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('caps tracked crafts per character with LRU recency ordering (newest entries kept)', () => {
    const playerId = 'player_lru';
    for (let i = 1; i <= MAX_ASSISTED_CRAFTS_PER_PLAYER + 8; i += 1) {
      addAssistedCraftId(playerId, `craft_${i}`);
    }

    const stored = Array.from(getAssistedCraftIds(playerId));
    expect(stored.length).toBe(MAX_ASSISTED_CRAFTS_PER_PLAYER);
    expect(stored[0]).toBe('craft_9');
    expect(stored[stored.length - 1]).toBe(`craft_${MAX_ASSISTED_CRAFTS_PER_PLAYER + 8}`);

    // Touching an older entry moves it to the most-recent tail so it is not evicted
    addAssistedCraftId(playerId, 'craft_9');
    addAssistedCraftId(playerId, 'craft_new');

    const afterTouch = Array.from(getAssistedCraftIds(playerId));
    expect(afterTouch.length).toBe(MAX_ASSISTED_CRAFTS_PER_PLAYER);
    expect(afterTouch).toContain('craft_9');
    expect(afterTouch).not.toContain('craft_10');
    expect(afterTouch[afterTouch.length - 2]).toBe('craft_9');
    expect(afterTouch[afterTouch.length - 1]).toBe('craft_new');
  });

  it('self-heals oversized legacy arrays on read and via startup pruneOversizedAssistedCraftStores across all alts', () => {
    const ikuriaIds = Array.from({ length: 284 }, (_, i) => `ikuria_${i + 1}`);
    const altIds = Array.from({ length: 145 }, (_, i) => `alt_${i + 1}`);
    const smallIds = ['betwixt_1'];

    localStorage.setItem('bitcraft_assisted_crafts_576460752768705987', JSON.stringify(ikuriaIds));
    localStorage.setItem('bitcraft_assisted_crafts_1224979098660021941', JSON.stringify(altIds));
    localStorage.setItem('bitcraft_assisted_crafts_1224979099304183020', JSON.stringify(smallIds));
    localStorage.setItem('bitcraft_assisted_crafts_corrupt', '{invalid');

    const summary = pruneOversizedAssistedCraftStores();
    expect(summary.keysTrimmed).toBe(3); // ikuria, alt, corrupt
    expect(summary.idsRemoved).toBe(284 - MAX_ASSISTED_CRAFTS_PER_PLAYER + (145 - MAX_ASSISTED_CRAFTS_PER_PLAYER));

    const trimmedIkuria = Array.from(getAssistedCraftIds('576460752768705987'));
    expect(trimmedIkuria.length).toBe(MAX_ASSISTED_CRAFTS_PER_PLAYER);
    expect(trimmedIkuria[0]).toBe(`ikuria_${284 - MAX_ASSISTED_CRAFTS_PER_PLAYER + 1}`);
    expect(trimmedIkuria[trimmedIkuria.length - 1]).toBe('ikuria_284');

    const trimmedAlt = Array.from(getAssistedCraftIds('1224979098660021941'));
    expect(trimmedAlt.length).toBe(MAX_ASSISTED_CRAFTS_PER_PLAYER);
    expect(trimmedAlt[trimmedAlt.length - 1]).toBe('alt_145');

    expect(Array.from(getAssistedCraftIds('1224979099304183020'))).toEqual(['betwixt_1']);
    expect(localStorage.getItem('bitcraft_assisted_crafts_corrupt')).toBeNull();
  });

  it('clears and toggles tracked crafts cleanly without leaving empty arrays in localStorage', () => {
    const playerId = 'player_clear';
    toggleAssistedCraftId(playerId, 'c_1');
    toggleAssistedCraftId(playerId, 'c_2');
    expect(getAssistedCraftIds(playerId).size).toBe(2);

    removeAssistedCraftIds(playerId, ['c_1']);
    expect(Array.from(getAssistedCraftIds(playerId))).toEqual(['c_2']);

    clearAssistedCraftIds(playerId);
    expect(localStorage.getItem(`bitcraft_assisted_crafts_${playerId}`)).toBeNull();
    expect(getAssistedCraftIds(playerId).size).toBe(0);
  });
});
