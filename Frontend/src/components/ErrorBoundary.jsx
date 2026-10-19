import React from 'react';
import { T } from './UI.jsx';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Enterprise ErrorBoundary:
 * - Catches render errors to prevent full app collapse.
 * - Generates unique error tracking ID.
 * - Captures component stack.
 * - Safely transmits to Sentry if initialized.
 * - Automatically resets on route/resetKey change.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error) {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    return { error, errorId };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error(`[CarbonVault ErrorBoundary] ${this.state.errorId || 'ERR'}:`, error, errorInfo?.componentStack);

    // Upload to Sentry if available
    try {
      if (typeof window !== 'undefined' && window.Sentry && typeof window.Sentry.captureException === 'function') {
        window.Sentry.captureException(error, {
          tags: { errorId: this.state.errorId },
          extra: { componentStack: errorInfo?.componentStack },
        });
      }
    } catch (sentryErr) {
      console.warn('[ErrorBoundary] Sentry transmission skipped:', sentryErr);
    }
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, errorInfo: null, errorId: null });
    }
  }

  render() {
    const { error, errorInfo, errorId } = this.state;
    if (error) {
      return (
        <div style={{ padding: 28, maxWidth: 680, margin: '0 auto' }}>
          <div
            style={{
              background: 'rgba(244,63,94,0.08)',
              border: '1px solid rgba(251,113,133,0.35)',
              borderRadius: 14,
              padding: 24,
              color: T.t2,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <AlertCircle size={22} color={T.roseL} />
              <div style={{ fontWeight: 800, color: T.roseL, fontSize: 16 }}>
                Something went wrong loading this view
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12, color: T.t3 }}>
              <span>Tracking ID:</span>
              <code style={{ background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: 4, color: T.tealL, fontWeight: 700 }}>
                {errorId || 'N/A'}
              </code>
            </div>

            <pre
              style={{
                margin: '0 0 14px 0',
                padding: 12,
                background: 'rgba(0,0,0,0.4)',
                borderRadius: 8,
                fontSize: 12,
                overflow: 'auto',
                color: T.t2,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 140,
              }}
            >
              {error?.message || String(error)}
            </pre>

            {errorInfo?.componentStack && (
              <details style={{ marginBottom: 14 }}>
                <summary style={{ fontSize: 12, color: T.t3, cursor: 'pointer', outline: 'none' }}>
                  Component Stack Trace
                </summary>
                <pre
                  style={{
                    marginTop: 8,
                    padding: 10,
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 6,
                    fontSize: 11,
                    overflow: 'auto',
                    color: T.t4,
                    maxHeight: 160,
                  }}
                >
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => this.setState({ error: null, errorInfo: null, errorId: null, copied: false })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: `1px solid ${T.border2}`,
                  background: 'rgba(255,255,255,0.06)',
                  color: T.t1,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                <RefreshCw size={13} />
                Try again
              </button>

              <button
                type="button"
                id="btn-copy-error-details"
                onClick={() => {
                  const details = [
                    `Tracking ID: ${errorId || 'N/A'}`,
                    `Message: ${error?.message || String(error)}`,
                    error?.stack ? `Stack:\n${error.stack}` : '',
                    errorInfo?.componentStack ? `Component Stack:\n${errorInfo.componentStack}` : ''
                  ].filter(Boolean).join('\n\n');
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(details).catch(() => {});
                  }
                  this.setState({ copied: true });
                  setTimeout(() => this.setState({ copied: false }), 2500);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: `1px solid ${this.state.copied ? T.teal : T.border2}`,
                  background: this.state.copied ? 'rgba(45,212,191,0.15)' : 'rgba(255,255,255,0.04)',
                  color: this.state.copied ? T.tealL : T.t2,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {this.state.copied ? '✓ Copied Details!' : 'Copy details'}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
