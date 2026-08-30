import React, { useState, useEffect } from 'react';
import {
  Database,
  Trash2,
  X,
  Clock,
  ShieldCheck,
  Search,
  AlertTriangle,
  RefreshCw,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { ApiClientStatus, CachedEndpointInfo } from '../types/calculator';
import { useHoverPopoverState } from '../hooks/useHoverPopoverState';
import { bitjitaApi } from '../services/apiClient';

interface CacheInspectorPopoverProps {
  apiStatus: ApiClientStatus;
  onClearCache: () => void;
  children: React.ReactNode;
  className?: string;
}

export const CacheInspectorPopover: React.FC<CacheInspectorPopoverProps> = ({
  apiStatus,
  onClearCache,
  children,
  className = '',
}) => {
  const { isOpen, handleMouseEnter, handleMouseLeave, toggle } = useHoverPopoverState(200);
  const [activeTab, setActiveTab] = useState<'cache' | 'anomalies'>('cache');
  const [filterText, setFilterText] = useState('');
  const [retryingEndpoint, setRetryingEndpoint] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const cachedEntries = apiStatus.cachedEntries || [];
  const anomalies = apiStatus.anomalies || [];

  // If there are anomalies and no cache, switch default tab
  useEffect(() => {
    if (anomalies.length > 0 && cachedEntries.length === 0) {
      setActiveTab('anomalies');
    }
  }, [anomalies.length, cachedEntries.length]);

  // Update relative timestamps while popover is open
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const handleEvict = (e: React.MouseEvent, endpoint: string) => {
    e.stopPropagation();
    bitjitaApi.evictEntry(endpoint);
  };

  const handleDismissAnomaly = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    bitjitaApi.dismissAnomaly(id);
  };

  const handleRetryAnomaly = async (e: React.MouseEvent, endpoint: string) => {
    e.stopPropagation();
    setRetryingEndpoint(endpoint);
    try {
      bitjitaApi.evictEntry(endpoint);
      await bitjitaApi.fetchWithCache(endpoint, 15000, true);
    } catch {
      // Re-triggers error handling
    } finally {
      setRetryingEndpoint(null);
    }
  };

  const filteredEntries = filterText.trim()
    ? cachedEntries.filter((item) =>
        item.endpoint.toLowerCase().includes(filterText.trim().toLowerCase())
      )
    : cachedEntries;

  const filteredAnomalies = filterText.trim()
    ? anomalies.filter(
        (a) =>
          a.endpoint.toLowerCase().includes(filterText.trim().toLowerCase()) ||
          a.message.toLowerCase().includes(filterText.trim().toLowerCase())
      )
    : anomalies;

  // Group by categories
  const categories: Array<{
    key: CachedEndpointInfo['category'];
    label: string;
    icon: string;
    entries: CachedEndpointInfo[];
  }> = [
    {
      key: 'character',
      label: 'Character & Equipment',
      icon: '👤',
      entries: filteredEntries.filter((e) => e.category === 'character'),
    },
    {
      key: 'craft',
      label: 'Crafting & Contributions',
      icon: '🔨',
      entries: filteredEntries.filter((e) => e.category === 'craft'),
    },
    {
      key: 'metadata',
      label: 'Items & Cargo Metadata',
      icon: '📦',
      entries: filteredEntries.filter((e) => e.category === 'metadata'),
    },
    {
      key: 'catalog',
      label: 'Master Catalogs',
      icon: '📜',
      entries: filteredEntries.filter((e) => e.category === 'catalog'),
    },
  ];

  const formatAge = (timestamp: number) => {
    const elapsedSecs = Math.max(0, Math.floor((now - timestamp) / 1000));
    if (elapsedSecs < 60) return `${elapsedSecs}s ago`;
    const mins = Math.floor(elapsedSecs / 60);
    const remainingSecs = elapsedSecs % 60;
    return `${mins}m ${remainingSecs}s ago`;
  };

  const formatRemainingTtl = (expiresAt: number, ttlMs: number) => {
    if (ttlMs >= 3600000) {
      return '1h Static TTL';
    }
    const remainingSecs = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    if (remainingSecs <= 0) return 'Expired';
    return `Expires in ${remainingSecs}s`;
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div onClick={toggle} className="cursor-pointer">
        {children}
      </div>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-[360px] sm:w-[480px] md:w-[560px] max-w-[95vw] bg-surface/95 backdrop-blur-xl border border-surface-border rounded-xl shadow-2xl p-4 z-50 text-xs text-gray-300 animate-in fade-in zoom-in-95 duration-150 space-y-3 font-sans">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-surface-border pb-3">
            <div className="space-y-0.5">
              <div className="font-bold text-gray-100 flex items-center gap-2 text-sm flex-wrap">
                <Database className="w-4 h-4 text-indigo-400" />
                <span>BitJita Cache & Data Health</span>
                {anomalies.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/90 border border-amber-600/70 text-amber-300 font-mono font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    {anomalies.length} {anomalies.length === 1 ? 'Warning' : 'Warnings'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                In-memory endpoints, live data freshness, and unpopulated payload diagnostics.
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onClearCache();
              }}
              title="Clear All Cached Endpoints & Re-query BitJita"
              className="flex items-center gap-1 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 hover:border-red-600 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shrink-0 shadow-sm"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
              <span>Clear All</span>
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-surface-border/60 pb-1 text-xs">
            <button
              onClick={() => setActiveTab('cache')}
              className={`flex items-center gap-1.5 pb-1 px-1 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'cache'
                  ? 'border-indigo-400 text-indigo-300 font-bold'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Active Cache ({cachedEntries.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('anomalies')}
              className={`flex items-center gap-1.5 pb-1 px-1 border-b-2 font-medium transition-colors cursor-pointer ${
                activeTab === 'anomalies'
                  ? 'border-amber-500 text-amber-300 font-bold'
                  : anomalies.length > 0
                  ? 'border-transparent text-amber-400 hover:text-amber-300'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Data Anomalies & Warnings ({anomalies.length})</span>
            </button>
          </div>

          {/* Quick Search Filter & Telemetry Stats Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-surface-subtle p-2 rounded-lg border border-surface-border/60 text-[11px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  activeTab === 'cache'
                    ? 'Filter cached URL paths...'
                    : 'Filter anomalies or error messages...'
                }
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 bg-surface border border-surface-border rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              {filterText && (
                <button
                  onClick={() => setFilterText('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Telemetry Pills */}
            <div className="flex items-center gap-2 shrink-0 font-mono text-[10px] text-gray-400">
              <span title="Queue rate spacing between requests">⚡ 120ms Spacing</span>
              <span>•</span>
              <span
                className={apiStatus.rateLimitBackoffMs > 0 ? 'text-amber-400 font-bold' : 'text-emerald-400'}
                title="Active 429 backoff penalty"
              >
                Backoff: {apiStatus.rateLimitBackoffMs}ms
              </span>
            </div>
          </div>

          {/* TAB 1: CACHED URL LIST */}
          {activeTab === 'cache' && (
            <div className="max-h-[320px] overflow-y-auto pr-1 space-y-3 scrollbar-thin scrollbar-thumb-surface-border">
              {cachedEntries.length === 0 ? (
                <div className="text-center py-6 text-gray-400 space-y-1">
                  <p>No active endpoints cached in memory.</p>
                  <p className="text-[11px] text-gray-500">Endpoints will populate as character and crafting data are polled.</p>
                </div>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <p>No cached endpoints match "{filterText}".</p>
                </div>
              ) : (
                categories.map((cat) => {
                  if (cat.entries.length === 0) return null;
                  return (
                    <div key={cat.key} className="space-y-1.5">
                      {/* Category Header */}
                      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-300 px-1">
                        <div className="flex items-center gap-1.5">
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                          <span className="text-[10px] text-gray-500 font-mono font-normal">
                            ({cat.entries.length})
                          </span>
                        </div>
                      </div>

                      {/* URL Items */}
                      <div className="space-y-1">
                        {cat.entries.map((entry) => {
                          const isStatic = entry.ttlMs >= 3600000;
                          return (
                            <div
                              key={entry.endpoint}
                              className="p-2 rounded-lg bg-surface-subtle/70 border border-surface-border/50 hover:border-surface-border flex items-start justify-between gap-2 group transition-colors"
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                {/* Method & URL Path */}
                                <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-200 break-all leading-tight">
                                  <span className="px-1 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 text-[9px] font-bold shrink-0">
                                    {entry.method}
                                  </span>
                                  <span className="text-indigo-200/90 hover:text-white transition-colors">
                                    {entry.endpoint}
                                  </span>
                                </div>

                                {/* Timestamps & Freshness */}
                                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 text-gray-500" />
                                    <span>{formatAge(entry.timestamp)}</span>
                                  </span>
                                  <span>•</span>
                                  <span
                                    className={
                                      isStatic
                                        ? 'text-purple-300'
                                        : entry.isExpired
                                        ? 'text-amber-400'
                                        : 'text-emerald-400'
                                    }
                                  >
                                    {formatRemainingTtl(entry.expiresAt, entry.ttlMs)}
                                  </span>
                                  <span>•</span>
                                  <span className="text-gray-500">
                                    TTL: {entry.ttlMs >= 3600000 ? '1h' : `${entry.ttlMs / 1000}s`}
                                  </span>
                                </div>
                              </div>

                              {/* Evict Button */}
                              <button
                                onClick={(e) => handleEvict(e, entry.endpoint)}
                                title={`Evict "${entry.endpoint}" from cache`}
                                className="text-gray-500 hover:text-red-400 opacity-60 group-hover:opacity-100 p-1 rounded hover:bg-surface transition-all shrink-0 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: ANOMALIES & DATA WARNINGS */}
          {activeTab === 'anomalies' && (
            <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2.5 scrollbar-thin scrollbar-thumb-surface-border">
              <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-2.5 text-[11px] text-amber-200/90 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-amber-300">BitJita Server Data Health Diagnostics</p>
                  <p className="text-[10px] text-gray-300 leading-relaxed">
                    Flags endpoints that returned empty/null objects, missing SpacetimeDB arrays, or network errors. When detected, the calculator activates automatic fallback logic.
                  </p>
                </div>
              </div>

              {anomalies.length === 0 ? (
                <div className="text-center py-8 text-gray-400 space-y-1.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto opacity-80" />
                  <p className="font-semibold text-gray-200">All Server Data Healthy</p>
                  <p className="text-[11px] text-gray-500">No null payloads, missing tables, or HTTP errors detected.</p>
                </div>
              ) : filteredAnomalies.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <p>No anomalies match "{filterText}".</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] text-gray-400 font-mono">
                      {filteredAnomalies.length} {filteredAnomalies.length === 1 ? 'Anomaly Logged' : 'Anomalies Logged'}
                    </span>
                    <button
                      onClick={() => bitjitaApi.clearAnomalies()}
                      className="text-[10px] text-gray-400 hover:text-red-300 underline cursor-pointer"
                    >
                      Clear Log
                    </button>
                  </div>

                  {filteredAnomalies.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg bg-surface-subtle border border-amber-800/40 hover:border-amber-700/60 space-y-2 text-xs transition-colors shadow-inner"
                    >
                      {/* Top Row: Method, Endpoint & Age */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-200 break-all leading-tight">
                          <span className="px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60 text-[9px] font-bold shrink-0">
                            {item.method}
                          </span>
                          <span className="text-amber-200/90">{item.endpoint}</span>
                        </div>

                        <span className="text-[10px] text-gray-500 font-mono shrink-0">
                          {formatAge(item.timestamp)}
                        </span>
                      </div>

                      {/* Issue Description */}
                      <div className="text-[11px] text-gray-200 bg-surface/80 p-2 rounded border border-surface-border space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                          <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                          <span>{item.message}</span>
                        </div>
                        {item.impact && (
                          <div className="text-[10px] text-gray-400 pl-4.5">
                            ↳ <strong>Fallback:</strong> {item.impact}
                          </div>
                        )}
                      </div>

                      {/* Controls Row */}
                      <div className="flex items-center justify-between pt-0.5 text-[10px]">
                        <button
                          onClick={(e) => handleRetryAnomaly(e, item.endpoint)}
                          disabled={retryingEndpoint === item.endpoint}
                          className="flex items-center gap-1 text-indigo-300 hover:text-indigo-200 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/50 px-2 py-0.5 rounded transition-colors cursor-pointer"
                        >
                          <RefreshCw
                            className={`w-2.5 h-2.5 ${retryingEndpoint === item.endpoint ? 'animate-spin' : ''}`}
                          />
                          <span>{retryingEndpoint === item.endpoint ? 'Retrying...' : 'Retry Endpoint'}</span>
                        </button>

                        <button
                          onClick={(e) => handleDismissAnomaly(e, item.id)}
                          className="text-gray-500 hover:text-gray-300 transition-colors p-0.5"
                          title="Dismiss Warning"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Safeguards Info */}
          <div className="border-t border-surface-border pt-2 flex items-center justify-between text-[10px] text-gray-500 font-mono">
            <span className="flex items-center gap-1 text-emerald-400/90">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>In-Flight Request Deduplication Active</span>
            </span>
            <span>BitJita API Proxy</span>
          </div>
        </div>
      )}
    </div>
  );
};
