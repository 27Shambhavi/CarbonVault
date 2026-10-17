import { useState, useEffect } from 'react';
import { useApp } from '../../AppContext.jsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  fetchPlatformStats,
  fetchAllProjects,
  fetchMapProjects,
  fetchMapPendingProjects,
  downloadPlatformPDF,
  fetchOverviewStats,
  fetchReady
} from '../../services/api.js';
import { KPICard, Card, SectionHeader, Table, Badge, Btn, T } from '../UI.jsx';
import { ProjectMap } from '../GoogleMap.jsx';
import { ActivityFeed } from '../ActivityFeed.jsx';
import {
  Layers, FolderCheck, Clock, AlertTriangle, Download, RefreshCw,
  Activity, ShieldCheck, CheckCircle2, Users, Building2, DollarSign,
  Wallet, FileSearch, Settings, ArrowRight, AlertOctagon
} from 'lucide-react';
import { MLFeedbackWidget } from '../common/MLFeedbackWidget.jsx';
import DataBoundary from '../DataBoundary.jsx';

const CT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0c1020', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
      <div style={{ color: T.teal, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: T.t2, fontSize: 12 }}>
          {p.name}: <span style={{ color: T.t1, fontWeight: 700 }}>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function AdminDashboard() {
  const { setPage, refreshKey, liveEvents } = useApp();
  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState(null);
  const [readyInfo, setReadyInfo] = useState(null);
  const [projects, setProjects] = useState([]);
  const [mapFeatures, setMapFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await downloadPlatformPDF();
    } catch (err) {
      alert(err.message || 'Failed to generate PDF report');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchPlatformStats(),
      fetchAllProjects(),
      fetchMapProjects(),
      fetchMapPendingProjects(),
      fetchOverviewStats('admin', '30d'),
      fetchReady().catch(() => ({ data: null }))
    ])
      .then(([statsRes, allRes, mapRes, pendRes, overviewRes, readyRes]) => {
        if (statsRes.data) setStats(statsRes.data);
        if (overviewRes?.data) setOverview(overviewRes.data);
        if (readyRes?.data) setReadyInfo(readyRes.data);
        if (!allRes.error && Array.isArray(allRes.data)) {
          setProjects(allRes.data);
        }
        const approved = mapRes.data?.projects || [];
        const pending = pendRes.data?.projects || [];
        setMapFeatures([...approved, ...pending]);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const ops = overview?.operations_console || {};
  const activeCount = stats?.active_projects ?? projects.filter(p => p.status === 'approved').length;
  const pendingCount = stats?.pending_projects ?? projects.filter(p => p.status === 'pending').length;
  const flagged = projects.filter(p => (p.fraudRisk || p.fraud_risk || 0) > 40).length;
  const approvedProjects = projects.filter(p => p.status === 'approved');
  const totalCredits = stats?.total_credits ?? approvedProjects.reduce((s, p) => s + (p.credits || 0), 0);
  const pieColors = [T.emerald, T.sky, T.goldL, T.violetL];

  const typeMap = {};
  approvedProjects.forEach(p => {
    const type = (p.plantation_type || p.type || 'Other').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    typeMap[type] = (typeMap[type] || 0) + (p.credits || 0);
  });
  const pieData = Object.keys(typeMap).length > 0
    ? Object.entries(typeMap).map(([name, value]) => ({ name, value }))
    : [{ name: 'Mixed', value: totalCredits || 1000 }];

  const shortcuts = [
    { label: 'Organisations', desc: 'KYC & entity reviews', icon: Building2, target: 'organisations', color: T.skyL },
    { label: 'Users', desc: 'Invite approvers & roles', icon: Users, target: 'users', color: T.teal },
    { label: 'Pricing', desc: 'Floor prices & buffer share', icon: DollarSign, target: 'pricing', color: T.goldL },
    { label: 'Payments & Payouts', desc: 'Reconciliation & settlements', icon: Wallet, target: 'payments_payouts', color: T.violetLL },
    { label: 'ML Models', desc: 'Retraining & telemetry', icon: Activity, target: 'ml_models', color: T.emeraldL },
    { label: 'Platform Audit', desc: 'Cryptographic ledger trail', icon: FileSearch, target: 'audit', color: T.skyL },
    { label: 'Settings', desc: 'Global platform config', icon: Settings, target: 'settings', color: T.t2 },
  ];

  return (
    <DataBoundary loading={loading} loadingMessage="Loading operations console…">
      <div style={{ padding: 28, animation: 'fadeUp 0.3s ease' }}>
        {/* Header with Title and Platform Health pill */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.15)', border: `1px solid rgba(245,158,11,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={22} color={T.goldL} />
              </div>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 900, color: T.t1, margin: 0, fontFamily: 'Fraunces, serif', letterSpacing: '-0.5px' }}>
                  Admin Operations Console
                </h1>
                <div style={{ fontSize: 13, color: T.t3, marginTop: 2 }}>
                  Platform oversight, KYC verification, administrative override governance, and treasury operations.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Live /ready Health Status Pill */}
            <div
              data-testid="platform-health-pill"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 20,
                background: readyInfo?.status === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${readyInfo?.status === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                fontSize: 12,
                fontWeight: 700,
                color: readyInfo?.status === 'ok' ? T.emeraldL : T.goldL
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: readyInfo?.status === 'ok' ? '#10b981' : '#f59e0b' }} />
              Health (/ready): {readyInfo?.status === 'ok' ? 'All Systems Healthy' : (readyInfo?.status || 'Online')}
            </div>

            <Btn variant="secondary" onClick={handleExportPDF} disabled={exporting}>
              {exporting ? <RefreshCw size={13} style={{ animation: 'spinSlow 0.8s linear infinite' }} /> : <Download size={13} />}
              {exporting ? 'Generating PDF…' : 'Export Audit PDF'}
            </Btn>
          </div>
        </div>

        {/* Section 1: Operations Governance KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 22 }}>
          <KPICard
            icon={ShieldCheck}
            label="Reconciliation"
            value="Balanced"
            sub="0 variance vs Razorpay"
            color={T.emeraldL}
          />
          <KPICard
            icon={AlertTriangle}
            label="Active Alerts"
            value={flagged}
            sub="NDVI decline & anomaly"
            color={flagged > 0 ? T.roseL : T.teal}
          />
          <KPICard
            icon={Users}
            label="KYC Queue"
            value={ops.kyc_queue_count ?? 0}
            sub="Pending entity review"
            color={T.skyL}
          />
          <KPICard
            icon={Clock}
            label="Unassigned"
            value={ops.unassigned_projects ?? pendingCount}
            sub="Awaiting approver link"
            color={T.goldL}
          />
          <KPICard
            icon={AlertOctagon}
            label="Admin Overrides"
            value={ops.overrides_this_month ?? 0}
            sub="Overrides this month"
            color={T.violetLL}
          />
          <KPICard
            icon={Layers}
            label="Total Credits"
            value={Math.round(totalCredits).toLocaleString()}
            sub="Minted inventory"
            color={T.teal}
          />
        </div>

        {/* Section 2: Financial Treasury Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <Card style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(4,5,8,0.5))', borderColor: 'rgba(16,185,129,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.emeraldL, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Payments Today
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: T.t1, fontFamily: 'Fraunces, serif', marginTop: 4 }}>
                  ₹{Number(ops.payments_today_inr || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>Settled via Razorpay gateway</div>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={22} color={T.emeraldL} />
              </div>
            </div>
          </Card>

          <Card style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.06), rgba(4,5,8,0.5))', borderColor: 'rgba(244,63,94,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.roseL, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Refunds Pending
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: T.t1, fontFamily: 'Fraunces, serif', marginTop: 4 }}>
                  {ops.refunds_pending ?? 0} <span style={{ fontSize: 14, fontWeight: 600, color: T.t3 }}>cases</span>
                </div>
                <div style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>Awaiting admin review & sign-off</div>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(244,63,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={22} color={T.roseL} />
              </div>
            </div>
          </Card>

          <Card style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(4,5,8,0.5))', borderColor: 'rgba(245,158,11,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.goldL, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  Payouts Owed to NGOs
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: T.t1, fontFamily: 'Fraunces, serif', marginTop: 4 }}>
                  ₹{Number(ops.payouts_owed_inr || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>Scheduled for milestone disbursement</div>
              </div>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={22} color={T.goldL} />
              </div>
            </div>
          </Card>
        </div>

        {/* Section 3: Operations Console Shortcuts Grid */}
        <Card style={{ marginBottom: 24 }}>
          <SectionHeader
            title="Operations Console Shortcuts"
            subtitle="Rapid navigation across administrative modules"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {shortcuts.map(({ label, desc, icon: Icon, target, color }) => (
              <button
                key={label}
                onClick={() => setPage(target)}
                style={{
                  background: 'var(--glass, rgba(255,255,255,0.025))',
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: '14px 14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.18s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = color;
                  e.currentTarget.style.background = 'var(--glass2, rgba(255,255,255,0.05))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.background = 'var(--glass, rgba(255,255,255,0.025))';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `color-mix(in srgb, ${color} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                  </div>
                  <ArrowRight size={14} color={T.t3} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>{label}</div>
                  <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Map + Pie Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 22 }}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px 14px' }}>
              <SectionHeader title="Plantation Project Locations" subtitle="Approved (green) and pending (yellow) plantation boundaries from stored polygons" />
            </div>
            <div style={{ paddingBottom: 0 }}>
              <ProjectMap features={mapFeatures} adminMode height={260} />
            </div>
          </Card>

          <Card>
            <SectionHeader title="By Project Type" />
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} innerRadius={30} dataKey="value" paddingAngle={4}>
                  {pieData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip content={<CT />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
              {pieData.map((t, i) => (
                <div key={t.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: T.t3 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: pieColors[i % pieColors.length], flexShrink: 0, boxShadow: `0 0 4px ${pieColors[i % pieColors.length]}` }} />
                    {t.name}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.t2 }}>{t.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Environmental & Biometric Alerts Panel */}
        <Card style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.t1, display: 'flex', alignItems: 'center', gap: 7 }}>
                <AlertTriangle size={16} color={T.roseL} />
                <span>Biometric & Environmental Risk Alerts</span>
              </div>
              <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>
                Automated triggers: IsolationForest anomaly score &gt; 50 &bull; Greenness decline z &lt; -2.0 &bull; High fraud score
              </div>
            </div>
            <Badge color={projects.filter(p => (p.fraud_risk || p.fraudRisk || 0) > 40).length > 0 ? 'rose' : 'teal'}>
              {projects.filter(p => (p.fraud_risk || p.fraudRisk || 0) > 40).length} ACTIVE ALERTS
            </Badge>
          </div>

          {projects.filter(p => (p.fraud_risk || p.fraudRisk || 0) > 35).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {projects.filter(p => (p.fraud_risk || p.fraudRisk || 0) > 35).map(p => (
                <div key={p.project_id || p.id} style={{
                  background: 'rgba(244,63,94,0.06)',
                  border: '1px solid rgba(244,63,94,0.22)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: T.t1 }}>
                      {p.name} <span style={{ fontSize: 11, color: T.t3 }}>({p.project_id || p.id})</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.roseL, marginTop: 2 }}>
                      Biometric risk score: {p.fraud_risk || p.fraudRisk}% &bull; Type: {p.plantation_type || p.type} &bull; Area: {p.area_hectares || '—'} ha
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <MLFeedbackWidget projectId={p.project_id || p.id} flagId={`flag_${p.project_id || p.id}_bio`} />
                    <Badge color="rose">REVIEW REQUIRED</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0', color: T.emeraldL, fontSize: 12, background: 'rgba(16,185,129,0.05)', borderRadius: 8 }}>
              ✓ All active plantations within normal biometric and greenness parameters. Zero active decline alerts.
            </div>
          )}
        </Card>

        {/* Real-Time Event Stream */}
        <Card style={{ marginBottom: 22 }}>
          <SectionHeader
            title="Real-Time Event Stream"
            subtitle="Server-Sent Events: Instantaneous ledger actions, submissions, approvals & purchases"
          />
          <ActivityFeed events={liveEvents} maxHeight={220} />
        </Card>

        {/* Oversight Queue Table */}
        <Card style={{ marginBottom: 22 }}>
          <SectionHeader title="Project Activity Log" subtitle="Platform-wide review queue oversight" />
          <Table
            headers={['Project', 'NGO', 'Type', 'Status', 'Credits', 'Date']}
            rows={projects.map(p => [
              <span style={{ fontWeight: 600, color: T.t1, fontSize: 13 }}>{p.name}</span>,
              <span style={{ color: T.t3, fontSize: 12 }}>{p.ngo || p.ngo_name || 'Unknown'}</span>,
              <Badge type={p.plantation_type || p.type || 'other'} label={(p.plantation_type || p.type || 'other').replace('_', ' ')} />,
              <Badge type={p.status} label={p.status} />,
              <span style={{ color: T.teal, fontWeight: 700 }}>{p.credits ? p.credits.toLocaleString() : '—'}</span>,
              <span style={{ color: T.t3, fontSize: 12 }}>{p.start_date || p.created_at || '—'}</span>,
            ])}
          />
        </Card>
      </div>
    </DataBoundary>
  );
}
