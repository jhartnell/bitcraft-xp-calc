import React, { useState, useEffect } from 'react';
import { Globe, X, Search, Loader2, MapPin, Hammer, ArrowRight, Star } from 'lucide-react';
import { CraftResult, ItemMetadata } from '../types/api';
import { bitjitaApi } from '../services/apiClient';
import { SKILL_DEFINITIONS } from '../services/bitcraftData';

interface PublicCraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCraft: (craft: CraftResult) => void;
  playerId?: string;
  playerUsername?: string;
}

export const PublicCraftsModal: React.FC<PublicCraftsModalProps> = ({
  isOpen,
  onClose,
  onSelectCraft,
  playerId,
  playerUsername,
}) => {
  const [crafts, setCrafts] = useState<CraftResult[]>([]);
  const [itemsMap, setItemsMap] = useState<Map<number, ItemMetadata>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyAssistedFilter, setOnlyAssistedFilter] = useState(false);
  const [assistedCraftIds, setAssistedCraftIds] = useState<Set<string>>(new Set());

  // Load tracked assisted craft IDs from localStorage for the active player
  useEffect(() => {
    if (!playerId) return;
    try {
      const stored = localStorage.getItem(`bitcraft_assisted_crafts_${playerId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setAssistedCraftIds(new Set(parsed));
        }
      }
    } catch {
      // ignore
    }
  }, [playerId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPublicCrafts = async () => {
      try {
        setIsLoading(true);
        const results = await bitjitaApi.getPublicActiveCrafts(true);
        setCrafts(results.craftResults);

        const map = new Map<number, ItemMetadata>();
        for (const itm of results.items) {
          map.set(Number(itm.id), itm);
        }
        for (const crg of results.cargos) {
          map.set(Number(crg.id), crg);
        }
        setItemsMap(map);
      } catch (err) {
        console.error('Failed to load public crafts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPublicCrafts();
  }, [isOpen]);

  if (!isOpen) return null;

  const isAssistedCraft = (c: CraftResult) => {
    if (assistedCraftIds.has(c.entityId)) return true;
    if (playerUsername && c.ownerUsername && c.ownerUsername.toLowerCase() === playerUsername.toLowerCase()) {
      return true;
    }
    return false;
  };

  const matchingCrafts = crafts.filter((c) => {
    if (onlyAssistedFilter && !isAssistedCraft(c)) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const targetId = c.craftedItem?.[0]?.item_id;
    const itemMeta = targetId ? itemsMap.get(Number(targetId)) : undefined;

    return (
      (c.buildingName && c.buildingName.toLowerCase().includes(term)) ||
      (c.claimName && c.claimName.toLowerCase().includes(term)) ||
      (c.ownerUsername && c.ownerUsername.toLowerCase().includes(term)) ||
      (c.regionName && c.regionName.toLowerCase().includes(term)) ||
      (itemMeta && itemMeta.name.toLowerCase().includes(term))
    );
  });

  // Sort: Assisted / Tracked crafts at the VERY TOP, then by progress percentage descending
  const sortedCrafts = [...matchingCrafts].sort((a, b) => {
    const aAssisted = isAssistedCraft(a);
    const bAssisted = isAssistedCraft(b);
    if (aAssisted && !bAssisted) return -1;
    if (!aAssisted && bAssisted) return 1;

    const aPct = a.totalActionsRequired > 0 ? a.progress / a.totalActionsRequired : 0;
    const bPct = b.totalActionsRequired > 0 ? b.progress / b.totalActionsRequired : 0;
    return bPct - aPct;
  });

  const totalAssistedCount = crafts.filter(isAssistedCraft).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-surface-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-700/60 text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100">Public In-Progress Crafts</h3>
              <p className="text-xs text-gray-400">
                Explore active community crafting projects (your tracked/assisted stations are pinned to the top)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-surface-subtle transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Input & Quick Tab Pills */}
        <div className="p-3 border-b border-surface-border bg-surface-subtle/50 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by building, item, owner, claim, or region..."
              className="w-full bg-surface border border-surface-border rounded-lg pl-9 pr-4 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setOnlyAssistedFilter(false)}
              className={`px-2.5 py-1 rounded-lg transition-colors font-medium cursor-pointer ${
                !onlyAssistedFilter
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-surface hover:bg-surface-border text-gray-400 border border-surface-border'
              }`}
            >
              All Active Stations ({crafts.length})
            </button>

            {totalAssistedCount > 0 && (
              <button
                onClick={() => setOnlyAssistedFilter(true)}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 font-medium cursor-pointer ${
                  onlyAssistedFilter
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>My Assisted Stations ({totalAssistedCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Crafts List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Fetching active public crafts from BitJita...</span>
            </div>
          ) : sortedCrafts.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500">
              No matching public crafts found.
            </div>
          ) : (
            sortedCrafts.map((c) => {
              const skillId = c.levelRequirements?.[0]?.skill_id || c.experiencePerProgress?.[0]?.skill_id || 1;
              const skill = SKILL_DEFINITIONS[skillId];
              const pct = c.totalActionsRequired > 0 ? (c.progress / c.totalActionsRequired) * 100 : 0;
              const targetId = c.craftedItem?.[0]?.item_id;
              const itemMeta = targetId ? itemsMap.get(Number(targetId)) : undefined;
              const isAssisted = isAssistedCraft(c);

              return (
                <div
                  key={c.entityId}
                  className={`p-3 rounded-lg border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                    isAssisted
                      ? 'bg-indigo-950/40 hover:bg-indigo-950/60 border-indigo-600/70 shadow-sm'
                      : 'bg-surface-subtle hover:bg-surface-border/40 border-surface-border'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-100 flex items-center flex-wrap gap-2">
                      <Hammer className="w-4 h-4 text-emerald-400" />
                      <span>{c.buildingName || 'Crafting Station'}</span>

                      {isAssisted && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-semibold">
                          <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          Tracked Station
                        </span>
                      )}

                      {itemMeta && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60 font-medium">
                          📦 {itemMeta.name} {itemMeta.tier ? `(T${itemMeta.tier})` : ''}
                        </span>
                      )}
                      {skill && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-normal">
                          {skill.icon} {skill.name} (Req Lvl {c.levelRequirements?.[0]?.level || 1})
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        {c.claimName || 'Wilderness'} ({c.regionName || `Region ${c.regionId}`})
                      </span>
                      <span>•</span>
                      <span>Owner: <strong className="text-gray-300">{c.ownerUsername || 'Unknown'}</strong></span>
                    </div>
                    <div className="text-gray-400 font-mono text-[11px]">
                      Progress: <strong className="text-gray-200">{c.progress.toLocaleString()}</strong> / {c.totalActionsRequired.toLocaleString()} ({pct.toFixed(1)}%)
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onSelectCraft(c);
                      onClose();
                    }}
                    className={`self-end sm:self-center inline-flex items-center gap-1 font-semibold px-3 py-1.5 rounded-lg transition-colors shadow cursor-pointer ${
                      isAssisted
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    <span>Analyze Craft</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-surface-border bg-surface-subtle/30 flex justify-between items-center text-xs text-gray-400">
          <span>Found {sortedCrafts.length} public crafts</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-surface-subtle hover:bg-surface border border-surface-border rounded-lg text-gray-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
