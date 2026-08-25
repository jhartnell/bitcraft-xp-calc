import React from 'react';
import { Award, Zap, Clock, ArrowUpRight, TrendingUp, Sparkles } from 'lucide-react';
import { XpCalculationResult } from '../types/calculator';
import { formatXp, formatTimeSeconds } from '../services/bitcraftData';

interface XpProjectionsProps {
  calc: XpCalculationResult;
}

export const XpProjections: React.FC<XpProjectionsProps> = ({ calc }) => {
  return (
    <div className="space-y-4">
      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total XP */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-md">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Total Craft XP</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-gray-100 font-mono">
            {calc.totalCraftXp.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-400/90 mt-1 flex items-center gap-1 font-medium">
            <span>{calc.baseXpPerAction.toFixed(2)} Base XP/effort</span>
            {calc.xpMultiplier > 1 && (
              <span className="text-indigo-400 font-mono">({calc.xpMultiplier.toFixed(2)}x)</span>
            )}
          </div>
        </div>

        {/* XP Left to Get */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-md">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>XP Left to Gain</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono">
            {calc.remainingXp.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-mono">
            {calc.remainingProgress.toLocaleString()} effort remaining
          </div>
        </div>

        {/* Earned XP */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-md">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>XP Already Earned</span>
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-indigo-300 font-mono">
            {calc.earnedXp.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-mono">
            {calc.completedProgress.toLocaleString()} effort finished
          </div>
        </div>

        {/* Estimated Time Remaining */}
        <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-md">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span>Time Remaining</span>
            <Clock className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-xl font-bold text-teal-300 font-mono">
            {formatTimeSeconds(calc.estimatedSecondsRemaining)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            ETA: <strong className="text-gray-200">{calc.estimatedCompletionTime || 'N/A'}</strong> ({calc.physicalActionsRemaining.toLocaleString()} actions)
          </div>
        </div>
      </div>

      {/* Level Progression Card */}
      <div className="bg-surface rounded-xl p-5 border border-surface-border shadow-xl space-y-4">
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

          {/* Level Transition Pill */}
          <div className="flex items-center gap-2 bg-surface-subtle px-3 py-1.5 rounded-lg border border-surface-border text-sm font-mono font-bold">
            <span className="text-gray-300">Lvl {calc.currentSkillLevel}</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400">Lvl {calc.projectedSkillLevel}</span>
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
      </div>
    </div>
  );
};
