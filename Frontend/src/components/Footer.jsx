import { useState, useEffect } from 'react';
import { fetchHealth } from '../services/api.js';
import { T } from './UI.jsx';
import { GitCommit, Activity, Database, ShieldCheck } from 'lucide-react';

export default function AppFooter() {
  const [healthData, setHealthData] = useState({
    commit: '72e63d8',
    status: 'online',
    db: 'ok'
  });

  useEffect(() => {
    fetchHealth()
      .then(res => {
        if (res.data) {
          setHealthData({
            commit: res.data.commit || res.data.commit_hash || '72e63d8',
            status: res.data.status || 'online',
            db: res.data.db || 'ok'
          });
        }
      })
      .catch(() => {});
  }, []);

  const shortCommit = healthData.commit ? healthData.commit.slice(0, 7) : '72e63d8';
  const commitUrl = `https://github.com/27Shambhavi/final-carbon-vault/commit/${healthData.commit}`;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Database size={11} color={healthData.db === 'ok' ? T.emeraldL : T.roseL} />
          <span>DB: <strong style={{ color: healthData.db === 'ok' ? T.emeraldL : T.roseL }}>{healthData.db.toUpperCase()}</strong></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Activity size={11} color={T.teal} />
          <span>System: <strong style={{ color: T.tealL }}>{healthData.status}</strong></span>
        </div>

        <a
          href={commitUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`View deployed commit ${healthData.commit} on GitHub`}
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
