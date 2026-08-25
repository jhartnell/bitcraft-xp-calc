import React, { useState, useEffect, useCallback } from 'react';
import {
  PlayerSummary,
  PlayerDetails,
  CraftResult,
  EquipmentSlot,
  PlayerBuff,
  PlayerStatsData,
  ItemMetadata,
} from './types/api';
import { ApiClientStatus } from './types/calculator';
import { bitjitaApi } from './services/apiClient';
import { calculateCraftXp, calculateMultiUserCraftProjection } from './services/xpCalculator';
import { Header } from './components/Header';
import { PlayerSearch } from './components/PlayerSearch';
import { RefreshControls } from './components/RefreshControls';
import { ActiveCraftCard } from './components/ActiveCraftCard';
import { XpProjections } from './components/XpProjections';
import { ModifiersPanel } from './components/ModifiersPanel';
import { ContributorsPanel } from './components/ContributorsPanel';
import { SkillList } from './components/SkillList';
import { PublicCraftsModal } from './components/PublicCraftsModal';
import { Hammer, Globe, AlertCircle, Info } from 'lucide-react';

const RECENT_PLAYERS_KEY = 'bitcraft_xp_recent_players';
const REFRESH_INTERVAL_KEY = 'bitcraft_xp_refresh_interval';
const PRIMARY_PLAYER_KEY = 'bitcraft_primary_player';
const INACTIVITY_TIMEOUT_KEY = 'bitcraft_inactivity_timeout';

export const App: React.FC = () => {
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
  const [crafts, setCrafts] = useState<CraftResult[]>([]);
  const [selectedCraftIndex, setSelectedCraftIndex] = useState(0);
  const [equipment, setEquipment] = useState<EquipmentSlot[]>([]);
  const [buffs, setBuffs] = useState<PlayerBuff[]>([]);
  const [stats, setStats] = useState<PlayerStatsData | null>(null);
  const [itemMetadataMap, setItemMetadataMap] = useState<Map<number, ItemMetadata>>(new Map());
  const [contributions, setContributions] = useState<import('./types/api').CraftContribution[]>([]);
  const [contributorPayloads, setContributorPayloads] = useState<import('./services/xpCalculator').ContributorDetailPayload[]>([]);
  const [includedContributors, setIncludedContributors] = useState<Record<string, boolean>>({});
  const [customProgressPerAction, setCustomProgressPerAction] = useState<number | null>(null);

  // Load primary player from chrome.storage.local on extension startup
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['primaryPlayer'], (res: Record<string, any>) => {
        if (res.primaryPlayer && res.primaryPlayer.entityId) {
          const loaded = res.primaryPlayer as PlayerSummary;
          setPrimaryPlayer(loaded);
          if (!selectedPlayer) {
            handleSelectPlayer(loaded);
          }
        }
      });
    } else if (primaryPlayer && !selectedPlayer) {
      handleSelectPlayer(primaryPlayer);
    }
  }, []);

  // Toggle primary player pinning
  const togglePrimaryPlayer = (player: PlayerSummary) => {
    const isCurrentlyPrimary = primaryPlayer?.entityId === player.entityId;
    const newPrimary = isCurrentlyPrimary ? null : player;

    setPrimaryPlayer(newPrimary);

    if (newPrimary) {
      localStorage.setItem(PRIMARY_PLAYER_KEY, JSON.stringify(newPrimary));
    } else {
      localStorage.removeItem(PRIMARY_PLAYER_KEY);
    }

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'SYNC_PRIMARY_PLAYER',
        player: newPrimary,
      });
    }
  };

  // Recent Players Storage
  const [recentPlayers, setRecentPlayers] = useState<PlayerSummary[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_PLAYERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Refresh Interval (default 30s)
  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(REFRESH_INTERVAL_KEY);
      return saved !== null ? Number(saved) : 30;
    } catch {
      return 30;
    }
  });

  const [isPaused, setIsPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPublicModalOpen, setIsPublicModalOpen] = useState(false);
  const [customCraft, setCustomCraft] = useState<CraftResult | null>(null);

  // Live API status
  const [apiStatus, setApiStatus] = useState<ApiClientStatus>(bitjitaApi.status);

  useEffect(() => {
    return bitjitaApi.subscribe((newStatus) => {
      setApiStatus(newStatus);
    });
  }, []);

  // Save recents to localStorage
  const saveRecentPlayer = (player: PlayerSummary) => {
    setRecentPlayers((prev) => {
      const filtered = prev.filter((p) => p.entityId !== player.entityId);
      const updated = [player, ...filtered].slice(0, 6);
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
        const activeCrafts = (craftsRes?.craftResults || []).filter((c) => !c.completed);
        setCrafts(activeCrafts);
        setCustomCraft(null); // Reset custom selected craft on player change
        setCustomProgressPerAction(null);

        // Fetch contributions for the first active craft if exists
        if (activeCrafts.length > 0) {
          bitjitaApi
            .getCraftContributions(activeCrafts[0].entityId, forceFresh)
            .then((cb) => {
              setContributions(cb);
              loadContributorPayloads(cb, player.entityId);
            })
            .catch(() => {
              setContributions([]);
              setContributorPayloads([]);
            });
        } else {
          setContributions([]);
          setContributorPayloads([]);
        }

        // Map item metadata
        const metaMap = new Map<number, ItemMetadata>();
        if (craftsRes?.items) {
          for (const item of craftsRes.items) {
            metaMap.set(Number(item.id), item);
          }
        }
        setItemMetadataMap(metaMap);

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
            stats,
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

  const handleInactivityTimeoutChange = (minutes: number) => {
    setInactivityTimeout(minutes);
    try {
      localStorage.setItem(INACTIVITY_TIMEOUT_KEY, String(minutes));
    } catch {
      // ignore
    }
  };

  // Player Selection Handler
  const handleSelectPlayer = async (player: PlayerSummary) => {
    setSelectedPlayer(player);
    setSelectedCraftIndex(0);
    setCustomProgressPerAction(null);
    setIncludedContributors({});

    if (player && player.entityId) {
      loadPlayerData(player, false);
    }
  };

  // Manual Refresh Trigger
  const handleManualRefresh = () => {
    if (selectedPlayer) {
      loadPlayerData(selectedPlayer, true);
    }
  };

  // Active craft to calculate
  const activeCraft = customCraft || (crafts.length > 0 ? crafts[selectedCraftIndex] : null);
  const activeCraftMetadata =
    activeCraft && activeCraft.craftedItem && activeCraft.craftedItem.length > 0
      ? itemMetadataMap.get(activeCraft.craftedItem[0].item_id) || null
      : null;

  // XP & Modifiers calculation result
  const calcResult = activeCraft
    ? calculateCraftXp(
        activeCraft,
        playerDetails,
        equipment,
        buffs,
        stats,
        contributions,
        customProgressPerAction
      )
    : null;

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

  return (
    <div className="min-h-screen bg-background text-gray-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation & Status */}
      <Header
        apiStatus={apiStatus}
        onClearCache={() => {
          bitjitaApi.clearCache();
          if (selectedPlayer) loadPlayerData(selectedPlayer, true);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Error Alert Banner */}
        {error && (
          <div className="bg-red-950/80 border border-red-800 rounded-xl p-4 flex items-start gap-3 text-red-200 text-sm shadow-lg">
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
                  <div className="bg-indigo-950/60 border border-indigo-700/60 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-indigo-200">
                    <span className="flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-indigo-400" />
                      Analyzing custom public craft with <strong>{selectedPlayer.username}</strong>'s stats & gear.
                    </span>
                    <button
                      onClick={() => setCustomCraft(null)}
                      className="text-indigo-400 hover:text-white underline"
                    >
                      Return to player's active craft
                    </button>
                  </div>
                )}

                {/* Craft Progress Visualizer Card */}
                <ActiveCraftCard
                  craft={activeCraft}
                  craftsList={crafts}
                  selectedIndex={selectedCraftIndex}
                  onSelectIndex={(idx) => {
                    setSelectedCraftIndex(idx);
                    setCustomProgressPerAction(null);
                    if (crafts[idx]) {
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
                />

                {/* Shared Craft Contributors & Collaborative Projections */}
                {multiUserProjection && multiUserProjection.totalContributorsCount > 0 && (
                  <ContributorsPanel
                    projection={multiUserProjection}
                    primaryEntityId={playerDetails?.entityId}
                    onToggleParticipant={handleToggleParticipant}
                    onInactivityTimeoutChange={handleInactivityTimeoutChange}
                  />
                )}

                {/* Projections & XP Calculations */}
                <XpProjections calc={calcResult} />

                {/* Modifiers (Food buffs & Equipment) */}
                <ModifiersPanel calc={calcResult} />
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
                    className="text-xs bg-surface-subtle hover:bg-emerald-950/70 hover:border-emerald-700/60 border border-surface-border text-gray-300 hover:text-emerald-300 px-3 py-1.5 rounded-lg font-medium transition-colors"
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
        onSelectCraft={(craft) => setCustomCraft(craft)}
      />

      {/* Footer */}
      <footer className="border-t border-surface-border/60 py-4 px-6 text-center text-xs text-gray-500">
        BitCraft XP Calculator • Powered by{' '}
        <a
          href="https://bitjita.com/docs/api"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:underline"
        >
          BitJita Developer API
        </a>
      </footer>
    </div>
  );
};
