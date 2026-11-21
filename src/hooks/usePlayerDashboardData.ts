import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CraftContribution,
  CraftResult,
  EquipmentSlot,
  ItemMetadata,
  PlayerBuff,
  PlayerDetails,
  PlayerStatsData,
  PlayerSummary,
  PlayerToolEntry,
} from '../types/api';
import { NearbyCraftItem } from '../components/ActiveCraftCard';
import { bitjitaApi } from '../services/apiClient';
import { resolveCraftCoordinates } from '../services/bitcraftData';
import { resolveActiveCraftSelection } from '../services/craftResolution';
import { ContributorDetailPayload } from '../services/xpCalculator';

interface UsePlayerDashboardDataParams {
  primaryPlayer: PlayerSummary | null;
  recentPlayers: PlayerSummary[];
  refreshInterval: number;
  saveRecentPlayer: (player: PlayerSummary) => void;
}

function addAssistedCraftId(playerEntityId: string, craftEntityId: string): void {
  try {
    const key = `bitcraft_assisted_crafts_${playerEntityId}`;
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    const set = new Set<string>(Array.isArray(parsed) ? parsed.map(String) : []);
    set.add(craftEntityId);
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // Ignore storage errors
  }
}

export function usePlayerDashboardData({
  primaryPlayer,
  recentPlayers,
  refreshInterval,
  saveRecentPlayer,
}: UsePlayerDashboardDataParams) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSummary | null>(
    () => primaryPlayer ?? recentPlayers[0] ?? null
  );
  const [playerDetails, setPlayerDetails] = useState<PlayerDetails | null>(null);
  const [equipment, setEquipment] = useState<EquipmentSlot[]>([]);
  const [playerTools, setPlayerTools] = useState<PlayerToolEntry[]>([]);
  const [buffs, setBuffs] = useState<PlayerBuff[]>([]);
  const [stats, setStats] = useState<PlayerStatsData | null>(null);
  const [crafts, setCrafts] = useState<CraftResult[]>([]);
  const [selectedCraftIndex, setSelectedCraftIndex] = useState<number>(0);
  const [customCraft, setCustomCraft] = useState<CraftResult | null>(null);
  const [nearbyCrafts, setNearbyCrafts] = useState<NearbyCraftItem[]>([]);
  const [contributions, setContributions] = useState<CraftContribution[]>([]);
  const [contributorPayloads, setContributorPayloads] = useState<ContributorDetailPayload[]>([]);
  const [includedContributors, setIncludedContributors] = useState<Record<string, boolean>>({});
  const [itemMetadataMap, setItemMetadataMap] = useState<Map<number, ItemMetadata>>(new Map());
  const [customProgressPerAction, setCustomProgressPerAction] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pollAnchorAt, setPollAnchorAt] = useState<number>(() => Date.now());

  // Race-condition guards & snapshots
  const loadRequestIdRef = useRef<number>(0);
  const craftRequestIdRef = useRef<number>(0);
  const selectedCraftIdRef = useRef<string | null>(null);
  const playerExpSnapshotRef = useRef<Map<number, number>>(new Map());
  const fetchedMissingMetaIdsRef = useRef<Set<string>>(new Set());

  const mergeItemMetadata = useCallback((items?: ItemMetadata[], cargos?: ItemMetadata[]) => {
    if ((!items || items.length === 0) && (!cargos || cargos.length === 0)) return;
    setItemMetadataMap((prev) => {
      const next = new Map(prev);
      if (items) {
        for (const itm of items) {
          next.set(Number(itm.id), itm);
        }
      }
      if (cargos) {
        for (const crg of cargos) {
          next.set(Number(crg.id), crg);
        }
      }
      return next;
    });
  }, []);

  const loadContributorPayloads = useCallback(
    async (contribs: CraftContribution[], primaryId: string, craftReqId: number) => {
      const payloads = await Promise.all(
        contribs.map(async (cb): Promise<ContributorDetailPayload> => {
          if (cb.contributorEntityId === primaryId) {
            return { contribution: cb };
          }
          try {
            const [equip, contributorBuffs, contributorStats] = await Promise.all([
              bitjitaApi.getPlayerEquipment(cb.contributorEntityId).catch(() => null),
              bitjitaApi.getPlayerBuffs(cb.contributorEntityId).catch(() => null),
              bitjitaApi.getPlayerStats(cb.contributorEntityId).catch(() => null),
            ]);

            return {
              contribution: cb,
              equipment: equip?.equipment || [],
              buffs: contributorBuffs?.buffs || [],
              stats: contributorStats || undefined,
            };
          } catch {
            return { contribution: cb };
          }
        })
      );

      // Ignore stale contributor loads if user switched craft or player
      if (craftRequestIdRef.current === craftReqId) {
        setContributorPayloads(payloads);
      }
    },
    []
  );

  const fetchCraftContributions = useCallback(
    async (craftId: string, playerEntityId: string, playerUsername?: string, forceFresh = false) => {
      const reqId = ++craftRequestIdRef.current;
      try {
        const cb = await bitjitaApi.getCraftContributions(craftId, forceFresh);
        if (craftRequestIdRef.current !== reqId) return [];
        setContributions(cb);
        // Only persist into assisted crafts if the player is actually a verified contributor
        const isVerifiedContributor = cb.some(
          (entry) =>
            (entry.contributorEntityId === playerEntityId ||
              (playerUsername &&
                entry.contributorUsername?.toLowerCase() === playerUsername.toLowerCase())) &&
            (entry.contributionCount > 0 || entry.totalProgressContributed > 0)
        );
        if (isVerifiedContributor) {
          addAssistedCraftId(playerEntityId, craftId);
        }
        void loadContributorPayloads(cb, playerEntityId, reqId);
        return cb;
      } catch {
        if (craftRequestIdRef.current === reqId) {
          setContributions([]);
          setContributorPayloads([]);
        }
        return [];
      }
    },
    [loadContributorPayloads]
  );

  const loadPlayerData = useCallback(
    async (player: PlayerSummary, forceFresh = false) => {
      if (!player || !player.entityId) return;

      const reqId = ++loadRequestIdRef.current;

      try {
        setIsLoading(true);
        setError(null);

        const [detailsRes, craftsRes, equipRes, buffsRes, statsRes, toolsRes] = await Promise.all([
          bitjitaApi.getPlayerDetails(player.entityId, forceFresh),
          bitjitaApi.getPlayerCrafts(player.entityId, forceFresh),
          bitjitaApi.getPlayerEquipment(player.entityId, forceFresh),
          bitjitaApi.getPlayerBuffs(player.entityId, forceFresh),
          bitjitaApi.getPlayerStats(player.entityId, forceFresh).catch(() => null),
          bitjitaApi.getPlayerTools(player.entityId, forceFresh).catch(() => ({ tools: [] })),
        ]);

        // Abort applying state if a newer player load has started
        if (loadRequestIdRef.current !== reqId) return;

        setPlayerDetails(detailsRes);
        setEquipment(equipRes?.equipment || []);
        setBuffs(buffsRes?.buffs || []);
        setStats(statsRes);
        setPlayerTools(toolsRes?.tools || []);

        // 1. Skill Experience Delta Tracking
        const oldExpMap = playerExpSnapshotRef.current;
        const currentExpMap = new Map<number, number>();
        const activeGainedSkillIds = new Set<number>();

        if (detailsRes?.experience && Array.isArray(detailsRes.experience)) {
          for (const exp of detailsRes.experience) {
            if (exp && exp.skill_id !== undefined && exp.quantity !== undefined) {
              currentExpMap.set(exp.skill_id, exp.quantity);
              const oldVal = oldExpMap.get(exp.skill_id);
              if (oldVal !== undefined && exp.quantity > oldVal) {
                activeGainedSkillIds.add(exp.skill_id);
              }
            }
          }
        }
        playerExpSnapshotRef.current = currentExpMap;

        // 2. Filter active (incomplete) owned crafts
        const activeCrafts = (craftsRes?.craftResults || []).filter(
          (c) => !c.completed && (c.progress ?? 0) < (c.totalActionsRequired || Infinity)
        );
        setCrafts(activeCrafts);

        // 3. Resolve player coordinates and fetch candidate shared/nearby crafts
        const activeRegionId = detailsRes?.regionId || buffsRes?.regionId;
        const rawPlayerX =
          detailsRes?.locationX ?? detailsRes?.location?.locationX ?? detailsRes?.teleportLocationX;
        const rawPlayerZ =
          detailsRes?.locationZ ?? detailsRes?.location?.locationZ ?? detailsRes?.teleportLocationZ;
        const activeCraftStationCoords =
          activeCrafts.length > 0
            ? resolveCraftCoordinates(activeCrafts[0] as unknown as Record<string, unknown>)
            : null;
        const effectivePlayerX =
          rawPlayerX !== undefined &&
          rawPlayerX !== null &&
          !isNaN(Number(rawPlayerX)) &&
          Number(rawPlayerX) !== 0
            ? Number(rawPlayerX)
            : activeCraftStationCoords?.x;
        const effectivePlayerZ =
          rawPlayerZ !== undefined &&
          rawPlayerZ !== null &&
          !isNaN(Number(rawPlayerZ)) &&
          Number(rawPlayerZ) !== 0
            ? Number(rawPlayerZ)
            : activeCraftStationCoords?.z;

        const trackedAssistedIds = new Set<string>();
        try {
          const key = `bitcraft_assisted_crafts_${player.entityId}`;
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              for (const id of parsed) {
                if (id) trackedAssistedIds.add(String(id));
              }
            }
          }
        } catch {
          // ignore
        }
        if (selectedCraftIdRef.current) {
          trackedAssistedIds.add(selectedCraftIdRef.current);
        }

        let nearList: NearbyCraftItem[] = [];
        if (activeRegionId) {
          try {
            nearList = await bitjitaApi.getNearbyActiveCrafts(
              activeRegionId,
              effectivePlayerX,
              effectivePlayerZ,
              500,
              forceFresh
            );
          } catch {
            nearList = [];
          }
        }

        if (loadRequestIdRef.current !== reqId) return;

        // Collect all discovered item/cargo metadata and merge in a single batched state update
        const collectedItems: ItemMetadata[] = [...(craftsRes?.items || [])];
        const collectedCargos: ItemMetadata[] = [...(craftsRes?.cargos || [])];

        const candidateMap = new Map<string, CraftResult>();
        for (const item of nearList) {
          if (item.craft && !candidateMap.has(item.craft.entityId)) {
            candidateMap.set(item.craft.entityId, item.craft);
          }
          if (item.itemMetadata) {
            collectedItems.push(item.itemMetadata);
          }
        }

        const missingAssistedIds = Array.from(trackedAssistedIds).filter(
          (id) => !candidateMap.has(id) && !activeCrafts.some((c) => c.entityId === id)
        );
        if (missingAssistedIds.length > 0) {
          const assistedResponses = await Promise.all(
            missingAssistedIds.map((assistedId) =>
              bitjitaApi.getCraft(assistedId, forceFresh).catch(() => null)
            )
          );
          if (loadRequestIdRef.current !== reqId) return;
          for (const res of assistedResponses) {
            if (res?.craft) {
              candidateMap.set(res.craft.entityId, res.craft);
              if (res.items) collectedItems.push(...res.items);
              if (res.cargos) collectedCargos.push(...res.cargos);
            }
          }
        }

        mergeItemMetadata(collectedItems, collectedCargos);

        // 4. Build enhanced nearby list first so we know which nearby stations the player actually helps on
        const verifiedHelperCraftIds = new Set<string>();
        if (nearList.length > 0) {
          const enhancedNearby = await Promise.all(
            nearList.slice(0, 8).map(async (item): Promise<NearbyCraftItem> => {
              let isHelper = false;
              try {
                const cbs = await bitjitaApi.getCraftContributions(item.craft.entityId);
                isHelper = cbs.some(
                  (cb) =>
                    (cb.contributorEntityId === player.entityId ||
                      cb.contributorUsername?.toLowerCase() === player.username.toLowerCase()) &&
                    (cb.contributionCount > 0 || cb.totalProgressContributed > 0)
                );
              } catch {
                // ignore
              }
              if (isHelper) {
                verifiedHelperCraftIds.add(item.craft.entityId);
              }
              return { ...item, isHelper };
            })
          );

          if (loadRequestIdRef.current !== reqId) return;

          enhancedNearby.sort((a, b) => {
            if (a.isHelper && !b.isHelper) return -1;
            if (!a.isHelper && b.isHelper) return 1;
            return a.distanceMeters - b.distanceMeters;
          });

          setNearbyCrafts(enhancedNearby);
        } else {
          setNearbyCrafts([]);
        }

        // 5. Resolve active craft selection (only auto-fallback to verified helper crafts)
        const resolution = resolveActiveCraftSelection({
          currentTargetCraftId: selectedCraftIdRef.current,
          activeGainedSkillIds,
          ownedActiveCrafts: activeCrafts,
          candidateSharedCrafts: Array.from(candidateMap.values()),
          verifiedHelperCraftIds,
          playerEntityId: player.entityId,
          playerUsername: player.username,
        });

        selectedCraftIdRef.current = resolution.selectedCraftId;
        setSelectedCraftIndex(resolution.selectedCraftIndex);
        setCustomCraft(resolution.customCraft);

        if (resolution.selectedCraftId) {
          void fetchCraftContributions(
            resolution.selectedCraftId,
            player.entityId,
            player.username,
            forceFresh
          );
        } else {
          setContributions([]);
          setContributorPayloads([]);
        }

        setLastUpdated(new Date());
        saveRecentPlayer(player);
      } catch (err) {
        if (loadRequestIdRef.current !== reqId) return;
        console.error('Failed to load player data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load player details.');
      } finally {
        if (loadRequestIdRef.current === reqId) {
          setIsLoading(false);
        }
      }
    },
    [fetchCraftContributions, mergeItemMetadata, saveRecentPlayer]
  );

  // Initial load for the pre-selected primary or most recent player
  useEffect(() => {
    const initial = primaryPlayer ?? recentPlayers[0] ?? null;
    if (!initial) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void loadPlayerData(initial);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Single authoritative polling timer
  useEffect(() => {
    if (refreshInterval <= 0 || isPaused || !selectedPlayer) {
      return;
    }

    const intervalMs = refreshInterval * 1000;
    const timer = setInterval(() => {
      setPollAnchorAt(Date.now());
      void loadPlayerData(selectedPlayer, true);
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [refreshInterval, isPaused, selectedPlayer, loadPlayerData]);

  const nextRefreshAt =
    refreshInterval > 0 && !isPaused && selectedPlayer
      ? pollAnchorAt + refreshInterval * 1000
      : null;

  const handleSelectPlayer = useCallback(
    (player: PlayerSummary) => {
      selectedCraftIdRef.current = null;
      playerExpSnapshotRef.current = new Map();
      setCustomCraft(null);
      setSelectedCraftIndex(0);
      setCustomProgressPerAction(null);
      setIncludedContributors({});
      setSelectedPlayer(player);
      setPollAnchorAt(Date.now());
      void loadPlayerData(player);
    },
    [loadPlayerData]
  );

  // Resolve sample player names cleanly via BitJita search API before loading
  const handleSelectSamplePlayer = useCallback(
    async (username: string) => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await bitjitaApi.searchPlayers(username);
        const exactMatch =
          res.players.find((p) => p.username.toLowerCase() === username.toLowerCase()) ||
          res.players[0];
        if (!exactMatch || !exactMatch.entityId) {
          setError(`Sample player "${username}" was not found on BitJita.`);
          setIsLoading(false);
          return;
        }
        handleSelectPlayer(exactMatch);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to search for "${username}".`);
        setIsLoading(false);
      }
    },
    [handleSelectPlayer]
  );

  const handleManualRefresh = useCallback(() => {
    if (selectedPlayer) {
      setPollAnchorAt(Date.now());
      void loadPlayerData(selectedPlayer, true);
    }
  }, [selectedPlayer, loadPlayerData]);

  const handleClearCache = useCallback(() => {
    bitjitaApi.clearCache();
    fetchedMissingMetaIdsRef.current.clear();
    if (selectedPlayer) {
      void loadPlayerData(selectedPlayer, true);
    }
  }, [selectedPlayer, loadPlayerData]);

  const handleSelectCustomCraft = useCallback(
    (craft: CraftResult) => {
      const targetCraftId = craft.entityId;
      selectedCraftIdRef.current = targetCraftId;
      setCustomCraft(craft);
      setCustomProgressPerAction(null);
      setContributions([]);
      setContributorPayloads([]);

      bitjitaApi
        .getCraft(targetCraftId, true)
        .then((res) => {
          if (selectedCraftIdRef.current !== targetCraftId) return;
          if (res?.craft) {
            setCustomCraft(res.craft);
          }
          mergeItemMetadata(res?.items, res?.cargos);
        })
        .catch(() => {});

      const activePlayerId = playerDetails?.entityId || selectedPlayer?.entityId;
      const activePlayerName = playerDetails?.username || selectedPlayer?.username;
      if (activePlayerId) {
        void fetchCraftContributions(targetCraftId, activePlayerId, activePlayerName, true);
      }
    },
    [fetchCraftContributions, mergeItemMetadata, playerDetails, selectedPlayer]
  );

  const handleClearCustomCraft = useCallback(() => {
    setCustomCraft(null);
    setCustomProgressPerAction(null);
    if (crafts.length > 0 && selectedPlayer) {
      const target = crafts[0];
      selectedCraftIdRef.current = target.entityId;
      setSelectedCraftIndex(0);
      void fetchCraftContributions(target.entityId, selectedPlayer.entityId, selectedPlayer.username, false);
    } else {
      selectedCraftIdRef.current = null;
      setSelectedCraftIndex(0);
      setContributions([]);
      setContributorPayloads([]);
    }
  }, [crafts, fetchCraftContributions, selectedPlayer]);

  const handleSelectOwnedCraftIndex = useCallback(
    (idx: number) => {
      const target = crafts[idx];
      if (!target || !selectedPlayer) return;
      selectedCraftIdRef.current = target.entityId;
      setCustomCraft(null);
      setSelectedCraftIndex(idx);
      setCustomProgressPerAction(null);
      void fetchCraftContributions(target.entityId, selectedPlayer.entityId, selectedPlayer.username, false);
    },
    [crafts, fetchCraftContributions, selectedPlayer]
  );

  const handleReturnToOwnedCraft = useCallback(() => {
    if (crafts.length === 0) return;
    handleSelectOwnedCraftIndex(0);
  }, [crafts.length, handleSelectOwnedCraftIndex]);

  // Active craft & item metadata resolution
  const activeCraft = customCraft || (crafts.length > 0 ? crafts[selectedCraftIndex] : null);
  const activeCraftItemId =
    activeCraft && activeCraft.craftedItem && activeCraft.craftedItem.length > 0
      ? Number(activeCraft.craftedItem[0].item_id)
      : null;
  const activeCraftItemType = activeCraft?.craftedItem?.[0]?.item_type;
  const activeCraftMetadata = activeCraftItemId
    ? itemMetadataMap.get(activeCraftItemId) || null
    : null;

  // Fallback: fetch active craft item/cargo metadata once if not present in cache
  useEffect(() => {
    if (!activeCraftItemId || activeCraftMetadata) return;
    const fetchKey = `${activeCraftItemType || 'item'}:${activeCraftItemId}`;
    if (fetchedMissingMetaIdsRef.current.has(fetchKey)) return;
    fetchedMissingMetaIdsRef.current.add(fetchKey);

    let cancelled = false;
    const fetcher =
      activeCraftItemType === 'cargo'
        ? bitjitaApi.getCargo(activeCraftItemId)
        : bitjitaApi.getItem(activeCraftItemId);

    fetcher
      .then((meta) => {
        if (!cancelled && meta) {
          setItemMetadataMap((prev) => {
            const next = new Map(prev);
            next.set(activeCraftItemId, meta);
            return next;
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeCraftItemId, activeCraftItemType, activeCraftMetadata]);

  return {
    selectedPlayer,
    playerDetails,
    equipment,
    playerTools,
    buffs,
    stats,
    crafts,
    selectedCraftIndex,
    customCraft,
    activeCraft,
    activeCraftMetadata,
    nearbyCrafts,
    contributions,
    contributorPayloads,
    includedContributors,
    setIncludedContributors,
    customProgressPerAction,
    setCustomProgressPerAction,
    isLoading,
    error,
    isPaused,
    setIsPaused,
    lastUpdated,
    nextRefreshAt,
    handleSelectPlayer,
    handleSelectSamplePlayer,
    handleManualRefresh,
    handleClearCache,
    handleSelectCustomCraft,
    handleClearCustomCraft,
    handleSelectOwnedCraftIndex,
    handleReturnToOwnedCraft,
  };
}
