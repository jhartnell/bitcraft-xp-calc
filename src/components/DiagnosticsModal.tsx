import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bug,
  X,
  Copy,
  Check,
  Download,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  Trash2,
} from 'lucide-react';
import {
  buildDiagnosticsReport,
  clearDiagnosticEvents,
  copyTextToClipboard,
  formatDiagnosticsReport,
} from '../services/diagnosticsCollector';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const [format, setFormat] = useState<'markdown' | 'json'>('markdown');
  const [anonymize, setAnonymize] = useState<boolean>(false);
  const [snapshotTick, setSnapshotTick] = useState<number>(0);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync native <dialog> top-layer modal open/close state and Safari light-dismiss fallback
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.setAttribute('closedby', 'any');
      if (!dialog.open && typeof dialog.showModal === 'function') {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener('close', handleClose);

    // Fallback light-dismiss for browsers without native closedby support (e.g. Safari)
    let cleanupFallback: (() => void) | undefined;
    if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      const handlePointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const handlePointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e)) {
          dialog.close();
        }
        pressedOutside = false;
      };
      dialog.addEventListener('pointerdown', handlePointerDown);
      dialog.addEventListener('pointerup', handlePointerUp);
      cleanupFallback = () => {
        dialog.removeEventListener('pointerdown', handlePointerDown);
        dialog.removeEventListener('pointerup', handlePointerUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      cleanupFallback?.();
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const report = useMemo(() => {
    if (!isOpen || snapshotTick < 0) return null;
    return buildDiagnosticsReport({ anonymize });
  }, [isOpen, anonymize, snapshotTick]);

  const formattedOutput = useMemo(() => {
    if (!report) return '';
    return formatDiagnosticsReport(report, format);
  }, [report, format]);

  if (!isOpen || !report) return null;

  const errorEventCount = report.recentEvents.filter((e) => e.level === 'error').length;
  const anomalyCount = report.apiHealth.anomalies.length;

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(formattedOutput);
    setCopyStatus(ok ? 'copied' : 'failed');
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopyStatus('idle');
    }, 2500);
  };

  const handleDownloadJson = () => {
    const jsonText = formatDiagnosticsReport(report, 'json');
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const stamp = report.generatedAt.replace(/[:.]/g, '-');
    const link = document.createElement('a');
    link.href = url;
    link.download = `bitcraft-xp-calc-diagnostics-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClearEvents = () => {
    clearDiagnosticEvents();
    setSnapshotTick((t) => t + 1);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="diagnostics-modal-title"
      className="p-0 bg-transparent border-0 max-w-3xl w-[calc(100%-2rem)] max-h-[85vh] overflow-visible text-gray-100 open:flex open:flex-col m-auto"
    >
      <div className="bg-surface border border-surface-border rounded-xl shadow-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-zoom-in">
        {/* Header */}
        <div className="p-4 border-b border-surface-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 shrink-0">
              <Bug className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="diagnostics-modal-title" className="text-base font-bold text-gray-100 truncate">
                Browser Diagnostics &amp; Bug Report
              </h2>
              <p className="text-xs text-gray-400">
                100% local snapshot — copy and paste to share issue details for troubleshooting.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close diagnostics dialog"
            className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-surface-subtle transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Metric Pills */}
        <div className="px-4 py-2.5 bg-surface-subtle/60 border-b border-surface-border flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="px-2 py-0.5 rounded bg-surface border border-surface-border text-emerald-300">
            v{report.app.version} ({report.app.runtime})
          </span>
          <span
            className={`px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
              anomalyCount > 0
                ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
            }`}
          >
            {anomalyCount > 0 ? (
              <AlertTriangle className="w-3 h-3 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            )}
            {anomalyCount} API {anomalyCount === 1 ? 'Warning' : 'Warnings'}
          </span>
          <span
            className={`px-2 py-0.5 rounded border ${
              errorEventCount > 0
                ? 'bg-red-950/60 border-red-800/60 text-red-300'
                : 'bg-surface border-surface-border text-gray-300'
            }`}
          >
            {report.recentEvents.length} Events{errorEventCount > 0 ? ` (${errorEventCount} errors)` : ''}
          </span>
          <span className="px-2 py-0.5 rounded bg-surface border border-surface-border text-indigo-300">
            Cache: {report.apiHealth.cachedEntriesCount}
          </span>
          {report.dashboard?.selectedPlayer && (
            <span className="px-2 py-0.5 rounded bg-surface border border-surface-border text-gray-300 truncate max-w-[220px]">
              👤 {report.dashboard.selectedPlayer.username}
            </span>
          )}
        </div>

        {/* Controls Bar */}
        <div className="px-4 py-2.5 border-b border-surface-border flex flex-wrap items-center justify-between gap-2 text-xs bg-surface/80">
          <div className="flex flex-wrap items-center gap-2">
            {/* Format Switcher */}
            <div className="inline-flex rounded-lg border border-surface-border bg-surface-subtle p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setFormat('markdown')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  format === 'markdown'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Markdown (Discord / GitHub)
              </button>
              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  format === 'json'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Raw JSON
              </button>
            </div>

            {/* Anonymize Toggle */}
            <label className="inline-flex items-center gap-1.5 text-[11px] text-gray-300 cursor-pointer select-none px-2 py-1 rounded-lg bg-surface-subtle border border-surface-border hover:border-gray-600 transition-colors">
              <input
                type="checkbox"
                checked={anonymize}
                onChange={(e) => setAnonymize(e.target.checked)}
                className="accent-emerald-500 rounded cursor-pointer"
              />
              <EyeOff className="w-3.5 h-3.5 text-gray-400" />
              <span>Anonymize names &amp; IDs</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            {report.recentEvents.length > 0 && (
              <button
                type="button"
                onClick={handleClearEvents}
                title="Clear recorded runtime events"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-gray-400 hover:text-red-300 bg-surface-subtle border border-surface-border hover:border-red-800/60 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Events</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSnapshotTick((t) => t + 1)}
              title="Capture a fresh snapshot"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-gray-300 hover:text-white bg-surface-subtle border border-surface-border hover:border-gray-500 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Scrollable Diagnostic Report Preview */}
        <div className="flex-1 overflow-auto p-4 bg-background/80">
          <pre
            aria-label="Diagnostic report preview"
            className="text-[11px] leading-relaxed font-mono text-gray-200 whitespace-pre-wrap break-words bg-surface/70 border border-surface-border rounded-lg p-3 select-all"
          >
            {formattedOutput}
          </pre>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 border-t border-surface-border bg-surface-subtle/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              Allowlisted <code className="text-gray-300">bitcraft_*</code> state only • No cookies, auth tokens, or background uploads
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-border border border-surface-border text-gray-200 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopy()}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow ${
                copyStatus === 'copied'
                  ? 'bg-emerald-700 text-white'
                  : copyStatus === 'failed'
                    ? 'bg-red-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {copyStatus === 'copied' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : copyStatus === 'failed' ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Copy Failed</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy to Clipboard</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
};
