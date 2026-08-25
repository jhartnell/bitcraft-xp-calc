import React from 'react';
import { Sparkles, Database, Activity, ShieldCheck, RefreshCw } from 'lucide-react';
import { ApiClientStatus } from '../types/calculator';

interface HeaderProps {
  apiStatus: ApiClientStatus;
  onClearCache: () => void;
}

export const Header: React.FC<HeaderProps> = ({ apiStatus, onClearCache }) => {
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

        {/* API Health & Polite Cache Status */}
        <div className="flex items-center gap-3 bg-surface-subtle/80 px-3 py-1.5 rounded-lg border border-surface-border text-xs">
          {/* Caching Status */}
          <div className="flex items-center gap-1.5 text-gray-300">
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span>Cache: <strong className="text-gray-100">{apiStatus.cachedEntriesCount}</strong></span>
          </div>

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

          {/* Clear Cache Button */}
          <button
            onClick={onClearCache}
            title="Clear API Cache"
            className="ml-1 text-gray-400 hover:text-gray-200 transition-colors p-1 rounded hover:bg-surface"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
};
