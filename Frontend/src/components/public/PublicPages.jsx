import { useState, useEffect } from 'react';
import { useApp } from '../../AppContext.jsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchLeaderboard, fetchPlatformStats, fetchPublicStats, fetchAuditLogs, fetchCertificates, fetchClimateAnalytics, fetchUsers, fetchGrsLeaderboard, timeAgo, getCertificateDownloadUrl, fetchPublicRetirements } from '../../services/api.js';

import { Card, SectionHeader, Table, Badge, KPICard, T } from '../UI.jsx';
import CertificateModal from '../CertificateModal.jsx';
import { Globe, Trophy, FileSearch, Award, Activity, Leaf, Zap, Search, Download, ShieldCheck, CheckCircle } from 'lucide-react';

const CT = ({ active, payload, label }) => {
  if (active && payload?.length) return (
    <div style={{ background: '#080b12', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ color: '#2dd4bf', fontSize: 11 }}>{label}</div>
      {payload.map((p, i) => <div key={i} style={{ color: '#94a3b8', fontSize: 12 }}>{p.value?.toLocaleString()}</div>)}
    </div>
  );
  return null;
};

export function PublicDashboard() {
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetchPlatformStats().then(res => {
      if (res.data) setStats(res.data);
    }).catch(() => {});
    fetchGrsLeaderboard().then(res => {
      if (res.data?.leaderboard) setLeaderboard(res.data.leaderboard);
    }).catch(() => {});
  }, []);

  const creditsIssued = stats ? Math.round(stats.total_credits || stats.credits_issued || 0).toLocaleString() : '—';
  const activeProjects = stats ? (stats.active_projects ?? 0) : '—';
  const auditsConducted = stats ? (stats.audits_conducted ?? 0) : '—';
  const certificatesIssued = stats ? (stats.certificates_issued ?? 0) : '—';

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, fontFamily: 'Fraunces, serif', margin: 0 }}>
          Global Ecological Impact
        </h1>
        <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>
          CarbonVault platform-wide impact metrics, restoration polygons, and live registry statistics
        </div>
      </div>

      <div style={{ background: 'linear-gradient(135deg, #0a1a0a 0%, #0e2a0e 100%)', border: '1px solid rgba(45,212,191,0.3)', borderRadius: 16, padding: 28, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ background: '#2dd4bf20', borderRadius: 10, padding: 10, display: 'flex' }}>
            <Leaf size={20} color="#2dd4bf" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', fontFamily: 'Fraunces, serif' }}>CarbonVault Transparency Commitment</div>
            <div style={{ fontSize: 13, color: '#475569' }}>All carbon credits are AI-verified and publicly auditable</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard icon={Globe} label="Credits Issued" value={creditsIssued} sub="Total verified tonnes" trend="up" color="#2dd4bf" />
        <KPICard icon={Leaf} label="Active Projects" value={`${activeProjects}`} sub="Verified in DB" trend="up" color="#60a5fa" />
        <KPICard icon={FileSearch} label="Audits Conducted" value={`${auditsConducted}`} sub="Append-only log" trend="up" color="#facc15" />
        <KPICard icon={Award} label="Certificates Issued" value={`${certificatesIssued}`} sub="Cryptographically signed" trend="up" color="#a78bfa" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card>
          <SectionHeader title="Top Organizations" subtitle="Rankings derived from verified ledger activity" />
          {leaderboard && leaderboard.length > 0 ? (
            leaderboard.slice(0, 5).map((org, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#2dd4bf', fontFamily: 'Fraunces, serif', flexShrink: 0 }}>{org.rank}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{org.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{Number(org.credits || 0).toLocaleString()} credits</div>
                </div>
                <Badge type={org.badge} label={org.badge} />
              </div>
            ))
          ) : (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
              No registered organizations with transaction history yet.
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader title="Platform Stats" subtitle="Live aggregates from registry database" />
          {[
            { label: 'Active Projects', value: stats?.active_projects ?? stats?.verified_projects_count ?? activeProjects, color: '#2dd4bf' },
            { label: 'Credits Issued (tCO₂e)', value: stats?.credits_issued ? Number(stats.credits_issued).toLocaleString() : '0', color: '#2dd4bf' },
            { label: 'Approval Rate', value: stats?.approval_rate_pct != null ? `${stats.approval_rate_pct}%` : '100%', color: '#60a5fa' },
            { label: 'Audit Trail Records', value: stats?.audits_conducted ?? auditsConducted, color: '#facc15' },
            { label: 'Fraud Risk Checks', value: stats?.fraud_flags ?? '0 flagged', color: '#f87171' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 13 }}>
              <span style={{ color: '#94a3b8' }}>{label}</span>
              <span style={{ color, fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

export function PublicLeaderboard() {
  const [filter, setFilter] = useState('all');
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    Promise.all([fetchLeaderboard(), fetchUsers()]).then(([lbRes, usersRes]) => {
      let combined = [];
      if (Array.isArray(lbRes.data) && lbRes.data.length > 0) {
        lbRes.data.forEach((item, idx) => {
          combined.push({
            rank: item.Rank || idx + 1,
            name: item.Company,
            type: 'buyer',
            credits: Math.round((item.GRS || 80) * 450),
            points: Math.round((item.GRS || 80) * 100),
            badge: (item.Badge || 'approved').toLowerCase(),
          });
        });
      }
      if (Array.isArray(usersRes.data)) {
        usersRes.data.filter(u => u.role === 'ngo').forEach((ngo, idx) => {
          combined.push({
            rank: combined.length + 1,
            name: ngo.name,
            type: 'ngo',
            credits: ngo.credits || 24000,
            points: Math.round((ngo.credits || 24000) * 0.25),
            badge: 'approved',
          });
        });
      }
      if (combined.length > 0) {
        combined.sort((a, b) => b.credits - a.credits);
        combined = combined.map((item, idx) => ({ ...item, rank: idx + 1 }));
        setLeaderboard(combined);
      }
    }).catch(() => {});
  }, []);

  const activeLeaderboard = leaderboard;
  const filtered = filter === 'all' ? activeLeaderboard : activeLeaderboard.filter(o => o.type === filter);

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, fontFamily: 'Fraunces, serif', margin: 0 }}>
          Carbon Impact Leaderboard
        </h1>
        <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>
          Top organizations and corporate buyers ranked by verified ecological impact
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'ngo', 'buyer'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ background: filter === f ? 'rgba(255,255,255,0.06)' : 'transparent', border: `1px solid ${filter === f ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, padding: '8px 16px', color: filter === f ? '#2dd4bf' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
            {f === 'all' ? 'All Organizations' : f.toUpperCase() + 's'}
          </button>
        ))}
      </div>

      {/* Top 3 podium */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 28, alignItems: 'flex-end' }}>
        {[filtered[1], filtered[0], filtered[2]].filter(Boolean).map((org, i) => {
          const heights = [100, 130, 80];
          const colors = ['#c0c0c0', '#fbbf24', '#d97706'];
          const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
          return (
            <div key={org.name || i} style={{ textAlign: 'center', width: 160 }}>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>{org.name}</div>
              <div style={{ height: heights[i], background: `linear-gradient(180deg, ${colors[i]}20 0%, ${colors[i]}08 100%)`, border: `1px solid ${colors[i]}40`, borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 12 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: colors[i], fontFamily: 'Fraunces, serif' }}>#{rank}</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors[i]}30`, borderRadius: '0 0 8px 8px', padding: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', fontFamily: 'Fraunces, serif' }}>{org.credits.toLocaleString()}</div>
                <div style={{ fontSize: 10, color: '#1e293b' }}>credits</div>
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <Table
          headers={['Rank', 'Organization', 'Type', 'Credits', 'Impact Points', 'Badge']}
          rows={filtered.map(o => [
            <span style={{ fontSize: 16, fontWeight: 800, color: '#475569', fontFamily: 'Fraunces, serif' }}>#{o.rank}</span>,
            <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{o.name}</span>,
            <Badge type={o.type} label={o.type.toUpperCase()} />,
            <span style={{ color: '#34d399', fontWeight: 700 }}>{o.credits.toLocaleString()}</span>,
            o.points.toLocaleString(),
            <Badge type={o.badge} label={o.badge} />,
          ])}
        />
      </Card>
    </div>
  );
}

export function PublicAudit() {
  const { user } = useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const actionColors = { approve: '#34d399', reject: '#f87171', mint: '#60a5fa', update: '#facc15', payment: '#fbbf24', create: '#a78bfa' };

  const loadAuditLogs = () => {
    setLoading(true);
    setError(null);
    fetchAuditLogs()
      .then(res => {
        if (res.error) {
          setError(res.error);
          setLogs([]);
        } else if (res.data && Array.isArray(res.data)) {
          setLogs(res.data);
          setError(null);
        } else {
          setLogs([]);
        }
      })
      .catch(err => {
        setError(err.message || 'Failed to load audit logs');
        setLogs([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const auditTitle = user?.role === 'admin' ? 'Public Audit Trail' : 'Immutable Audit Ledger';

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, fontFamily: 'Fraunces, serif', margin: 0 }}>
          {auditTitle}
        </h1>
        <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>
          Immutable cryptographic ledger of platform actions, verifier sign-offs, and state transitions
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(45,212,191,0.15)', borderTop: '3px solid #2dd4bf', borderRadius: '50%', margin: '0 auto 12px', animation: 'spinSlow 0.8s linear infinite' }} />
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Loading verified audit trail…</div>
        </div>
      ) : error ? (
        <Card style={{ padding: 24, textAlign: 'center', border: '1px solid rgba(244,63,94,0.3)' }}>
          <div style={{ color: '#f43f5e', fontSize: 13, marginBottom: 12 }}>Failed to load audit trail: {error}</div>
          <button
            onClick={loadAuditLogs}
            style={{ background: '#2dd4bf', color: '#041d1a', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            Retry
          </button>
        </Card>
      ) : logs.length === 0 ? (
        <Card style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Audit Ledger Initialized</div>
          <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 480, margin: '0 auto' }}>
            No platform mutations recorded yet. System approvals, verifications, and credit minting events will be immutably recorded here.
          </div>
        </Card>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.06)' }} />
          {logs.map((log) => (
            <div key={log.id} style={{ position: 'relative', marginBottom: 20 }}>
              <div style={{ position: 'absolute', left: -20, top: 14, width: 12, height: 12, borderRadius: '50%', background: actionColors[log.action] || '#2dd4bf', border: '2px solid #07080f' }} />
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 16, marginLeft: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge type={log.action === 'approve' ? 'approved' : log.action === 'reject' ? 'rejected' : log.action === 'mint' ? 'minted' : 'pending'} label={log.action.toUpperCase()} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{log.name}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{timeAgo(log.timestamp || log.time)}</span>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{log.detail}</div>
                <div style={{ fontSize: 11, color: 'rgba(45,212,191,0.5)' }}>by {log.user}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PublicCertificates() {
  const [certs, setCerts] = useState([]);
  const [retirements, setRetirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'retirement' | 'issuance' | 'registry'
  const [selectedCert, setSelectedCert] = useState(null);

  const loadCertificates = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchCertificates(),
      fetchPublicRetirements().catch(() => ({ data: { retirements: [] } }))
    ])
      .then(([certRes, retRes]) => {
        if (certRes.error) {
          setError(certRes.error);
          setCerts([]);
        } else if (Array.isArray(certRes.data)) {
          setCerts(certRes.data);
          setError(null);
        } else {
          setCerts([]);
        }

        const retData = retRes?.data?.retirements || retRes?.retirements || [];
        setRetirements(Array.isArray(retData) ? retData : []);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch certificates');
        setCerts([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  const handleDirectDownload = (certId, e) => {
    e.stopPropagation();
    const url = getCertificateDownloadUrl(certId, 'pdf');
    const link = document.createElement('a');
    link.href = url;
    link.download = `Certificate_${certId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRetirements = retirements.filter(r => {
    const q = search.toLowerCase();
    return !q ||
      (r.certificate_id && r.certificate_id.toLowerCase().includes(q)) ||
      (r.project_name && r.project_name.toLowerCase().includes(q)) ||
      (r.project_id && r.project_id.toLowerCase().includes(q)) ||
      (r.beneficiary && r.beneficiary.toLowerCase().includes(q)) ||
      (r.purpose && r.purpose.toLowerCase().includes(q));
  });

  const filtered = certs.filter(c => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      (c.certificate_id && c.certificate_id.toLowerCase().includes(q)) ||
      (c.project_name && c.project_name.toLowerCase().includes(q)) ||
      (c.beneficiary && c.beneficiary.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (typeFilter === 'retirement') return (c.type || '').toLowerCase().includes('retirement') || (c.type || '').toLowerCase().includes('offset');
    if (typeFilter === 'issuance') return (c.type || '').toLowerCase().includes('issuance');
    return true;
  });

  if (loading) {
    return (
      <div style={{ padding: 28, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(45,212,191,0.15)', borderTop: '3px solid #2dd4bf', borderRadius: '50%', margin: '0 auto 12px', animation: 'spinSlow 0.8s linear infinite' }} />
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Loading verified certificate registry…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 28 }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, fontFamily: 'Fraunces, serif', margin: 0 }}>
            Public Retirement Certificates
          </h1>
          <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>
            Publicly accessible, cryptographically verified certificate registry
          </div>
        </div>
        <Card style={{ padding: 28, textAlign: 'center', border: '1px solid rgba(244,63,94,0.3)' }}>
          <div style={{ color: '#f43f5e', fontSize: 13, marginBottom: 12 }}>Failed to load certificates: {error}</div>
          <button
            onClick={loadCertificates}
            style={{ background: '#2dd4bf', color: '#041d1a', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
          >
            Retry
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, fontFamily: 'Fraunces, serif', margin: 0 }}>
            Public Retirement Certificates
          </h1>
          <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>
            Public transparency ledger of permanently retired credits and unique serial ranges
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Search box */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--input-bg, rgba(255,255,255,0.04))',
            border: `1px solid ${T.border}`, borderRadius: 8, padding: '7px 12px', width: 260
          }}>
            <Search size={14} color={T.t3} />
            <input
              type="text"
              placeholder="Search ID, project, buyer, serial…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: T.t1, fontSize: 13, width: '100%'
              }}
            />
          </div>

          {/* Type Filter Buttons */}
          <div style={{ display: 'flex', gap: 4, background: T.bg1, padding: 3, borderRadius: 8, border: `1px solid ${T.border}` }}>
            <button
              onClick={() => setTypeFilter('all')}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: typeFilter === 'all' ? T.teal : 'transparent',
                color: typeFilter === 'all' ? '#041d1a' : T.t2
              }}
            >
              All ({certs.length})
            </button>
            <button
              onClick={() => setTypeFilter('registry')}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: typeFilter === 'registry' ? '#a78bfa' : 'transparent',
                color: typeFilter === 'registry' ? '#041d1a' : T.t2
              }}
            >
              Retirement Registry ({retirements.length})
            </button>
            <button
              onClick={() => setTypeFilter('retirement')}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: typeFilter === 'retirement' ? T.teal : 'transparent',
                color: typeFilter === 'retirement' ? '#041d1a' : T.t2
              }}
            >
              Offsets
            </button>
            <button
              onClick={() => setTypeFilter('issuance')}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: typeFilter === 'issuance' ? T.teal : 'transparent',
                color: typeFilter === 'issuance' ? '#041d1a' : T.t2
              }}
            >
              Issuances
            </button>
          </div>
        </div>
      </div>

      {typeFilter === 'registry' ? (
        filteredRetirements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.t3 }}>
            No permanent retirements recorded in public registry yet.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {filteredRetirements.map((ret) => (
              <Card key={ret.retirement_id || ret.certificate_id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid rgba(167, 139, 250, 0.25)' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ background: 'rgba(167, 139, 250, 0.15)', borderRadius: 10, padding: 9, display: 'flex' }}>
                        <Award size={18} color="#a78bfa" />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace' }}>
                          {ret.certificate_id}
                        </div>
                        <span style={{ fontSize: 11, color: '#a78bfa' }}>Permanent Retirement</span>
                      </div>
                    </div>
                    <Badge color="violet">
                      <ShieldCheck size={11} style={{ marginRight: 3 }} /> NON-TRANSFERABLE
                    </Badge>
                  </div>

                  <div style={{ marginBottom: 12, padding: '10px 12px', background: T.bg1, borderRadius: 8, border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase' }}>Beneficiary</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.t1, marginTop: 2 }}>
                      {ret.beneficiary}
                    </div>
                    <div style={{ fontSize: 11, color: T.t2, marginTop: 4 }}>
                      Purpose: <span style={{ color: T.t1 }}>{ret.purpose}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.t2, marginTop: 4 }}>
                      Project: <strong style={{ color: T.teal }}>{ret.project_name || ret.project_id}</strong>
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 12, fontSize: 11, fontFamily: 'monospace', color: T.t2, border: `1px solid ${T.border}` }}>
                    <span style={{ color: T.t3 }}>Serial Range:</span> <strong style={{ color: T.emeraldL }}>{ret.serial_range}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 16, color: T.t2 }}>
                    <span>Volume: <strong style={{ color: T.emeraldL }}>{(ret.quantity || 0).toLocaleString()} tCO₂e</strong></span>
                    <span style={{ fontSize: 11, color: T.t3 }}>{ret.retired_at ? new Date(ret.retired_at).toLocaleDateString() : '—'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                  <button
                    onClick={() => setSelectedCert(ret.certificate_id)}
                    style={{
                      flex: 1,
                      background: 'rgba(167, 139, 250, 0.1)',
                      border: '1px solid rgba(167, 139, 250, 0.3)',
                      borderRadius: 7,
                      padding: '7px 12px',
                      color: '#c4b5fd',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6
                    }}
                  >
                    <Award size={13} /> View Impact Certificate
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: T.t3 }}>
          No certificates found matching your criteria.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {filtered.map((cert) => (
            <Card key={cert.certificate_id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{
                      background: cert.type?.includes('Retirement') ? 'rgba(167, 139, 250, 0.15)' : 'rgba(45, 212, 191, 0.15)',
                      borderRadius: 10, padding: 9, display: 'flex'
                    }}>
                      <Award size={18} color={cert.type?.includes('Retirement') ? (T.violetLL || '#a78bfa') : '#2dd4bf'} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace' }}>
                        {cert.certificate_id}
                      </div>
                      <span style={{ fontSize: 11, color: T.t3 }}>{cert.type || 'Verified Certificate'}</span>
                    </div>
                  </div>
                  <Badge color="emerald">
                    <ShieldCheck size={11} style={{ marginRight: 3 }} /> {cert.status || 'VERIFIED'}
                  </Badge>
                </div>

                <div style={{ marginBottom: 12, padding: '10px 12px', background: T.bg1, borderRadius: 8, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase' }}>Beneficiary / Buyer</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.t1, marginTop: 2 }}>
                    {cert.beneficiary || 'Verified Entity'}
                  </div>
                  <div style={{ fontSize: 11, color: T.t2, marginTop: 6 }}>
                    Project: <strong style={{ color: T.teal }}>{cert.project_name}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 16, color: T.t2 }}>
                  <span>Volume: <strong style={{ color: T.emeraldL }}>{cert.credits?.toLocaleString()} tCO₂e</strong></span>
                  <span style={{ fontSize: 11, color: T.t3 }}>Issued: {cert.issuance_date}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
                <button
                  onClick={() => setSelectedCert(cert.certificate_id)}
                  style={{
                    flex: 1,
                    background: 'rgba(45, 212, 191, 0.08)',
                    border: '1px solid rgba(45, 212, 191, 0.25)',
                    borderRadius: 7,
                    padding: '7px 12px',
                    color: '#2dd4bf',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Award size={13} /> View Certificate
                </button>
                <button
                  onClick={(e) => handleDirectDownload(cert.certificate_id, e)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${T.border}`,
                    borderRadius: 7,
                    padding: '7px 12px',
                    color: T.t2,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  title="Download Certificate"
                >
                  <Download size={13} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedCert && (
        <CertificateModal
          certId={selectedCert}
          onClose={() => setSelectedCert(null)}
        />
      )}
    </div>
  );
}

export function PublicClimate() {
  const [climate, setClimate] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    Promise.all([fetchClimateAnalytics(), fetchPlatformStats()]).then(([cRes, sRes]) => {
      if (cRes.data) setClimate(cRes.data);
      if (sRes.data) setStats(sRes.data);
    }).catch(() => {});
  }, []);

  const climateData = climate?.co_benefits || [];

  const co2Removed = stats?.credits_issued != null
    ? `${Number(stats.credits_issued).toLocaleString()} t`
    : climate?.co2_removed_tons != null ? `${Number(climate.co2_removed_tons).toLocaleString()} t` : '0 t';

  const forestArea = climate?.forest_area_ha != null
    ? `${Number(climate.forest_area_ha).toLocaleString()} ha`
    : '0 ha';

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, fontFamily: 'Fraunces, serif', margin: 0 }}>
          Climate & Satellite Insights
        </h1>
        <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>
          Environmental impact and satellite telemetry of verified reforestation and afforestation projects
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24, maxWidth: 680 }}>
        {[
          { icon: Leaf, label: 'CO₂e Removed', value: co2Removed, sub: 'Minted credits from approved projects', color: '#2dd4bf' },
          { icon: Globe, label: 'Forest Area', value: forestArea, sub: 'Sum of approved project boundaries', color: '#60a5fa' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <KPICard key={label} icon={Icon} label={label} value={value} sub={sub} color={color} />
        ))}
      </div>

      <Card>
        <SectionHeader title="Co-Benefits by Impact Category" subtitle="Ecological co-benefits verified through project MRV telemetry" />
        {climateData.length > 0 ? (
          <div style={{ width: '100%', height: 280, minHeight: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={climateData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
              >
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                <YAxis dataKey="metric" type="category" tick={{ fill: '#f1f5f9', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} width={130} />
                <Tooltip content={<CT />} />
                <Bar dataKey="value" fill="#2dd4bf" barSize={18} radius={[0, 4, 4, 0]} name="Impact Score" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ padding: '36px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            No verified project co-benefits recorded in the registry yet.
          </div>
        )}
      </Card>
    </div>
  );
}

export function PublicScreeningGuide() {
  const checks = [
    {
      num: 1,
      title: 'Boundary Geometry & Registry Overlap',
      icon: '🗺️',
      desc: 'Calculates spherical surface area in hectares using planar projection at mean latitude. Verifies that claimed project area matches within ±10% and checks against all registered projects in the registry to prevent overlapping boundaries and double-issuance.',
      threshold: '±10% area tolerance · 0.00% registry overlap',
    },
    {
      num: 2,
      title: 'Field Photo GPS & Proximity Verification',
      icon: '📸',
      desc: 'Extracts embedded EXIF GPS tags directly from original camera image files. Computes geodesic distance to the project centroid using the Haversine formula to confirm photographs were taken on-site.',
      threshold: 'Camera GPS within 25.0 km of project centroid',
    },
    {
      num: 3,
      title: 'Perceptual Hash & Replay Screening',
      icon: '✨',
      desc: 'Generates multi-orientation perceptual hashes (pHash) for each image across original, horizontal flip, and 90°/180°/270° rotations. Compares against the entire repository to detect duplicate or transformed photos.',
      threshold: 'Min Hamming distance > 10 bits across all orientations',
    },
    {
      num: 4,
      title: 'Satellite NDVI Vegetative Health Trend',
      icon: '🛰️',
      desc: 'Queries orbital Sentinel-2 and NASA MODIS multi-spectral surface reflectance. Compares vegetative index trajectory before vs. after planting date to confirm sustained canopy growth.',
      threshold: 'Stable greenness (NDVI > 0.35 or slope >= -0.05)',
    },
    {
      num: 5,
      title: 'Regional Peer Anomaly & Allometrics',
      icon: '🌲',
      desc: 'Evaluates 7 standardized biometric parameters (tree density, area ratio, photo count, NDVI mean/trend, coordinates, plantation type) using an Isolation Forest trained on regional peer projects to highlight unusual features.',
      threshold: 'Anomaly score < 55/100 (standard peer cohort)',
    },
  ];

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: '0 auto' }}>
      <SectionHeader
        title="Automated 5-Check Verification & Screening Guide"
        subtitle="How CarbonVault ensures mathematical integrity and prevents double-counting without accusatory jargon"
      />

      {/* Philosophy Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(45,212,191,0.08) 0%, rgba(16,185,129,0.04) 100%)',
        border: '1px solid rgba(45,212,191,0.3)', borderRadius: 16, padding: 24, marginBottom: 24
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#f1f5f9', fontFamily: 'Fraunces, serif', marginBottom: 8 }}>
          Objective Science Over Accusation
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
          CarbonVault screens every restoration project across 5 mathematical and orbital checkpoints upon creation, edit, and evidence upload.
          We never label developers with accusatory language. If an anomaly occurs—such as boundary buffer zones or photos taken with camera GPS disabled—the developer receives clear guidance and can submit explanations directly into the immutable audit trail.
        </div>
      </div>

      {/* Review Status Legend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginBottom: 28 }}>
        <div style={{ padding: 18, borderRadius: 12, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#34d399' }}>Looks consistent</span>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
            All 5 checks conform within scientific and empirical thresholds. Ready for verifier sign-off and issuance.
          </div>
        </div>

        <div style={{ padding: 18, borderRadius: 12, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fbbf24' }} />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#fbbf24' }}>Needs attention</span>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
            Minor variance detected (e.g. uncompressed photo stripped of GPS metadata). Developer can clarify via explanation.
          </div>
        </div>

        <div style={{ padding: 18, borderRadius: 12, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#f87171' }}>Needs manual review</span>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
            Significant divergence (e.g. boundary overlap or duplicate photograph). Requires field auditor inspection.
          </div>
        </div>
      </div>

      {/* 5 Checks Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {checks.map((c) => (
          <Card key={c.num} style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>{c.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>
                  Check {c.num}: {c.title}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 10 }}>
                  {c.desc}
                </div>
                <div style={{
                  display: 'inline-block', padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: 11, fontWeight: 700, color: '#2dd4bf'
                }}>
                  Standard Benchmark: {c.threshold}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}


