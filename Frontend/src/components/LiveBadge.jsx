import { useState, useEffect } from 'react';
import { Radio } from 'lucide-react';
import { T } from './UI.jsx';

/**
 * LiveBadge
 * Ground Rule #1:
 * "A 'LIVE' indicator may show only while the real stream is connected.
 * Every live metric shows its source and timestamp."
 */
export function LiveBadge({ status = 'offline', lastEventAt = null, source = null }) {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const updateTime = () => {
      if (!lastEventAt) {
        setSecondsAgo(0);
        return;
      }
      const diff = Math.max(0, Math.floor((Date.now() - new Date(lastEventAt).getTime()) / 1000));
      setSecondsAgo(diff);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [lastEventAt]);

  const isLive = status === 'connected';
  const isReconnecting = status === 'reconnecting';

  const dotColor = isLive ? T.emeraldL : isReconnecting ? T.goldL : T.t3;
  const bg = isLive
    ? 'color-mix(in srgb, var(--emerald, #10b981) 12%, transparent)'
    : isReconnecting
    ? 'color-mix(in srgb, var(--gold, #f59e0b) 12%, transparent)'
    : 'color-mix(in srgb, var(--t3, #475569) 12%, transparent)';

  const border = isLive
    ? 'color-mix(in srgb, var(--emerald, #10b981) 28%, transparent)'
    : isReconnecting
    ? 'color-mix(in srgb, var(--gold, #f59e0b) 28%, transparent)'
    : 'color-mix(in srgb, var(--t3, #475569) 25%, transparent)';

  const timeLabel = lastEventAt
    ? secondsAgo < 5
      ? 'just now'
      : `${secondsAgo}s ago`
    : 'connecting';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 9px',
        borderRadius: 20,
        background: bg,
        border: `1px solid ${border}`,
        fontSize: 11,
        fontWeight: 600,
        color: T.t1,
        letterSpacing: '0.2px',
        userSelect: 'none',
      }}
      title={source ? `Data Source: ${source}` : 'CarbonVault Real-Time Event Stream'}
    >
      <span
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 7,
          height: 7,
        }}
      >
        {isLive && (
          <span
            style={{
              position: 'absolute',
              width: 13,
              height: 13,
              borderRadius: '50%',
              background: dotColor,
              opacity: 0.4,
              animation: 'ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite',
            }}
          />
        )}
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: isLive ? `0 0 6px ${dotColor}` : 'none',
          }}
        />
      </span>

      <span
        style={{
          fontWeight: 800,
          color: dotColor,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          fontSize: 10,
        }}
      >
        {isLive ? 'LIVE' : isReconnecting ? 'SYNCING' : 'OFFLINE'}
      </span>

      <span style={{ color: T.t3, fontSize: 10 }}>•</span>

      <span style={{ color: T.t2, fontSize: 10.5, fontWeight: 500 }}>
        {isLive ? `updated ${timeLabel}` : isReconnecting ? 'reconnecting…' : 'polling mode'}
      </span>

      {source && (
        <span style={{ color: T.t3, fontSize: 9.5, marginLeft: 2 }}>
          ({source})
        </span>
      )}

      <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
