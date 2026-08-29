import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PlayerSummary,
  PlayerDetails,
  CraftResult,
  EquipmentSlot,
  PlayerBuff,
  PlayerStatsData,
  ItemMetadata,
} from './types/api';
import { ApiClientStatus, FoodBuffOverride } from './types/calculator';
import { bitjitaApi } from './services/apiClient';
import { calculateCraftXp, calculateMultiUserCraftProjection } from './services/xpCalculator';
import { Header } from './components/Header';
import { PlayerSearch } from './components/PlayerSearch';
import { RefreshControls } from './components/RefreshControls';
import { ActiveCraftCard, NearbyCraftItem } from './components/ActiveCraftCard';
import { XpProjections } from './components/XpProjections';
import { ModifiersPanel } from './components/ModifiersPanel';
import { ContributorsPanel } from './components/ContributorsPanel';
import { SkillList } from './components/SkillList';
import { PublicCraftsModal } from './components/PublicCraftsModal';
import { Footer } from './components/Footer';
import { UpdateNotificationToast } from './components/UpdateNotificationToast';
import { useVersionUpdateChecker } from './hooks/useVersionUpdateChecker';
import { useSessionXpTracker } from './hooks/useSessionXpTracker';
import { Hammer, AlertCircle, Info, MapPin, Star, Globe } from 'lucide-react';

const RECENT_PLAYERS_KEY = 'bitcraft_xp_recent_players';
const REFRESH_INTERVAL_KEY = 'bitcraft_xp_refresh_interval';
const PRIMARY_PLAYER_KEY = 'bitcraft_primary_player';
const INACTIVITY_TIMEOUT_KEY = 'bitcraft_inactivity_timeout';

export const App: React.FC = () => {
  // Update Notification Checker
  const {
    hasUpdate,
    currentVersion,
    latestVersion,
    reload: handleReloadUpdate,
    dismiss: handleDismissUpdate,
  } = useVersionUpdateChecker();

  // State
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSummary | null>(null);
  const [primaryPlayer, setPrimaryPlayer] = useState<PlayerSummary | null>(() => {
    try {
      const saved = localStorage.getItem(PRIMARY_PLAYER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [inactivityTimeout, setInactivityTimeout] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(INACTIVITY_TIMEOUT_KEY);
      return saved !== null ? Number(saved) : 2.0;
    } catch {
      return 2.0;
    }
  });

  const [playerDetails, setPlayerDetails] = useState<PlayerDetails | null>(null);
  const [equipment, setEquipment] = useState<EquipmentSlot[]>([]);
  const [buffs, setBuffs] = useState<PlayerBuff[]>([]);
  const [stats, setStats] = useState<PlayerStatsData | null>(null);
  const [crafts, setCrafts] = useState<CraftResult[]>([]);
  const [selectedCraftIndex, setSelectedCraftIndex] = useState<number>(0);
  const [customCraft, setCustomCraft] = useState<CraftResult | null>(null);
  const [nearbyCrafts, setNearbyCrafts] = useState<NearbyCraftItem[]>([]);
  const [contributions, setContributions] = useState<import('./types/api').CraftContribution[]>([]);
  const [contributorPayloads, setContributorPayloads] = useState<import('./services/xpCalculator').ContributorDetailPayload[]>([]);
  const [includedContributors, setIncludedContributors] = useState<Record<string, boolean>>({});
  const [itemMetadataMap, setItemMetadataMap] = useState<Map<number, ItemMetadata>>(new Map());
  const [customProgressPerAction, setCustomProgressPerAction] = useState<number | null>(null);
  
  const [foodBuffOverride, setFoodBuffOverride] = useState<FoodBuffOverride | null>(() => {
    try {
      const saved = sessionStorage.getItem('bitcraft_food_buff_override');
      if (!saved) return null;
      const parsed: FoodBuffOverride = JSON.parse(saved);
      const elapsed = (Date.now() - parsed.startedAt) / 1000;
      if (elapsed < parsed.durationSeconds) {
        return {
          ...parsed,
          remainingSeconds: Math.max(0, Math.round(parsed.durationSeconds - elapsed)),
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  const handleSetFoodBuffOverride = useCallback((override: FoodBuffOverride | null) => {
    setFoodBuffOverride(override);
    try {
      if (override) {
        sessionStorage.setItem('bitcraft_food_buff_override', JSON.stringify(override));
      } else {
        sessionStorage.removeItem('bitcraft_food_buff_override');
      }
    } catch {
      // ignore
    }
  }, []);

  // Ticking countdown effect for active food override
  useEffect(() => {
    if (!foodBuffOverride || !foodBuffOverride.enabled) return;
    const timer = setInterval(() => {
      const elapsed = (Date.now() - foodBuffOverride.startedAt) / 1000;
      if (elapsed >= foodBuffOverride.durationSeconds) {
        handleSetFoodBuffOverride(null);
      } else {
        setFoodBuffOverride((prev) =>
          prev
            ? {
                ...prev,
                remainingSeconds: Math.max(0, Math.round(prev.durationSeconds - elapsed)),
              }
            : null
        );
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [foodBuffOverride?.startedAt, foodBuffOverride?.durationSeconds, foodBuffOverride?.enabled, handleSetFoodBuffOverride]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiClientStatus>({
    lastFetchedAt: null,
    cachedEntriesCount: 0,
    isFetching: false,
    lastResponseTimeMs: null,
    rateLimitBackoffMs: 0,
    error: null,
  });

  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(REFRESH_INTERVAL_KEY);
      return saved !== null ? Number(saved) : 30;
    } catch {
      return 30;
    }
  });

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPublicModalOpen, setIsPublicModalOpen] = useState(false);
  const [recentPlayers, setRecentPlayers] = useState<PlayerSummary[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_PLAYERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const selectedCraftIdRef = useRef<string | null>(null);

  // Subscribe to live API client status (cache size, latency, fetching state)
  useEffect(() => {
    return bitjitaApi.subscribe((status) => {
      setApiStatus(status);
    });
  }, []);

  // Clear cache handler: clears in-memory network cache and immediately re-fetches fresh data
  const handleClearCache = () => {
    bitjitaApi.clearCache();
    if (selectedPlayer) {
      loadPlayerData(selectedPlayer, true);
    }
  };

  // Primary player toggle
  const togglePrimaryPlayer = (player: PlayerSummary) => {
    if (primaryPlayer?.entityId === player.entityId) {
      setPrimaryPlayer(null);
      localStorage.removeItem(PRIMARY_PLAYER_KEY);
    } else {
      setPrimaryPlayer(player);
      localStorage.setItem(PRIMARY_PLAYER_KEY, JSON.stringify(player));
    }
  };

  // Inactivity timeout setting
  const handleInactivityTimeoutChange = (minutes: number) => {
    setInactivityTimeout(minutes);
    try {
      localStorage.setItem(INACTIVITY_TIMEOUT_KEY, String(minutes));
    } catch (err) {
      console.error('Failed to save inactivity timeout:', err);
    }
  };

  // Recent players helper
  const saveRecentPlayer = (player: PlayerSummary) => {
    setRecentPlayers((prev) => {
      const filtered = prev.filter((p) => p.entityId !== player.entityId);
      const updated = [player, ...filtered].slice(0, 8);
      try {
        localStorage.setItem(RECENT_PLAYERS_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save recent players:', err);
      }
      return updated;
    });
  };

  const removeRecentPlayer = (entityId: string) => {
    setRecentPlayers((prev) => {
      const updated = prev.filter((p) => p.entityId !== entityId);
      try {
        localStorage.setItem(RECENT_PLAYERS_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to remove recent player:', err);
      }
      return updated;
    });
  };

  const handleIntervalChange = (secs: number) => {
    setRefreshInterval(secs);
    try {
      localStorage.setItem(REFRESH_INTERVAL_KEY, String(secs));
    } catch (err) {
      console.error('Failed to save refresh interval:', err);
    }
  };

  // Background loader for other contributors' gear & stats
  const loadContributorPayloads = async (
    contribs: import('./types/api').CraftContribution[],
    primaryId: string
  ) => {
    const payloads: import('./services/xpCalculator').ContributorDetailPayload[] = [];

    for (const cb of contribs) {
      if (cb.contributorEntityId === primaryId) {
        payloads.push({
          contribution: cb,
          isIncluded: includedContributors[cb.contributorEntityId],
        });
      } else {
        try {
          const [equip, buffs, stats] = await Promise.all([
            bitjitaApi.getPlayerEquipment(cb.contributorEntityId).catch(() => null),
            bitjitaApi.getPlayerBuffs(cb.contributorEntityId).catch(() => null),
            bitjitaApi.getPlayerStats(cb.contributorEntityId).catch(() => null),
          ]);

          payloads.push({
            contribution: cb,
            equipment: equip?.equipment || [],
            buffs: buffs?.buffs || [],
            stats: stats || undefined,
            isIncluded: includedContributors[cb.contributorEntityId],
          });
        } catch {
          payloads.push({
            contribution: cb,
            isIncluded: includedContributors[cb.contributorEntityId],
          });
        }
      }
    }

    setContributorPayloads(payloads);
  };

  const updateItemMetadataMap = (items?: ItemMetadata[], cargos?: ItemMetadata[]) => {
    if (!items && !cargos) return;
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
  };

  const fetchCraftContributions = async (
    craftId: string,
    playerEntityId: string,
    forceFresh = false
  ) => {
    try {
      const cb = await bitjitaApi.getCraftContributions(craftId, forceFresh);
      setContributions(cb);
      loadContributorPayloads(cb, playerEntityId);
      return cb;
    } catch {
      setContributions([]);
      setContributorPayloads([]);
      return [];
    }
  };

  const handleSelectCustomCraft = (craft: CraftResult) => {
    selectedCraftIdRef.current = craft.entityId;
    setCustomCraft(craft);
    setCustomProgressPerAction(null);
    setContributions([]);
    setContributorPayloads([]);

    // Fetch craft details to cache any item or cargo metadata and update with full craft payload
    bitjitaApi
      .getCraft(craft.entityId, true)
      .then((res) => {
        if (res?.craft) {
          setCustomCraft(res.craft);
        }
        updateItemMetadataMap(res?.items, res?.cargos);
      })
      .catch(() => {});

    if (selectedPlayer?.entityId) {
      try {
        const key = `bitcraft_assisted_crafts_${selectedPlayer.entityId}`;
        const raw = localStorage.getItem(key);
        const set = new Set<string>(raw ? JSON.parse(raw) : []);
        set.add(craft.entityId);
        localStorage.setItem(key, JSON.stringify(Array.from(set)));
      } catch {
        // ignore
      }
    }

    if (playerDetails) {
      fetchCraftContributions(craft.entityId, playerDetails.entityId, true);
    }
  };

  // Fetch full player data
  const loadPlayerData = useCallback(
    async (player: PlayerSummary, forceFresh = false) => {
      if (!player || !player.entityId) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch parallel endpoints with polite rate-limiting
        const [detailsRes, craftsRes, equipRes, buffsRes, statsRes] = await Promise.all([
          bitjitaApi.getPlayerDetails(player.entityId, forceFresh),
          bitjitaApi.getPlayerCrafts(player.entityId, forceFresh),
          bitjitaApi.getPlayerEquipment(player.entityId, forceFresh),
          bitjitaApi.getPlayerBuffs(player.entityId, forceFresh),
          bitjitaApi.getPlayerStats(player.entityId, forceFresh).catch(() => null),
        ]);

        setPlayerDetails(detailsRes);
        setEquipment(equipRes?.equipment || []);
        setBuffs(buffsRes?.buffs || []);
        setStats(statsRes);

        // Filter active (incomplete) crafts
        const activeCrafts = (craftsRes?.craftResults || []).filter(
          (c) => !c.completed && (c.progress ?? 0) < (c.totalActionsRequired || Infinity)
        );
        setCrafts(activeCrafts);

        // Preserve current craft selection or detect newly active craft
        const currentTargetCraftId = selectedCraftIdRef.current;
        let isCraftResolved = false;

        if (currentTargetCraftId) {
          const ownedIndex = activeCrafts.findIndex((c) => c.entityId === currentTargetCraftId);
          if (ownedIndex >= 0) {
            // Player is viewing an owned active craft that is still in progress
            setSelectedCraftIndex(ownedIndex);
            setCustomCraft(null);
            isCraftResolved = true;

            fetchCraftContributions(activeCrafts[ownedIndex].entityId, player.entityId, forceFresh);
          } else {
            // Check if the custom / helper craft is still ongoing
            try {
              const res = await bitjitaApi.getCraft(currentTargetCraftId, forceFresh);
              const isStillOngoing =
                Boolean(res?.craft) &&
                !res!.craft.completed &&
                res!.craft.status !== 'completed' &&
                (res!.craft.progress ?? 0) < (res!.craft.totalActionsRequired || Infinity);

              if (isStillOngoing) {
                // If player has an owned active craft, owned crafts ALWAYS take priority over custom/helper stations!
                if (activeCrafts.length > 0) {
                  selectedCraftIdRef.current = null;
                  setCustomCraft(null);
                  isCraftResolved = false;
                } else {
                  await fetchCraftContributions(currentTargetCraftId, player.entityId, forceFresh);
                  setCustomCraft(res!.craft);
                  isCraftResolved = true;
                  updateItemMetadataMap(res!.items, res!.cargos);
                }
              } else {
                // The targeted craft has completed or is no longer active! Clear it to auto-pick the new craft.
                selectedCraftIdRef.current = null;
                setCustomCraft(null);
              }
            } catch {
              selectedCraftIdRef.current = null;
              setCustomCraft(null);
            }
          }
        }

        // If the targeted craft was completed or none was selected, auto-select the active craft!
        if (!isCraftResolved) {
          if (activeCrafts.length > 0) {
            // Prioritize the craft with active lock expiration / recent activity, else first craft
            let bestIndex = 0;
            const now = Date.now();
            for (let i = 0; i < activeCrafts.length; i++) {
              const lockTime = activeCrafts[i].lockExpiration ? new Date(activeCrafts[i].lockExpiration!).getTime() : 0;
              if (lockTime > now - 60_000) {
                bestIndex = i;
                break;
              }
            }

            selectedCraftIdRef.current = activeCrafts[bestIndex].entityId;
            setSelectedCraftIndex(bestIndex);
            setCustomCraft(null);

            fetchCraftContributions(activeCrafts[bestIndex].entityId, player.entityId, forceFresh);
          } else {
            setCustomCraft(null);
            setContributions([]);
            setContributorPayloads([]);
          }
        }

        // Spatial Proximity: Find nearby stations in the player's region (< 500m)
        const activeRegionId = detailsRes?.regionId || buffsRes?.regionId;
        if (activeRegionId) {
          bitjitaApi
            .getNearbyActiveCrafts(
              activeRegionId,
              detailsRes?.locationX,
              detailsRes?.locationZ,
              500,
              forceFresh
            )
            .then(async (nearList) => {
              const enhancedNearby: NearbyCraftItem[] = [];
              for (const item of nearList.slice(0, 8)) {
                let isHelper = false;
                try {
                  const cbs = await bitjitaApi.getCraftContributions(item.craft.entityId);
                  isHelper = cbs.some(
                    (cb) =>
                      cb.contributorEntityId === player.entityId ||
                      cb.contributorUsername?.toLowerCase() === player.username.toLowerCase()
                  );
                } catch {
                  // ignore
                }
                enhancedNearby.push({ ...item, isHelper });
              }

              // Sort helper crafts first, then by distance
              enhancedNearby.sort((a, b) => {
                if (a.isHelper && !b.isHelper) return -1;
                if (!a.isHelper && b.isHelper) return 1;
                return a.distanceMeters - b.distanceMeters;
              });

              // Cache all nearby items metadata
              for (const item of nearList) {
                if (item.itemMetadata) {
                  setItemMetadataMap((prev) => {
                    const next = new Map(prev);
                    next.set(Number(item.itemMetadata!.id), item.itemMetadata!);
                    return next;
                  });
                }
              }

              setNearbyCrafts(enhancedNearby);

              // If player has NO owned active crafts and is assisting on a station, auto-switch to it!
              if (activeCrafts.length === 0 && enhancedNearby.length > 0) {
                const helperCandidate = enhancedNearby.find((n) => n.isHelper && !n.craft.completed);
                if (helperCandidate) {
                  if (selectedCraftIdRef.current !== helperCandidate.craft.entityId) {
                    handleSelectCustomCraft(helperCandidate.craft);
                  }
                }
              }
            })
            .catch(() => setNearbyCrafts([]));
        } else {
          setNearbyCrafts([]);
        }

        // Map item and cargo metadata (merge into existing cache so assisted/custom craft items are preserved)
        setItemMetadataMap((prev) => {
          const next = new Map(prev);
          if (craftsRes?.items) {
            for (const item of craftsRes.items) {
              next.set(Number(item.id), item);
            }
          }
          if (craftsRes?.cargos) {
            for (const cargo of craftsRes.cargos) {
              next.set(Number(cargo.id), cargo);
            }
          }
          return next;
        });

        setLastUpdated(new Date());
        saveRecentPlayer(player);
      } catch (err) {
        console.error('Failed to load player data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load player details.');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Initial load: pick primary player if available, else first recent player
  useEffect(() => {
    if (primaryPlayer) {
      setSelectedPlayer(primaryPlayer);
      loadPlayerData(primaryPlayer);
    } else if (recentPlayers.length > 0) {
      setSelectedPlayer(recentPlayers[0]);
      loadPlayerData(recentPlayers[0]);
    }
  }, []);

  // Polling setup
  useEffect(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (refreshInterval > 0 && !isPaused && selectedPlayer) {
      refreshTimerRef.current = setInterval(() => {
        loadPlayerData(selectedPlayer, true);
      }, refreshInterval * 1000);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [refreshInterval, isPaused, selectedPlayer, loadPlayerData]);

  const handleSelectPlayer = (player: PlayerSummary) => {
    selectedCraftIdRef.current = null;
    setCustomCraft(null);
    setSelectedCraftIndex(0);
    setSelectedPlayer(player);
    loadPlayerData(player);
  };

  const handleManualRefresh = () => {
    if (selectedPlayer) {
      loadPlayerData(selectedPlayer, true);
    }
  };

  // Active craft to calculate
  const activeCraft = customCraft || (crafts.length > 0 ? crafts[selectedCraftIndex] : null);
  const activeCraftItemId =
    activeCraft && activeCraft.craftedItem && activeCraft.craftedItem.length > 0
      ? Number(activeCraft.craftedItem[0].item_id)
      : null;
  const activeCraftItemType = activeCraft?.craftedItem?.[0]?.item_type;
  const activeCraftMetadata = activeCraftItemId ? itemMetadataMap.get(activeCraftItemId) || null : null;

  // Fallback: if active craft's item metadata is not in cache, fetch it automatically!
  useEffect(() => {
    if (activeCraftItemId && !itemMetadataMap.has(activeCraftItemId)) {
      if (activeCraftItemType === 'cargo') {
        bitjitaApi
          .getCargo(activeCraftItemId)
          .then((crg) => {
            if (crg) {
              setItemMetadataMap((prev) => {
                const next = new Map(prev);
                next.set(activeCraftItemId, crg);
                return next;
              });
            }
          })
          .catch(() => {});
      } else {
        bitjitaApi
          .getItem(activeCraftItemId)
          .then((itm) => {
            if (itm) {
              setItemMetadataMap((prev) => {
                const next = new Map(prev);
                next.set(activeCraftItemId, itm);
                return next;
              });
            }
          })
          .catch(() => {});
      }
    }
  }, [activeCraftItemId, activeCraftItemType, itemMetadataMap]);

  // XP & Modifiers calculation result
  const calcResult = activeCraft
    ? calculateCraftXp(
        activeCraft,
        playerDetails,
        equipment,
        buffs,
        stats,
        contributions,
        customProgressPerAction,
        null,
        foodBuffOverride
      )
    : null;

  // Live Session XP Tracker (Measured vs Theoretical Rate)
  // Track strictly the active player's personal progress to isolate individual rate from other helpers!
  const activeUserContrib = contributions.find(
    (c) =>
      c.contributorEntityId === selectedPlayer?.entityId ||
      c.contributorUsername?.toLowerCase() === selectedPlayer?.username.toLowerCase()
  );
  const trackedPlayerProgress = activeUserContrib
    ? activeUserContrib.totalProgressContributed
    : calcResult?.completedProgress;

  const { sessionStats, resetSession } = useSessionXpTracker(
    selectedPlayer?.entityId,
    calcResult?.skillId,
    activeCraft?.entityId,
    trackedPlayerProgress,
    calcResult?.effectiveXpPerAction,
    calcResult?.xpPerHour
  );

  if (calcResult) {
    calcResult.sessionStats = sessionStats;
  }

  // Multi-User Collaborative Crafting Projection
  const multiUserProjection =
    activeCraft && calcResult && (contributorPayloads.length > 0 || contributions.length > 0)
      ? calculateMultiUserCraftProjection(
          activeCraft,
          playerDetails,
          calcResult,
          contributorPayloads.length > 0
            ? contributorPayloads.map((cp) => ({
                ...cp,
                isIncluded: includedContributors[cp.contribution.contributorEntityId],
              }))
            : contributions.map((cb) => ({
                contribution: cb,
                isIncluded: includedContributors[cb.contributorEntityId],
              })),
          inactivityTimeout
        )
      : null;

  const handleToggleParticipant = (entityId: string) => {
    setIncludedContributors((prev) => {
      const current = prev[entityId];
      const participant = multiUserProjection?.participants.find((p) => p.entityId === entityId);
      const defaultState = participant ? participant.isActive : true;
      const nextVal = current !== undefined ? !current : !defaultState;
      return { ...prev, [entityId]: nextVal };
    });
  };

  const otherContributorsCount = multiUserProjection
    ? multiUserProjection.participants.filter(
        (p) => p.entityId !== selectedPlayer?.entityId && p.entityId !== playerDetails?.entityId
      ).length
    : 0;

  return (
    <div className="min-h-screen bg-background text-gray-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation & Status */}
      <Header apiStatus={apiStatus} onClearCache={handleClearCache} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Global Error Notice */}
        {error && (
          <div className="bg-red-950/80 border border-red-800 text-red-200 p-4 rounded-xl flex items-start gap-3 shadow-lg animate-in fade-in duration-200 text-sm">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-semibold text-red-100">BitJita API Notice:</strong> {error}
            </div>
          </div>
        )}

        {/* Player Selection & Refresh Controls Row */}
        <div className="space-y-3">
          <PlayerSearch
            selectedPlayer={selectedPlayer}
            onSelectPlayer={handleSelectPlayer}
            recentPlayers={recentPlayers}
            onRemoveRecent={removeRecentPlayer}
            isLoading={isLoading}
            primaryPlayer={primaryPlayer}
            onTogglePrimary={togglePrimaryPlayer}
          />

          {selectedPlayer && (
            <RefreshControls
              intervalSeconds={refreshInterval}
              onIntervalChange={handleIntervalChange}
              isPaused={isPaused}
              onTogglePause={() => setIsPaused(!isPaused)}
              onRefreshNow={handleManualRefresh}
              isRefreshing={isLoading}
              lastUpdated={lastUpdated}
            />
          )}
        </div>

        {/* Selected Player Dashboard View */}
        {selectedPlayer && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Active Craft Section */}
            {activeCraft && calcResult ? (
              <div className="space-y-5">
                {customCraft && (
                  <div className="bg-indigo-950/60 border border-indigo-700/60 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-indigo-200 shadow-md">
                    <span className="flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-indigo-400" />
                      Station: <strong>{customCraft.buildingName || 'Crafting Station'}</strong> ({customCraft.claimName || `Region ${customCraft.regionId}`}) • Owner: <strong>{customCraft.ownerUsername || 'Public'}</strong>
                    </span>
                    {crafts.length > 0 && (
                      <button
                        onClick={() => {
                          selectedCraftIdRef.current = crafts[0].entityId;
                          setCustomCraft(null);
                          setSelectedCraftIndex(0);
                        }}
                        className="text-indigo-300 hover:text-white underline cursor-pointer"
                      >
                        Return to my owned craft
                      </button>
                    )}
                  </div>
                )}

                {/* Craft Progress Visualizer Card */}
                <ActiveCraftCard
                  craft={activeCraft}
                  craftsList={crafts}
                  selectedIndex={selectedCraftIndex}
                  selectedCraftEntityId={activeCraft.entityId}
                  nearbyCrafts={nearbyCrafts}
                  onSelectNearbyCraft={handleSelectCustomCraft}
                  onSelectIndex={(idx) => {
                    if (crafts[idx]) {
                      selectedCraftIdRef.current = crafts[idx].entityId;
                      setCustomCraft(null);
                      setSelectedCraftIndex(idx);
                      setCustomProgressPerAction(null);
                      bitjitaApi
                        .getCraftContributions(crafts[idx].entityId)
                        .then((cb) => {
                          setContributions(cb);
                          loadContributorPayloads(cb, selectedPlayer.entityId);
                        })
                        .catch(() => {
                          setContributions([]);
                          setContributorPayloads([]);
                        });
                    }
                  }}
                  calc={calcResult}
                  itemMetadata={activeCraftMetadata}
                  onOverrideProgressPerAction={(val) => setCustomProgressPerAction(val)}
                  onOpenPublicModal={() => setIsPublicModalOpen(true)}
                  onResetSession={resetSession}
                />

                {/* Craft Contributors & Projections Panel */}
                {multiUserProjection && multiUserProjection.totalContributorsCount > 0 && (
                  <ContributorsPanel
                    projection={multiUserProjection}
                    primaryEntityId={playerDetails?.entityId}
                    onToggleParticipant={handleToggleParticipant}
                    onInactivityTimeoutChange={handleInactivityTimeoutChange}
                    isInitiallyCollapsed={otherContributorsCount === 0}
                  />
                )}

                {/* Projections & XP Calculations */}
                <XpProjections calc={calcResult} onResetSession={resetSession} />

                {/* Modifiers (Food buffs & Equipment) */}
                <ModifiersPanel
                  calc={calcResult}
                  foodBuffOverride={foodBuffOverride}
                  onSetFoodBuffOverride={handleSetFoodBuffOverride}
                />
              </div>
            ) : (
              /* No In-Progress Craft Empty State */
              <div className="bg-surface rounded-xl border border-surface-border p-8 text-center space-y-4 shadow-xl">
                <div className="w-14 h-14 rounded-2xl bg-surface-subtle border border-surface-border mx-auto flex items-center justify-center text-gray-400 text-2xl">
                  <Hammer className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-100">No Active In-Progress Craft</h3>
                  <p className="text-xs text-gray-400 max-w-md mx-auto">
                    <strong>{selectedPlayer.username}</strong> does not currently have any active crafts in progress on the server.
                  </p>
                </div>

                {/* Nearby Stations List if found */}
                {nearbyCrafts.length > 0 && (
                  <div className="pt-3 max-w-lg mx-auto space-y-2">
                    <div className="text-xs text-indigo-300 font-semibold flex items-center justify-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Found {nearbyCrafts.length} nearby crafting stations within ~100m:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {nearbyCrafts.map(({ craft: nCraft, distanceMeters, isHelper, itemName: nItemName, itemTier: nItemTier }) => (
                        <button
                          key={nCraft.entityId}
                          onClick={() => handleSelectCustomCraft(nCraft)}
                          className={`p-2.5 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                            isHelper
                              ? 'bg-indigo-950/80 border-indigo-600/80 text-indigo-200 shadow'
                              : 'bg-surface-subtle border-surface-border hover:bg-surface-border text-gray-300'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1">
                            {isHelper && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                            <span>{nCraft.buildingName || 'Station'}</span>
                          </div>
                          <div className="text-[11px] text-amber-300 font-sans">
                            📦 {nItemName || `Recipe #${nCraft.recipeId}`} {nItemTier ? `(T${nItemTier})` : ''}
                          </div>
                          <div className="text-[10px] text-gray-400 flex items-center justify-between font-mono">
                            <span>{nCraft.claimName || 'Local Claim'}</span>
                            <span className="text-emerald-400 font-bold">{distanceMeters}m away</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={() => setIsPublicModalOpen(true)}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-lg shadow-emerald-950/50 transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Browse Public Crafts to Analyze</span>
                  </button>
                </div>
              </div>
            )}

            {/* Character Skills Matrix */}
            {playerDetails && (
              <SkillList
                player={playerDetails}
                highlightSkillId={calcResult?.skillId}
              />
            )}
          </div>
        )}

        {/* Initial Welcome Screen when no player selected */}
        {!selectedPlayer && (
          <div className="py-16 text-center space-y-6 max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 mx-auto flex items-center justify-center shadow-xl shadow-emerald-950/60 border border-emerald-400/40 text-3xl">
              ⛏️
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-gray-100 tracking-tight">
                Welcome to BitCraft XP Calculator
              </h2>
              <p className="text-sm text-gray-400 leading-relaxed">
                Enter your character username above to calculate expected XP, remaining effort, equipment compatibility, and projected completion time for any active craft.
              </p>
            </div>

            {/* Quick Demo Players */}
            <div className="bg-surface rounded-xl p-4 border border-surface-border text-left space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Try with sample players:
              </div>
              <div className="flex flex-wrap gap-2">
                {['wiz', 'DOOM', 'Ameger', 'Hydrivett', 'Socrates'].map((name) => (
                  <button
                    key={name}
                    onClick={() => handleSelectPlayer({ entityId: '', username: name })}
                    className="text-xs bg-surface-subtle hover:bg-emerald-950/70 hover:border-emerald-700/60 border border-surface-border text-gray-300 hover:text-emerald-300 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer"
                  >
                    👤 {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Public Crafts Explorer Modal */}
      <PublicCraftsModal
        isOpen={isPublicModalOpen}
        onClose={() => setIsPublicModalOpen(false)}
        onSelectCraft={(craft) => handleSelectCustomCraft(craft)}
        playerId={selectedPlayer?.entityId}
        playerUsername={selectedPlayer?.username}
      />

      {/* Floating Update Notification Toast */}
      <UpdateNotificationToast
        hasUpdate={hasUpdate}
        latestVersion={latestVersion}
        currentVersion={currentVersion}
        onReload={handleReloadUpdate}
        onDismiss={handleDismissUpdate}
      />

      {/* Embedded App Version & Footer */}
      <Footer />
    </div>
  );
};
