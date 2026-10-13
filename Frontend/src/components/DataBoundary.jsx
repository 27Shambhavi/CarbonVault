import React from 'react';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { T, Card, Btn } from './UI.jsx';

/**
 * DataBoundary provides a unified loading, error, and empty state container
 * to ensure screen components execute all hooks unconditionally before rendering.
 *
 * Props:
 * - status: 'loading' | 'error' | 'empty' | 'success' (or inferred from loading/error/isEmpty)
 * - loading / isLoading: boolean
 * - error: string | Error | null
 * - isEmpty: boolean
 * - onRetry: () => void (optional retry callback)
 * - loadingMessage: string
 * - emptyTitle: string
 * - emptyMessage: string
 * - children: ReactNode
 */
export default function DataBoundary({
  status,
  loading = false,
  isLoading = false,
  error = null,
  isEmpty = false,
  onRetry,
  loadingMessage = 'Loading data…',
  emptyTitle = 'No data available',
  emptyMessage = 'There are no records to display at this time.',
  children
}) {
  const isCurrentlyLoading = loading || isLoading || status === 'loading';
  const hasError = Boolean(error || status === 'error');
  const isCurrentlyEmpty = Boolean(isEmpty || status === 'empty');

  if (isCurrentlyLoading) {
    return (
      <div
        data-testid="data-boundary-loading"
        style={{
          padding: 36,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '36vh',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              border: `3px solid rgba(45,212,191,0.15)`,
              borderTop: `3px solid ${T.teal}`,
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spinSlow 0.8s linear infinite',
            }}
          />
          <div style={{ fontSize: 14, color: T.t2, fontWeight: 500 }}>
            {loadingMessage}
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    const errorText = typeof error === 'string' ? error : (error?.message || 'Failed to load data from backend server.');
    return (
      <div data-testid="data-boundary-error" style={{ padding: 24 }}>
        <Card
          style={{
            textAlign: 'center',
            padding: 36,
            border: '1px solid rgba(244,63,94,0.3)',
            background: 'rgba(244,63,94,0.04)',
          }}
        >
          <AlertCircle size={36} color={T.roseL} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: T.t1, marginBottom: 8 }}>
            Unable to Load Data
          </div>
          <div style={{ fontSize: 13, color: T.t3, maxWidth: 520, margin: '0 auto 18px', lineHeight: 1.6 }}>
            {errorText}
          </div>
          {onRetry && (
            <Btn
              onClick={onRetry}
              variant="secondary"
              style={{ margin: '0 auto' }}
            >
              <RefreshCw size={13} />
              Try Again
            </Btn>
          )}
        </Card>
      </div>
    );
  }

  if (isCurrentlyEmpty) {
    return (
      <div data-testid="data-boundary-empty" style={{ padding: 24 }}>
        <Card style={{ textAlign: 'center', padding: 40, border: `1px solid ${T.border}` }}>
          <Inbox size={36} color={T.teal} style={{ margin: '0 auto 12px', opacity: 0.8 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: T.t1, marginBottom: 6 }}>
            {emptyTitle}
          </div>
          <div style={{ fontSize: 13, color: T.t3, maxWidth: 480, margin: '0 auto', lineHeight: 1.6 }}>
            {emptyMessage}
          </div>
        </Card>
      </div>
    );
  }

  return children;
}
