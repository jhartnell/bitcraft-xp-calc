import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { App } from '../../App';
import { bitjitaApi } from '../../services/apiClient';
import packageJson from '../../../package.json';

const APP_VERSION = packageJson.version;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Public Craft Analysis vs Verified Helping Lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    bitjitaApi.clearCache();
    bitjitaApi.clearAnomalies();
    bitjitaApi.resetBackoff();
    bitjitaApi.setMinIntervalMs(0);

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
    bitjitaApi.setMinIntervalMs(120);
  });

  it('keeps an analyzed public craft as Analyzing (never Helping) before and after refresh when player is not a contributor', async () => {
    const ikuria = { entityId: '576460752768705987', username: 'Ikuria' };
    localStorage.setItem('bitcraft_primary_player', JSON.stringify(ikuria));

    const publicCraft = {
      entityId: '1008806317066192960',
      buildingEntityId: '1008806317042828046',
      ownerEntityId: '576460752766901931',
      ownerUsername: 'Oaktavia',
      buildingName: 'Exquisite Forestry Station',
      claimName: 'Newsolis',
      regionId: 14,
      progress: 125000,
      recipeId: 501003,
      craftCount: 11092,
      lockExpiration: '2026-11-21 20:26:29+00',
      actionsRequiredPerItem: 115,
      totalActionsRequired: 1275580,
      craftedItem: [{ item_id: 338345776, quantity: 1, item_type: 'item', durability: 0 }],
      levelRequirements: [{ level: 50, skill_id: 2 }],
      toolRequirements: [{ level: 5, power: 1, tool_type: 1 }],
      experiencePerProgress: [{ quantity: 2.24, skill_id: 2 }],
      completed: false,
      isPublic: true,
    };

    let pollCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/version.json')) {
          return Promise.resolve({ ok: true, json: async () => ({ version: APP_VERSION }) });
        }
        if (url.endsWith(`/players/${ikuria.entityId}`)) {
          pollCount += 1;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              player: {
                ...ikuria,
                regionId: 8,
                locationX: 60,
                locationZ: 31,
                experience: [{ skill_id: 2, quantity: 779107 + pollCount * 50 }],
              },
            }),
          });
        }
        if (url.includes(`/players/${ikuria.entityId}/crafts`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ craftResults: [], items: [], cargos: [], count: 0 }),
          });
        }
        if (url.includes('/equipment')) {
          return Promise.resolve({ ok: true, json: async () => ({ equipment: [] }) });
        }
        if (url.includes('/buffs')) {
          return Promise.resolve({ ok: true, json: async () => ({ buffs: [], count: 0, regionId: 8 }) });
        }
        if (url.includes('/stats')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ stats: { entityId: ikuria.entityId, values: [] } }),
          });
        }
        if (url.includes('/tools')) {
          return Promise.resolve({ ok: true, json: async () => ({ tools: [] }) });
        }
        if (url.includes(`/crafts/${publicCraft.entityId}/contributions`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              contributions: [
                {
                  id: 'cb-honcho',
                  contributorEntityId: '1297036693020599412',
                  contributorUsername: 'honcho',
                  totalProgressContributed: 103680,
                  contributionCount: 3840,
                  lastContributedAt: new Date().toISOString(),
                },
              ],
            }),
          });
        }
        if (url.includes(`/crafts/${publicCraft.entityId}`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              craft: publicCraft,
              items: [{ id: 338345776, name: 'Exquisite Wood Log Output', tier: 5 }],
              cargos: [],
            }),
          });
        }
        if (url.includes('/crafts?completed=false')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              craftResults: [publicCraft],
              items: [{ id: 338345776, name: 'Exquisite Wood Log Output', tier: 5 }],
              cargos: [],
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    // 1. Mount App and wait for initial Ikuria load
    await act(async () => {
      root.render(React.createElement(App));
      await new Promise((r) => setTimeout(r, 30));
    });

    expect(container.textContent).toContain('No Active In-Progress Craft');

    // 2. Open Public Crafts modal, switch to All Stations, and click "Analyze Craft"
    const browseBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Browse Public Crafts')
    );
    expect(browseBtn).toBeTruthy();

    await act(async () => {
      browseBtn!.click();
      await new Promise((r) => setTimeout(r, 30));
    });

    const allStationsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('All Stations')
    );
    expect(allStationsBtn).toBeTruthy();

    await act(async () => {
      allStationsBtn!.click();
      await new Promise((r) => setTimeout(r, 10));
    });

    const forestryAccordion = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Forestry') && b.textContent?.includes('station')
    );
    expect(forestryAccordion).toBeTruthy();

    await act(async () => {
      forestryAccordion!.click();
      await new Promise((r) => setTimeout(r, 10));
    });

    const analyzeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Analyze Craft')
    );
    expect(analyzeBtn).toBeTruthy();

    await act(async () => {
      analyzeBtn!.click();
      await new Promise((r) => setTimeout(r, 40));
    });

    // Verify immediate state: Analyzing, NOT Helping
    expect(container.textContent).toContain('Analyzing Public Craft (Not Contributing)');
    expect(container.textContent).toContain('Analyzing: Exquisite Forestry');
    expect(container.textContent).not.toContain('Helping:');
    expect(container.textContent).not.toContain('Helping on Shared Station');
    expect(localStorage.getItem(`bitcraft_assisted_crafts_${ikuria.entityId}`)).toBeNull();

    // 3. Trigger a full refresh (even while gaining Forestry XP in-game)
    const refreshBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Refresh'
    );
    expect(refreshBtn).toBeTruthy();

    await act(async () => {
      refreshBtn!.click();
      await new Promise((r) => setTimeout(r, 50));
    });

    // Verify post-refresh state: STILL Analyzing, STILL NOT Helping, NOT saved to localStorage
    expect(container.textContent).toContain('Analyzing Public Craft (Not Contributing)');
    expect(container.textContent).toContain('Analyzing: Exquisite Forestry');
    expect(container.textContent).not.toContain('Helping:');
    expect(container.textContent).not.toContain('Helping on Shared Station');
    expect(localStorage.getItem(`bitcraft_assisted_crafts_${ikuria.entityId}`)).toBeNull();
  });

  it('shows the Helping marker only when the player is verified as a contributor with progress > 0', async () => {
    const ikuria = { entityId: '576460752768705987', username: 'Ikuria' };
    localStorage.setItem('bitcraft_primary_player', JSON.stringify(ikuria));

    const sharedCraft = {
      entityId: '1008806317066192961',
      buildingEntityId: '1008806317042828047',
      ownerEntityId: '576460752766901931',
      ownerUsername: 'Oaktavia',
      buildingName: 'Exquisite Forestry Station',
      claimName: 'Newsolis',
      regionId: 8,
      progress: 125000,
      recipeId: 501003,
      craftCount: 11092,
      lockExpiration: '2026-11-21 20:26:29+00',
      actionsRequiredPerItem: 115,
      totalActionsRequired: 1275580,
      craftedItem: [{ item_id: 338345776, quantity: 1, item_type: 'item', durability: 0 }],
      levelRequirements: [{ level: 50, skill_id: 2 }],
      toolRequirements: [{ level: 5, power: 1, tool_type: 1 }],
      experiencePerProgress: [{ quantity: 2.24, skill_id: 2 }],
      completed: false,
      isPublic: true,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/version.json')) {
          return Promise.resolve({ ok: true, json: async () => ({ version: APP_VERSION }) });
        }
        if (url.endsWith(`/players/${ikuria.entityId}`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              player: { ...ikuria, regionId: 8, locationX: 60, locationZ: 31, experience: [{ skill_id: 2, quantity: 779107 }] },
            }),
          });
        }
        if (url.includes(`/players/${ikuria.entityId}/crafts`)) {
          return Promise.resolve({ ok: true, json: async () => ({ craftResults: [], items: [], cargos: [], count: 0 }) });
        }
        if (url.includes('/equipment')) {
          return Promise.resolve({ ok: true, json: async () => ({ equipment: [] }) });
        }
        if (url.includes('/buffs')) {
          return Promise.resolve({ ok: true, json: async () => ({ buffs: [], count: 0, regionId: 8 }) });
        }
        if (url.includes('/stats')) {
          return Promise.resolve({ ok: true, json: async () => ({ stats: { entityId: ikuria.entityId, values: [] } }) });
        }
        if (url.includes('/tools')) {
          return Promise.resolve({ ok: true, json: async () => ({ tools: [] }) });
        }
        if (url.includes(`/crafts/${sharedCraft.entityId}/contributions`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              contributions: [
                {
                  id: 'cb-ikuria',
                  contributorEntityId: ikuria.entityId,
                  contributorUsername: ikuria.username,
                  totalProgressContributed: 1200,
                  contributionCount: 40,
                  lastContributedAt: new Date().toISOString(),
                },
              ],
            }),
          });
        }
        if (url.includes(`/crafts/${sharedCraft.entityId}`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              craft: sharedCraft,
              items: [{ id: 338345776, name: 'Exquisite Wood Log Output', tier: 5 }],
              cargos: [],
            }),
          });
        }
        if (url.includes('/crafts?completed=false')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              craftResults: [sharedCraft],
              items: [{ id: 338345776, name: 'Exquisite Wood Log Output', tier: 5 }],
              cargos: [],
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    await act(async () => {
      root.render(React.createElement(App));
      await new Promise((r) => setTimeout(r, 30));
    });

    const browseBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Browse Public Crafts')
    );
    await act(async () => {
      browseBtn!.click();
      await new Promise((r) => setTimeout(r, 30));
    });

    const forestryAccordion = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Forestry') && b.textContent?.includes('station')
    );
    await act(async () => {
      forestryAccordion!.click();
      await new Promise((r) => setTimeout(r, 10));
    });

    const analyzeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Analyze Craft')
    );
    await act(async () => {
      analyzeBtn!.click();
      await new Promise((r) => setTimeout(r, 40));
    });

    expect(container.textContent).toContain('Helping on Shared Station');
    expect(container.textContent).toContain('Helping: Exquisite Forestry');
  });

  it('automatically prunes localStorage tracked crafts returning 404, clears Cache Inspector anomalies, and stops re-polling them', async () => {
    const ikuria = { entityId: '576460752768705987', username: 'Ikuria' };
    const expiredCraftId = '999000000000000404';
    localStorage.setItem('bitcraft_primary_player', JSON.stringify(ikuria));
    localStorage.setItem(
      `bitcraft_assisted_crafts_${ikuria.entityId}`,
      JSON.stringify([expiredCraftId])
    );

    let expiredCraftFetchCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/version.json')) {
          return Promise.resolve({ ok: true, json: async () => ({ version: APP_VERSION }) });
        }
        if (url.endsWith(`/players/${ikuria.entityId}`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              player: { ...ikuria, regionId: 8, locationX: 60, locationZ: 31, experience: [{ skill_id: 2, quantity: 779107 }] },
            }),
          });
        }
        if (url.includes(`/players/${ikuria.entityId}/crafts`)) {
          return Promise.resolve({ ok: true, json: async () => ({ craftResults: [], items: [], cargos: [], count: 0 }) });
        }
        if (url.includes('/equipment')) {
          return Promise.resolve({ ok: true, json: async () => ({ equipment: [] }) });
        }
        if (url.includes('/buffs')) {
          return Promise.resolve({ ok: true, json: async () => ({ buffs: [], count: 0, regionId: 8 }) });
        }
        if (url.includes('/stats')) {
          return Promise.resolve({ ok: true, json: async () => ({ stats: { entityId: ikuria.entityId, values: [] } }) });
        }
        if (url.includes('/tools')) {
          return Promise.resolve({ ok: true, json: async () => ({ tools: [] }) });
        }
        if (url.includes(`/crafts/${expiredCraftId}`)) {
          expiredCraftFetchCount += 1;
          return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });
        }
        if (url.includes('/crafts?completed=false')) {
          return Promise.resolve({ ok: true, json: async () => ({ craftResults: [], items: [], cargos: [] }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    await act(async () => {
      root.render(React.createElement(App));
      await new Promise((r) => setTimeout(r, 40));
    });

    // Fetched once, received 404, automatically pruned from localStorage and retired from Cache Inspector anomalies
    expect(expiredCraftFetchCount).toBe(1);
    expect(localStorage.getItem(`bitcraft_assisted_crafts_${ikuria.entityId}`)).toBeNull();
    expect(bitjitaApi.getAnomalies()).toEqual([]);

    // Subsequent manual refresh must NOT poll the retired 404 craft again
    const refreshBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Refresh'
    );
    expect(refreshBtn).toBeTruthy();

    await act(async () => {
      refreshBtn!.click();
      await new Promise((r) => setTimeout(r, 40));
    });

    expect(expiredCraftFetchCount).toBe(1);
    expect(bitjitaApi.getAnomalies()).toEqual([]);
  });

  it('automatically prunes completed tracked crafts from localStorage and retains crafts on transient 500 errors', async () => {
    const ikuria = { entityId: '576460752768705987', username: 'Ikuria' };
    const completedCraftId = '999000000000000200';
    const transientErrCraftId = '999000000000000500';
    localStorage.setItem('bitcraft_primary_player', JSON.stringify(ikuria));
    localStorage.setItem(
      `bitcraft_assisted_crafts_${ikuria.entityId}`,
      JSON.stringify([completedCraftId, transientErrCraftId])
    );

    let completedCraftFetchCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/version.json')) {
          return Promise.resolve({ ok: true, json: async () => ({ version: APP_VERSION }) });
        }
        if (url.endsWith(`/players/${ikuria.entityId}`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              player: { ...ikuria, regionId: 8, locationX: 60, locationZ: 31, experience: [{ skill_id: 2, quantity: 779107 }] },
            }),
          });
        }
        if (url.includes(`/players/${ikuria.entityId}/crafts`)) {
          return Promise.resolve({ ok: true, json: async () => ({ craftResults: [], items: [], cargos: [], count: 0 }) });
        }
        if (url.includes('/equipment')) {
          return Promise.resolve({ ok: true, json: async () => ({ equipment: [] }) });
        }
        if (url.includes('/buffs')) {
          return Promise.resolve({ ok: true, json: async () => ({ buffs: [], count: 0, regionId: 8 }) });
        }
        if (url.includes('/stats')) {
          return Promise.resolve({ ok: true, json: async () => ({ stats: { entityId: ikuria.entityId, values: [] } }) });
        }
        if (url.includes('/tools')) {
          return Promise.resolve({ ok: true, json: async () => ({ tools: [] }) });
        }
        if (url.includes(`/crafts/${completedCraftId}`)) {
          completedCraftFetchCount += 1;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              craft: {
                entityId: completedCraftId,
                buildingName: 'Finished Forge',
                progress: 500,
                totalActionsRequired: 500,
                completed: true,
              },
              items: [],
              cargos: [],
            }),
          });
        }
        if (url.includes(`/crafts/${transientErrCraftId}`)) {
          return Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' });
        }
        if (url.includes('/crafts?completed=false')) {
          return Promise.resolve({ ok: true, json: async () => ({ craftResults: [], items: [], cargos: [] }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    await act(async () => {
      root.render(React.createElement(App));
      await new Promise((r) => setTimeout(r, 40));
    });

    // Completed craft is pruned & retired from cache; transient 500 craft is preserved in localStorage
    expect(completedCraftFetchCount).toBe(1);
    const stored = JSON.parse(localStorage.getItem(`bitcraft_assisted_crafts_${ikuria.entityId}`) || '[]');
    expect(stored).toEqual([transientErrCraftId]);
    expect(bitjitaApi.getCachedEntries().map((e) => e.endpoint)).not.toContain(`/crafts/${completedCraftId}`);

    // Subsequent refresh should not re-fetch the completed craft
    const refreshBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Refresh'
    );
    await act(async () => {
      refreshBtn!.click();
      await new Promise((r) => setTimeout(r, 40));
    });

    expect(completedCraftFetchCount).toBe(1);
  });

  it('bounds legacy oversized assisted craft lists and enforces the per-poll fetch budget to prevent request storms', async () => {
    const ikuria = { entityId: '576460752768705987', username: 'Ikuria' };
    localStorage.setItem('bitcraft_primary_player', JSON.stringify(ikuria));

    // Seed 284 legacy tracked craft IDs (simulating pre-v1.9.1 alt history)
    const legacyIds = Array.from({ length: 284 }, (_, i) => `legacy_craft_${i + 1}`);
    localStorage.setItem(`bitcraft_assisted_crafts_${ikuria.entityId}`, JSON.stringify(legacyIds));

    const fetchedCraftIds: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/version.json')) {
          return Promise.resolve({ ok: true, json: async () => ({ version: APP_VERSION }) });
        }
        if (url.endsWith(`/players/${ikuria.entityId}`)) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              player: { ...ikuria, regionId: 8, locationX: 60, locationZ: 31, experience: [{ skill_id: 2, quantity: 779107 }] },
            }),
          });
        }
        if (url.includes(`/players/${ikuria.entityId}/crafts`)) {
          return Promise.resolve({ ok: true, json: async () => ({ craftResults: [], items: [], cargos: [], count: 0 }) });
        }
        if (url.includes('/equipment')) {
          return Promise.resolve({ ok: true, json: async () => ({ equipment: [] }) });
        }
        if (url.includes('/buffs')) {
          return Promise.resolve({ ok: true, json: async () => ({ buffs: [], count: 0, regionId: 8 }) });
        }
        if (url.includes('/stats')) {
          return Promise.resolve({ ok: true, json: async () => ({ stats: { entityId: ikuria.entityId, values: [] } }) });
        }
        if (url.includes('/tools')) {
          return Promise.resolve({ ok: true, json: async () => ({ tools: [] }) });
        }
        const craftMatch = url.match(/\/crafts\/(legacy_craft_\d+)$/);
        if (craftMatch) {
          fetchedCraftIds.push(craftMatch[1]);
          return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' });
        }
        if (url.includes('/crafts?completed=false')) {
          return Promise.resolve({ ok: true, json: async () => ({ craftResults: [], items: [], cargos: [] }) });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      })
    );

    await act(async () => {
      root.render(React.createElement(App));
      await new Promise((r) => setTimeout(r, 60));
    });

    // 1. Only at most 5 GET /crafts/{id} requests fired in a single poll (prioritizing newest IDs)
    expect(fetchedCraftIds.length).toBe(5);
    expect(fetchedCraftIds).toEqual([
      'legacy_craft_284',
      'legacy_craft_283',
      'legacy_craft_282',
      'legacy_craft_281',
      'legacy_craft_280',
    ]);

    // 2. Oversized 284-entry list was trimmed immediately to 20, and the 5 verified 404s were pruned -> 15 left
    const remaining: string[] = JSON.parse(
      localStorage.getItem(`bitcraft_assisted_crafts_${ikuria.entityId}`) || '[]'
    );
    expect(remaining.length).toBe(15);
    expect(remaining[0]).toBe('legacy_craft_265');
    expect(remaining[remaining.length - 1]).toBe('legacy_craft_279');
  });
});
