import React, { useState } from 'react';
import { Hammer, MapPin, Wrench, ShieldAlert, CheckCircle2, Layers, Sliders } from 'lucide-react';
import { CraftResult, ItemMetadata } from '../types/api';
import { XpCalculationResult } from '../types/calculator';

interface ActiveCraftCardProps {
  craft: CraftResult;
  craftsList: CraftResult[];
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  calc: XpCalculationResult;
  itemMetadata?: ItemMetadata | null;
  onOverrideProgressPerAction?: (val: number | null) => void;
}

export const ActiveCraftCard: React.FC<ActiveCraftCardProps> = ({
  craft,
  craftsList,
  selectedIndex,
  onSelectIndex,
  calc,
  itemMetadata,
  onOverrideProgressPerAction,
}) => {
  const [isEditingEffort, setIsEditingEffort] = useState(false);
  const [effortInput, setEffortInput] = useState<string>(String(calc.progressPerAction));

  const itemName =
    itemMetadata?.name ||
    (craft.craftedItem && craft.craftedItem.length > 0 ? `Item #${craft.craftedItem[0].item_id}` : 'Craft Item');
  const itemTier = itemMetadata?.tier || 1;
  const itemRarity = itemMetadata?.rarityStr || itemMetadata?.rarityString || 'Common';

  const getRarityBadgeColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'uncommon':
        return 'bg-green-950/80 text-green-400 border-green-700/60';
      case 'rare':
        return 'bg-blue-950/80 text-blue-400 border-blue-700/60';
      case 'epic':
        return 'bg-purple-950/80 text-purple-400 border-purple-700/60';
      case 'legendary':
        return 'bg-amber-950/80 text-amber-400 border-amber-700/60';
      case 'mythic':
        return 'bg-red-950/80 text-red-400 border-red-700/60';
      default:
        return 'bg-gray-800 text-gray-300 border-gray-700';
    }
  };

  const handleApplyEffort = () => {
    const num = parseFloat(effortInput);
    if (!isNaN(num) && num > 0 && onOverrideProgressPerAction) {
      onOverrideProgressPerAction(num);
    }
    setIsEditingEffort(false);
  };

  const handleResetEffort = () => {
    if (onOverrideProgressPerAction) {
      onOverrideProgressPerAction(null);
    }
    setEffortInput(String(calc.progressPerAction));
    setIsEditingEffort(false);
  };

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-5 shadow-xl space-y-4">
      {/* Header with Multi-Craft Tabs if > 1 active craft */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
            <Hammer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-100">Active Craft</h2>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                In Progress
              </span>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
              <span>{craft.buildingName || 'Crafting Station'}</span>
              {craft.claimName && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-gray-300">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    {craft.claimName} {craft.regionName ? `(${craft.regionName})` : ''}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Multi-craft tabs */}
        {craftsList.length > 1 && (
          <div className="flex items-center gap-1 bg-surface-subtle p-1 rounded-lg border border-surface-border">
            <Layers className="w-3.5 h-3.5 text-gray-400 ml-1.5 mr-0.5" />
            {craftsList.map((_, idx) => (
              <button
                key={idx}
                onClick={() => onSelectIndex(idx)}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  selectedIndex === idx
                    ? 'bg-emerald-600 text-white font-semibold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Craft #{idx + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Crafted Item Details Banner */}
      <div className="bg-surface-subtle/70 rounded-lg p-4 border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-surface-border/50 border border-surface-border flex items-center justify-center text-xl shadow-inner">
            📦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-gray-100">{itemName}</span>
              <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${getRarityBadgeColor(itemRarity)}`}>
                {itemRarity}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-3">
              <span>Tier {itemTier}</span>
              <span>•</span>
              <span>Recipe #{craft.recipeId}</span>
              <span>•</span>
              <span className="text-emerald-400 font-medium">
                {calc.skillName} Req Level {craft.levelRequirements?.[0]?.level || 1}
              </span>
            </div>
          </div>
        </div>

        {/* Tool Compatibility Indicator */}
        <div className="sm:text-right">
          <div className="text-xs text-gray-400 mb-1">Required Tool</div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-surface border-surface-border">
            {calc.toolStatus.isEquipped ? (
              calc.toolStatus.meetsLevelReq ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">
                    {calc.toolStatus.equippedTool?.name || calc.toolStatus.requiredToolName} (T{calc.toolStatus.effectivePower})
                  </span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300">
                    {calc.toolStatus.requiredToolName} (T{calc.toolStatus.effectivePower} vs req T{calc.toolStatus.requiredToolLevel})
                  </span>
                </>
              )
            ) : (
              <>
                <Wrench className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-300">
                  {calc.toolStatus.requiredToolName} (T{calc.toolStatus.requiredToolLevel}+)
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar & Counts */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-300 flex items-center gap-1.5">
            <span>Overall Effort Progress</span>
            <span className="text-emerald-400 font-bold font-mono">
              {calc.progressPercent.toFixed(1)}%
            </span>
          </span>
          <span className="text-gray-400 font-mono">
            <strong className="text-gray-200">{calc.completedProgress.toLocaleString()}</strong> / {calc.totalProgressRequired.toLocaleString()} effort points
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-surface-subtle rounded-full h-3.5 overflow-hidden border border-surface-border p-0.5">
          <div
            className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 relative shadow-lg shadow-emerald-500/20"
            style={{ width: `${Math.max(1, calc.progressPercent)}%` }}
          />
        </div>

        {/* Items crafted ratio and Physical Actions */}
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-400 pt-1 font-mono gap-2">
          <div>
            Items Finished: <strong className="text-gray-200">{calc.itemsCompleted.toLocaleString()}</strong> / {calc.itemsTotal.toLocaleString()}
          </div>
          <div>
            Remaining Effort: <strong className="text-amber-400">{calc.remainingProgress.toLocaleString()}</strong> ({calc.itemsRemaining.toLocaleString()} items left)
          </div>
        </div>
      </div>

      {/* Effort Per Action (Rate Calibration & Custom Override) */}
      <div className="bg-surface-subtle/50 rounded-lg p-3 border border-surface-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-gray-300">
            Progress per Action (Effort/Click):{' '}
            <strong className="text-emerald-400 font-mono text-sm">{calc.progressPerAction}</strong>
            {calc.isMeasuredProgressPerAction && (
              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-sans">
                Measured from your history
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isEditingEffort ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="1"
                max="100"
                step="0.5"
                value={effortInput}
                onChange={(e) => setEffortInput(e.target.value)}
                className="w-16 bg-surface border border-surface-border text-gray-100 rounded px-2 py-0.5 text-xs text-center font-mono"
              />
              <button
                onClick={handleApplyEffort}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 rounded text-xs"
              >
                Set
              </button>
              <button
                onClick={handleResetEffort}
                className="bg-surface border border-surface-border text-gray-400 hover:text-white px-2 py-0.5 rounded text-xs"
              >
                Reset
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEffortInput(String(calc.progressPerAction));
                setIsEditingEffort(true);
              }}
              className="text-indigo-400 hover:text-indigo-300 underline text-xs cursor-pointer"
            >
              Adjust rate
            </button>
          )}

          <span className="text-gray-500">|</span>
          <span className="text-gray-300 font-mono">
            ~<strong className="text-gray-100">{calc.physicalActionsRemaining.toLocaleString()}</strong> clicks / actions remaining
          </span>
        </div>
      </div>
    </div>
  );
};
