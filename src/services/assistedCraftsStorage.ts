// Shared localStorage helpers for tracking assisted/pinned craft IDs per character
// Enforces a bounded LRU cap (newest entries at tail) to prevent unbounded storage growth
// and multi-hundred-request API storms when switching between characters.

import { recordDiagnosticEvent } from './diagnosticsBuffer';

const ASSISTED_CRAFTS_PREFIX = 'bitcraft_assisted_crafts_';
export const MAX_ASSISTED_CRAFTS_PER_PLAYER = 20;

function getStorageKey(playerEntityId: string): string {
  return `${ASSISTED_CRAFTS_PREFIX}${playerEntityId}`;
}

function normalizeAndCapIds(
  rawIds: Iterable<string>,
  maxEntries: number = MAX_ASSISTED_CRAFTS_PER_PLAYER
): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();
  const all = Array.from(rawIds).filter(Boolean).map(String);

  // Keep the latest occurrence of each ID to preserve LRU recency ordering
  for (let i = all.length - 1; i >= 0; i -= 1) {
    const id = all[i];
    if (!seen.has(id)) {
      seen.add(id);
      deduped.push(id);
    }
  }
  deduped.reverse();

  return deduped.length > maxEntries ? deduped.slice(-maxEntries) : deduped;
}

function writeAssistedCraftIds(playerEntityId: string, ids: Iterable<string>): Set<string> {
  const bounded = normalizeAndCapIds(ids);
  try {
    const key = getStorageKey(playerEntityId);
    if (bounded.length === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(bounded));
    }
  } catch {
    // Ignore storage quota or privacy-mode errors
  }
  return new Set(bounded);
}

export function getAssistedCraftIds(playerEntityId?: string | null): Set<string> {
  if (!playerEntityId) return new Set();
  try {
    const key = getStorageKey(playerEntityId);
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();

    const cleaned = parsed.filter(Boolean).map(String);
    const bounded = normalizeAndCapIds(cleaned);

    // Self-heal oversized legacy arrays immediately on read so ancient entries never trigger API storms
    if (bounded.length !== cleaned.length) {
      writeAssistedCraftIds(playerEntityId, bounded);
    }

    return new Set(bounded);
  } catch {
    return new Set();
  }
}

export function addAssistedCraftId(playerEntityId: string, craftEntityId: string): Set<string> {
  const ids = getAssistedCraftIds(playerEntityId);
  if (!craftEntityId) return ids;
  // LRU touch: move existing ID to the most-recent tail so actively worked crafts are never evicted
  ids.delete(craftEntityId);
  ids.add(craftEntityId);
  return writeAssistedCraftIds(playerEntityId, ids);
}

export function removeAssistedCraftId(playerEntityId: string, craftEntityId: string): Set<string> {
  const ids = getAssistedCraftIds(playerEntityId);
  if (ids.delete(craftEntityId)) {
    return writeAssistedCraftIds(playerEntityId, ids);
  }
  return ids;
}

export function removeAssistedCraftIds(
  playerEntityId: string,
  craftEntityIds: Iterable<string>
): Set<string> {
  const ids = getAssistedCraftIds(playerEntityId);
  let changed = false;
  for (const id of craftEntityIds) {
    if (ids.delete(id)) {
      changed = true;
    }
  }
  if (changed) {
    return writeAssistedCraftIds(playerEntityId, ids);
  }
  return ids;
}

export function clearAssistedCraftIds(playerEntityId: string): void {
  if (!playerEntityId) return;
  try {
    localStorage.removeItem(getStorageKey(playerEntityId));
  } catch {
    // Ignore storage errors
  }
}

export function toggleAssistedCraftId(playerEntityId: string, craftEntityId: string): Set<string> {
  const ids = getAssistedCraftIds(playerEntityId);
  if (ids.has(craftEntityId)) {
    ids.delete(craftEntityId);
  } else {
    ids.add(craftEntityId);
  }
  return writeAssistedCraftIds(playerEntityId, ids);
}

/**
 * Startup localStorage hygiene pass: trims any oversized legacy `bitcraft_assisted_crafts_*`
 * keys across all characters down to the bounded LRU cap with zero network requests.
 */
export function pruneOversizedAssistedCraftStores(
  maxEntries: number = MAX_ASSISTED_CRAFTS_PER_PLAYER
): { keysTrimmed: number; idsRemoved: number } {
  if (typeof localStorage === 'undefined') {
    return { keysTrimmed: 0, idsRemoved: 0 };
  }

  let keysTrimmed = 0;
  let idsRemoved = 0;

  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(ASSISTED_CRAFTS_PREFIX)) {
        keys.push(k);
      }
    }

    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        localStorage.removeItem(key);
        keysTrimmed += 1;
        continue;
      }

      if (!Array.isArray(parsed)) {
        localStorage.removeItem(key);
        keysTrimmed += 1;
        continue;
      }

      const cleaned = parsed.filter(Boolean).map(String);
      const bounded = normalizeAndCapIds(cleaned, maxEntries);

      if (bounded.length === 0) {
        localStorage.removeItem(key);
        keysTrimmed += 1;
        idsRemoved += cleaned.length;
      } else if (bounded.length < cleaned.length) {
        localStorage.setItem(key, JSON.stringify(bounded));
        keysTrimmed += 1;
        idsRemoved += cleaned.length - bounded.length;
      }
    }
  } catch {
    // Ignore restricted storage access
  }

  if (keysTrimmed > 0) {
    recordDiagnosticEvent({
      level: 'info',
      source: 'app',
      message: 'Trimmed legacy assisted craft lists to bounded LRU cap',
      details: {
        keysTrimmed,
        idsRemoved,
        maxEntries,
      },
    });
  }

  return { keysTrimmed, idsRemoved };
}
