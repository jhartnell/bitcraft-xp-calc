import React from 'react';
import { Sparkles, Database, Activity, ShieldCheck, RefreshCw, ExternalLink, ChevronDown } from 'lucide-react';
import { ApiClientStatus } from '../types/calculator';
import { CacheInspectorPopover } from './CacheInspectorPopover';

interface HeaderProps {
  apiStatus: ApiClientStatus;
  onClearCache: () => void;
}

export const Header: React.FC<HeaderProps> = ({ apiStatus, onClearCache }) => {
  const handleOpenInNewTab = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime?.getURL) {
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    } else {
      window.open(window.location.href, '_blank');
    }
  };

  return (
    <header className="border-b border-surface-border bg-surface/80 backdrop-blur-md sticky top-0 z-30 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-900/30 border border-emerald-400/30">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-100 tracking-tight">
                BitCraft <span className="text-emerald-400">XP Calculator</span>
              </h1>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                BitJita API
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Live craft tracking, equipment modifiers & projected level-ups
            </p>
          </div>
        </div>

        {/* API Health, Cache Status & Tab Expansion */}
        <div className="flex items-center gap-2 sm:gap-3 bg-surface-subtle/80 px-3 py-1.5 rounded-lg border border-surface-border text-xs">
          {/* Caching Status & Popover */}
          <CacheInspectorPopover apiStatus={apiStatus} onClearCache={onClearCache}>
            <div
              className={`flex items-center gap-1.5 transition-colors cursor-pointer group px-1.5 py-0.5 rounded hover:bg-surface ${
                apiStatus.anomalies && apiStatus.anomalies.length > 0
                  ? 'text-amber-300 hover:text-amber-200 bg-amber-950/40 border border-amber-800/50'
                  : 'text-gray-300 hover:text-indigo-300'
              }`}
              title="Click or hover to inspect cached URL endpoints & server data health"
            >
              <Database className={`w-3.5 h-3.5 ${apiStatus.anomalies && apiStatus.anomalies.length > 0 ? 'text-amber-400' : 'text-indigo-400 group-hover:text-indigo-300'}`} />
              <span>
                Cache: <strong className="text-gray-100 group-hover:text-indigo-200 underline decoration-dotted decoration-indigo-400/60">{apiStatus.cachedEntriesCount}</strong>
              </span>
              {apiStatus.anomalies && apiStatus.anomalies.length > 0 && (
                <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5 ml-0.5">
                  <span>⚠️ {apiStatus.anomalies.length}</span>
                </span>
              )}
              <ChevronDown className={`w-3 h-3 ${apiStatus.anomalies && apiStatus.anomalies.length > 0 ? 'text-amber-400' : 'text-indigo-400/70 group-hover:text-indigo-300'}`} />
            </div>
          </CacheInspectorPopover>

          <span className="text-gray-600">|</span>

          {/* Latency */}
          <div className="flex items-center gap-1.5 text-gray-300">
            <Activity className={`w-3.5 h-3.5 ${apiStatus.isFetching ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
            <span>
              {apiStatus.lastResponseTimeMs !== null ? `${apiStatus.lastResponseTimeMs}ms` : 'Ready'}
            </span>
          </div>

          <span className="text-gray-600">|</span>

          {/* Rate Limit Protection */}
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rate Protected</span>
          </div>

          <span className="text-gray-600">|</span>

          {/* Action Buttons: Clear Cache & Expand to Full Tab */}
          <div className="flex items-center gap-1">
            <button
              onClick={onClearCache}
              title="Clear API Cache & Fetch Fresh Data"
              className="text-gray-400 hover:text-emerald-400 transition-colors p-1 rounded hover:bg-surface cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${apiStatus.isFetching ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            <button
              onClick={handleOpenInNewTab}
              title="Open Calculator in New Tab"
              className="text-emerald-400 hover:text-emerald-300 transition-colors p-1 rounded hover:bg-surface flex items-center gap-1 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px] font-medium">New Tab</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
