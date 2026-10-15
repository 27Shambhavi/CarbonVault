import { useState, useEffect } from 'react';
import { fetchReady } from '../services/api.js';
import { T } from './UI.jsx';
import { GitCommit, Activity, Database, ShieldCheck } from 'lucide-react';

export default function AppFooter() {
  const [healthData, setHealthData] = useState({
    commit: null,
    status: 'checking',
    db: 'checking',
    scheduler: 'idle',
    latency: null,
    checkedAt: null,
    error: null,
  });
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const checkHealth = () => {
      const startPing = performance.now();
      fetchReady()
        .then(res => {
          if (!isMounted) return;
          const latency = Math.round(performance.now() - startPing);
          const checkedAt = Date.now();
          if (res.data && res.data.status === 'ready') {
            setHealthData({
              commit: res.data.commit || res.data.commit_hash || null,
              status: 'online',
              db: res.data.database?.status || 'ok',
              scheduler: res.data.scheduler?.status || 'active',
              latency,
              checkedAt,
              error: null,
            });
          } else if (res.data && res.data.status === 'unready') {
            setHealthData({
              commit: res.data.commit || null,
              status: 'degraded',
              db: res.data.database?.status || 'error',
              scheduler: 'idle',
              latency,
              checkedAt,
              error: res.data.reason || 'Database unready',
            });
          } else if (res.error) {
            setHealthData(prev => ({
              ...prev,
              status: 'offline',
              db: 'error',
              latency: null,
              checkedAt,
              error: res.error,
            }));
          }
        })
        .catch(err => {
          if (!isMounted) return;
          setHealthData(prev => ({
            ...prev,
            status: 'offline',
            db: 'error',
            latency: null,
            checkedAt: Date.now(),
            error: err.message || 'Unreachable',
          }));
        });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (healthData.checkedAt) {
        setSecondsAgo(Math.max(0, Math.floor((Date.now() - healthData.checkedAt) / 1000)));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [healthData.checkedAt]);

  const shortCommit = healthData.commit ? healthData.commit.slice(0, 7) : 'HEAD';
  const commitUrl = healthData.commit
    ? `https://github.com/27Shambhavi/CarbonVault/commit/${healthData.commit}`
    : 'https://github.com/27Shambhavi/CarbonVault';

  const isDbOk = healthData.db === 'ok';
  const isSystemOnline = healthData.status === 'online';
  const isChecking = healthData.status === 'checking';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} title={healthData.error || 'Database connection healthy'}>
          <Database size={11} color={isChecking ? T.t3 : isDbOk ? T.emeraldL : T.roseL} />
          <span>DB: <strong style={{ color: isChecking ? T.t3 : isDbOk ? T.emeraldL : T.roseL }}>
            {isChecking ? 'CHECKING…' : healthData.db.toUpperCase()}
          </strong></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} title={healthData.error || (isSystemOnline ? 'All core pipelines online' : healthData.status === 'degraded' ? 'System Degraded' : 'API Offline')}>
          <Activity size={11} color={isChecking ? T.t3 : isSystemOnline ? T.teal : healthData.status === 'degraded' ? T.goldL : T.roseL} />
          <span>System: <strong style={{ color: isChecking ? T.t3 : isSystemOnline ? T.tealL : healthData.status === 'degraded' ? T.goldL : T.roseL }}>
            {isChecking ? 'Checking…' : isSystemOnline ? 'Online' : healthData.status === 'degraded' ? 'Degraded' : 'Offline'}
            {healthData.latency != null ? ` · ${healthData.latency}ms` : ''} · checked {secondsAgo}s ago
          </strong></span>
        </div>

        <a
          href={commitUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={healthData.commit ? `View deployed commit ${healthData.commit} on GitHub` : 'View repository on GitHub'}
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
