import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

interface UpdateNotificationToastProps {
  hasUpdate: boolean;
  latestVersion: string | null;
  currentVersion: string;
  onReload: () => void;
  onDismiss: () => void;
}

export const UpdateNotificationToast: React.FC<UpdateNotificationToastProps> = ({
  hasUpdate,
  latestVersion,
  currentVersion,
  onReload,
  onDismiss,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [isAutoReloadPaused, setIsAutoReloadPaused] = useState<boolean>(false);

  useEffect(() => {
    if (!hasUpdate) return;

    if (isAutoReloadPaused) return;

    if (secondsRemaining <= 0) {
      onReload();
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [hasUpdate, secondsRemaining, isAutoReloadPaused, onReload]);

  if (!hasUpdate) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-surface border-2 border-emerald-500/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300"
      onMouseEnter={() => setIsAutoReloadPaused(true)}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-gray-100">
                New Update Available!
              </h4>
              <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                v{latestVersion || 'Latest'}
              </span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              A new version of BitCraft XP Calculator has been published (current: v{currentVersion}).
            </p>
            {!isAutoReloadPaused ? (
              <p className="text-[11px] text-emerald-400/90 font-mono">
                Auto-reloading in {secondsRemaining}s...
              </p>
            ) : (
              <p className="text-[11px] text-gray-400 font-mono">
                Auto-reload paused (hovering).
              </p>
            )}
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-surface-subtle transition-colors cursor-pointer shrink-0"
          title="Dismiss update notification"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-end gap-2.5 mt-3 pt-2.5 border-t border-surface-border">
        <button
          onClick={onDismiss}
          className="text-xs font-medium text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-surface-subtle transition-colors cursor-pointer"
        >
          Later
        </button>
        <button
          onClick={onReload}
          className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/40 px-3.5 py-1.5 rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reload Now</span>
        </button>
      </div>
    </div>
  );
};
