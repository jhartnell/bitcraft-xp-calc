import { describe, it, expect } from 'vitest';
import { calculateSnapshotRate, ProgressSnapshot } from '../useSessionXpTracker';

describe('Rolling Snapshot XP Rate Calculator', () => {
  it('returns null rate when fewer than 2 snapshots exist', () => {
    const snapshots: ProgressSnapshot[] = [{ timestamp: 1000, cumulativeXp: 0 }];
    const result = calculateSnapshotRate(snapshots, 160000);

    expect(result.measuredXpPerHour).toBeNull();
    expect(result.efficiencyPercent).toBeNull();
  });

  it('accurately calculates steady-state rate on first active snapshot pair with true interval', () => {
    const snapshots: ProgressSnapshot[] = [
      { timestamp: 10000, cumulativeXp: 0 },
      { timestamp: 20000, cumulativeXp: 450 }, // +450 XP over 10s
    ];
    const theoreticalRate = 162000;

    const result = calculateSnapshotRate(snapshots, theoreticalRate);

    // deltaXp = 450, elapsed = 10s -> (450 / 10) * 3600 = 162,000 XP/hr
    expect(result.measuredXpPerHour).toBe(162000);
    expect(result.efficiencyPercent).toBe(100);
  });

  it('filters and clamps anomalous catch-up backlog spikes that exceed physical theoretical speed', () => {
    const snapshots: ProgressSnapshot[] = [
      { timestamp: 10000, cumulativeXp: 0 },
      { timestamp: 16000, cumulativeXp: 5000 }, // huge backlog flush in 6s = 3,000,000 XP/hr raw
    ];
    const theoreticalRate = 160000;

    const result = calculateSnapshotRate(snapshots, theoreticalRate);

    // Clamped to 125% of theoretical = 200,000 XP/hr
    expect(result.measuredXpPerHour).toBe(200000);
    expect(result.efficiencyPercent).toBe(125);
  });

  it('requires at least 5 seconds of elapsed time to avoid micro-interval division errors', () => {
    const snapshots: ProgressSnapshot[] = [
      { timestamp: 10000, cumulativeXp: 0 },
      { timestamp: 12000, cumulativeXp: 500 }, // only 2s elapsed
    ];
    const result = calculateSnapshotRate(snapshots, 160000);

    expect(result.measuredXpPerHour).toBeNull();
    expect(result.efficiencyPercent).toBeNull();
  });
});
