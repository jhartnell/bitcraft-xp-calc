import React from 'react';
import {
  Zap,
  Hammer,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Music,
  Gem,
  Award,
  CheckCircle2,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { ToolStatusInfo, EquipmentModifier } from '../types/calculator';
import { useHoverPopoverState } from '../hooks/useHoverPopoverState';
import { getItemPower, resolveToolRarity } from '../services/bitcraftData';

interface PowerBreakdownPopoverProps {
  toolStatus: ToolStatusInfo;
  equipmentModifiers: EquipmentModifier[];
  skillId?: number;
  skillName?: string;
  skillIcon?: string;
  currentSkillLevel?: number;
  hasManualSkillOverride?: boolean;
  isSkillLevelInferred?: boolean;
  progressPerAction?: number;
  isMeasuredProgressPerAction?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const PowerBreakdownPopover: React.FC<PowerBreakdownPopoverProps> = ({
  toolStatus,
  equipmentModifiers,
  skillName,
  skillIcon,
  currentSkillLevel,
  hasManualSkillOverride = false,
  isSkillLevelInferred = false,
  progressPerAction,
  isMeasuredProgressPerAction,
  children,
  className = '',
}) => {
  const { isOpen, handleMouseEnter, handleMouseLeave, toggle } = useHoverPopoverState(150);

  const baseTool = toolStatus.equippedTool;
  const baseToolPower = baseTool ? getItemPower(baseTool) : (toolStatus.isEquipped ? 1 : 1);
  const toolTier = baseTool?.tier || 1;
  const toolRarity =
    baseTool?.rarityStr ||
    baseTool?.rarityString ||
    resolveToolRarity(toolTier, baseToolPower);

  const extraGearWithPower = equipmentModifiers.filter(
    (e) => e.powerBonus !== undefined && e.powerBonus > 0
  );

  const theoreticalEffort = Math.max(1, toolStatus.effectivePower);
  const meetsPower = toolStatus.meetsPowerReq;
  const isMatchingTool = toolStatus.isEquipped && Boolean(baseTool);

  const getSlotIcon = (slot: string) => {
    const lower = slot.toLowerCase();
    if (lower.includes('instrument')) return <Music className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />;
    if (lower.includes('charm')) return <Sparkles className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />;
    if (lower.includes('ring') || lower.includes('amulet') || lower.includes('neck')) {
      return <Gem className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />;
    }
    return <Zap className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />;
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={toggle}
    >
      {/* Target Trigger */}
      <div className="cursor-help transition-transform hover:scale-[1.01]">
        {children}
      </div>

      {/* Floating Popover */}
      {isOpen && (
        <div
          className="absolute z-50 bottom-full left-0 sm:left-auto sm:right-0 mb-2 w-80 sm:w-96 p-4 rounded-xl bg-surface border border-surface-border shadow-2xl backdrop-blur-md text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto text-left"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Header Row */}
          <div className="flex items-center justify-between border-b border-surface-border pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-400">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-gray-100 flex items-center gap-1.5">
                  <span>Effort & Tool Breakdown</span>
                </h4>
                <p className="text-[10px] text-gray-400">
                  Tool power, skill level & action pacing
                </p>
              </div>
            </div>
            <div
              className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] border flex items-center gap-1 ${
                meetsPower
                  ? 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/70 border-rose-800/60 text-rose-300'
              }`}
            >
              {meetsPower ? <ShieldCheck className="w-3 h-3 text-emerald-400" /> : <ShieldAlert className="w-3 h-3 text-rose-400" />}
              <span>{toolStatus.effectivePower} Power</span>
            </div>
          </div>

          {/* 1. Skill Level & Profession Context */}
          {skillName && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-subtle/80 border border-surface-border/60">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="font-semibold text-gray-200 flex items-center gap-1.5">
                    {skillIcon && <span>{skillIcon}</span>}
                    <span>{skillName}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5">
                    <span>Player Level:</span>
                    <strong className="text-emerald-300">Lvl {currentSkillLevel ?? 1}</strong>
                    {hasManualSkillOverride ? (
                      <span className="text-[9px] bg-amber-950/80 border border-amber-700/60 text-amber-300 px-1 py-0.2 rounded font-sans">
                        Custom
                      </span>
                    ) : isSkillLevelInferred ? (
                      <span
                        className="text-[9px] bg-amber-950/80 border border-amber-700/60 text-amber-300 px-1 py-0.2 rounded font-sans cursor-help"
                        title="Experience unavailable from BitJita; level inferred from tool & craft requirements."
                      >
                        Inferred ℹ️
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block">Station Req:</span>
                <span className="text-[11px] font-mono text-gray-300 font-semibold">
                  Req Power {toolStatus.requiredToolPower}+ (Lvl {toolStatus.requiredToolLevel}+)
                </span>
              </div>
            </div>
          )}

          {/* 2. Tool in Use Status */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 font-sans block">
              Tool In Use:
            </span>
            <div
              className={`p-2 rounded-lg border flex items-start justify-between gap-2 ${
                isMatchingTool
                  ? 'bg-surface-subtle/50 border-surface-border/70'
                  : 'bg-amber-950/30 border-amber-800/50'
              }`}
            >
              <div className="flex items-start gap-2 min-w-0">
                <Hammer className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isMatchingTool ? 'text-emerald-400' : 'text-amber-400'}`} />
                <div className="min-w-0">
                  <div className="text-gray-200 font-medium truncate flex items-center gap-1.5">
                    <span>{baseTool ? baseTool.name : 'No Tool Equipped'}</span>
                    {isMatchingTool ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {isMatchingTool
                      ? `Active Tool • Tier ${toolTier} • ${toolRarity}`
                      : `Requires ${toolStatus.requiredToolName || 'matching tool'}`}
                  </div>
                </div>
              </div>
              <div className="font-mono text-amber-300 font-semibold text-[11px] shrink-0">
                +{baseToolPower} Power
              </div>
            </div>
          </div>

          {/* 3. Auxiliary Power Gear (Charms, Instruments, Gear) */}
          {extraGearWithPower.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 font-sans block">
                Auxiliary Power Gear:
              </span>
              <div className="space-y-1">
                {extraGearWithPower.map((gear, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-2 p-2 rounded-lg bg-surface-subtle/40 border border-surface-border/40"
                  >
                    <div className="flex items-start gap-1.5 min-w-0">
                      {getSlotIcon(gear.slot)}
                      <div className="min-w-0">
                        <div className="text-gray-200 font-medium truncate">
                          {gear.itemName}
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                          {gear.slot.replace('_', ' ')} • Tier {gear.tier} {gear.rarity}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono text-amber-300 font-semibold shrink-0">
                      +{gear.powerBonus} Power
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3.5. Profession Level Stat Bonus (from BitcraftLevelStatIncreases.csv) */}
          {toolStatus.levelPowerBonus !== undefined && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 font-sans block">
                Profession Level Stat Bonus:
              </span>
              <div className="flex items-start justify-between gap-2 p-2 rounded-lg bg-surface-subtle/40 border border-surface-border/40">
                <div className="flex items-start gap-1.5 min-w-0">
                  <Award className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${toolStatus.levelPowerBonus > 0 ? 'text-amber-400' : 'text-gray-400'}`} />
                  <div className="min-w-0">
                    <div className="text-gray-200 font-medium truncate">
                      {skillName || 'Profession'} Level {currentSkillLevel || 1}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {toolStatus.levelPowerBonus > 0 ? (
                        `Cumulative stat increase (+${toolStatus.levelPowerBonus} Power${
                          toolStatus.levelSpeedBonus ? `, +${(toolStatus.levelSpeedBonus * 100).toFixed(0)}% Speed` : ''
                        }${toolStatus.levelCritBonus ? `, +${(toolStatus.levelCritBonus * 100).toFixed(0)}% Crit` : ''})`
                      ) : (
                        `Level ${currentSkillLevel || 1} progression (+0 Power${
                          toolStatus.levelSpeedBonus ? `, +${(toolStatus.levelSpeedBonus * 100).toFixed(0)}% Speed` : ''
                        }${toolStatus.levelCritBonus ? `, +${(toolStatus.levelCritBonus * 100).toFixed(0)}% Crit` : ''} • +1 Power at Level 5)`
                      )}
                    </div>
                  </div>
                </div>
                <div className={`font-mono font-semibold shrink-0 ${toolStatus.levelPowerBonus > 0 ? 'text-amber-300' : 'text-gray-400'}`}>
                  +{toolStatus.levelPowerBonus} Power
                </div>
              </div>
            </div>
          )}

          {/* 4. Total Effective Power Summary */}
          <div className="pt-2 border-t border-surface-border/60 flex items-center justify-between font-mono text-[11px]">
            <span className="text-gray-400 font-sans">Total Effective Power:</span>
            <span className="text-amber-300 font-bold text-xs">
              {toolStatus.effectivePower} Power
            </span>
          </div>

          {/* 5. Effort Scaling & Measured Calibration Box */}
          <div className="bg-surface-subtle/90 rounded-lg p-2.5 border border-surface-border/80 font-mono text-[11px] space-y-1">
            <div className="flex items-center justify-between text-gray-200 font-semibold">
              <span className="font-sans text-gray-300">Effective Effort Pace:</span>
              <span className="text-emerald-400 font-bold text-xs">
                {(progressPerAction ?? theoreticalEffort).toFixed(1)} effort / action
              </span>
            </div>
            <div className="text-[10px] text-gray-400 font-sans pt-0.5">
              {isMeasuredProgressPerAction ? (
                <span className="text-indigo-300">
                  📊 <strong>Live Historical Calibration:</strong> Derived directly from your verified SpacetimeDB action deltas on this craft.
                </span>
              ) : (
                <span>
                  ⚡ <strong>Theoretical Baseline:</strong> 1:1 Effective Power = {theoreticalEffort.toFixed(1)} effort / action.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
