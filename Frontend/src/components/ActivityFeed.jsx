import { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  FolderPlus,
  Coins,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  Bell,
  AlertTriangle,
  Leaf,
} from 'lucide-react';
import { T, gc } from './UI.jsx';

const EVENT_CONFIG = {
  'project.created': {
    label: 'Project Submitted',
    icon: FolderPlus,
    color: T.skyL,
    bg: 'color-mix(in srgb, var(--sky, #0ea5e9) 14%, transparent)',
  },
  'project.status_changed': {
    label: 'Status Changed',
    icon: CheckCircle,
    color: T.emeraldL,
    bg: 'color-mix(in srgb, var(--emerald, #10b981) 14%, transparent)',
  },
  'credits.minted': {
    label: 'Credits Minted',
    icon: Coins,
    color: T.violetLL,
    bg: 'color-mix(in srgb, var(--violet, #7c3aed) 14%, transparent)',
  },
  'pricing.updated': {
    label: 'Pricing Adjusted',
    icon: TrendingUp,
    color: T.goldL,
    bg: 'color-mix(in srgb, var(--gold, #f59e0b) 14%, transparent)',
  },
  'marketplace.buy_request': {
    label: 'Buy Request Placed',
    icon: ShoppingCart,
    color: T.teal,
    bg: 'color-mix(in srgb, var(--teal, #2dd4bf) 14%, transparent)',
  },
  'marketplace.request_accepted': {
    label: 'Request Accepted',
    icon: CheckCircle,
    color: T.emeraldL,
    bg: 'color-mix(in srgb, var(--emerald, #10b981) 14%, transparent)',
  },
  'payment.completed': {
    label: 'Payment Completed',
    icon: CreditCard,
    color: T.emeraldL,
    bg: 'color-mix(in srgb, var(--emerald, #10b981) 14%, transparent)',
  },
  'notification.created': {
    label: 'Notification',
    icon: Bell,
    color: T.violetL,
    bg: 'color-mix(in srgb, var(--violet, #7c3aed) 14%, transparent)',
  },
  'anomaly.alert': {
    label: 'Anomaly Alert',
    icon: AlertTriangle,
    color: T.roseL,
    bg: 'color-mix(in srgb, var(--rose, #f43f5e) 14%, transparent)',
  },
  'greenness.decline': {
    label: 'Greenness Alert',
    icon: Leaf,
    color: T.goldL,
    bg: 'color-mix(in srgb, var(--gold, #f59e0b) 14%, transparent)',
  },
};

function formatRelativeTime(ts) {
  if (!ts) return 'just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function ActivityFeed({ events = [], maxHeight = 340, compact = false }) {
  const [, setTick] = useState(0);

  // Re-render time labels every 5s
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(timer);
  }, []);

  if (!events || events.length === 0) {
    return (
      <div
        style={{
          ...gc({ padding: 24 }),
          textAlign: 'center',
          color: T.t3,
          fontSize: 12.5,
          borderStyle: 'dashed',
        }}
      >
        <Activity size={24} color={T.t4} style={{ margin: '0 auto 8px', display: 'block' }} />
        <div>Listening for live platform events…</div>
        <div style={{ fontSize: 11, color: T.t4, marginTop: 4 }}>
          SSE stream connected. Actions in any session appear here immediately.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 6 : 9,
        maxHeight,
        overflowY: 'auto',
        paddingRight: 4,
      }}
    >
      {events.map((ev, idx) => {
        const conf = EVENT_CONFIG[ev.type] || {
          label: ev.type || 'Platform Event',
          icon: Activity,
          color: T.teal,
          bg: 'color-mix(in srgb, var(--teal, #2dd4bf) 14%, transparent)',
        };
        const Icon = conf.icon;
        const payload = ev.payload || {};
        const detailText =
          payload.message ||
          (payload.name && payload.status ? `${payload.name} -> ${payload.status}` : null) ||
          (payload.project_name && payload.corporate_name
            ? `${payload.corporate_name}: ${payload.project_name}`
            : null) ||
          (payload.effective_usd ? `Effective: $${Number(payload.effective_usd).toFixed(2)}/t` : null) ||
          JSON.stringify(payload).slice(0, 80);

        return (
          <div
            key={ev.id || `${ev.type}-${idx}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: compact ? '8px 10px' : '10px 13px',
              borderRadius: 10,
              background: 'var(--card-bg, rgba(255,255,255,0.025))',
              border: `1px solid ${T.border}`,
              transition: 'background 0.15s',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: conf.bg,
                border: `1px solid color-mix(in srgb, ${conf.color} 30%, transparent)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon size={14} color={conf.color} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.t1 }}>
                  {conf.label}
                </span>
                <span style={{ fontSize: 10, color: T.t3, whiteSpace: 'nowrap' }}>
                  {formatRelativeTime(ev.timestamp || ev.created_at)}
                </span>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: T.t2,
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {detailText}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
