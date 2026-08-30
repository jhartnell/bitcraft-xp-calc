import React, { useState, useEffect } from 'react';
import {
  Globe,
  X,
  Search,
  Loader2,
  MapPin,
  Hammer,
  ArrowRight,
  Star,
  ChevronDown,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { CraftResult, ItemMetadata } from '../types/api';
import { bitjitaApi } from '../services/apiClient';
import {
  SKILL_DEFINITIONS,
  SkillDefinition,
  getBitCraftMapUrl,
  resolveCraftCoordinates,
  toBitCraftCoords,
} from '../services/bitcraftData';

interface PublicCraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCraft: (craft: CraftResult) => void;
  playerId?: string;
  playerUsername?: string;
  playerRegionId?: number;
}

interface ProfessionGroup {
  skillId: number;
  def: SkillDefinition;
  crafts: CraftResult[];
  minLevel: number;
  maxLevel: number;
}

function compareCraftsByLevelDesc(a: CraftResult, b: CraftResult): number {
  const aLvl = a.levelRequirements?.[0]?.level || 1;
  const bLvl = b.levelRequirements?.[0]?.level || 1;
  if (bLvl !== aLvl) return bLvl - aLvl;
  const aPct = a.totalActionsRequired > 0 ? a.progress / a.totalActionsRequired : 0;
  const bPct = b.totalActionsRequired > 0 ? b.progress / b.totalActionsRequired : 0;
  return bPct - aPct;
}

export const PublicCraftsModal: React.FC<PublicCraftsModalProps> = ({
  isOpen,
  onClose,
  onSelectCraft,
  playerId,
  playerUsername,
  playerRegionId,
}) => {
  const [crafts, setCrafts] = useState<CraftResult[]>([]);
  const [itemsMap, setItemsMap] = useState<Map<number, ItemMetadata>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<number | 'all'>(
    playerRegionId ?? 'all'
  );
  const [selectedProfession, setSelectedProfession] = useState<number | 'all'>('all');
  const [minTier, setMinTier] = useState(1);
  const [maxTier, setMaxTier] = useState(10);
  const [onlyAssistedFilter, setOnlyAssistedFilter] = useState(false);
  const [isFilterSetOpen, setIsFilterSetOpen] = useState(false);
  const [assistedCraftIds, setAssistedCraftIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<number | 'tracked'>>(
    new Set(['tracked'])
  );

  // Default region filter to active player's region whenever modal opens
  useEffect(() => {
    if (isOpen && playerRegionId) {
      setSelectedRegion(playerRegionId);
    }
  }, [isOpen, playerRegionId]);

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

  // Extract all unique regions and count how many active crafts exist in each
  const regionOptions = React.useMemo(() => {
    const counts = new Map<number, { count: number; name?: string }>();
    for (const c of crafts) {
      if (c.regionId) {
        const existing = counts.get(c.regionId);
        if (existing) {
          existing.count += 1;
          if (!existing.name && c.regionName) existing.name = c.regionName;
        } else {
          counts.set(c.regionId, { count: 1, name: c.regionName });
        }
      }
    }
    return Array.from(counts.entries()).sort((a, b) => {
      if (playerRegionId && a[0] === playerRegionId) return -1;
      if (playerRegionId && b[0] === playerRegionId) return 1;
      return b[1].count - a[1].count;
    });
  }, [crafts, playerRegionId]);

  // Extract all unique professions and count active crafts
  const professionOptions = React.useMemo(() => {
    const counts = new Map<number, number>();
    for (const c of crafts) {
      const sId = c.levelRequirements?.[0]?.skill_id || c.experiencePerProgress?.[0]?.skill_id;
      if (sId && SKILL_DEFINITIONS[sId]) {
        counts.set(sId, (counts.get(sId) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([skillId, count]) => ({
        skillId,
        def: SKILL_DEFINITIONS[skillId],
        count,
      }))
      .sort((a, b) => a.def.name.localeCompare(b.def.name));
  }, [crafts]);

  const handleToggleTrack = (craftId: string) => {
    if (!playerId) return;
    try {
      const key = `bitcraft_assisted_crafts_${playerId}`;
      const next = new Set(assistedCraftIds);
      if (next.has(craftId)) {
        next.delete(craftId);
      } else {
        next.add(craftId);
      }
      setAssistedCraftIds(next);
      localStorage.setItem(key, JSON.stringify(Array.from(next)));
    } catch {
      // ignore
    }
  };

  const isAssistedCraft = (c: CraftResult) => {
    return assistedCraftIds.has(c.entityId);
  };

  const matchingCrafts = crafts.filter((c) => {
    if (onlyAssistedFilter && !isAssistedCraft(c)) return false;
    if (selectedRegion !== 'all' && c.regionId !== selectedRegion) return false;

    const craftSkillId = c.levelRequirements?.[0]?.skill_id || c.experiencePerProgress?.[0]?.skill_id;
    if (selectedProfession !== 'all' && craftSkillId !== selectedProfession) return false;

    const targetId = c.craftedItem?.[0]?.item_id;
    const itemMeta = targetId ? itemsMap.get(Number(targetId)) : undefined;

    // Filter by Item Tier Range
    const craftTier = itemMeta?.tier ?? 1;
    if (craftTier < minTier || craftTier > maxTier) return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase().trim();

    // Multi-format Region matching: matches "14", "region 14", "region14", "r14", or regionName
    const regionIdStr = c.regionId ? String(c.regionId) : '';
    const matchesRegion =
      (c.regionName && c.regionName.toLowerCase().includes(term)) ||
      (regionIdStr && (
        regionIdStr === term ||
        `region ${regionIdStr}`.includes(term) ||
        `region${regionIdStr}`.includes(term) ||
        `r${regionIdStr}`.includes(term)
      ));

    return (
      (c.buildingName && c.buildingName.toLowerCase().includes(term)) ||
      (c.claimName && c.claimName.toLowerCase().includes(term)) ||
      (c.ownerUsername && c.ownerUsername.toLowerCase().includes(term)) ||
      matchesRegion ||
      (itemMeta && itemMeta.name.toLowerCase().includes(term))
    );
  });

  // Group matching crafts by profession and sort each group by level requirement descending (Highest -> Lowest)
  const professionGroups = React.useMemo(() => {
    const groupsMap = new Map<number, CraftResult[]>();

    for (const c of matchingCrafts) {
      const sId = c.levelRequirements?.[0]?.skill_id || c.experiencePerProgress?.[0]?.skill_id || 1;
      const list = groupsMap.get(sId) || [];
      list.push(c);
      groupsMap.set(sId, list);
    }

    const result: ProfessionGroup[] = [];

    for (const [skillId, groupCrafts] of groupsMap.entries()) {
      // Sort within group: Skill Level Requirement descending (highest to lowest), then progressPct descending
      groupCrafts.sort(compareCraftsByLevelDesc);

      const levels = groupCrafts.map((c) => c.levelRequirements?.[0]?.level || 1);
      const minLevel = Math.min(...levels);
      const maxLevel = Math.max(...levels);

      result.push({
        skillId,
        def: SKILL_DEFINITIONS[skillId] || { id: skillId, name: `Skill ${skillId}`, category: 'Other', icon: '🛠️', color: '#6366f1' },
        crafts: groupCrafts,
        minLevel,
        maxLevel,
      });
    }

    // Sort groups alphabetically by profession name (A-Z)
    return result.sort((a, b) => a.def.name.localeCompare(b.def.name));
  }, [matchingCrafts]);

  // Tracked crafts sorted by required level descending
  const trackedCrafts = React.useMemo(() => {
    return matchingCrafts
      .filter(isAssistedCraft)
      .sort(compareCraftsByLevelDesc);
  }, [matchingCrafts, assistedCraftIds]);

  // Auto-expand groups when user searches or picks a specific profession
  useEffect(() => {
    if (searchTerm.trim() || selectedProfession !== 'all') {
      const all = new Set<number | 'tracked'>(['tracked', ...professionGroups.map((g) => g.skillId)]);
      setExpandedGroups(all);
    }
  }, [searchTerm, selectedProfession, professionGroups]);

  const toggleGroup = (id: number | 'tracked') => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    const all = new Set<number | 'tracked'>(['tracked', ...professionGroups.map((g) => g.skillId)]);
    setExpandedGroups(all);
  };

  const handleCollapseAll = () => {
    setExpandedGroups(new Set());
  };

  if (!isOpen) return null;

  const totalAssistedCount = crafts.filter(isAssistedCraft).length;
  const playerRegionCraftCount = playerRegionId ? (crafts.filter((c) => c.regionId === playerRegionId).length) : 0;
  const hasActiveDropdownFilters = Boolean(
    (playerRegionId ? selectedRegion !== playerRegionId : selectedRegion !== 'all') ||
    selectedProfession !== 'all' ||
    minTier !== 1 ||
    maxTier !== 10
  );

  const renderCraftCard = (c: CraftResult) => {
    const skillId = c.levelRequirements?.[0]?.skill_id || c.experiencePerProgress?.[0]?.skill_id || 1;
    const skill = SKILL_DEFINITIONS[skillId];
    const pct = c.totalActionsRequired > 0 ? (c.progress / c.totalActionsRequired) * 100 : 0;
    const targetId = c.craftedItem?.[0]?.item_id;
    const itemMeta = targetId ? itemsMap.get(Number(targetId)) : undefined;
    const isAssisted = isAssistedCraft(c);
    const isCurrentPlayerRegion = playerRegionId && c.regionId === playerRegionId;
    const isOwner = Boolean(
      playerUsername &&
        c.ownerUsername &&
        c.ownerUsername.toLowerCase() === playerUsername.toLowerCase()
    );
    const coords = resolveCraftCoordinates(c as unknown as Record<string, unknown>);
    const bcCoords = coords ? toBitCraftCoords(coords.x, coords.z) : null;
    const mapUrl = coords ? getBitCraftMapUrl(coords.x, coords.z) : null;

    return (
      <div
        key={c.entityId}
        className={`p-3 rounded-lg border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          isAssisted
            ? 'bg-indigo-950/40 hover:bg-indigo-950/60 border-indigo-600/70 shadow-sm'
            : 'bg-surface-subtle hover:bg-surface-border/40 border-surface-border'
        }`}
      >
        <div className="space-y-1 min-w-0">
          <div className="font-semibold text-gray-100 flex items-center flex-wrap gap-2">
            <Hammer className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{c.buildingName || 'Crafting Station'}</span>

            {isOwner && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-semibold shrink-0">
                👤 My Station
              </span>
            )}

            {isAssisted ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleTrack(c.entityId);
                }}
                title="Click to untrack this station"
                className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 hover:bg-rose-950/60 text-amber-300 hover:text-rose-300 border border-amber-500/30 hover:border-rose-500/50 flex items-center gap-1 font-semibold transition-all cursor-pointer group shrink-0"
              >
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 group-hover:hidden" />
                <X className="w-3 h-3 text-rose-400 hidden group-hover:inline" />
                <span className="group-hover:hidden">Tracked Station</span>
                <span className="hidden group-hover:inline">Untrack</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleTrack(c.entityId);
                }}
                title="Click to track/pin this station to the top"
                className="text-[10px] px-2 py-0.5 rounded-full bg-surface-subtle hover:bg-amber-950/40 text-gray-400 hover:text-amber-300 border border-surface-border hover:border-amber-700/50 flex items-center gap-1 font-medium transition-all cursor-pointer shrink-0"
              >
                <Star className="w-3 h-3 text-gray-500 hover:text-amber-400" />
                <span>Track</span>
              </button>
            )}

            {itemMeta && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/60 font-medium shrink-0">
                📦 {itemMeta.name} {itemMeta.tier ? `(T${itemMeta.tier})` : ''}
              </span>
            )}
            {skill && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProfession(selectedProfession === skillId ? 'all' : skillId);
                }}
                title={`Filter list by ${skill.name}`}
                className={`text-[10px] px-2 py-0.5 rounded border font-medium flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                  selectedProfession === skillId
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm font-semibold'
                    : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-400 border-emerald-800/60'
                }`}
              >
                <span>{skill.icon}</span>
                <span>{skill.name} (Req Lvl {c.levelRequirements?.[0]?.level || 1})</span>
              </button>
            )}
          </div>
          <div className="text-gray-400 flex items-center flex-wrap gap-2 text-[11px]">
            {/* Claim Name & Map Link */}
            {bcCoords && mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={`Open ${c.claimName || 'Station'} on BitCraftMap (N: ${bcCoords.n}, E: ${bcCoords.e})`}
                className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium hover:underline transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{c.claimName || 'Wilderness'}</span>
                <span className="text-[10px] text-emerald-300/80 font-mono">
                  (N {bcCoords.n}, E {bcCoords.e})
                </span>
                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-gray-300 font-medium">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{c.claimName || 'Wilderness'}</span>
              </span>
            )}

            {/* Distinct Region Filter Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRegion(c.regionId);
              }}
              title={`Filter list to Region ${c.regionId}`}
              className={`text-[10px] px-1.5 py-0.5 rounded border font-mono transition-colors cursor-pointer ${
                isCurrentPlayerRegion
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60 font-semibold'
                  : 'bg-surface hover:bg-surface-border text-gray-400 border-surface-border hover:text-gray-200'
              }`}
            >
              🌐 Region {c.regionId} {isCurrentPlayerRegion ? '(Your Region)' : ''}
            </button>

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
          className={`self-end sm:self-center inline-flex items-center gap-1 font-semibold px-3 py-1.5 rounded-lg transition-colors shadow cursor-pointer shrink-0 ${
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
  };

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
                Explore active community crafting projects grouped by profession and level requirement
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

        {/* Filter & Controls Area */}
        <div className="p-3 border-b border-surface-border bg-surface-subtle/50 space-y-2.5">
          {/* Tier 1: Search Bar & Collapsible Filter Set Toggle Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search station, item, owner, claim, or region (e.g. 14, Region 14)..."
                className="w-full bg-surface border border-surface-border rounded-lg pl-9 pr-4 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 shadow-inner"
              />
            </div>
            <button
              type="button"
              onClick={() => setIsFilterSetOpen((prev) => !prev)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                isFilterSetOpen
                  ? 'bg-surface-border text-gray-100 border-gray-500 shadow-sm'
                  : hasActiveDropdownFilters
                  ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                  : 'bg-surface hover:bg-surface-subtle text-gray-400 border-surface-border'
              }`}
              title="Toggle advanced region and profession dropdown filters"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {hasActiveDropdownFilters && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isFilterSetOpen ? 'rotate-180 text-emerald-400' : 'text-gray-500'
                }`}
              />
            </button>
          </div>

          {/* Tier 1.5: Collapsible Filter Set (Dropdowns & Tier Range, Collapsed by default) */}
          {isFilterSetOpen && (
            <div className="p-3 rounded-lg bg-surface/80 border border-surface-border space-y-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                <span>Filter Options</span>
                {hasActiveDropdownFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRegion(playerRegionId ?? 'all');
                      setSelectedProfession('all');
                      setMinTier(1);
                      setMaxTier(10);
                    }}
                    className="text-emerald-400 hover:underline cursor-pointer normal-case text-xs font-normal"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Row 1: Region & Profession Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Region Dropdown Filter */}
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 font-medium">
                    Region
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="w-full bg-surface border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 cursor-pointer font-mono"
                  >
                    <option value="all">🌐 All Regions ({crafts.length})</option>
                    {regionOptions.map(([regId, info]) => {
                      const isPlayerRegion = playerRegionId && regId === playerRegionId;
                      return (
                        <option key={regId} value={regId}>
                          {isPlayerRegion ? '📍 Your Region: ' : 'Region '}
                          {regId}
                          {info.name ? ` (${info.name})` : ''} — {info.count}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Profession Dropdown Filter */}
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1 font-medium">
                    Profession
                  </label>
                  <select
                    value={selectedProfession}
                    onChange={(e) => setSelectedProfession(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="w-full bg-surface border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="all">🛠️ All Professions ({crafts.length})</option>
                    {professionOptions.map(({ skillId, def, count }) => (
                      <option key={skillId} value={skillId}>
                        {def.icon} {def.name} — {count} crafts
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Item Tier Range Slider */}
              <div className="pt-2 border-t border-surface-border/60">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                      Item Tier Range:
                    </label>
                    <span className="text-xs font-mono font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                      {minTier === maxTier ? `Tier ${minTier}` : `T${minTier} – T${maxTier}`}
                    </span>
                  </div>
                  {/* Tier Quick Filter Pills */}
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => { setMinTier(1); setMaxTier(10); }}
                      className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                        minTier === 1 && maxTier === 10
                          ? 'bg-emerald-700 text-white border-emerald-600'
                          : 'bg-surface hover:bg-surface-border text-gray-400 border-surface-border'
                      }`}
                    >
                      All (T1-T10)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMinTier(1); setMaxTier(4); }}
                      className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                        minTier === 1 && maxTier === 4
                          ? 'bg-emerald-700 text-white border-emerald-600'
                          : 'bg-surface hover:bg-surface-border text-gray-400 border-surface-border'
                      }`}
                    >
                      T1–T4
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMinTier(5); setMaxTier(7); }}
                      className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                        minTier === 5 && maxTier === 7
                          ? 'bg-emerald-700 text-white border-emerald-600'
                          : 'bg-surface hover:bg-surface-border text-gray-400 border-surface-border'
                      }`}
                    >
                      T5–T7
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMinTier(8); setMaxTier(10); }}
                      className={`px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                        minTier === 8 && maxTier === 10
                          ? 'bg-emerald-700 text-white border-emerald-600'
                          : 'bg-surface hover:bg-surface-border text-gray-400 border-surface-border'
                      }`}
                    >
                      T8–T10
                    </button>
                  </div>
                </div>

                {/* Unified 2-Point Dual Range Slider */}
                <div className="pt-2 px-1">
                  <div className="relative h-6 flex items-center">
                    {/* Background Track */}
                    <div className="absolute w-full h-2 bg-surface-border rounded-lg" />

                    {/* Active Range Highlight */}
                    <div
                      className="absolute h-2 bg-emerald-500 rounded-lg"
                      style={{
                        left: `${((minTier - 1) / 9) * 100}%`,
                        width: `${((maxTier - minTier) / 9) * 100}%`,
                      }}
                    />

                    {/* Min Tier Thumb Input */}
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={minTier}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setMinTier(Math.min(val, maxTier));
                      }}
                      className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none cursor-pointer z-10 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-emerald-500 [&::-moz-range-thumb]:shadow-md"
                    />

                    {/* Max Tier Thumb Input */}
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={maxTier}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setMaxTier(Math.max(val, minTier));
                      }}
                      className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none cursor-pointer z-20 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-emerald-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-emerald-500 [&::-moz-range-thumb]:shadow-md"
                    />
                  </div>

                  {/* Tier Labels / Ticks (Clickable) */}
                  <div className="flex justify-between text-[10px] font-mono text-gray-400 select-none px-0.5 mt-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((t) => {
                      const isSelected = t >= minTier && t <= maxTier;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            if (t < minTier) setMinTier(t);
                            else if (t > maxTier) setMaxTier(t);
                            else {
                              setMinTier(t);
                              setMaxTier(t);
                            }
                          }}
                          className={`transition-colors cursor-pointer hover:text-white ${
                            isSelected ? 'text-emerald-400 font-bold' : 'text-gray-500'
                          }`}
                          title={`Set tier to T${t}`}
                        >
                          T{t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tier 2: Dynamic Quick Filters (Non-collapsible) */}
          <div className="flex items-center flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setOnlyAssistedFilter(false);
                setSelectedRegion('all');
                setSelectedProfession('all');
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors font-medium cursor-pointer ${
                !onlyAssistedFilter && selectedRegion === 'all' && selectedProfession === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-surface hover:bg-surface-border text-gray-400 border border-surface-border'
              }`}
            >
              All Stations ({crafts.length})
            </button>

            {playerRegionId && playerRegionCraftCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOnlyAssistedFilter(false);
                  setSelectedRegion(selectedRegion === playerRegionId ? 'all' : playerRegionId);
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 font-medium cursor-pointer ${
                  selectedRegion === playerRegionId
                    ? 'bg-emerald-700 text-white shadow-sm border border-emerald-500'
                    : 'bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/50 text-emerald-300'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>My Region: R{playerRegionId} ({playerRegionCraftCount})</span>
              </button>
            )}

            {totalAssistedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOnlyAssistedFilter(!onlyAssistedFilter);
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 font-medium cursor-pointer ${
                  onlyAssistedFilter
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>My Assisted ({totalAssistedCount})</span>
              </button>
            )}
          </div>

          {/* Tier 3: Dedicated Expand & Collapse Buttons Row */}
          <div className="flex items-center justify-between pt-1 border-t border-surface-border/60 text-xs">
            <span className="text-[11px] text-gray-400 font-mono">
              Found {matchingCrafts.length} crafts across {professionGroups.length} professions
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleExpandAll}
                className="px-2 py-0.5 bg-surface hover:bg-surface-border text-gray-300 border border-surface-border rounded-md text-[11px] font-medium cursor-pointer transition-colors"
                title="Expand all profession groups"
              >
                ▾ Expand All
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="px-2 py-0.5 bg-surface hover:bg-surface-border text-gray-400 border border-surface-border rounded-md text-[11px] font-medium cursor-pointer transition-colors"
                title="Collapse all profession groups"
              >
                ▸ Collapse All
              </button>
            </div>
          </div>
        </div>

        {/* Crafts List: Accordion Groups */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Fetching active public crafts from BitJita...</span>
            </div>
          ) : matchingCrafts.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500">
              No matching public crafts found.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Pinned Tracked Stations Group */}
              {trackedCrafts.length > 0 && !onlyAssistedFilter && (
                <div className="rounded-xl border border-indigo-700/60 bg-indigo-950/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleGroup('tracked')}
                    className="w-full flex items-center justify-between p-3 bg-indigo-950/60 hover:bg-indigo-950/80 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="font-bold text-gray-100 text-xs sm:text-sm">
                        My Tracked Stations
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-900/80 text-indigo-300 border border-indigo-700/60">
                        {trackedCrafts.length}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-indigo-300 transition-transform duration-200 ${
                        expandedGroups.has('tracked') ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {expandedGroups.has('tracked') && (
                    <div className="p-2.5 space-y-2 border-t border-indigo-800/40">
                      {trackedCrafts.map(renderCraftCard)}
                    </div>
                  )}
                </div>
              )}

              {/* Profession Accordion Groups */}
              {professionGroups.map(({ skillId, def, crafts: groupCrafts, minLevel, maxLevel }) => {
                const isExpanded = expandedGroups.has(skillId);
                return (
                  <div
                    key={skillId}
                    className="rounded-xl border border-surface-border bg-surface-subtle/30 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGroup(skillId)}
                      className="w-full flex items-center justify-between p-3 bg-surface hover:bg-surface-subtle transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0">{def.icon}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-100 flex items-center gap-2 text-xs sm:text-sm">
                            <span>{def.name}</span>
                            <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded-full bg-surface-subtle text-gray-400 border border-surface-border">
                              {groupCrafts.length} {groupCrafts.length === 1 ? 'station' : 'stations'}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {minLevel === maxLevel ? `Requirement: Level ${minLevel}` : `Requirements: Levels ${minLevel}–${maxLevel}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-gray-400">
                        <span className="text-[11px] font-mono hidden sm:inline">
                          Max Req: <strong className="text-emerald-400">Lvl {maxLevel}</strong>
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180 text-emerald-400' : 'text-gray-500'
                          }`}
                        />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-2.5 space-y-2 border-t border-surface-border/60 bg-surface-subtle/20 animate-in fade-in duration-150">
                        {groupCrafts.map(renderCraftCard)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-surface-border bg-surface-subtle/30 flex justify-between items-center text-xs text-gray-400">
          <span>Found {matchingCrafts.length} public crafts across {professionGroups.length} professions</span>
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
