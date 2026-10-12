import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, TrendingUp, ShoppingCart, Coins, Bell } from 'lucide-react';
import { T } from './UI.jsx';

export function LiveToastContainer({ toasts = [], onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 9999,
        maxWidth: 380,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <LiveToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function LiveToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Fade in
    requestAnimationFrame(() => setVisible(true));
    // Auto dismiss after 4.5 seconds
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 4500);

    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case 'project.status_changed':
      case 'project.created':
        return <CheckCircle size={16} color={T.emeraldL} />;
      case 'credits.minted':
        return <Coins size={16} color={T.violetLL} />;
      case 'pricing.updated':
        return <TrendingUp size={16} color={T.goldL} />;
      case 'marketplace.buy_request':
      case 'payment.completed':
        return <ShoppingCart size={16} color={T.teal} />;
      default:
        return <Bell size={16} color={T.skyL} />;
    }
  };

  return (
    <div
      style={{
        pointerEvents: 'auto',
        background: 'var(--card-bg, rgba(13,17,32,0.92))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${T.border2}`,
        borderRadius: 12,
        padding: '12px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.96)',
      }}
    >
      <div style={{ marginTop: 2, flexShrink: 0 }}>{getIcon()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.t1 }}>
          {toast.title || 'Real-Time Update'}
        </div>
        <div style={{ fontSize: 11.5, color: T.t2, marginTop: 2, lineHeight: 1.4 }}>
          {toast.message}
        </div>
      </div>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: T.t3,
          cursor: 'pointer',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
