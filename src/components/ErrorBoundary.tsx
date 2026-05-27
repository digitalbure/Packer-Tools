import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error captured by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-neutral-200 p-6 sans-serif">
          <div className="w-full max-w-2xl bg-neutral-800 border border-neutral-700 rounded-xl p-6 shadow-xl">
            <h1 className="text-2xl font-bold text-red-400 mb-2">Application Render Crash</h1>
            <p className="text-neutral-400 mb-4">
              Packer Tools encountered an unexpected error on this view. Below are the diagnostic details.
            </p>
            <div className="bg-neutral-950 p-4 rounded-lg overflow-x-auto text-xs font-mono text-red-300 max-h-96 border border-neutral-800">
              <strong className="text-white block mb-1">Error:</strong>
              {this.state.error?.toString()}
              {this.state.errorInfo && (
                <>
                  <strong className="text-white block mt-4 mb-1">Component Stack:</strong>
                  <span className="whitespace-pre-wrap block opacity-80">{this.state.errorInfo.componentStack}</span>
                </>
              )}
            </div>
            <div className="mt-6 flex gap-4">
              <button
                id="eb-reload-btn"
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-850 text-white rounded-lg transition text-sm font-medium cursor-pointer"
              >
                Reload App
              </button>
              <button
                id="eb-reset-btn"
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition text-sm font-medium cursor-pointer"
              >
                Try Component Reset
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

