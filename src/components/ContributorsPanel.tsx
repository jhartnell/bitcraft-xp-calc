import React, { useState, useEffect } from 'react';
import {
  Users,
  Zap,
  Star,
  Activity,
  ArrowRight,
  Sparkles,
  Timer,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import { MultiUserCraftProjection } from '../types/calculator';
import { formatTimeSeconds } from '../services/bitcraftData';

interface ContributorsPanelProps {
  projection: MultiUserCraftProjection;
  primaryEntityId?: string;
  onToggleParticipant: (entityId: string) => void;
  onInactivityTimeoutChange?: (minutes: number) => void;
  isInitiallyCollapsed?: boolean;
}

export const ContributorsPanel: React.FC<ContributorsPanelProps> = ({
  projection,
  primaryEntityId,
  onToggleParticipant,
  onInactivityTimeoutChange,
  isInitiallyCollapsed = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(isInitiallyCollapsed);

  // Sync default collapse state when switching crafts or helpers count changes
  useEffect(() => {
    setIsCollapsed(isInitiallyCollapsed);
  }, [isInitiallyCollapsed]);

  const {
    participants,
    activeParticipantsCount,
    totalContributorsCount,
    secondsProjectedSaved,
    secondsAlreadySaved,
    secondsTotalSaved,
    inactivityTimeoutMinutes,
  } = projection;

  if (!participants || participants.length === 0) {
    return null;
  }

  const isMultiplayerActive = activeParticipantsCount > 1;

  // Collapsed compact pill view (Consistent across solo and multiplayer)
  if (isCollapsed) {
    return (
      <div className="bg-surface rounded-xl border border-surface-border p-3.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-gray-200">Craft Contributors:</span>{' '}
            {isMultiplayerActive ? (
              <span className="text-gray-400">
                {activeParticipantsCount} Active / {totalContributorsCount} Total
              </span>
            ) : (
              <span className="text-gray-400">
                1 Active (Solo Craft)
              </span>
            )}
            {isMultiplayerActive && secondsTotalSaved > 0 && (
              <span className="text-emerald-400 font-mono ml-2">
                • Collaborative ETA: <strong>{projection.collaborativeEtaCompletionTime}</strong> ({formatTimeSeconds(projection.collaborativeEstimatedSecondsRemaining)})
                {secondsProjectedSaved > 0 && ` • Shaving ${formatTimeSeconds(secondsProjectedSaved)} remaining`}
                {secondsAlreadySaved > 0 && ` (${formatTimeSeconds(secondsAlreadySaved)} already saved)`}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-1.5 bg-surface-subtle hover:bg-surface-border border border-surface-border text-gray-300 hover:text-white px-3 py-1 rounded-lg transition-colors font-medium cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-emerald-400" />
          <span>Show Details</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-5 shadow-xl space-y-4 animate-in fade-in duration-200">
      {/* Panel Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-surface-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-100">
                Craft Contributors & Projections
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {isMultiplayerActive
                  ? `${activeParticipantsCount} Active / ${totalContributorsCount} Total`
                  : 'Solo Craft'}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {isMultiplayerActive
                ? 'Real-time multi-crafter speed compounding and individual expected XP shares'
                : 'Individual effort rate, gear speed bonuses, and projected craft milestones'}
            </p>
          </div>
        </div>

        {/* Header Controls: Inactivity Selector, Time Saved Pill, Collapse Toggle */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Timeout Selector */}
          {onInactivityTimeoutChange && isMultiplayerActive && (
            <div className="flex items-center gap-1.5 bg-surface-subtle border border-surface-border px-2.5 py-1 rounded-lg text-gray-300">
              <Timer className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[11px] text-gray-400">Timeout:</span>
              <select
                value={inactivityTimeoutMinutes}
                onChange={(e) => onInactivityTimeoutChange(Number(e.target.value))}
                className="bg-surface border border-surface-border text-emerald-400 font-medium rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value={1}>1 min</option>
                <option value={2}>2 mins (Default)</option>
                <option value={3}>3 mins</option>
                <option value={5}>5 mins</option>
              </select>
            </div>
          )}

          {/* Time Saved Pill */}
          {isMultiplayerActive && secondsTotalSaved > 0 && (
            <div className="flex items-center gap-2 bg-emerald-950/70 border border-emerald-700/60 px-3 py-1.5 rounded-lg font-mono text-emerald-300 shadow-md">
              <Zap className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>
                ETA: <strong>{projection.collaborativeEtaCompletionTime}</strong> ({formatTimeSeconds(projection.collaborativeEstimatedSecondsRemaining)})
              </span>
              <span className="text-emerald-400/80 font-sans font-bold">
                {secondsProjectedSaved > 0 && `• Shaving ${formatTimeSeconds(secondsProjectedSaved)} remaining`}
                {secondsAlreadySaved > 0 && ` (${formatTimeSeconds(secondsAlreadySaved)} already saved)`}!
              </span>
            </div>
          )}

          {/* Collapse Button */}
          <button
            onClick={() => setIsCollapsed(true)}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-200 bg-surface-subtle border border-surface-border px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            title="Collapse contributors section"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hide</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Collaborative Summary Stat Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        <div className="bg-surface-subtle p-3 rounded-lg border border-surface-border">
          <div className="text-gray-400 text-[11px] mb-0.5">
            {isMultiplayerActive ? 'Combined Effort Rate' : 'Player Effort Rate'}
          </div>
          <div className="text-base font-bold text-emerald-400">
            {projection.combinedEffortPerSecond.toFixed(1)} effort / sec
          </div>
          <div className="text-[10px] text-gray-500 font-sans mt-0.5">
            {isMultiplayerActive
              ? `Across ${activeParticipantsCount} active crafting participants`
              : 'Solo crafting pace'}
          </div>
        </div>

        <div className="bg-surface-subtle p-3 rounded-lg border border-surface-border">
          <div className="text-gray-400 text-[11px] mb-0.5">
            {isMultiplayerActive ? 'Solo vs Collaborative Time' : 'Estimated Time Remaining'}
          </div>
          <div className="text-base font-bold text-gray-200 flex items-center gap-1.5">
            {isMultiplayerActive ? (
              <>
                <span className="text-gray-400 line-through text-xs">
                  {formatTimeSeconds(projection.soloEstimatedSecondsRemaining)}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-bold">
                  {formatTimeSeconds(projection.collaborativeEstimatedSecondsRemaining)}
                </span>
              </>
            ) : (
              <span className="text-emerald-300 font-bold">
                {formatTimeSeconds(projection.soloEstimatedSecondsRemaining)}
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-400 font-sans mt-0.5">
            {isMultiplayerActive ? 'Accelerated with helpers' : 'Standard in-game duration'}
          </div>
        </div>

        <div className="bg-surface-subtle p-3 rounded-lg border border-surface-border">
          <div className="text-gray-400 text-[11px] mb-0.5">Team Time Savings</div>
          <div className="text-base font-bold text-teal-300">
            {secondsProjectedSaved > 0
              ? `${formatTimeSeconds(secondsProjectedSaved)} Faster Remaining`
              : secondsAlreadySaved > 0
              ? `${formatTimeSeconds(secondsAlreadySaved)} Already Saved`
              : '0s (Solo)'}
          </div>
          <div className="text-[10px] text-gray-400 font-sans mt-1 space-y-0.5">
            {secondsAlreadySaved > 0 && (
              <div>
                ⚡ Already Saved (Completed):{' '}
                <strong className="text-emerald-400 font-mono">
                  {formatTimeSeconds(secondsAlreadySaved)}
                </strong>
              </div>
            )}
            {secondsTotalSaved > 0 && (
              <div>
                🏆 Total Craft Savings:{' '}
                <strong className="text-teal-300 font-mono">
                  {formatTimeSeconds(secondsTotalSaved)}
                </strong>
              </div>
            )}
            {secondsProjectedSaved <= 0 && secondsAlreadySaved <= 0 && (
              <div>{isMultiplayerActive ? 'No remaining acceleration' : 'Waiting for helpers to join'}</div>
            )}
          </div>
        </div>
      </div>

      {/* Contributors Table / Cards */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-300 flex items-center justify-between">
          <span>Active & Historical Crafters ({participants.length})</span>
          <span className="text-[11px] text-gray-500 font-normal">
            {isMultiplayerActive
              ? `Auto-drops after ${inactivityTimeoutMinutes}m of inactivity • Check/uncheck to override`
              : 'Currently solo on this craft'}
          </span>
        </div>

        <div className="divide-y divide-surface-border/60 border border-surface-border rounded-xl overflow-hidden bg-surface-subtle/40">
          {participants.map((p) => {
            const isPrimary = p.entityId === primaryEntityId;

            return (
              <div
                key={p.entityId}
                className={`p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition-colors ${
                  p.isIncludedInProjection
                    ? p.isCurrentlyCrafting
                      ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                      : 'hover:bg-surface-subtle'
                    : 'opacity-60 bg-surface/40'
                }`}
              >
                {/* Left: Player ID, Star, and Status Badges */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={p.isIncludedInProjection}
                    onChange={() => onToggleParticipant(p.entityId)}
                    className="mt-1 w-4 h-4 rounded border-surface-border text-emerald-600 focus:ring-emerald-500 bg-surface cursor-pointer"
                    title="Include in collaborative ETA and remaining XP projection"
                  />

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-100 flex items-center gap-1">
                        {isPrimary && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                        {p.username}
                      </span>

                      {/* Crafting Activity Badge */}
                      {p.isCurrentlyCrafting ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          <Activity className="w-3 h-3 animate-pulse text-emerald-400" />
                          Crafting Now
                        </span>
                      ) : p.isActive ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-mono">
                          Active {p.secondsUntilInactive > 0 ? `(Drops in ${p.secondsUntilInactive}s)` : ''}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                          Idle / Left ({p.minutesSinceLastContribution < 999 ? `${p.minutesSinceLastContribution.toFixed(1)}m ago` : 'Past'})
                        </span>
                      )}

                      {p.isOnline ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" title="Player is currently online in BitCraft" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-gray-500" title="Offline" />
                      )}
                    </div>

                    {/* Minimal Tool, Speed, & Buff Details */}
                    <div className="text-[11px] text-gray-400 flex flex-wrap items-center gap-2 font-mono">
                      {p.equippedToolName ? (
                        <span className="text-gray-300">
                          🛠️ {p.equippedToolName} {p.equippedToolTier ? `(T${p.equippedToolTier})` : ''}
                        </span>
                      ) : (
                        <span className="text-gray-400">Tool Power T1+</span>
                      )}
                      <span>•</span>
                      <span className={p.craftingSpeedBonusPercent < 0 ? 'text-red-400' : 'text-emerald-400'}>
                        Speed: {p.craftingSpeedBonusPercent >= 0 ? `+${p.craftingSpeedBonusPercent}%` : `${p.craftingSpeedBonusPercent}%`} ({p.secondsPerAction.toFixed(2)}s/act)
                      </span>
                      <span>•</span>
                      <span className="text-indigo-300">
                        {p.progressPerAction.toFixed(1)} effort/click ({p.effortPerSecond.toFixed(1)} eff/s)
                      </span>
                      {p.xpMultiplier > 1 && (
                        <>
                          <span>•</span>
                          <span className="text-amber-400">{p.xpMultiplier.toFixed(2)}x XP</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: XP Contribution and Projection Metrics */}
                <div className="flex flex-wrap items-center gap-4 text-right font-mono text-xs">
                  {/* Historical Earned */}
                  <div className="space-y-0.5">
                    <div className="text-[10px] text-gray-500">Already Contributed</div>
                    <div className="font-semibold text-gray-200">
                      {p.totalProgressContributed.toLocaleString()} effort
                    </div>
                    <div className="text-[10px] text-indigo-400">
                      {p.earnedXp.toLocaleString()} XP earned
                    </div>
                  </div>

                  {/* Projected Remaining Share */}
                  {p.isIncludedInProjection ? (
                    <div className="space-y-0.5 pl-3 border-l border-surface-border">
                      <div className="text-[10px] text-emerald-400 flex items-center justify-end gap-1 font-semibold">
                        <Sparkles className="w-3 h-3" />
                        Projected Share ({p.projectedSharePercent}%)
                      </div>
                      <div className="font-bold text-amber-400">
                        +{p.projectedRemainingXp.toLocaleString()} XP remaining
                      </div>
                      <div className="text-[10px] text-emerald-300">
                        Total: <strong>{p.totalExpectedXp.toLocaleString()} XP</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-0.5 pl-3 border-l border-surface-border text-gray-500 text-[11px]">
                      <div>Excluded from ETA</div>
                      <div>Total: {p.earnedXp.toLocaleString()} XP</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
