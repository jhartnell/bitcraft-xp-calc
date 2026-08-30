import React, { useState, useEffect } from 'react';
import {
  Utensils,
  Shield,
  Gauge,
  AlertTriangle,
  X,
  Sparkles,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { XpCalculationResult, FoodBuffOverride } from '../types/calculator';
import { formatTimeSeconds } from '../services/bitcraftData';
import { SpeedBreakdownPopover } from './SpeedBreakdownPopover';
import { ShowPanelButton, HidePanelButton } from './PanelToggleButtons';

interface ModifiersPanelProps {
  calc: XpCalculationResult;
  isInitiallyCollapsed?: boolean;
  foodBuffOverride?: FoodBuffOverride | null;
  onSetFoodBuffOverride?: (override: FoodBuffOverride | null) => void;
}

interface SpeedBadgeProps {
  calc: XpCalculationResult;
  isCompact?: boolean;
}

const SpeedBadge: React.FC<SpeedBadgeProps> = ({ calc, isCompact = false }) => {
  const isSpeedDebuffed = calc.craftingSpeedBonusPercent < 0;
  const badgeContent = isCompact ? (
    <span
      className={`px-2 py-0.5 rounded text-[11px] font-bold border inline-flex items-center gap-1 cursor-help ${
        isSpeedDebuffed
          ? 'bg-amber-950/70 border-amber-700/60 text-amber-300'
          : 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300'
      }`}
    >
      Speed: {calc.craftingSpeedBonusPercent >= 0 ? `+${calc.craftingSpeedBonusPercent}%` : `${calc.craftingSpeedBonusPercent}%`} ({calc.secondsPerAction.toFixed(2)}s/act)
    </span>
  ) : (
    <div
      className={`border px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 cursor-help ${
        isSpeedDebuffed
          ? 'bg-amber-950/70 border-amber-700/60 text-amber-300'
          : 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300'
      }`}
    >
      <Gauge className="w-3.5 h-3.5" />
      <span>
        {calc.craftingSpeedBonusPercent >= 0 ? `+${calc.craftingSpeedBonusPercent}%` : `${calc.craftingSpeedBonusPercent}%`}
      </span>
      <span className="text-gray-400 font-sans">({calc.secondsPerAction.toFixed(2)}s/act)</span>
    </div>
  );

  if (calc.speedBreakdown) {
    return (
      <SpeedBreakdownPopover speedBreakdown={calc.speedBreakdown}>
        {badgeContent}
      </SpeedBreakdownPopover>
    );
  }

  return badgeContent;
};

export const ModifiersPanel: React.FC<ModifiersPanelProps> = ({
  calc,
  isInitiallyCollapsed = false,
  foodBuffOverride,
  onSetFoodBuffOverride,
}) => {
  const [activeTab, setActiveTab] = useState<'buffs' | 'equipment'>('buffs');
  const [isCollapsed, setIsCollapsed] = useState(isInitiallyCollapsed);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [customSpeedPct, setCustomSpeedPct] = useState('9.4');
  const [customXpPct, setCustomXpPct] = useState('0');
  const [customDurationMin, setCustomDurationMin] = useState('50');
  const [customName, setCustomName] = useState('Crafting Food Buff');

  const FOOD_PRESETS = [
    { name: 'Fine Crafting Feast (+9.4%)', speed: 0.094, xp: 0, duration: 3600, label: '🥧 +9.4% (60m)' },
    { name: 'Refined Crafting Ration (+8.2%)', speed: 0.082, xp: 0, duration: 1800, label: '🍞 +8.2% (30m)' },
    { name: 'Standard Crafting Stew (+4.2%)', speed: 0.042, xp: 0, duration: 1800, label: '🍲 +4.2% (30m)' },
    { name: 'Grand Feast (+10% / +5% XP)', speed: 0.10, xp: 0.05, duration: 3600, label: '🌟 +10% & +5% XP' },
    { name: "Scholar's Wisdom (+5% XP)", speed: 0, xp: 0.05, duration: 1800, label: '📜 +5% XP (30m)' },
  ];

  const handleApplyPreset = (preset: typeof FOOD_PRESETS[0]) => {
    if (!onSetFoodBuffOverride) return;
    onSetFoodBuffOverride({
      id: `food_${Date.now()}`,
      name: preset.name,
      craftingSpeedBonus: preset.speed,
      xpRateBonus: preset.xp,
      staminaRegenBonus: 0,
      durationSeconds: preset.duration,
      startedAt: Date.now(),
      remainingSeconds: preset.duration,
      enabled: true,
    });
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSetFoodBuffOverride) return;
    const speed = parseFloat(customSpeedPct) / 100 || 0;
    const xp = parseFloat(customXpPct) / 100 || 0;
    const mins = parseFloat(customDurationMin) || 60;
    const durSecs = Math.round(mins * 60);

    onSetFoodBuffOverride({
      id: `food_${Date.now()}`,
      name: customName || 'Custom Food Buff',
      craftingSpeedBonus: speed,
      xpRateBonus: xp,
      staminaRegenBonus: 0,
      durationSeconds: durSecs,
      startedAt: Date.now(),
      remainingSeconds: durSecs,
      enabled: true,
    });
    setShowOverrideForm(false);
  };

  useEffect(() => {
    setIsCollapsed(isInitiallyCollapsed);
  }, [isInitiallyCollapsed]);

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
            <SpeedBadge calc={calc} isCompact />
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

        <ShowPanelButton
          label="Show Modifiers"
          onClick={() => setIsCollapsed(false)}
        />
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
          <SpeedBadge calc={calc} />

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
          <HidePanelButton
            title="Collapse Modifiers section"
            onClick={() => setIsCollapsed(true)}
          />
        </div>
      </div>

      {/* Tab Content: Active Food & Potion Buffs */}
      {activeTab === 'buffs' && (
        <div className="space-y-4">
          {/* Active Buffs Grid */}
          {calc.activeBuffModifiers.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400 bg-surface-subtle/30 rounded-lg border border-surface-border/40 space-y-1">
              <p>No active food or potion buffs currently returned by BitJita API for this character.</p>
              <p className="text-[11px] text-gray-500">If you ate food in-game and BitJita has not synced yet, click a quick preset below to activate it!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {calc.activeBuffModifiers.map((buff, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                    buff.isDebuff
                      ? 'bg-red-950/40 border-red-800/60 text-red-200'
                      : buff.name.includes('Override')
                      ? 'bg-indigo-950/40 border-indigo-700/60 text-indigo-200'
                      : buff.isExpiringSoon
                      ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                      : 'bg-surface-subtle border-surface-border text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="truncate flex items-center gap-1">
                      {buff.name.includes('Override') && <Sparkles className="w-3 h-3 text-indigo-400" />}
                      {buff.name}
                    </span>
                    {buff.isDebuff ? (
                      <span className="flex items-center gap-1 text-[10px] text-red-400 font-normal">
                        <AlertTriangle className="w-3 h-3" /> Debuff
                      </span>
                    ) : buff.name.includes('Override') ? (
                      <button
                        onClick={() => onSetFoodBuffOverride && onSetFoodBuffOverride(null)}
                        className="text-[10px] text-red-400 hover:text-red-300 font-sans flex items-center gap-0.5 hover:underline cursor-pointer"
                        title="Remove manual override"
                      >
                        <X className="w-3 h-3" /> Clear
                      </button>
                    ) : null}
                  </div>

                  <div className="font-mono text-[11px] space-y-0.5">
                    {buff.craftingSpeedBonus !== 0 && (
                      <div className={buff.craftingSpeedBonus < 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                        Crafting Speed: {buff.craftingSpeedBonus > 0 ? '+' : ''}
                        {(buff.craftingSpeedBonus * 100).toFixed(1)}%
                      </div>
                    )}
                    {buff.xpRateBonus !== undefined && buff.xpRateBonus !== 0 && (
                      <div className="text-purple-300 font-bold">
                        XP Rate: +{(buff.xpRateBonus * 100).toFixed(1)}%
                      </div>
                    )}
                    {buff.staminaRegenBonus !== 0 && (
                      <div className="text-blue-300">
                        Stamina Regen: +{(buff.staminaRegenBonus * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>

                  {buff.remainingSeconds > 0 && (
                    <div className="text-[10px] text-gray-400 font-mono pt-0.5 border-t border-surface-border/40 flex justify-between items-center">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-500" /> Expires in:
                      </span>
                      <span className={buff.isExpiringSoon ? 'text-amber-400 font-bold' : 'text-gray-300 font-medium'}>
                        {formatTimeSeconds(buff.remainingSeconds)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Quick Presets & Manual Override Bar */}
          <div className="bg-surface-subtle/50 rounded-lg p-3 border border-surface-border/60 text-xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-gray-200 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-amber-400" />
                <span>Quick Food Buff Presets:</span>
              </span>
              <button
                onClick={() => setShowOverrideForm(!showOverrideForm)}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium hover:underline cursor-pointer"
              >
                {showOverrideForm ? 'Hide Custom Input' : '+ Custom Food / Duration / XP'}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {FOOD_PRESETS.map((preset, pIdx) => {
                const isActive = foodBuffOverride?.enabled && foodBuffOverride.name === preset.name;
                return (
                  <button
                    key={pIdx}
                    onClick={() => handleApplyPreset(preset)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer border ${
                      isActive
                        ? 'bg-indigo-900/80 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-400'
                        : 'bg-surface hover:bg-surface-border/60 border-surface-border text-gray-300 hover:text-white'
                    }`}
                  >
                    <span>{preset.label}</span>
                    {isActive && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                  </button>
                );
              })}
            </div>

            {/* Collapsible Custom Input Form */}
            {showOverrideForm && (
              <form onSubmit={handleApplyCustom} className="pt-2 border-t border-surface-border/60 grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">Food / Buff Name</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. High-Quality Pie"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">Speed Bonus (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={customSpeedPct}
                    onChange={(e) => setCustomSpeedPct(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded px-2 py-1 text-gray-200 font-mono focus:outline-none focus:border-indigo-500"
                    placeholder="9.4"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">XP Rate Bonus (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={customXpPct}
                    onChange={(e) => setCustomXpPct(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded px-2 py-1 text-gray-200 font-mono focus:outline-none focus:border-indigo-500"
                    placeholder="5.0"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={customDurationMin}
                    onChange={(e) => setCustomDurationMin(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded px-2 py-1 text-gray-200 font-mono focus:outline-none focus:border-indigo-500"
                    placeholder="50"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-1 px-3 rounded transition-colors cursor-pointer"
                  >
                    Activate Override
                  </button>
                </div>
              </form>
            )}
          </div>
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
                        Speed: +{(equip.craftingSpeedBonus * 100).toFixed(1)}%
                      </div>
                    )}
                    {equip.powerBonus !== undefined && equip.powerBonus > 0 && (
                      <div className="text-amber-400">
                        Power: +{equip.powerBonus}
                      </div>
                    )}
                    {equip.xpRateBonus !== undefined && equip.xpRateBonus > 0 && (
                      <div className="text-purple-400">
                        XP Rate: +{(equip.xpRateBonus * 100).toFixed(1)}%
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
