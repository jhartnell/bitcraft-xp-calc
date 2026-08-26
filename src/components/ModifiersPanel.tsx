import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Shield,
  Gauge,
  Zap,
  AlertTriangle,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import { XpCalculationResult } from '../types/calculator';
import { formatTimeSeconds } from '../services/bitcraftData';

interface ModifiersPanelProps {
  calc: XpCalculationResult;
  isInitiallyCollapsed?: boolean;
}

export const ModifiersPanel: React.FC<ModifiersPanelProps> = ({
  calc,
  isInitiallyCollapsed = false,
}) => {
  const [activeTab, setActiveTab] = useState<'buffs' | 'equipment'>('buffs');
  const [isCollapsed, setIsCollapsed] = useState(isInitiallyCollapsed);

  useEffect(() => {
    setIsCollapsed(isInitiallyCollapsed);
  }, [isInitiallyCollapsed]);

  const isSpeedDebuffed = calc.craftingSpeedBonusPercent < 0;
  const activeBuffsCount = calc.activeBuffModifiers.length;
  const equipCount = calc.equipmentModifiers.length;

  // Collapsed Minimal View
  if (isCollapsed) {
    return (
      <div className="bg-surface rounded-xl border border-surface-border p-3.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-surface-subtle border border-surface-border text-emerald-400">
            <Gauge className="w-4 h-4" />
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono">
            <span className="font-semibold text-gray-200 font-sans">Modifiers:</span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                isSpeedDebuffed
                  ? 'bg-amber-950/70 border-amber-700/60 text-amber-300'
                  : 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300'
              }`}
            >
              Speed: {calc.craftingSpeedBonusPercent >= 0 ? `+${calc.craftingSpeedBonusPercent}%` : `${calc.craftingSpeedBonusPercent}%`} ({calc.secondsPerAction.toFixed(2)}s/act)
            </span>
            {activeBuffsCount > 0 && (
              <span className="text-indigo-300 text-[11px] font-sans">
                • {activeBuffsCount} Active {activeBuffsCount === 1 ? 'Buff' : 'Buffs'}
              </span>
            )}
            {calc.toolStatus.equippedTool && (
              <span className="text-gray-400 text-[11px] font-sans">
                • 🛠️ {calc.toolStatus.equippedTool.name}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-1.5 bg-surface-subtle hover:bg-surface-border border border-surface-border text-gray-300 hover:text-white px-3 py-1 rounded-lg transition-colors font-medium cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-emerald-400" />
          <span>Show Modifiers</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-5 shadow-xl space-y-4 animate-in fade-in duration-200">
      {/* Panel Header with Tabs & Collapse Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
            <Gauge className="w-5 h-5 text-emerald-400" />
            <span>Modifiers & Buffs</span>
          </h3>
          <p className="text-xs text-gray-400">
            Base action duration (1.6s) modulated by equipment and food buffs/debuffs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Speed Multiplier & Action Duration Highlight Badge */}
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
              className={`px-3 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'buffs'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Utensils className="w-3.5 h-3.5" />
              <span>Food & Potions ({activeBuffsCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('equipment')}
              className={`px-3 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'equipment'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Equipment ({equipCount})</span>
            </button>
          </div>

          {/* Collapse Button */}
          <button
            onClick={() => setIsCollapsed(true)}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-200 bg-surface-subtle border border-surface-border px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs"
            title="Collapse Modifiers section"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hide</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab Content: Active Food & Potion Buffs */}
      {activeTab === 'buffs' && (
        <div className="space-y-3">
          {calc.activeBuffModifiers.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500 bg-surface-subtle/30 rounded-lg border border-surface-border/40">
              No active food or potion buffs detected for this character.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {calc.activeBuffModifiers.map((buff, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                    buff.isDebuff
                      ? 'bg-red-950/40 border-red-800/60 text-red-200'
                      : buff.isExpiringSoon
                      ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                      : 'bg-surface-subtle border-surface-border text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="truncate">{buff.name}</span>
                    {buff.isDebuff && (
                      <span className="flex items-center gap-1 text-[10px] text-red-400 font-normal">
                        <AlertTriangle className="w-3 h-3" /> Debuff
                      </span>
                    )}
                  </div>

                  <div className="font-mono text-[11px] space-y-0.5">
                    {buff.craftingSpeedBonus !== 0 && (
                      <div className={buff.craftingSpeedBonus < 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                        Crafting Speed: {buff.craftingSpeedBonus > 0 ? '+' : ''}
                        {(buff.craftingSpeedBonus * 100).toFixed(1)}%
                      </div>
                    )}
                    {buff.staminaRegenBonus !== 0 && (
                      <div className="text-blue-300">
                        Stamina Regen: +{(buff.staminaRegenBonus * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>

                  {buff.remainingSeconds > 0 && (
                    <div className="text-[10px] text-gray-400 font-mono pt-0.5 border-t border-surface-border/40 flex justify-between">
                      <span>Expires in:</span>
                      <span className={buff.isExpiringSoon ? 'text-amber-400 font-bold' : 'text-gray-300'}>
                        {formatTimeSeconds(buff.remainingSeconds)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Equipment Modifiers */}
      {activeTab === 'equipment' && (
        <div className="space-y-3">
          {calc.equipmentModifiers.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500 bg-surface-subtle/30 rounded-lg border border-surface-border/40">
              No equipment modifiers detected for current gear slots.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {calc.equipmentModifiers.map((equip, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-surface-subtle rounded-lg border border-surface-border text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-gray-200 truncate">{equip.itemName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-surface-border text-gray-400 uppercase">
                      {equip.slot.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="font-mono text-[11px] space-y-0.5">
                    {equip.craftingSpeedBonus !== 0 && (
                      <div className="text-emerald-400">
                        Crafting Speed: +{(equip.craftingSpeedBonus * 100).toFixed(1)}%
                      </div>
                    )}
                    {equip.staminaBonus !== 0 && (
                      <div className="text-blue-300">
                        Stamina: +{equip.staminaBonus}
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-gray-500 pt-0.5 border-t border-surface-border/40">
                    Tier {equip.tier} • {equip.rarity}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
