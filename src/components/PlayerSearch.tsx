import React, { useState, useEffect, useRef } from 'react';
import { Search, User, Users, Clock, Loader2, X, ChevronDown, Star } from 'lucide-react';
import { PlayerSummary } from '../types/api';
import { bitjitaApi } from '../services/apiClient';

interface PlayerSearchProps {
  selectedPlayer: PlayerSummary | null;
  onSelectPlayer: (player: PlayerSummary) => void;
  recentPlayers: PlayerSummary[];
  onRemoveRecent: (entityId: string) => void;
  isLoading: boolean;
  primaryPlayer?: PlayerSummary | null;
  onTogglePrimary?: (player: PlayerSummary) => void;
}

export const PlayerSearch: React.FC<PlayerSearchProps> = ({
  selectedPlayer,
  onSelectPlayer,
  recentPlayers,
  onRemoveRecent,
  isLoading,
  primaryPlayer,
  onTogglePrimary,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlayerSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const showLoading = isSearching || isLoading;

  // Debounced search
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await bitjitaApi.searchPlayers(query.trim());
        setSuggestions(res.players.slice(0, 8));
        setIsOpen(true);
      } catch (err) {
        console.error('Player search error:', err);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (player: PlayerSummary) => {
    onSelectPlayer(player);
    setQuery('');
    setIsOpen(false);
    setIsDropdownOpen(false);
  };

  const isCurrentPrimary = Boolean(
    selectedPlayer && primaryPlayer && selectedPlayer.entityId === primaryPlayer.entityId
  );

  return (
    <div className="bg-surface rounded-xl p-4 border border-surface-border shadow-lg" ref={searchContainerRef}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search Input Box */}
        <div className="relative flex-1">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setIsOpen(true);
              }}
              placeholder="Search player name (e.g. Ikuria, DOOM, Ameger)..."
              className="w-full bg-surface-subtle border border-surface-border rounded-lg pl-9 pr-10 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
            {showLoading ? (
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin absolute right-3" />
            ) : query ? (
              <button
                onClick={() => setQuery('')}
                className="text-gray-400 hover:text-gray-200 absolute right-3"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {/* Autocomplete Suggestions Dropdown */}
          {isOpen && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface border border-surface-border rounded-lg shadow-2xl z-40 overflow-hidden max-h-64 overflow-y-auto">
              <div className="p-1.5 space-y-1">
                {suggestions.map((p) => (
                  <button
                    key={p.entityId}
                    onClick={() => handleSelect(p)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left rounded-md hover:bg-surface-subtle transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400 font-semibold text-xs">
                        {p.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-100 group-hover:text-emerald-300">
                          {p.username}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          ID: {p.entityId.slice(0, 8)}...
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      {p.signedIn ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Online
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                          Offline
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected Character & Quick Switcher */}
        <div className="flex items-center gap-2">
          {selectedPlayer ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2.5 bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 rounded-lg text-sm text-gray-100 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-bold text-xs">
                    {selectedPlayer.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-emerald-400 font-semibold">Active Character</div>
                    <div className="text-sm font-bold leading-none">{selectedPlayer.username}</div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-emerald-400 ml-1" />
                </button>

                {/* Character switcher popup */}
                {isDropdownOpen && recentPlayers.length > 0 && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 bg-surface border border-surface-border rounded-lg shadow-2xl z-40 p-2">
                    <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1">
                      <Users className="w-3 h-3 text-emerald-400" />
                      Switch Character
                    </div>
                    <div className="space-y-1 mt-1">
                      {recentPlayers.map((rp) => (
                        <button
                          key={rp.entityId}
                          onClick={() => handleSelect(rp)}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left text-sm transition-colors ${
                            rp.entityId === selectedPlayer.entityId
                              ? 'bg-emerald-950/80 text-emerald-300 font-semibold'
                              : 'hover:bg-surface-subtle text-gray-200'
                          }`}
                        >
                          <span>{rp.username}</span>
                          {primaryPlayer?.entityId === rp.entityId && (
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pin as Primary Button */}
              {onTogglePrimary && (
                <button
                  onClick={() => onTogglePrimary(selectedPlayer)}
                  title={
                    isCurrentPrimary
                      ? 'Primary character watched by extension (alerts red when idle). Click to unpin.'
                      : 'Pin this character as Primary Watch for browser toolbar badge alerts.'
                  }
                  className={`p-2 rounded-lg border transition-all flex items-center gap-1 text-xs ${
                    isCurrentPrimary
                      ? 'bg-amber-950/60 border-amber-500/80 text-amber-300 shadow-md shadow-amber-950/40'
                      : 'bg-surface-subtle border-surface-border text-gray-400 hover:text-amber-300 hover:border-amber-500/50'
                  }`}
                >
                  <Star className={`w-4 h-4 ${isCurrentPrimary ? 'fill-amber-400 text-amber-400' : ''}`} />
                  <span className="hidden sm:inline font-medium">
                    {isCurrentPrimary ? 'Primary Watch' : 'Pin Primary'}
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-amber-400/90 bg-amber-950/30 border border-amber-800/40 px-3 py-2 rounded-lg">
              <User className="w-4 h-4" />
              <span>Select a player to begin</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent Players History Chips */}
      {recentPlayers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-surface-border/60 flex items-center gap-2 overflow-x-auto text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="shrink-0">Recent:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {recentPlayers.map((rp) => (
              <span
                key={rp.entityId}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors ${
                  selectedPlayer?.entityId === rp.entityId
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60 font-semibold'
                    : 'bg-surface-subtle hover:bg-surface-border text-gray-300 border-surface-border'
                }`}
              >
                <button
                  onClick={() => handleSelect(rp)}
                  className="hover:underline cursor-pointer flex items-center gap-1"
                >
                  {primaryPlayer?.entityId === rp.entityId && (
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  )}
                  <span>{rp.username}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveRecent(rp.entityId);
                  }}
                  className="text-gray-500 hover:text-gray-300 p-0.5 rounded"
                  title="Remove from recents"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
