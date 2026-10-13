import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080c14] text-white flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <p className="text-lg font-bold text-white mb-2">Something went wrong</p>
            <p className="text-sm text-white/40 mb-4">An unexpected error occurred while loading this page.</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.08] border border-white/10 text-sm font-semibold text-white hover:bg-white/[0.12] transition-all"
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
