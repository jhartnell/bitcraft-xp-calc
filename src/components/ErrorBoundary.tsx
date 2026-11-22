import React from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import {
  buildDiagnosticsReport,
  copyTextToClipboard,
  formatDiagnosticsReport,
  recordDiagnosticEvent,
} from '../services/diagnosticsCollector';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
  errorStack?: string;
  componentStack?: string;
  copyStatus: 'idle' | 'copied' | 'failed';
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: null,
      copyStatus: 'idle',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected rendering error occurred.',
      errorStack: error?.stack,
      copyStatus: 'idle',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Unhandled UI ErrorBoundary exception:', error, info.componentStack);
    this.setState({
      errorStack: error?.stack,
      componentStack: info.componentStack || undefined,
    });
    recordDiagnosticEvent({
      level: 'error',
      source: 'error-boundary',
      message: error?.message || 'Unhandled React rendering crash',
      details: {
        stack: error?.stack,
        componentStack: info.componentStack || undefined,
      },
    });
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      errorMessage: null,
      errorStack: undefined,
      componentStack: undefined,
      copyStatus: 'idle',
    });
  };

  private handleCopyCrashDiagnostics = async () => {
    const report = buildDiagnosticsReport({
      crash: {
        message: this.state.errorMessage || 'Unknown rendering error',
        stack: this.state.errorStack,
        componentStack: this.state.componentStack,
      },
    });
    const text = formatDiagnosticsReport(report, 'markdown');
    const ok = await copyTextToClipboard(text);
    this.setState({ copyStatus: ok ? 'copied' : 'failed' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-gray-100 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-surface border border-red-800/70 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-700/60 mx-auto flex items-center justify-center text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-gray-100">Something went wrong</h1>
              <p className="text-xs text-gray-400 leading-relaxed">
                BitCraft XP Calculator encountered an unexpected error while rendering live data.
              </p>
              {this.state.errorMessage && (
                <p className="text-[11px] font-mono text-red-300 bg-red-950/40 border border-red-900/60 rounded-lg p-2 mt-2 break-words">
                  {this.state.errorMessage}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => void this.handleCopyCrashDiagnostics()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-indigo-950/80 hover:bg-indigo-900/80 border border-indigo-700/60 text-indigo-200 transition-colors cursor-pointer"
              >
                {this.state.copyStatus === 'copied' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Diagnostics Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Crash Diagnostics</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="px-3.5 py-2 rounded-lg text-xs font-medium bg-surface-subtle hover:bg-surface-border border border-surface-border text-gray-200 transition-colors cursor-pointer"
              >
                Try Recovering
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
