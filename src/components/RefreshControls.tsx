import React, { useEffect, useState } from 'react';
import { RefreshCw, Play, Pause, Timer, CheckCircle2 } from 'lucide-react';

interface RefreshControlsProps {
  intervalSeconds: number; // 0 = Off
  onIntervalChange: (seconds: number) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onRefreshNow: () => void;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  nextRefreshAt: number | null;
}

const INTERVAL_OPTIONS = [
  { label: 'Off (Manual Only)', value: 0 },
  { label: '15 seconds', value: 15 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
  { label: '2 minutes', value: 120 },
  { label: '5 minutes', value: 300 },
];

export const RefreshControls: React.FC<RefreshControlsProps> = ({
  intervalSeconds,
  onIntervalChange,
  isPaused,
  onTogglePause,
  onRefreshNow,
  isRefreshing,
  lastUpdated,
  nextRefreshAt,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Single 1s ticker to update countdown and relative "Updated X ago" label purely
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const secondsUntilNext =
    intervalSeconds > 0 && !isPaused && nextRefreshAt
      ? Math.max(0, Math.ceil((nextRefreshAt - nowMs) / 1000))
      : 0;

  let relativeTimeString = 'Never';
  if (lastUpdated) {
    const diffSecs = Math.max(0, Math.floor((nowMs - lastUpdated.getTime()) / 1000));
    if (diffSecs < 5) {
      relativeTimeString = 'Just now';
    } else if (diffSecs < 60) {
      relativeTimeString = `${diffSecs}s ago`;
    } else {
      const mins = Math.floor(diffSecs / 60);
      relativeTimeString = `${mins}m ago`;
    }
  }

  return (
    <div className="bg-surface rounded-xl p-3.5 border border-surface-border flex flex-wrap items-center justify-between gap-3 text-sm">
      {/* Auto-refresh interval dropdown */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="auto-refresh-interval"
          className="text-xs font-medium text-gray-400 flex items-center gap-1.5"
        >
          <Timer className="w-3.5 h-3.5 text-emerald-400" />
          Auto-Refresh:
        </label>
        <select
          id="auto-refresh-interval"
          value={intervalSeconds}
          onChange={(e) => onIntervalChange(Number(e.target.value))}
          className="bg-surface-subtle border border-surface-border text-gray-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
        >
          {INTERVAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Pause / Resume Button (if auto-refresh active) */}
        {intervalSeconds > 0 && (
          <button
            type="button"
            onClick={onTogglePause}
            aria-label={isPaused ? 'Resume Auto-Refresh' : 'Pause Auto-Refresh'}
            className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 cursor-pointer ${
              isPaused
                ? 'bg-amber-950/60 border-amber-700/60 text-amber-300 hover:bg-amber-900/60'
                : 'bg-surface-subtle border-surface-border text-gray-300 hover:text-white'
            }`}
            title={isPaused ? 'Resume Auto-Refresh' : 'Pause Auto-Refresh'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Countdown Ring & Refresh Now Action */}
      <div className="flex items-center gap-3">
        {intervalSeconds > 0 && !isPaused && (
          <div className="text-xs text-gray-400 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            <span>Next in {secondsUntilNext}s</span>
          </div>
        )}

        <div className="text-xs text-gray-500 hidden sm:flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-gray-400" />
          <span>
            Updated: <strong className="text-gray-300">{relativeTimeString}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={onRefreshNow}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900/50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shadow-md shadow-emerald-950/40 disabled:cursor-not-allowed cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
};
