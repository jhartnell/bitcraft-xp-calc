import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeLiveXpAdjustment,
  getLiveXpAnchorStorageKey,
  loadLiveXpAnchor,
  reconcileLiveXpAnchor,
  saveLiveXpAnchor,
} from '../liveXpBridge';

describe('liveXpBridge', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('tracks unflushed craft XP deltas while BitJita server XP stays frozen and re-anchors on flush without double-counting', () => {
    // 1. Craft starts at 0 progress with server XP = 10,078 (Level 11)
    const a0 = reconcileLiveXpAnchor(null, 10078, 0, 1000);
    expect(a0).toEqual({
      baselineServerXp: 10078,
      baselineUserProgress: 0,
      includePriorCraftProgress: false,
      hasObservedLag: false,
      hasObservedServerSync: false,
      updatedAt: 1000,
    });

    // 2. Player crafts 21,178 effort at 1.6 XP/effort (+33,885 XP) while server XP stays 10,078
    const a1 = reconcileLiveXpAnchor(a0, 10078, 21178, 2000);
    expect(a1.hasObservedLag).toBe(true);
    expect(a1.baselineServerXp).toBe(10078);
    expect(a1.baselineUserProgress).toBe(0);

    const adj1 = computeLiveXpAdjustment({
      anchor: a1,
      serverSkillXp: 10078,
      hasServerExperience: true,
      hasManualOverride: false,
      userProgress: 21178,
      effectiveXpPerAction: 1.6,
    });
    expect(adj1).not.toBeNull();
    expect(adj1!.serverSkillLevel).toBe(11);
    expect(adj1!.unflushedCraftXp).toBe(33885);
    expect(adj1!.effectiveSkillXp).toBe(43963); // Level 22!
    expect(adj1!.isServerXpLagging).toBe(true);
    expect(adj1!.canIncludePriorCraftXp).toBe(false);

    // 3. BitJita finally flushes server XP to 43,963 at 21,178 progress -> zero double-counting!
    const adjFlushedSameFrame = computeLiveXpAdjustment({
      anchor: a1, // Even with stale anchor on the exact render frame server XP arrives
      serverSkillXp: 43963,
      hasServerExperience: true,
      hasManualOverride: false,
      userProgress: 21178,
      effectiveXpPerAction: 1.6,
    });
    expect(adjFlushedSameFrame!.unflushedCraftXp).toBe(0);
    expect(adjFlushedSameFrame!.effectiveSkillXp).toBe(43963);
    expect(adjFlushedSameFrame!.canIncludePriorCraftXp).toBe(false);

    const a2 = reconcileLiveXpAnchor(a1, 43963, 21178, 3000);
    expect(a2.baselineServerXp).toBe(43963);
    expect(a2.baselineUserProgress).toBe(21178);
    expect(a2.hasObservedServerSync).toBe(true);
    expect(a2.hasObservedLag).toBe(false);

    // 4. Subsequent crafting adds only the new delta beyond 21,178
    const adjAfterFlush = computeLiveXpAdjustment({
      anchor: a2,
      serverSkillXp: 43963,
      hasServerExperience: true,
      hasManualOverride: false,
      userProgress: 22178, // +1,000 more effort (+1,600 XP)
      effectiveXpPerAction: 1.6,
    });
    expect(adjAfterFlush!.unflushedCraftXp).toBe(1600);
    expect(adjAfterFlush!.effectiveSkillXp).toBe(45563);
    expect(adjAfterFlush!.canIncludePriorCraftXp).toBe(false); // Never re-prompts after real sync
  });

  it('supports cold-start mid-craft opt-in, revert, and auto-reset once BitJita syncs', () => {
    // Cold start mid-craft at 21,178 effort while BitJita reports 10,078 XP (Level 11)
    const coldAnchor = reconcileLiveXpAnchor(null, 10078, 21178, 1000);

    const beforeOptIn = computeLiveXpAdjustment({
      anchor: coldAnchor,
      serverSkillXp: 10078,
      hasServerExperience: true,
      hasManualOverride: false,
      userProgress: 21178,
      effectiveXpPerAction: 1.6,
    });
    expect(beforeOptIn!.unflushedCraftXp).toBe(0);
    expect(beforeOptIn!.canIncludePriorCraftXp).toBe(true);
    expect(beforeOptIn!.priorCraftXp).toBe(33885);
    expect(beforeOptIn!.isPriorCraftXpIncluded).toBe(false);

    // User clicks "Include prior craft XP"
    const optedInAnchor = { ...coldAnchor, includePriorCraftProgress: true };
    const afterOptIn = computeLiveXpAdjustment({
      anchor: optedInAnchor,
      serverSkillXp: 10078,
      hasServerExperience: true,
      hasManualOverride: false,
      userProgress: 21178,
      effectiveXpPerAction: 1.6,
    });
    expect(afterOptIn!.unflushedCraftXp).toBe(33885);
    expect(afterOptIn!.effectiveSkillXp).toBe(43963);
    expect(afterOptIn!.isPriorCraftXpIncluded).toBe(true);

    // BitJita later flushes server XP -> automatically clears opt-in and prevents double-counting
    const reconciledOnFlush = reconcileLiveXpAnchor(optedInAnchor, 43963, 21178, 2000);
    expect(reconciledOnFlush.includePriorCraftProgress).toBe(false);
    expect(reconciledOnFlush.hasObservedServerSync).toBe(true);

    const afterFlush = computeLiveXpAdjustment({
      anchor: reconciledOnFlush,
      serverSkillXp: 43963,
      hasServerExperience: true,
      hasManualOverride: false,
      userProgress: 21178,
      effectiveXpPerAction: 1.6,
    });
    expect(afterFlush!.unflushedCraftXp).toBe(0);
    expect(afterFlush!.effectiveSkillXp).toBe(43963);
    expect(afterFlush!.canIncludePriorCraftXp).toBe(false);
  });

  it('disables bridging when a manual skill override is active or server experience is missing', () => {
    const anchor = reconcileLiveXpAnchor(null, 10078, 0, 1000);
    expect(
      computeLiveXpAdjustment({
        anchor,
        serverSkillXp: 10078,
        hasServerExperience: true,
        hasManualOverride: true,
        userProgress: 21178,
        effectiveXpPerAction: 1.6,
      })
    ).toBeNull();

    expect(
      computeLiveXpAdjustment({
        anchor,
        serverSkillXp: 0,
        hasServerExperience: false,
        hasManualOverride: false,
        userProgress: 21178,
        effectiveXpPerAction: 1.6,
      })
    ).toBeNull();
  });

  it('persists and loads anchors safely from sessionStorage', () => {
    const anchor = reconcileLiveXpAnchor(null, 10078, 5000, 12345);
    saveLiveXpAnchor('player_1', 6, 'craft_1', anchor);
    expect(sessionStorage.getItem(getLiveXpAnchorStorageKey('player_1', 6, 'craft_1'))).not.toBeNull();
    expect(loadLiveXpAnchor('player_1', 6, 'craft_1')).toEqual(anchor);
  });
});
