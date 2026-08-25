import React, { useState } from 'react';
import { Utensils, Shield, Gauge, Zap, AlertTriangle, ArrowDownRight } from 'lucide-react';
import { XpCalculationResult } from '../types/calculator';
import { formatTimeSeconds } from '../services/bitcraftData';

interface ModifiersPanelProps {
  calc: XpCalculationResult;
}

export const ModifiersPanel: React.FC<ModifiersPanelProps> = ({ calc }) => {
  const [activeTab, setActiveTab] = useState<'buffs' | 'equipment'>('buffs');

  const isSpeedDebuffed = calc.craftingSpeedBonusPercent < 0;

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-5 shadow-xl space-y-4">
      {/* Panel Header with Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-emerald-400" />
            <span>Modifiers & Buffs</span>
          </h3>
          <p className="text-xs text-gray-400">
            Base action duration (1.4s) modulated by equipment and food buffs/debuffs
          </p>
        </div>

        {/* Speed Multiplier & Action Duration Highlight Badge */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`border px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 ${
              isSpeedDebuffed
                ? 'bg-amber-950/70 border-amber-700/60 text-amber-300'
                : 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300'
            }`}
          >
            {isSpeedDebuffed ? (
              <ArrowDownRight className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>
              Speed: {calc.craftingSpeedBonusPercent >= 0 ? `+${calc.craftingSpeedBonusPercent}%` : `${calc.craftingSpeedBonusPercent}%`}
            </span>
            <span className="text-gray-400 font-normal">
              ({calc.secondsPerAction.toFixed(2)}s/action • {calc.effectiveActionsPerSecond.toFixed(2)} act/s)
            </span>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center bg-surface-subtle p-1 rounded-lg border border-surface-border text-xs">
            <button
              onClick={() => setActiveTab('buffs')}
              className={`px-3 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 ${
                activeTab === 'buffs'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Food & Buffs ({calc.activeBuffModifiers.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('equipment')}
              className={`px-3 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 ${
                activeTab === 'equipment'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Equipment ({calc.equipmentModifiers.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content: Food Buffs & Debuffs */}
      {activeTab === 'buffs' && (
        <div className="space-y-2">
          {calc.activeBuffModifiers.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-500 bg-surface-subtle/40 rounded-lg border border-surface-border/50">
              No active food or consumable buffs/debuffs detected for this player.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {calc.activeBuffModifiers.map((b, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex items-start justify-between gap-3 text-xs transition-colors ${
                    b.isDebuff
                      ? 'bg-red-950/30 border-red-800/60 text-red-200'
                      : b.isExpiringSoon
                      ? 'bg-amber-950/30 border-amber-800/60 text-amber-200'
                      : 'bg-surface-subtle border-surface-border text-gray-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-100 flex items-center gap-1.5">
                      <span>🍲 {b.name}</span>
                      {b.isDebuff && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-900/80 text-red-300 border border-red-700/60">
                          Speed Penalty
                        </span>
                      )}
                      {b.isExpiringSoon && (
                        <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" /> Expiring
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 text-[11px]">
                      {b.category}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1 font-mono">
                      {b.craftingSpeedBonus !== 0 && (
                        <span
                          className={`font-semibold ${
                            b.craftingSpeedBonus < 0 ? 'text-red-400' : 'text-emerald-400'
                          }`}
                        >
                          Crafting Speed:{' '}
                          {b.craftingSpeedBonus > 0
                            ? `+${(b.craftingSpeedBonus * 100).toFixed(1)}%`
                            : `${(b.craftingSpeedBonus * 100).toFixed(1)}%`}
                        </span>
                      )}
                      {b.gatheringSpeedBonus !== 0 && (
                        <span className="text-teal-400">
                          Gathering: +{(b.gatheringSpeedBonus * 100).toFixed(1)}%
                        </span>
                      )}
                      {b.staminaRegenBonus !== 0 && (
                        <span className="text-indigo-400">
                          Stamina Regen: +{(b.staminaRegenBonus * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right font-mono text-[11px] text-gray-400 shrink-0">
                    <div>{formatTimeSeconds(b.remainingSeconds)}</div>
                    <div className="text-[10px] text-gray-500">remaining</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Equipment */}
      {activeTab === 'equipment' && (
        <div className="space-y-2">
          {calc.equipmentModifiers.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-500 bg-surface-subtle/40 rounded-lg border border-surface-border/50">
              No speed-modifying equipment currently equipped.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {calc.equipmentModifiers.map((eq, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-surface-subtle border border-surface-border flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-100 flex items-center gap-1.5">
                      <span>{eq.itemName}</span>
                      <span className="text-[10px] text-gray-400">T{eq.tier}</span>
                    </div>
                    <div className="text-[11px] text-gray-400 capitalize">
                      Slot: {eq.slot.replace('_', ' ')}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
                      {eq.craftingSpeedBonus !== 0 && (
                        <span className="text-emerald-400 font-medium">
                          Crafting: +{(eq.craftingSpeedBonus * 100).toFixed(1)}%
                        </span>
                      )}
                      {eq.gatheringSpeedBonus !== 0 && (
                        <span className="text-teal-400">
                          Gathering: +{(eq.gatheringSpeedBonus * 100).toFixed(1)}%
                        </span>
                      )}
                      {eq.staminaBonus !== 0 && (
                        <span className="text-indigo-400">
                          +{eq.staminaBonus} Stamina
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-surface border border-surface-border text-gray-400">
                    {eq.rarity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
