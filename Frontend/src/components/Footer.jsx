import { useBackendHealth, BUILD_COMMIT, BUILD_COMMIT_FULL } from '../services/health.js';
import { T } from './UI.jsx';
import { GitCommit, Activity, Database, ShieldCheck } from 'lucide-react';

export default function AppFooter() {
  const health = useBackendHealth();

  const isSystemOnline = health.status === 'Online';
  const isWaking = health.status.startsWith('Waking');
  const isChecking = health.status === 'Checking…';
  const isDegraded = health.status === 'Degraded';
  const isDbOk = health.db === 'ok';

  // Real commit resolution: never the string "HEAD"
  const rawCommit = health.commit && health.commit !== 'HEAD' && health.commit !== 'unknown'
    ? health.commit
    : (BUILD_COMMIT !== 'HEAD' ? BUILD_COMMIT : 'unknown');
  const shortCommit = rawCommit.slice(0, 7);

  const fullCommit = BUILD_COMMIT_FULL && BUILD_COMMIT_FULL !== 'unknown' && BUILD_COMMIT_FULL !== 'HEAD'
    ? BUILD_COMMIT_FULL
    : (rawCommit !== 'unknown' ? rawCommit : null);

  const commitUrl = fullCommit
    ? `https://github.com/27Shambhavi/CarbonVault/commit/${fullCommit}`
    : 'https://github.com/27Shambhavi/CarbonVault';

  return (
    <footer style={{
      borderTop: `1px solid ${T.border}`,
      background: 'var(--bg1, rgba(8,11,22,0.95))',
      backdropFilter: 'blur(16px)',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 12,
      fontSize: 11,
      color: T.t3,
      marginTop: 'auto',
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, color: T.t2, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={13} color={T.teal} />
          CarbonVault Platform
        </span>
        <span style={{ color: T.border2 }}>|</span>
        <span style={{ color: T.t3 }}>
          Verified Carbon Intelligence &amp; MRV Registry
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} title={health.error || (isWaking ? 'Server waking up from cold sleep' : 'Database connection healthy')}>
          <Database size={11} color={isChecking ? T.t3 : isWaking ? T.goldL : isDbOk ? T.emeraldL : T.roseL} />
          <span>DB: <strong style={{ color: isChecking ? T.t3 : isWaking ? T.goldL : isDbOk ? T.emeraldL : T.roseL }}>
            {isChecking ? 'CHECKING…' : isWaking ? 'WAKING…' : health.db.toUpperCase()}
          </strong></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} title={health.error || (isSystemOnline ? 'All core pipelines online' : isWaking ? 'Waking up Render instance…' : isDegraded ? 'System Degraded' : 'API Offline')}>
          <Activity size={11} color={isChecking ? T.t3 : isSystemOnline ? T.teal : isWaking ? T.goldL : isDegraded ? T.goldL : T.roseL} />
          <span>System: <strong style={{ color: isChecking ? T.t3 : isSystemOnline ? T.tealL : isWaking ? T.goldL : isDegraded ? T.goldL : T.roseL }}>
            {health.status}
            {health.latency != null ? ` · ${health.latency}ms` : ''} · checked {health.secondsAgo}s ago
          </strong></span>
        </div>

        <a
          href={commitUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={fullCommit ? `View deployed commit ${fullCommit} on GitHub` : 'View repository on GitHub'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            color: T.teal,
            textDecoration: 'none',
            background: 'var(--glass2, rgba(45,212,191,0.06))',
            border: `1px solid ${T.border}`,
            padding: '3px 8px',
            borderRadius: 6,
            fontWeight: 600,
            fontFamily: 'monospace',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = T.teal;
            e.currentTarget.style.color = T.tealL;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = T.border;
            e.currentTarget.style.color = T.teal;
          }}
        >
          <GitCommit size={11} />
          <span>commit {shortCommit}</span>
        </a>
      </div>
    </footer>
  );
}
