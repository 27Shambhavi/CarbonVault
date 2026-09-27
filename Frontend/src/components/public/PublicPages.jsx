import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { mockResilienceData } from '../../data/mockData.js';
import { fetchLeaderboard } from '../../services/api.js';

const mockPublicLeaderboard = [
  { rank: 1, name: 'Microsoft Sustainability', type: 'buyer', credits: 49400, points: 9850, badge: 'approved' },
  { rank: 2, name: 'EcoGuard Brazil', role: 'ngo', type: 'ngo', credits: 34600, points: 8940, badge: 'approved' },
  { rank: 3, name: 'Google Carbon Team', type: 'buyer', credits: 28000, points: 8420, badge: 'approved' },
  { rank: 4, name: 'CongoCare', role: 'ngo', type: 'ngo', credits: 22000, points: 7650, badge: 'approved' },
  { rank: 5, name: 'Shell Renewables', type: 'buyer', credits: 18000, points: 6840, badge: 'approved' },
];

const mockAuditLogs = [
  { id: 1, action: 'mint', name: 'PRJ-MAN-AMAZON', time: '10m ago', detail: 'Minted 12,400 verified credits with satellite NDVI verification', user: 'Admin System' },
  { id: 2, action: 'approve', name: 'PRJ-TEK-CONGO1', time: '2h ago', detail: 'Project approved with GRS quality score of 91/100', user: 'Alex Mercer (Admin)' },
  { id: 3, action: 'create', name: 'PRJ-MAN-SUNDAR', time: '5h ago', detail: 'New mangrove restoration project submitted with boundary polygon', user: 'Green Delta' },
  { id: 4, action: 'update', name: 'Pricing Multipliers', time: '1d ago', detail: 'Dynamic demand multiplier updated to 1.12x', user: 'Admin System' },
];
import { Card, SectionHeader, Table, Badge, KPICard } from '../UI.jsx';
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
        <KPICard icon={Globe} label="Credits Issued" value="107,600" sub="Total verified tonnes" trend="up" color="#2dd4bf" />
        <KPICard icon={Leaf} label="Active Projects" value="6" sub="In 5 countries" trend="up" color="#60a5fa" />
        <KPICard icon={FileSearch} label="Audits Conducted" value="48" sub="100% transparent" trend="up" color="#facc15" />
        <KPICard icon={Award} label="Certificates Issued" value="24" sub="Blockchain anchored" trend="up" color="#a78bfa" />
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
            { label: 'Fraud Detection Rate', value: '12.5%', color: '#f87171' },
            { label: 'Approval Rate', value: '75%', color: '#2dd4bf' },
            { label: 'Avg MRV Score', value: '82.4', color: '#60a5fa' },
            { label: 'CO₂e Removed (t)', value: '43,400', color: '#2dd4bf' },
            { label: 'Countries Active', value: '5', color: '#facc15' },
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
  const filtered = filter === 'all' ? mockPublicLeaderboard : mockPublicLeaderboard.filter(o => o.type === filter);

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
            <div key={org.rank} style={{ textAlign: 'center', width: 160 }}>
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
  const actionColors = { approve: '#34d399', reject: '#f87171', mint: '#60a5fa', update: '#facc15', create: '#a78bfa' };

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="Audit Trail" subtitle="Immutable log of all platform actions" />

      <div style={{ position: 'relative', paddingLeft: 24 }}>
        <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.06)' }} />
        {mockAuditLogs.map((log, i) => (
          <div key={log.id} style={{ position: 'relative', marginBottom: 20 }}>
            <div style={{ position: 'absolute', left: -20, top: 14, width: 12, height: 12, borderRadius: '50%', background: actionColors[log.action] || '#2dd4bf', border: '2px solid #07080f' }} />
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 16, marginLeft: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge type={log.action === 'approve' ? 'approved' : log.action === 'reject' ? 'rejected' : log.action === 'mint' ? 'minted' : 'pending'} label={log.action.toUpperCase()} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{log.name}</span>
                </div>
                <span style={{ fontSize: 11, color: '#1e293b' }}>{log.time}</span>
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>{log.detail}</div>
              <div style={{ fontSize: 11, color: 'rgba(45,212,191,0.2)' }}>by {log.user}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PublicCertificates() {
  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="Verification Certificates" subtitle="Publicly accessible certificate registry" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {['CV-2024-001', 'CV-2024-002', 'CV-2024-003', 'CV-2024-004', 'CV-2024-005'].map((cert, i) => (
          <Card key={cert}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
              <div style={{ background: '#2dd4bf20', borderRadius: 10, padding: 10, display: 'flex' }}>
                <Award size={20} color="#2dd4bf" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{cert}</div>
                <Badge type="minted" label="VERIFIED" />
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>Project: {['Amazon Reforestation', 'Sahel Wind Energy', 'Congo Basin Forest', 'Vietnamese Mangrove', 'Chilean Solar'][i]}</div>
            <div style={{ fontSize: 12, color: '#1e293b', marginBottom: 12 }}>Issued: {['Dec 15, 2024', 'Dec 14, 2024', 'Dec 12, 2024', 'Dec 10, 2024', 'Dec 8, 2024'][i]}</div>
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
  const climateData = mockResilienceData.map(d => ({ ...d, value: d.score * 120 }));

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="Climate Resilience Analytics" subtitle="Environmental impact of verified projects" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { icon: Leaf, label: 'CO₂e Removed', value: '43,400t', color: '#2dd4bf' },
          { icon: Globe, label: 'Forest Area', value: '14,500 ha', color: '#60a5fa' },
          { icon: Zap, label: 'Renewable Energy', value: '89 GWh', color: '#facc15' },
        ].map(({ icon: Icon, label, value, color }) => (
          <KPICard key={label} icon={Icon} label={label} value={value} color={color} />
        ))}
      </div>

      <Card>
        <SectionHeader title="Co-Benefits by Impact Category" />
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={climateData} layout="vertical">
            <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis dataKey="metric" type="category" tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
            <Tooltip content={<CT />} />
            <Bar dataKey="value" fill="#2dd4bf" radius={[0, 4, 4, 0]} name="Impact Score" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
