import { Component, type ErrorInfo, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

function isChunkError(error: Error | null): boolean {
  if (!error) return false;
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo.componentStack);

    this.setState({ error, errorInfo });

    const CHUNK_RETRY_KEY = '__chunk_error_retry_ts';
    if (isChunkError(error)) {
      const stored = sessionStorage.getItem(CHUNK_RETRY_KEY);
      const now = Date.now();
      if (!stored || now - parseInt(stored, 10) > 10_000) {
        sessionStorage.setItem(CHUNK_RETRY_KEY, String(now));
        window.location.reload();
        return;
      }
    }

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const email = sessionData.session?.user?.email || null;
        await supabase.from('client_errors').insert({
          message: error.message || 'Unknown error',
          stack: (error.stack || '').slice(0, 2000),
          component_stack: errorInfo.componentStack || null,
          url: window.location.href,
          user_email: email,
        });
      } catch {
        // Silent — never block the error screen
      }
    })();
  }

  handleReload = () => {
    sessionStorage.removeItem('__chunk_error_retry_ts');
    sessionStorage.removeItem('__vite_retry_ts');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isChunk = isChunkError(this.state.error);
      const title = isChunk
        ? 'A new version of the site is available'
        : 'Something went wrong';
      const subtitle = isChunk
        ? 'Please reload to get the latest version.'
        : 'An unexpected error occurred while loading this page.';

      return (
        <div className="min-h-screen bg-[#080c14] text-white flex items-center justify-center px-4 font-sans antialiased">
          <div className="text-center max-w-sm">
            <p className="text-lg font-bold text-white mb-2">{title}</p>
            <p className="text-sm text-white/40 mb-4">{subtitle}</p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.08] border border-white/10 text-sm font-semibold text-white hover:bg-white/[0.12] transition-all"
            >
              Reload
            </button>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-[11px] text-white/30 hover:text-white/50 cursor-pointer transition-colors">
                  Error details
                </summary>
                <div className="mt-2 rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <p className="text-[11px] text-red-400/80 font-mono break-all leading-relaxed">
                    {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <pre className="mt-2 text-[10px] text-white/30 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                      {this.state.error.stack.slice(0, 1500)}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
