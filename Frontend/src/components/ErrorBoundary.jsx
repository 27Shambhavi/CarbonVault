import React from 'react';
import { T } from './UI.jsx';

/**
 * Catches render errors so a failed dashboard does not leave a blank main area.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{ padding: 28, maxWidth: 640 }}>
          <div
            style={{
              background: 'rgba(244,63,94,0.08)',
              border: '1px solid rgba(251,113,133,0.35)',
              borderRadius: 12,
              padding: 20,
              color: T.t2,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 800, color: T.roseL, marginBottom: 10, fontSize: 15 }}>
              Something went wrong loading this page
            </div>
            <pre
              style={{
                margin: 0,
                padding: 12,
                background: 'rgba(0,0,0,0.35)',
                borderRadius: 8,
                fontSize: 12,
                overflow: 'auto',
                color: T.t3,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error?.message || String(error)}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              style={{
                marginTop: 14,
                padding: '8px 14px',
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: 'rgba(255,255,255,0.06)',
                color: T.t1,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
