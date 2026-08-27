import React, { useState } from 'react';
import {
  Award,
  Zap,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
  Milestone,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { XpCalculationResult } from '../types/calculator';
import { formatXp, formatTimeSeconds } from '../services/bitcraftData';
import { LiveRateGraphPopover } from './LiveRateGraphPopover';

interface XpProjectionsProps {
  calc: XpCalculationResult;
  onResetSession?: () => void;
}

export const XpProjections: React.FC<XpProjectionsProps> = ({ calc, onResetSession }) => {
  const [isMilestonesExpanded, setIsMilestonesExpanded] = useState(false);
  const { levelForecast } = calc;

  return (
    <div className="space-y-4">
      {/* 5 Clean Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Craft XP */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-md">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Total Craft XP</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-gray-100 font-mono">
            {calc.totalCraftXp.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-400/90 mt-1 flex items-center gap-1 font-medium">
            <span>{calc.baseXpPerAction.toFixed(2)} Base XP/eff</span>
            {calc.xpMultiplier > 1 && (
              <span className="text-indigo-400 font-mono">({calc.xpMultiplier.toFixed(2)}x)</span>
            )}
          </div>
        </div>

        {/* Card 2: Hourly XP Rates (Dual Stack with Hover Popover) */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Hourly XP Rates</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>

          <div className="space-y-1.5 font-mono text-xs my-auto">
            {/* Theoretical Row */}
            <div className="flex items-center justify-between">
              <span className="text-amber-400 font-bold text-sm flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                {calc.xpPerHour.toLocaleString()}
              </span>
              <span className="text-[10px] text-gray-400 font-sans font-medium px-1.5 py-0.5 rounded bg-surface-subtle border border-surface-border">
                Theoretical
              </span>
            </div>

            {/* Live Session Row (Hoverable Popover Graph) */}
            <LiveRateGraphPopover
              sessionStats={calc.sessionStats}
              theoreticalXpPerHour={calc.xpPerHour}
              onResetSession={onResetSession}
            >
              <div className="flex items-center justify-between pt-1 border-t border-surface-border/50 hover:bg-surface-subtle/50 -mx-1 px-1 rounded transition-colors">
                {calc.sessionStats && !calc.sessionStats.isWarmingUp && calc.sessionStats.measuredXpPerHour !== null ? (
                  <>
                    <span className="text-indigo-300 font-bold text-sm flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                      {calc.sessionStats.measuredXpPerHour.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-indigo-300 font-sans font-medium px-1.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-700/60 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live ({calc.sessionStats.efficiencyPercent}%)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-gray-500 text-xs font-sans italic flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-gray-600" />
                      Calibrating...
                    </span>
                    <span className="text-[10px] text-gray-500 font-sans">
                      Live Session ▾
                    </span>
                  </>
                )}
              </div>
            </LiveRateGraphPopover>
          </div>
        </div>

        {/* Card 3: XP Left to Get */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-md">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>XP Left to Gain</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono">
            {calc.remainingXp.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-mono">
            {calc.remainingProgress.toLocaleString()} effort left
          </div>
        </div>

        {/* Card 4: Earned XP */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-md">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>XP Already Earned</span>
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-indigo-300 font-mono">
            {calc.earnedXp.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-mono">
            {calc.completedProgress.toLocaleString()} effort done
          </div>
        </div>

        {/* Card 5: Estimated Time Remaining */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-md col-span-2 sm:col-span-1 lg:col-span-1">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Time Remaining</span>
            <Clock className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl font-bold text-teal-300 font-mono">
            {formatTimeSeconds(calc.estimatedSecondsRemaining)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            ETA: <strong className="text-gray-200">{calc.estimatedCompletionTime || 'N/A'}</strong> ({calc.physicalActionsRemaining.toLocaleString()} acts)
          </div>
        </div>
      </div>

      {/* Level Progression Card (Defaults to clean compact view; expands on click) */}
      <div className="bg-surface rounded-xl p-5 border border-surface-border shadow-xl space-y-4">
        {/* Card Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-900 to-purple-900 border border-indigo-500/40 flex items-center justify-center text-xl shadow-lg">
              📈
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-100">
                  {calc.skillName} Level Projection
                </h3>
                {calc.levelsGained > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    +{calc.levelsGained} {calc.levelsGained === 1 ? 'Level' : 'Levels'}!
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Current skill experience vs projected completion outcome
              </p>
            </div>
          </div>

          {/* Right Controls: Clickable Next Level Button & Transition Pill */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Interactive Next Level Button */}
            {levelForecast && levelForecast.isNextLevelAchievable && (
              <button
                onClick={() => setIsMilestonesExpanded(!isMilestonesExpanded)}
                className="flex items-center gap-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 hover:border-indigo-500 px-3 py-1.5 rounded-lg text-xs font-mono text-indigo-200 transition-all cursor-pointer shadow-sm group"
                title="Click to toggle detailed level milestone breakdown"
              >
                <Milestone className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-300" />
                <span>Level {levelForecast.targetNextLevel} in </span>
                <strong className="text-emerald-400 font-bold">
                  {formatTimeSeconds(levelForecast.secondsToNextLevel || 0)}
                </strong>
                <span className="text-gray-400 text-[10px] hidden md:inline">
                  ({levelForecast.nextLevelEtaTimestamp})
                </span>
                {isMilestonesExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-200 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-200 ml-0.5" />
                )}
              </button>
            )}

            {/* Level Transition Pill */}
            <div className="flex items-center gap-2 bg-surface-subtle px-3 py-1.5 rounded-lg border border-surface-border text-sm font-mono font-bold">
              <span className="text-gray-300">Lvl {calc.currentSkillLevel}</span>
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400">Lvl {calc.projectedSkillLevel}</span>
            </div>
          </div>
        </div>

        {/* Detailed XP Progress Bars */}
        <div className="space-y-3 pt-2">
          {/* Current Level Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Current Level {calc.currentSkillLevel} Progress:</span>
              <span className="text-gray-200 font-mono">
                {formatXp(calc.currentSkillXp)} / {formatXp(calc.xpForNextLevel)} ({calc.currentLevelProgressPct.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-surface-subtle rounded-full h-2.5 overflow-hidden border border-surface-border">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1, calc.currentLevelProgressPct)}%` }}
              />
            </div>
          </div>

          {/* Projected Total Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-400 font-medium">After Craft Completion:</span>
              <span className="text-emerald-300 font-mono font-bold">
                {formatXp(calc.projectedSkillXp)} XP (Lvl {calc.projectedSkillLevel})
              </span>
            </div>
            <div className="w-full bg-surface-subtle rounded-full h-2.5 overflow-hidden border border-surface-border">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(1, calc.projectedLevelProgressPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* EXPANDED MILESTONE SECTION (Visible when clicked) */}
        {isMilestonesExpanded && levelForecast && (
          <div className="pt-3 border-t border-surface-border space-y-3 animate-in fade-in duration-200">
            {/* Detailed Next Level Banner */}
            <div className="bg-gradient-to-r from-indigo-950/70 via-purple-950/40 to-surface-subtle border border-indigo-700/50 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 mt-0.5">
                  <Milestone className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                      Next Level Milestone
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded font-bold font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/40">
                      Level {levelForecast.targetNextLevel}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-gray-100 flex flex-wrap items-center gap-2">
                    <span>Reaching Level {levelForecast.targetNextLevel} in</span>
                    <span className="text-emerald-400 font-mono text-base font-bold">
                      {formatTimeSeconds(levelForecast.secondsToNextLevel || 0)}
                    </span>
                    <span className="text-gray-400 font-normal text-xs flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      (at {levelForecast.nextLevelEtaTimestamp})
                    </span>
                  </div>

                  <div className="text-xs text-gray-400 font-mono">
                    🎯 Occurs at {levelForecast.craftProgressPercentAtNextLevel?.toFixed(1)}% craft progress
                  </div>
                </div>
              </div>

              {/* XP Remaining to Milestone */}
              <div className="text-right font-mono text-xs pl-4 border-l border-surface-border md:border-l-indigo-800/60 shrink-0">
                <div className="text-[10px] text-gray-400">XP to Level {levelForecast.targetNextLevel}</div>
                <div className="text-sm font-bold text-indigo-300">
                  {levelForecast.xpNeededForNextLevel.toLocaleString()} XP
                </div>
                <div className="text-[10px] text-gray-500">
                  {Math.ceil(levelForecast.xpNeededForNextLevel / (calc.progressPerAction * calc.baseXpPerAction * calc.xpMultiplier)).toLocaleString()} clicks away
                </div>
              </div>
            </div>

            {/* Multi-Level Milestone Roadmap (Rendered when gaining 2+ levels) */}
            {levelForecast.totalLevelsGained >= 2 && levelForecast.milestones.length > 1 && (
              <div className="bg-surface-subtle p-3.5 rounded-xl border border-surface-border space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Multi-Level Milestone Roadmap (+{levelForecast.totalLevelsGained} Levels This Craft)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                  {levelForecast.milestones.map((m) => {
                    const isFinal = m.level === levelForecast.projectedFinalLevel;

                    return (
                      <div
                        key={m.level}
                        className={`p-3 rounded-lg border text-xs font-mono space-y-1.5 transition-all ${
                          isFinal
                            ? 'bg-emerald-950/40 border-emerald-600/60 shadow-sm'
                            : 'bg-surface border-surface-border'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-100 flex items-center gap-1">
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${
                                isFinal ? 'text-emerald-400' : 'text-indigo-400'
                              }`}
                            />
                            Level {m.level} {isFinal && '(Final)'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-sans">
                            {m.craftProgressPercentAtMilestone.toFixed(0)}% craft
                          </span>
                        </div>

                        <div className="text-emerald-300 font-bold text-sm">
                          in {formatTimeSeconds(m.estimatedSecondsFromNow)}
                        </div>

                        <div className="text-[11px] text-gray-400 flex items-center justify-between">
                          <span>{m.estimatedTimestamp}</span>
                          <span className="text-indigo-300 font-sans">+{m.xpNeededFromCurrent.toLocaleString()} XP</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
