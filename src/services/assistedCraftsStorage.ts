// Shared localStorage helpers for tracking assisted/pinned craft IDs per character

const ASSISTED_CRAFTS_PREFIX = 'bitcraft_assisted_crafts_';

function getStorageKey(playerEntityId: string): string {
  return `${ASSISTED_CRAFTS_PREFIX}${playerEntityId}`;
}

export function getAssistedCraftIds(playerEntityId?: string | null): Set<string> {
  if (!playerEntityId) return new Set();
  try {
    const raw = localStorage.getItem(getStorageKey(playerEntityId));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(Boolean).map(String));
  } catch {
    return new Set();
  }
}

function writeAssistedCraftIds(playerEntityId: string, ids: Set<string>): void {
  try {
    const key = getStorageKey(playerEntityId);
    if (ids.size === 0) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(Array.from(ids)));
    }
  } catch {
    // Ignore storage quota or privacy-mode errors
  }
}

export function addAssistedCraftId(playerEntityId: string, craftEntityId: string): Set<string> {
  const ids = getAssistedCraftIds(playerEntityId);
  if (!craftEntityId) return ids;
  if (!ids.has(craftEntityId)) {
    ids.add(craftEntityId);
    writeAssistedCraftIds(playerEntityId, ids);
  }
  return ids;
}

export function removeAssistedCraftId(playerEntityId: string, craftEntityId: string): Set<string> {
  const ids = getAssistedCraftIds(playerEntityId);
  if (ids.delete(craftEntityId)) {
    writeAssistedCraftIds(playerEntityId, ids);
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
    writeAssistedCraftIds(playerEntityId, ids);
  }
  return ids;
}

export function toggleAssistedCraftId(playerEntityId: string, craftEntityId: string): Set<string> {
  const ids = getAssistedCraftIds(playerEntityId);
  if (ids.has(craftEntityId)) {
    ids.delete(craftEntityId);
  } else {
    ids.add(craftEntityId);
  }
  writeAssistedCraftIds(playerEntityId, ids);
  return ids;
}
