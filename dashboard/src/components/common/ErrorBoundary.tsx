// dashboard/src/components/common/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-gray-900 border border-red-800/60 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-950 text-red-400 border border-red-800 flex items-center justify-center text-2xl font-bold">
                ⚠️
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Application Error Caught</h2>
                <p className="text-xs text-gray-400">Terjadi kesalahan tak terduga pada tampilan komponen React.</p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-red-400 block uppercase tracking-wider">Detail Error:</span>
              <div className="p-3.5 bg-gray-950 border border-gray-800 rounded-xl text-xs font-mono text-red-300 leading-relaxed overflow-x-auto max-h-48 whitespace-pre-wrap select-all">
                {this.state.error?.toString() || 'Unknown React error'}
              </div>
            </div>

            {this.state.errorInfo?.componentStack && (
              <details className="text-[11px] text-gray-400 font-mono space-y-1">
                <summary className="cursor-pointer hover:text-gray-200">Component Stack Trace</summary>
                <div className="p-3 bg-gray-950 rounded-xl border border-gray-800 max-h-36 overflow-y-auto whitespace-pre-wrap text-gray-500">
                  {this.state.errorInfo.componentStack}
                </div>
              </details>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2"
              >
                <span>🔄</span> Reload Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
