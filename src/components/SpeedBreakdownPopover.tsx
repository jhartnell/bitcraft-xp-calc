import React, { useState, useRef } from 'react';
import {
  Gauge,
  Utensils,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { SpeedBreakdownInfo } from '../types/calculator';

interface SpeedBreakdownPopoverProps {
  speedBreakdown: SpeedBreakdownInfo;
  children: React.ReactNode;
  className?: string;
}

export const SpeedBreakdownPopover: React.FC<SpeedBreakdownPopoverProps> = ({
  speedBreakdown,
  children,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const isSpeedDebuffed = speedBreakdown.totalBonusPercent < 0;

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => setIsOpen((prev) => !prev)}
    >
      {/* Target Trigger with subtle indicator cursor */}
      <div className="cursor-help transition-transform hover:scale-[1.02]">
        {children}
      </div>

      {/* Floating Hover Popover */}
      {isOpen && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 sm:w-96 p-4 rounded-xl bg-surface border border-surface-border shadow-2xl backdrop-blur-md text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Header Row */}
          <div className="flex items-center justify-between border-b border-surface-border pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
                <Gauge className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-gray-100 flex items-center gap-1.5">
                  <span>Crafting Speed Breakdown</span>
                </h4>
                <p className="text-[10px] text-gray-400">
                  How action duration is calculated
                </p>
              </div>
            </div>
            <div
              className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] border ${
                isSpeedDebuffed
                  ? 'bg-amber-950/70 border-amber-700/60 text-amber-300'
                  : 'bg-emerald-950/70 border-emerald-800/60 text-emerald-300'
              }`}
            >
              {speedBreakdown.totalBonusPercent >= 0
                ? `+${speedBreakdown.totalBonusPercent}%`
                : `${speedBreakdown.totalBonusPercent}%`}
            </div>
          </div>

          {/* Formula Summary Box */}
          <div className="bg-surface-subtle/80 rounded-lg p-2.5 border border-surface-border/60 font-mono text-[11px] space-y-1">
            <div className="text-[10px] text-gray-400 font-sans flex items-center justify-between">
              <span>Speed Formula:</span>
              <span className="text-gray-500">Base / Multiplier</span>
            </div>
            <div className="flex items-center justify-between text-gray-200 font-semibold pt-0.5">
              <span>1.60s ÷ {speedBreakdown.totalMultiplier.toFixed(3)}x</span>
              <span className="text-emerald-400 font-bold text-xs">
                = {speedBreakdown.finalSecondsPerAction.toFixed(2)}s / action
              </span>
            </div>
            <div className="text-[10px] text-gray-400 font-sans text-right">
              ({speedBreakdown.effectiveActionsPerSecond.toFixed(2)} actions per second)
            </div>
          </div>

          {/* Contributor Rows */}
          <div className="space-y-2 pt-1">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 font-sans block">
              Speed Multiplier Sources:
            </span>

            {/* 1. Base Station Rate */}
            <div className="flex items-start justify-between gap-2 p-2 rounded-lg bg-surface-subtle/40 border border-surface-border/40">
              <div className="flex items-start gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-gray-200 font-medium">Base Station Rate</div>
                  <div className="text-[10px] text-gray-500">Standard 1.60s craft action duration</div>
                </div>
              </div>
              <div className="font-mono text-gray-300 text-right font-medium shrink-0">
                1.000x <span className="text-gray-500 text-[10px]">(+0.0%)</span>
              </div>
            </div>

            {/* 2. Equipment & Gear */}
            {speedBreakdown.equipmentBonusPercent !== 0 && (
              <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-surface-subtle/40 border border-surface-border/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-gray-200 font-medium">Equipment & Clothing</span>
                  </div>
                  <div className="font-mono text-blue-300 font-semibold shrink-0">
                    +{speedBreakdown.equipmentBonusPercent.toFixed(1)}%
                  </div>
                </div>

                {speedBreakdown.equipmentItems.length > 0 ? (
                  <div className="pl-5 space-y-0.5 text-[10px] text-gray-400 font-mono border-l-2 border-surface-border ml-1.5">
                    {speedBreakdown.equipmentItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="truncate max-w-[180px]">{item.name}</span>
                        <span className="text-emerald-400">+{item.bonusPercent.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pl-5 text-[10px] text-gray-500 font-sans border-l-2 border-surface-border ml-1.5">
                    Total gear speed stat from server
                  </div>
                )}
              </div>
            )}

            {/* 3. Food Buffs & Potions */}
            {speedBreakdown.buffBonusPercent !== 0 && (
              <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-surface-subtle/40 border border-surface-border/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-gray-200 font-medium">Food Buffs & Potions</span>
                  </div>
                  <div className="font-mono text-amber-300 font-semibold shrink-0">
                    {speedBreakdown.buffBonusPercent >= 0 ? '+' : ''}
                    {speedBreakdown.buffBonusPercent.toFixed(1)}%
                  </div>
                </div>

                {speedBreakdown.buffItems.length > 0 && (
                  <div className="pl-5 space-y-0.5 text-[10px] text-gray-400 font-mono border-l-2 border-surface-border ml-1.5">
                    {speedBreakdown.buffItems.map((buff, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="truncate max-w-[180px] flex items-center gap-1">
                          {buff.name}
                          {buff.isOverride && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-700">
                              Override
                            </span>
                          )}
                        </span>
                        <span className={buff.bonusPercent < 0 ? 'text-red-400' : 'text-emerald-400'}>
                          {buff.bonusPercent >= 0 ? '+' : ''}
                          {buff.bonusPercent.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. Profession Skill Level Speed */}
            {speedBreakdown.professionSkillBonusPercent !== 0 && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-subtle/40 border border-surface-border/40">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <div>
                    <span className="text-gray-200 font-medium">
                      {speedBreakdown.professionSkillName} Skill Bonus
                    </span>
                    <span className="text-[10px] text-gray-500 block">Level speed bonus</span>
                  </div>
                </div>
                <div className="font-mono text-purple-300 font-semibold shrink-0">
                  +{speedBreakdown.professionSkillBonusPercent.toFixed(1)}%
                </div>
              </div>
            )}

            {/* Total Row */}
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 font-semibold">
              <span className="text-gray-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                <span>Total Multiplier</span>
              </span>
              <span className="font-mono text-emerald-300 text-sm">
                {speedBreakdown.totalMultiplier.toFixed(3)}x{' '}
                <span className="text-xs font-normal">
                  ({speedBreakdown.totalBonusPercent >= 0 ? '+' : ''}
                  {speedBreakdown.totalBonusPercent}%)
                </span>
              </span>
            </div>
          </div>

          {/* Bottom Popover Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-3 h-3 bg-surface border-r border-b border-surface-border rotate-45" />
        </div>
      )}
    </div>
  );
};
