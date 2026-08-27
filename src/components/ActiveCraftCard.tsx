import React, { useState, useRef, useEffect } from 'react';
import {
  Hammer,
  MapPin,
  Wrench,
  ShieldAlert,
  CheckCircle2,
  Sliders,
  Star,
  Compass,
  ChevronDown,
  Zap,
  TrendingUp,
  Globe,
} from 'lucide-react';
import { CraftResult, ItemMetadata } from '../types/api';
import { XpCalculationResult } from '../types/calculator';
import { LiveRateGraphPopover } from './LiveRateGraphPopover';

export interface NearbyCraftItem {
  craft: CraftResult;
  distanceMeters: number;
  isHelper?: boolean;
  itemName?: string;
  itemTier?: number;
  itemMetadata?: ItemMetadata;
}

interface ActiveCraftCardProps {
  craft: CraftResult;
  craftsList: CraftResult[];
  selectedIndex?: number;
  onSelectIndex: (idx: number) => void;
  nearbyCrafts?: NearbyCraftItem[];
  onSelectNearbyCraft?: (craft: CraftResult) => void;
  selectedCraftEntityId?: string;
  calc: XpCalculationResult;
  itemMetadata?: ItemMetadata | null;
  onOverrideProgressPerAction?: (val: number | null) => void;
  onOpenPublicModal?: () => void;
}

export const ActiveCraftCard: React.FC<ActiveCraftCardProps> = ({
  craft,
  craftsList,
  selectedIndex: _selectedIndex,
  onSelectIndex,
  nearbyCrafts = [],
  onSelectNearbyCraft,
  selectedCraftEntityId,
  calc,
  itemMetadata,
  onOverrideProgressPerAction,
  onOpenPublicModal,
}) => {
  const [isEditingEffort, setIsEditingEffort] = useState(false);
  const [effortInput, setEffortInput] = useState<string>(String(calc.progressPerAction));
  const [isNearbyDropdownOpen, setIsNearbyDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsNearbyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const itemName =
    itemMetadata?.name ||
    (craft.craftedItem && craft.craftedItem.length > 0
      ? craft.craftedItem[0].item_type === 'cargo'
        ? `Cargo #${craft.craftedItem[0].item_id}`
        : `Item #${craft.craftedItem[0].item_id}`
      : 'Craft Item');
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

  const isCurrentCraftSelected = (c: CraftResult) => {
    if (selectedCraftEntityId) return selectedCraftEntityId === c.entityId;
    return craft.entityId === c.entityId;
  };

  // Filter out any nearby craft that is already in craftsList (own crafts)
  const uniqueNearbyCrafts = nearbyCrafts.filter(
    (n) => !craftsList.some((c) => c.entityId === n.craft.entityId)
  );

  const helperCrafts = uniqueNearbyCrafts.filter((n) => n.isHelper);
  const idleNearbyCrafts = uniqueNearbyCrafts.filter((n) => !n.isHelper);
  const selectedIdleCraft = idleNearbyCrafts.find((n) => isCurrentCraftSelected(n.craft));

  const hasMultipleOptions = craftsList.length > 1 || uniqueNearbyCrafts.length > 0;

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-5 shadow-xl space-y-4">
      {/* Header with Multi-Craft Tabs */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
              <Hammer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-100">
                  {craft.buildingName || 'Crafting Station'}
                </h2>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  In Progress
                </span>
                {craft.ownerUsername && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-subtle border border-surface-border text-gray-400 font-mono">
                    Owner: {craft.ownerUsername}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5 font-mono">
                {craft.claimName ? (
                  <span className="flex items-center gap-1 text-gray-300">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                    {craft.claimName} {craft.regionName ? `(${craft.regionName})` : ''}
                  </span>
                ) : (
                  <span>Region {craft.regionId}</span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Search Public Stations Action */}
          {onOpenPublicModal && (
            <button
              onClick={onOpenPublicModal}
              className="px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-medium bg-surface-subtle hover:bg-surface-border text-teal-300 hover:text-teal-200 border border-surface-border cursor-pointer text-xs shadow-sm"
              title="Search and browse all active crafting stations across the server"
            >
              <Globe className="w-3.5 h-3.5 text-teal-400" />
              <span>Search Public Stations</span>
            </button>
          )}
        </div>

        {/* Compact & Clean Station Tabs (Own Crafts + Active Helper Stations + Compact Nearby Dropdown) */}
        {hasMultipleOptions && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-surface-border/50 text-xs">
            <div className="flex items-center gap-1 text-gray-400 font-semibold mr-1">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              <span>Stations:</span>
            </div>

            {/* 1. Own Crafts */}
            {craftsList.map((c, idx) => {
              const isSelected = isCurrentCraftSelected(c);
              return (
                <button
                  key={c.entityId || idx}
                  onClick={() => onSelectIndex(idx)}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 font-medium cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                      : 'bg-surface-subtle hover:bg-surface-border text-gray-300 border border-surface-border'
                  }`}
                >
                  <Hammer className="w-3 h-3 text-emerald-300" />
                  <span>My Craft #{idx + 1}</span>
                  <span className="text-[10px] opacity-80 font-mono">
                    ({c.buildingName?.replace(' Station', '') || 'Station'})
                  </span>
                </button>
              );
            })}

            {/* 2. Active Helper Crafts (Only stations where you've contributed) */}
            {helperCrafts.map(({ craft: hCraft, distanceMeters, itemName: hItemName }) => {
              const isSelected = isCurrentCraftSelected(hCraft);
              return (
                <button
                  key={hCraft.entityId}
                  onClick={() => onSelectNearbyCraft && onSelectNearbyCraft(hCraft)}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 font-medium cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200'
                  }`}
                >
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>
                    Helping: {hCraft.buildingName?.replace(' Station', '') || 'Station'}
                    {hItemName ? ` (${hItemName})` : ''}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 opacity-90">
                    ({distanceMeters}m{hCraft.ownerUsername ? ` • ${hCraft.ownerUsername}` : ''})
                  </span>
                </button>
              );
            })}

            {/* 3. Compact Dropdown for Other Idle Stations on Claim */}
            {idleNearbyCrafts.length > 0 && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsNearbyDropdownOpen(!isNearbyDropdownOpen)}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 font-medium cursor-pointer border ${
                    selectedIdleCraft
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm font-semibold'
                      : 'bg-surface-subtle hover:bg-surface-border text-gray-300 border-surface-border'
                  }`}
                >
                  <MapPin className={`w-3 h-3 ${selectedIdleCraft ? 'text-white' : 'text-teal-400'}`} />
                  <span>
                    {selectedIdleCraft
                      ? `Viewing: ${selectedIdleCraft.craft.buildingName?.replace(' Station', '') || 'Station'}${
                          selectedIdleCraft.itemName ? ` (${selectedIdleCraft.itemName})` : ''
                        }`
                      : `+${idleNearbyCrafts.length} Nearby Stations`}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${
                      isNearbyDropdownOpen ? 'rotate-180 text-white' : ''
                    }`}
                  />
                </button>

                {/* Floating Dropdown Drawer */}
                {isNearbyDropdownOpen && (
                  <div className="absolute left-0 mt-1.5 w-80 bg-surface border border-surface-border rounded-xl shadow-2xl p-1.5 z-40 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-surface-border/50 flex items-center justify-between">
                      <span>Nearby Claim Stations</span>
                      <span className="text-gray-500 font-mono">{idleNearbyCrafts.length} available</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1 py-1">
                      {idleNearbyCrafts.map(({ craft: nCraft, distanceMeters, itemName: nItemName, itemTier: nItemTier }) => {
                        const isSelected = isCurrentCraftSelected(nCraft);
                        return (
                          <button
                            key={nCraft.entityId}
                            onClick={() => {
                              onSelectNearbyCraft && onSelectNearbyCraft(nCraft);
                              setIsNearbyDropdownOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex flex-col gap-0.5 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-950/90 border border-indigo-600 text-indigo-100 shadow-sm'
                                : 'hover:bg-surface-subtle text-gray-300'
                            }`}
                          >
                            <div className="font-semibold flex items-center justify-between">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-teal-400" />
                                {nCraft.buildingName || 'Station'}
                              </span>
                              <span className="text-[10px] text-emerald-400 font-mono font-normal">
                                {distanceMeters}m
                              </span>
                            </div>
                            <div className="text-[11px] text-amber-300 font-sans flex items-center justify-between pl-4">
                              <span className="truncate max-w-[180px]">
                                📦 {nItemName || `Recipe #${nCraft.recipeId}`} {nItemTier ? `(T${nItemTier})` : ''}
                              </span>
                              <span className="text-gray-400 font-mono text-[10px] shrink-0">
                                {nCraft.ownerUsername || 'Public'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
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

        {/* Tool Requirements Badge */}
        <div className="flex flex-col sm:items-end justify-center text-xs space-y-1">
          {calc.toolStatus.isEquipped ? (
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-md font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tool Equipped: {calc.toolStatus.equippedTool?.name || 'Valid Tool'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2.5 py-1 rounded-md font-mono">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Tool Required: {calc.toolStatus.requiredToolName || 'Matching Tool'}</span>
            </div>
          )}
          <span className="text-[11px] text-gray-400 font-mono">
            Requires Power T{craft.toolRequirements?.[0]?.power || 1}+ • Tool Lvl {craft.toolRequirements?.[0]?.level || 1}+
          </span>
        </div>
      </div>

      {/* Progress & Item Metrics Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-gray-300 font-semibold flex items-center gap-1">
            Progress: {calc.completedProgress.toLocaleString()} / {calc.totalProgressRequired.toLocaleString()}
            <span className="text-emerald-400 font-bold ml-1">({calc.progressPercent.toFixed(1)}%)</span>
          </span>
          <span className="text-gray-400 font-sans">
            {calc.itemsCompleted.toLocaleString()} / {calc.itemsTotal.toLocaleString()} items finished
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-surface-subtle rounded-full h-3.5 overflow-hidden border border-surface-border relative">
          <div
            className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.max(1, Math.min(100, calc.progressPercent))}%` }}
          />
        </div>
      </div>

      {/* Effort Pacing & Override Control */}
      <div className="bg-surface-subtle p-3 rounded-lg border border-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center flex-wrap gap-2">
          <Wrench className="w-4 h-4 text-indigo-400" />
          <div className="flex items-center flex-wrap gap-2">
            <div>
              <span className="text-gray-300 font-medium">Calculated Effort Pace:</span>{' '}
              <strong className="text-emerald-400 font-mono text-sm">
                {calc.progressPerAction.toFixed(1)} effort / action
              </strong>
              {calc.isMeasuredProgressPerAction ? (
                <span className="text-[10px] text-indigo-300 ml-2 bg-indigo-950/80 border border-indigo-700/60 px-1.5 py-0.5 rounded font-mono">
                  Historical Calibration
                </span>
              ) : (
                <span className="text-[10px] text-gray-400 ml-2 font-mono">
                  (Default 1.0)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-mono flex items-center gap-1"
                title="Continuous casting theoretical ceiling"
              >
                <Zap className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                {calc.xpPerHour.toLocaleString()} Theo
              </span>
              {calc.sessionStats && !calc.sessionStats.isWarmingUp && calc.sessionStats.measuredXpPerHour !== null && (
                <LiveRateGraphPopover
                  sessionStats={calc.sessionStats}
                  theoreticalXpPerHour={calc.xpPerHour}
                >
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 font-mono flex items-center gap-1 hover:bg-indigo-900/80 transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <TrendingUp className="w-3 h-3 text-indigo-400" />
                    {calc.sessionStats.measuredXpPerHour.toLocaleString()} Live ({calc.sessionStats.efficiencyPercent}%)
                  </span>
                </LiveRateGraphPopover>
              )}
            </div>
          </div>
        </div>

        {/* Custom Effort Override */}
        <div className="flex items-center gap-2">
          {isEditingEffort ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={effortInput}
                onChange={(e) => setEffortInput(e.target.value)}
                className="w-20 bg-surface border border-emerald-500 text-emerald-400 font-mono text-xs rounded px-2 py-1 focus:outline-none"
                placeholder="Effort"
              />
              <button
                onClick={handleApplyEffort}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs font-medium cursor-pointer"
              >
                Set
              </button>
              <button
                onClick={handleResetEffort}
                className="bg-surface border border-surface-border text-gray-400 hover:text-gray-200 px-2 py-1 rounded text-xs cursor-pointer"
              >
                Reset
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingEffort(true)}
              className="flex items-center gap-1 text-gray-400 hover:text-gray-200 bg-surface border border-surface-border px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Override Pace</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
