import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchLeaderboard, fetchPlatformStats, fetchAuditLogs, fetchCertificates, fetchClimateAnalytics, fetchUsers, timeAgo } from '../../services/api.js';

const mockPublicLeaderboard = [
  { rank: 1, name: 'Microsoft Sustainability', type: 'buyer', credits: 49400, points: 9850, badge: 'approved' },
  { rank: 2, name: 'EcoGuard Brazil', role: 'ngo', type: 'ngo', credits: 34600, points: 8940, badge: 'approved' },
  { rank: 3, name: 'Google Carbon Team', type: 'buyer', credits: 28000, points: 8420, badge: 'approved' },
  { rank: 4, name: 'CongoCare', role: 'ngo', type: 'ngo', credits: 22000, points: 7650, badge: 'approved' },
  { rank: 5, name: 'Shell Renewables', type: 'buyer', credits: 18000, points: 6840, badge: 'approved' },
];

import { Card, SectionHeader, Table, Badge, KPICard, T } from '../UI.jsx';
import { Globe, Trophy, FileSearch, Award, Activity, Leaf, Zap } from 'lucide-react';

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

  useEffect(() => {
    fetchPlatformStats().then(res => {
      if (res.data) setStats(res.data);
    }).catch(() => {});
  }, []);

  const creditsIssued = stats ? Math.round(stats.total_credits || 0).toLocaleString() : '67,495';
  const activeProjects = stats ? stats.active_projects : 5;
  const auditsConducted = stats ? stats.audits_conducted : 31;
  const certificatesIssued = stats ? stats.certificates_issued : 5;

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="Public Transparency Dashboard" subtitle="CarbonVault platform-wide impact metrics" />

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
        <KPICard icon={FileSearch} label="Audits Conducted" value={`${auditsConducted}`} sub="100% transparent" trend="up" color="#facc15" />
        <KPICard icon={Award} label="Certificates Issued" value={`${certificatesIssued}`} sub="Blockchain anchored" trend="up" color="#a78bfa" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Card>
          <SectionHeader title="Top Organizations" />
          {mockPublicLeaderboard.slice(0, 5).map((org, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#2dd4bf', fontFamily: 'Fraunces, serif', flexShrink: 0 }}>{org.rank}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{org.name}</div>
                <div style={{ fontSize: 11, color: '#1e293b' }}>{org.credits.toLocaleString()} credits</div>
              </div>
              <Badge type={org.badge} label={org.badge} />
            </div>
          ))}
        </Card>

        <Card>
          <SectionHeader title="Platform Stats" />
          {[
            { label: 'Fraud Detection Rate', value: stats ? stats.fraud_detection_rate : '0.0%', color: '#f87171' },
            { label: 'Approval Rate', value: stats ? stats.approval_rate : '100%', color: '#2dd4bf' },
            { label: 'Avg MRV Score', value: stats ? `${stats.avg_mrv_score}` : '85.6', color: '#60a5fa' },
            { label: 'CO₂e Removed (t)', value: stats ? Math.round(stats.co2_removed_tons || 0).toLocaleString() : '67,495', color: '#2dd4bf' },
            { label: 'Countries Active', value: stats ? `${stats.countries_active}` : '4', color: '#facc15' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: 13 }}>
              <span style={{ color: '#475569' }}>{label}</span>
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

  const activeLeaderboard = leaderboard.length > 0 ? leaderboard : mockPublicLeaderboard;
  const filtered = filter === 'all' ? activeLeaderboard : activeLeaderboard.filter(o => o.type === filter);

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="Impact Leaderboard" subtitle="Top organizations by carbon impact" />
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
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const actionColors = { approve: '#34d399', reject: '#f87171', mint: '#60a5fa', update: '#facc15', payment: '#fbbf24', create: '#a78bfa' };

  useEffect(() => {
    fetchAuditLogs().then(res => {
      if (res.data && Array.isArray(res.data)) {
        setLogs(res.data);
      }
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="Audit Trail" subtitle="Immutable log of all platform actions" />

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
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{log.detail}</div>
              <div style={{ fontSize: 11, color: 'rgba(45,212,191,0.5)' }}>by {log.user}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PublicCertificates() {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCertificates().then(res => {
      if (Array.isArray(res.data)) {
        setCerts(res.data);
      }
    }).finally(() => setLoading(false));
  }, []);

  const displayCerts = certs.length > 0 ? certs : [
    { certificate_id: 'CV-2024-001', project_name: 'Amazon Reforestation', credits: 12400, issuance_date: 'Dec 15, 2024' },
    { certificate_id: 'CV-2024-002', project_name: 'Sahel Wind Energy', credits: 22000, issuance_date: 'Dec 14, 2024' },
    { certificate_id: 'CV-2024-003', project_name: 'Congo Basin Forest', credits: 22000, issuance_date: 'Dec 12, 2024' },
    { certificate_id: 'CV-2024-004', project_name: 'Vietnamese Mangrove', credits: 6800, issuance_date: 'Dec 10, 2024' },
    { certificate_id: 'CV-2024-005', project_name: 'Chilean Solar', credits: 9400, issuance_date: 'Dec 8, 2024' },
  ];

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="Verification Certificates" subtitle="Publicly accessible certificate registry" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {displayCerts.map((cert) => (
          <Card key={cert.certificate_id}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <div style={{ background: '#2dd4bf20', borderRadius: 10, padding: 10, display: 'flex' }}>
                <Award size={20} color="#2dd4bf" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{cert.certificate_id}</div>
                <Badge type="minted" label="VERIFIED" />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>Project: {cert.project_name}</div>
            <div style={{ fontSize: 12, color: '#1e293b', marginBottom: 12 }}>Issued: {cert.issuance_date}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '5px 10px', color: '#2dd4bf', fontSize: 11, cursor: 'pointer' }}>View</button>
              <button style={{ background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '5px 10px', color: '#2dd4bf', fontSize: 11, cursor: 'pointer' }}>Download</button>
            </div>
          </Card>
        ))}
      </div>
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

  const climateData = climate?.co_benefits && climate.co_benefits.length > 0 ? climate.co_benefits : [
    { metric: 'Flood Control', value: 78 },
    { metric: 'Biodiversity', value: 85 },
    { metric: 'Fisheries', value: 62 },
    { metric: 'Coastal Prot.', value: 71 },
    { metric: 'Carbon Seq.', value: 93 },
    { metric: 'Livelihood', value: 67 },
  ];

  const co2Removed = stats?.total_credits
    ? `${Math.round(stats.total_credits).toLocaleString()}t`
    : climate?.co2_removed_tons ? `${Math.round(climate.co2_removed_tons).toLocaleString()}t` : '43,400t';

  const forestArea = climate?.forest_area_ha
    ? `${Math.round(climate.forest_area_ha).toLocaleString()} ha`
    : '14,500 ha';

  const renewableEnergy = climate?.renewable_energy_gwh
    ? `${climate.renewable_energy_gwh} GWh`
    : '89 GWh';

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="Climate Resilience Analytics" subtitle="Environmental impact of verified projects" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { icon: Leaf, label: 'CO₂e Removed', value: co2Removed, color: '#2dd4bf' },
          { icon: Globe, label: 'Forest Area', value: forestArea, color: '#60a5fa' },
          { icon: Zap, label: 'Renewable Energy', value: renewableEnergy, color: '#facc15' },
        ].map(({ icon: Icon, label, value, color }) => (
          <KPICard key={label} icon={Icon} label={label} value={value} color={color} />
        ))}
      </div>

      <Card>
        <SectionHeader title="Co-Benefits by Impact Category" />
        <div style={{ width: '100%', height: 280, minHeight: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={climateData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
            >
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
              <YAxis dataKey="metric" type="category" tick={{ fill: '#f1f5f9', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip content={<CT />} />
              <Bar dataKey="value" fill="#2dd4bf" barSize={18} radius={[0, 4, 4, 0]} name="Impact Score" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

