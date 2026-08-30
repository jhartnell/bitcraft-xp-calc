import { useState, useEffect, useCallback } from 'react';
import { SkillOverrideMap } from '../types/calculator';

const STORAGE_PREFIX = 'bitcraft_skill_overrides_';

export interface UseSkillOverridesReturn {
  overrides: SkillOverrideMap;
  setSkillLevel: (skillId: number, level: number) => void;
  setSkillXp: (skillId: number, xp: number) => void;
  clearSkillOverride: (skillId: number) => void;
  clearAllSkillOverrides: () => void;
}

export function useSkillOverrides(playerEntityId?: string | null): UseSkillOverridesReturn {
  const storageKey = playerEntityId ? `${STORAGE_PREFIX}${playerEntityId}` : null;

  const [overrides, setOverrides] = useState<SkillOverrideMap>(() => {
    if (!storageKey) return {};
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Re-sync when playerEntityId changes
  useEffect(() => {
    if (!storageKey) {
      setOverrides({});
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey);
      setOverrides(raw ? JSON.parse(raw) : {});
    } catch {
      setOverrides({});
    }
  }, [storageKey]);

  const saveOverrides = useCallback(
    (next: SkillOverrideMap) => {
      setOverrides(next);
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
    (skillId: number, level: number) => {
      const clampedLevel = Math.max(1, Math.min(110, Math.round(level)));
      const next: SkillOverrideMap = {
        ...overrides,
        [skillId]: {
          ...overrides[skillId],
          level: clampedLevel,
          updatedAt: Date.now(),
        },
      };
      saveOverrides(next);
    },
    [overrides, saveOverrides]
  );

  const setSkillXp = useCallback(
    (skillId: number, xp: number) => {
      const clampedXp = Math.max(0, Math.round(xp));
      const next: SkillOverrideMap = {
        ...overrides,
        [skillId]: {
          ...overrides[skillId],
          xp: clampedXp,
          updatedAt: Date.now(),
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
