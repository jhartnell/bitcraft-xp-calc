import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { calculateCraftXp, calculateMultiUserCraftProjection } from './services/xpCalculator';
import { PROFESSION_SPEED_STAT_IDS } from './services/toolMatching';
import { isContributionByPlayer } from './services/bitcraftData';
import {
  DashboardDiagnosticsSnapshot,
  setDiagnosticsSnapshotProvider,
} from './services/diagnosticsCollector';
import { Header } from './components/Header';
import { PlayerSearch } from './components/PlayerSearch';
import { RefreshControls } from './components/RefreshControls';
import { ActiveCraftCard } from './components/ActiveCraftCard';
import { XpProjections } from './components/XpProjections';
import { ModifiersPanel } from './components/ModifiersPanel';
import { ContributorsPanel } from './components/ContributorsPanel';
import { SkillList } from './components/SkillList';
import { PublicCraftsModal } from './components/PublicCraftsModal';
import { DiagnosticsModal } from './components/DiagnosticsModal';
import { Footer } from './components/Footer';
import { UpdateNotificationToast } from './components/UpdateNotificationToast';
import { useVersionUpdateChecker } from './hooks/useVersionUpdateChecker';
import { useSessionXpTracker } from './hooks/useSessionXpTracker';
import { useSkillOverrides } from './hooks/useSkillOverrides';
import { usePersistentPreferences } from './hooks/usePersistentPreferences';
import { usePlayerDashboardData } from './hooks/usePlayerDashboardData';
import { Hammer, AlertCircle, Info, MapPin, Star, Globe } from 'lucide-react';

const SAMPLE_PLAYER_NAMES = ['wiz', 'DOOM', 'Ameger', 'Hydrivett', 'Socrates'];

export const App: React.FC = () => {
  const [isPublicModalOpen, setIsPublicModalOpen] = useState(false);
  const [isDiagnosticsModalOpen, setIsDiagnosticsModalOpen] = useState(false);

  // Update Notification Checker
  const {
    hasUpdate,
    currentVersion,
    latestVersion,
    reload: handleReloadUpdate,
    dismiss: handleDismissUpdate,
  } = useVersionUpdateChecker();

  // Persistent user preferences & Chrome Extension primary player sync
  const {
    primaryPlayer,
    togglePrimaryPlayer,
    inactivityTimeout,
    handleInactivityTimeoutChange,
    refreshInterval,
    handleIntervalChange,
    recentPlayers,
    saveRecentPlayer,
    removeRecentPlayer,
    foodBuffOverride,
    handleSetFoodBuffOverride,
  } = usePersistentPreferences();

  // Live player, craft, nearby station, and contributor data orchestration
  const {
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
  } = usePlayerDashboardData({
    primaryPlayer,
    recentPlayers,
    refreshInterval,
    saveRecentPlayer,
  });

  // Persistent user skill level overrides
  const {
    overrides: skillOverrides,
    setSkillLevel,
    clearSkillOverride,
  } = useSkillOverrides(selectedPlayer?.entityId || playerDetails?.entityId);

  // Memoized XP & Modifiers calculation result
  const baseCalcResult = useMemo(() => {
    if (!activeCraft) return null;
    return calculateCraftXp(
      activeCraft,
      playerDetails,
      equipment,
      buffs,
      stats,
      contributions,
      customProgressPerAction,
      null,
      foodBuffOverride,
      playerTools,
      skillOverrides
    );
  }, [
    activeCraft,
    playerDetails,
    equipment,
    buffs,
    stats,
    contributions,
    customProgressPerAction,
    foodBuffOverride,
    playerTools,
    skillOverrides,
  ]);

  // Live Session XP Tracker (isolating personal progress from other helpers)
  const activeUserContrib = useMemo(
    () =>
      contributions.find(
        (c) =>
          isContributionByPlayer(c, selectedPlayer?.entityId, selectedPlayer?.username) &&
          c.totalProgressContributed > 0
      ),
    [contributions, selectedPlayer?.entityId, selectedPlayer?.username]
  );

  const isActiveCraftHelper = Boolean(customCraft && activeUserContrib);

  // Never attribute other players' progress on a previewed public craft to this character's live session XP
  const trackedPlayerProgress = activeUserContrib
    ? activeUserContrib.totalProgressContributed
    : customCraft
      ? undefined
      : baseCalcResult?.completedProgress;

  const { sessionStats, resetSession } = useSessionXpTracker(
    selectedPlayer?.entityId,
    baseCalcResult?.skillId,
    activeCraft?.entityId,
    trackedPlayerProgress,
    baseCalcResult?.effectiveXpPerAction,
    baseCalcResult?.xpPerHour
  );

  const calcResult = useMemo(() => {
    if (!baseCalcResult) return null;
    return {
      ...baseCalcResult,
      sessionStats,
    };
  }, [baseCalcResult, sessionStats]);

  // Memoized Multi-User Collaborative Crafting Projection
  const multiUserProjection = useMemo(() => {
    if (!activeCraft || !calcResult || (contributorPayloads.length === 0 && contributions.length === 0)) {
      return null;
    }
    const payloads =
      contributorPayloads.length > 0
        ? contributorPayloads.map((cp) => ({
            ...cp,
            isIncluded: includedContributors[cp.contribution.contributorEntityId],
          }))
        : contributions.map((cb) => ({
            contribution: cb,
            isIncluded: includedContributors[cb.contributorEntityId],
          }));

    return calculateMultiUserCraftProjection(
      activeCraft,
      playerDetails,
      calcResult,
      payloads,
      inactivityTimeout
    );
  }, [
    activeCraft,
    playerDetails,
    calcResult,
    contributorPayloads,
    contributions,
    includedContributors,
    inactivityTimeout,
  ]);

  const handleToggleParticipant = useCallback(
    (entityId: string) => {
      setIncludedContributors((prev) => {
        const current = prev[entityId];
        const participant = multiUserProjection?.participants.find((p) => p.entityId === entityId);
        const defaultState = participant ? participant.isActive : true;
        const nextVal = current !== undefined ? !current : !defaultState;
        return { ...prev, [entityId]: nextVal };
      });
    },
    [multiUserProjection?.participants, setIncludedContributors]
  );

  const otherContributorsCount = multiUserProjection
    ? multiUserProjection.participants.filter(
        (p) => p.entityId !== selectedPlayer?.entityId && p.entityId !== playerDetails?.entityId
      ).length
    : 0;

  // Keep a live sanitized snapshot available for DiagnosticsModal & ErrorBoundary
  const diagnosticsSnapshotRef = useRef<DashboardDiagnosticsSnapshot | null>(null);
  useEffect(() => {
    diagnosticsSnapshotRef.current = {
      selectedPlayer: selectedPlayer
        ? {
            entityId: selectedPlayer.entityId,
            username: selectedPlayer.username,
            regionId: playerDetails?.regionId,
            locationX: playerDetails?.locationX ?? playerDetails?.location?.locationX,
            locationZ: playerDetails?.locationZ ?? playerDetails?.location?.locationZ,
          }
        : null,
      polling: {
        refreshIntervalSeconds: refreshInterval,
        isPaused,
        isLoading,
        lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
        error,
      },
      crafts: {
        ownedActiveCount: crafts.length,
        selectedCraftIndex,
        nearbyCount: nearbyCrafts.length,
        hasCustomCraft: Boolean(customCraft),
        isActiveCraftHelper,
        activeCraft: activeCraft
          ? {
              entityId: activeCraft.entityId,
              buildingName: activeCraft.buildingName,
              claimName: activeCraft.claimName,
              regionId: activeCraft.regionId,
              ownerEntityId: activeCraft.ownerEntityId,
              ownerUsername: activeCraft.ownerUsername,
              progress: activeCraft.progress,
              totalActionsRequired: activeCraft.totalActionsRequired,
              completed: activeCraft.completed,
              isPublic: activeCraft.isPublic,
              recipeId: activeCraft.recipeId,
              contributorsCount: contributions.length,
              userContribution: activeUserContrib
                ? {
                    totalProgressContributed: activeUserContrib.totalProgressContributed,
                    contributionCount: activeUserContrib.contributionCount,
                    lastContributedAt: activeUserContrib.lastContributedAt,
                  }
                : null,
            }
          : null,
      },
      calculation: calcResult
        ? {
            skillId: calcResult.skillId,
            skillName: calcResult.skillName,
            currentLevel: calcResult.currentSkillLevel,
            isLevelInferred: calcResult.isSkillLevelInferred,
            progressPerAction: calcResult.progressPerAction,
            isMeasuredProgressPerAction: calcResult.isMeasuredProgressPerAction,
            effectivePower: calcResult.toolStatus.effectivePower,
            levelPowerBonus: calcResult.toolStatus.levelPowerBonus,
            actionDurationSeconds: calcResult.secondsPerAction,
            speedBreakdown: {
              equipmentBonusPercent: calcResult.speedBreakdown.equipmentBonusPercent,
              buffBonusPercent: calcResult.speedBreakdown.buffBonusPercent,
              professionSkillBonusPercent: calcResult.speedBreakdown.professionSkillBonusPercent,
              totalMultiplier: calcResult.speedBreakdown.totalMultiplier,
            },
            serverSpeedStats: stats?.values
              ? {
                  stat15CraftingSpeed:
                    typeof stats.values[15] === 'number' ? stats.values[15] : undefined,
                  profStatId: PROFESSION_SPEED_STAT_IDS[calcResult.skillId],
                  profStatValue:
                    PROFESSION_SPEED_STAT_IDS[calcResult.skillId] !== undefined &&
                    typeof stats.values[PROFESSION_SPEED_STAT_IDS[calcResult.skillId]] === 'number'
                      ? stats.values[PROFESSION_SPEED_STAT_IDS[calcResult.skillId]]
                      : undefined,
                }
              : null,
            xpMultiplier: calcResult.xpMultiplier,
            xpPerHour: calcResult.xpPerHour,
            estimatedSecondsRemaining: calcResult.estimatedSecondsRemaining,
            hasToolMatch: calcResult.toolStatus.isEquipped,
            isToolMissing: !calcResult.toolStatus.isEquipped,
          }
        : null,
      overrides: {
        skillOverrideCount: Object.keys(skillOverrides).length,
        hasFoodBuffOverride: Boolean(foodBuffOverride),
        hasCustomProgressPerAction: customProgressPerAction !== null,
      },
    };
  }, [
    selectedPlayer,
    playerDetails,
    refreshInterval,
    isPaused,
    isLoading,
    lastUpdated,
    error,
    crafts.length,
    selectedCraftIndex,
    nearbyCrafts.length,
    customCraft,
    isActiveCraftHelper,
    activeCraft,
    activeUserContrib,
    contributions.length,
    calcResult,
    stats,
    skillOverrides,
    foodBuffOverride,
    customProgressPerAction,
  ]);

  useEffect(() => {
    setDiagnosticsSnapshotProvider(() => diagnosticsSnapshotRef.current);
    return () => {
      setDiagnosticsSnapshotProvider(null);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-gray-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation & Self-Contained API Status */}
      <Header
        onClearCache={handleClearCache}
        onOpenDiagnostics={() => setIsDiagnosticsModalOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Global Error Notice */}
        {error && (
          <div
            role="alert"
            className="bg-red-950/80 border border-red-800 text-red-200 p-4 rounded-xl flex items-start gap-3 shadow-lg animate-fade-in text-sm"
          >
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
              onTogglePause={() => setIsPaused((prev) => !prev)}
              onRefreshNow={handleManualRefresh}
              isRefreshing={isLoading}
              lastUpdated={lastUpdated}
              nextRefreshAt={nextRefreshAt}
            />
          )}
        </div>

        {/* Selected Player Dashboard View */}
        {selectedPlayer && (
          <div className="space-y-5 animate-fade-in">
            {/* Active Craft Section */}
            {activeCraft && calcResult ? (
              <div className="space-y-5">
                {customCraft && (
                  <div
                    className={`rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shadow-md border ${
                      isActiveCraftHelper
                        ? 'bg-indigo-950/60 border-indigo-700/60 text-indigo-200'
                        : 'bg-teal-950/50 border-teal-700/60 text-teal-200'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <Info
                        className={`w-4 h-4 shrink-0 ${
                          isActiveCraftHelper ? 'text-indigo-400' : 'text-teal-400'
                        }`}
                      />
                      <span className="font-semibold">
                        {isActiveCraftHelper ? 'Helping on Shared Station:' : 'Analyzing Public Craft (Not Contributing):'}
                      </span>
                      <strong>{customCraft.buildingName || 'Crafting Station'}</strong> (
                      {customCraft.claimName || `Region ${customCraft.regionId}`}) • Owner:{' '}
                      <strong>{customCraft.ownerUsername || 'Public'}</strong>
                    </span>
                    <div className="flex items-center gap-3">
                      {crafts.length > 0 ? (
                        <button
                          type="button"
                          onClick={handleReturnToOwnedCraft}
                          className="text-indigo-300 hover:text-white underline cursor-pointer"
                        >
                          Return to my owned craft
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleClearCustomCraft}
                          className="text-teal-300 hover:text-white underline cursor-pointer"
                        >
                          Exit preview
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Craft Progress Visualizer Card */}
                <ActiveCraftCard
                  craft={activeCraft}
                  craftsList={crafts}
                  selectedIndex={selectedCraftIndex}
                  selectedCraftEntityId={activeCraft.entityId}
                  isActiveCraftHelper={isActiveCraftHelper}
                  nearbyCrafts={nearbyCrafts}
                  onSelectNearbyCraft={handleSelectCustomCraft}
                  onSelectIndex={handleSelectOwnedCraftIndex}
                  calc={calcResult}
                  itemMetadata={activeCraftMetadata}
                  onOverrideProgressPerAction={(val) => setCustomProgressPerAction(val)}
                  onOpenPublicModal={() => setIsPublicModalOpen(true)}
                  onResetSession={resetSession}
                  skillOverrides={skillOverrides}
                  onSetSkillLevel={setSkillLevel}
                  onClearSkillOverride={clearSkillOverride}
                />

                {/* Craft Contributors & Projections Panel */}
                {multiUserProjection && multiUserProjection.totalContributorsCount > 0 && (
                  <ContributorsPanel
                    projection={multiUserProjection}
                    primaryEntityId={selectedPlayer?.entityId || playerDetails?.entityId}
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
                      <span>Found {nearbyCrafts.length} nearby crafting stations within 500m:</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {nearbyCrafts.map(
                        ({ craft: nCraft, distanceMeters, isHelper, itemName: nItemName, itemTier: nItemTier }) => (
                          <button
                            type="button"
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
                              📦 {nItemName || `Recipe #${nCraft.recipeId}`}{' '}
                              {nItemTier ? `(T${nItemTier})` : ''}
                            </div>
                            <div className="text-[10px] text-gray-400 flex items-center justify-between font-mono">
                              <span>{nCraft.claimName || 'Local Claim'}</span>
                              <span className="text-emerald-400 font-bold">{distanceMeters}m away</span>
                            </div>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setIsPublicModalOpen(true)}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-lg shadow-emerald-950/50 transition-colors cursor-pointer"
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
                skillOverrides={skillOverrides}
                onSetSkillLevel={setSkillLevel}
                onClearSkillOverride={clearSkillOverride}
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
                {SAMPLE_PLAYER_NAMES.map((name) => (
                  <button
                    type="button"
                    key={name}
                    onClick={() => void handleSelectSamplePlayer(name)}
                    disabled={isLoading}
                    className="text-xs bg-surface-subtle hover:bg-emerald-950/70 hover:border-emerald-700/60 border border-surface-border text-gray-300 hover:text-emerald-300 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50"
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
        onSelectCraft={handleSelectCustomCraft}
        playerId={selectedPlayer?.entityId}
        playerUsername={selectedPlayer?.username}
        playerRegionId={playerDetails?.regionId}
      />

      {/* Browser Diagnostics & Bug Report Modal */}
      <DiagnosticsModal
        isOpen={isDiagnosticsModalOpen}
        onClose={() => setIsDiagnosticsModalOpen(false)}
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
      <Footer onOpenDiagnostics={() => setIsDiagnosticsModalOpen(true)} />
    </div>
  );
};
