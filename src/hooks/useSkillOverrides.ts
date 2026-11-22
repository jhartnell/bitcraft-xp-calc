import { useState, useCallback, useMemo } from 'react';
import { SkillOverrideMap } from '../types/calculator';

const STORAGE_PREFIX = 'bitcraft_skill_overrides_';

export interface SkillOverrideCraftAnchor {
  craftId: string;
  userProgress: number;
}

export interface UseSkillOverridesReturn {
  overrides: SkillOverrideMap;
  setSkillLevel: (skillId: number, level: number, craftAnchor?: SkillOverrideCraftAnchor) => void;
  setSkillXp: (skillId: number, xp: number, craftAnchor?: SkillOverrideCraftAnchor) => void;
  clearSkillOverride: (skillId: number) => void;
  clearAllSkillOverrides: () => void;
}

function readOverrides(storageKey: string | null): SkillOverrideMap {
  if (!storageKey) return {};
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as SkillOverrideMap) : {};
  } catch {
    return {};
  }
}

export function useSkillOverrides(playerEntityId?: string | null): UseSkillOverridesReturn {
  const storageKey = playerEntityId ? `${STORAGE_PREFIX}${playerEntityId}` : null;

  const [state, setState] = useState<{
    key: string | null;
    data: SkillOverrideMap;
  } | null>(null);

  const overrides = useMemo<SkillOverrideMap>(() => {
    if (state && state.key === storageKey) {
      return state.data;
    }
    return readOverrides(storageKey);
  }, [state, storageKey]);

  const saveOverrides = useCallback(
    (next: SkillOverrideMap) => {
      setState({ key: storageKey, data: next });
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore localStorage write errors
        }
      }
    },
    [storageKey]
  );

  const setSkillLevel = useCallback(
    (skillId: number, level: number, craftAnchor?: SkillOverrideCraftAnchor) => {
      const clampedLevel = Math.max(1, Math.min(110, Math.round(level)));
      const next: SkillOverrideMap = {
        ...overrides,
        [skillId]: {
          level: clampedLevel,
          updatedAt: Date.now(),
          ...(craftAnchor
            ? {
                anchorCraftId: craftAnchor.craftId,
                anchorUserProgress: Math.max(0, craftAnchor.userProgress),
              }
            : {}),
        },
      };
      saveOverrides(next);
    },
    [overrides, saveOverrides]
  );

  const setSkillXp = useCallback(
    (skillId: number, xp: number, craftAnchor?: SkillOverrideCraftAnchor) => {
      const clampedXp = Math.max(0, Math.round(xp));
      const next: SkillOverrideMap = {
        ...overrides,
        [skillId]: {
          xp: clampedXp,
          updatedAt: Date.now(),
          ...(craftAnchor
            ? {
                anchorCraftId: craftAnchor.craftId,
                anchorUserProgress: Math.max(0, craftAnchor.userProgress),
              }
            : {}),
        },
      };
      saveOverrides(next);
    },
    [overrides, saveOverrides]
  );

  const clearSkillOverride = useCallback(
    (skillId: number) => {
      const next = { ...overrides };
      delete next[skillId];
      saveOverrides(next);
    },
    [overrides, saveOverrides]
  );

  const clearAllSkillOverrides = useCallback(() => {
    saveOverrides({});
  }, [saveOverrides]);

  return {
    overrides,
    setSkillLevel,
    setSkillXp,
    clearSkillOverride,
    clearAllSkillOverrides,
  };
}
