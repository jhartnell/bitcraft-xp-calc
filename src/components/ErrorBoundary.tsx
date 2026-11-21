import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Unhandled UI ErrorBoundary exception:', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: null });
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
            <div className="flex items-center justify-center gap-2 pt-2">
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
