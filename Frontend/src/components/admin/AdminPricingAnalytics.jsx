import { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../../AppContext.jsx';
import { fetchPricingConfig, savePricingConfig, fetchPlatformStats, fetchAllProjects, fetchClimateAnalytics } from '../../services/api.js';
import { Card, SectionHeader, KPICard, Btn, T, withAlpha } from '../UI.jsx';
import { DollarSign, TrendingUp, Package, Activity, Save, RotateCcw, ShieldAlert, Lock, Cpu, Sliders } from 'lucide-react';

const CT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--card-bg, #0c1020)', border: `1px solid ${T.border2}`, borderRadius: 10, padding: '10px 14px', boxShadow: 'var(--shadow-modal)' }}>
      <div style={{ color: T.teal, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: T.t2, fontSize: 12 }}>
          <span style={{ color: T.t1, fontWeight: 700 }}>
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export function AdminPricing() {
  const { user, subscribeToEvent } = useApp();
  const isApprover = user?.admin_role === 'approver';

  const [p, setP] = useState({
    base: 28.50,
    demand: 1.12,
    supply: 0.98,
    living: 1.08,
    mode: 'manual',
    demand_min: 0.80,
    demand_max: 1.50,
    supply_min: 0.80,
    supply_max: 1.50,
  });
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const loadConfig = () => {
    fetchPricingConfig().then((res) => {
      if (res.data) {
        setP((prev) => ({
          ...prev,
          base: res.data.base ?? 28.50,
          demand: res.data.demand ?? 1.12,
          supply: res.data.supply ?? 0.98,
          living: res.data.living ?? 1.08,
          mode: res.data.mode || 'manual',
          demand_min: res.data.demand_min ?? 0.80,
          demand_max: res.data.demand_max ?? 1.50,
          supply_min: res.data.supply_min ?? 0.80,
          supply_max: res.data.supply_max ?? 1.50,
        }));
        if (Array.isArray(res.data.history)) {
          setHistory(res.data.history);
        }
      }
    }).catch(() => {});
  };

  useEffect(() => {
    loadConfig();
    // Real-time SSE subscription: re-fetch instantly on pricing updates from other sessions
    if (subscribeToEvent) {
      const unsub = subscribeToEvent('pricing.updated', (ev) => {
        loadConfig();
      });
      return unsub;
    }
  }, [subscribeToEvent]);

  const handleSave = async (overrideMode = null) => {
    if (isApprover) {
      setSavedMsg('Super Admin privilege required to update pricing configuration');
      return;
    }
    setSaving(true);
    setSavedMsg('');
    const targetMode = overrideMode || p.mode;
    const res = await savePricingConfig({
      base: p.base,
      demand: p.demand,
      supply: p.supply,
      living: p.living,
      mode: targetMode,
      demand_min: p.demand_min,
      demand_max: p.demand_max,
      supply_min: p.supply_min,
      supply_max: p.supply_max,
    });
    setSaving(false);
    if (!res.error) {
      setSavedMsg(`Pricing saved in ${targetMode.toUpperCase()} mode!`);
      loadConfig();
      setTimeout(() => setSavedMsg(''), 3500);
    } else {
      setSavedMsg('Save failed: ' + res.error);
    }
  };

  const final = (p.base * p.demand * p.supply * p.living).toFixed(2);
  const sc = { demand: T.teal, supply: T.goldL, living: T.emeraldL };

  const Slider = ({ label, field, min = 0.5, max = 2.0, disabled = false }) => {
    const color = sc[field] || T.teal;
    const pct = ((p[field] - min) / (max - min)) * 100;
    return (
      <div style={{ marginBottom: 22, opacity: disabled || isApprover ? 0.75 : 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
          <span style={{ fontSize: 13, color: T.t2, fontWeight: 500 }}>{label}</span>
          <span style={{ fontSize: 19, fontWeight: 800, color, fontFamily: 'Fraunces, serif' }}>
            {p[field].toFixed(2)}×
          </span>
        </div>
        <div style={{ position: 'relative', height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 4, marginBottom: 8 }}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${pct}%`,
              background: `linear-gradient(90deg,${color}70,${color})`,
              borderRadius: 4,
              boxShadow: `0 0 8px ${color}60`,
            }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={0.01}
          value={p[field]}
          disabled={disabled || isApprover}
          onChange={(e) => setP({ ...p, [field]: parseFloat(e.target.value) })}
          style={{ width: '100%', cursor: disabled || isApprover ? 'not-allowed' : 'pointer', accentColor: color }}
        />
      </div>
    );
  };

  const priceHistoryData = history.length > 0 ? history : [];

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader
        title="Pricing Engine"
        subtitle="Dynamic pricing engine with algorithmic auto-mode and real-time ledger history"
        action={
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--card-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 20, padding: '3px 4px', gap: 4 }}>
            <button
              onClick={() => {
                setP({ ...p, mode: 'manual' });
                handleSave('manual');
              }}
              disabled={isApprover}
              style={{
                background: p.mode === 'manual' ? 'rgba(45,212,191,0.2)' : 'transparent',
                border: p.mode === 'manual' ? `1px solid ${T.teal}` : '1px solid transparent',
                color: p.mode === 'manual' ? T.teal : T.t3,
                borderRadius: 16,
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: isApprover ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Sliders size={12} /> Manual Multipliers
            </button>
            <button
              onClick={() => {
                setP({ ...p, mode: 'auto' });
                handleSave('auto');
              }}
              disabled={isApprover}
              style={{
                background: p.mode === 'auto' ? 'rgba(245,158,11,0.2)' : 'transparent',
                border: p.mode === 'auto' ? `1px solid ${T.goldL}` : '1px solid transparent',
                color: p.mode === 'auto' ? T.goldL : T.t3,
                borderRadius: 16,
                padding: '4px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: isApprover ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Cpu size={12} /> Auto Algorithmic
            </button>
          </div>
        }
      />

      {/* Approver role read-only banner */}
      {isApprover && (
        <div
          style={{
            background: 'rgba(56,189,248,0.08)',
            border: `1px solid rgba(56,189,248,0.25)`,
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <ShieldAlert size={18} color={T.skyL} />
          <div style={{ fontSize: 13, color: T.skyL }}>
            <strong>Project Approver Role:</strong> Viewing live pricing configuration in read-only mode. Adjusting base prices and multipliers requires <strong>Super Admin</strong> authorization.
          </div>
        </div>
      )}

      {p.mode === 'auto' && (
        <div
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: `1px solid rgba(245,158,11,0.25)`,
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cpu size={18} color={T.goldL} />
            <div style={{ fontSize: 13, color: T.goldL }}>
              <strong>Algorithmic Auto-Pricing Active:</strong> Demand multiplier = (open buy-request tonnes ÷ available credits) mapped to [{p.demand_min}× – {p.demand_max}×]. Supply multiplier adapts to available inventory. Multipliers automatically recompute on every marketplace order or mint.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <Card style={{ marginBottom: 16 }}>
            <SectionHeader
              title={p.mode === 'auto' ? 'Automated Multipliers' : 'Configuration'}
              subtitle={p.mode === 'auto' ? 'Bounds and parameters for automated pricing' : 'Manual adjustment of base and multiplier sliders'}
            />
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
                Base Price ($/t CO₂e)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="number"
                  value={p.base}
                  disabled={isApprover}
                  onChange={(e) => setP({ ...p, base: parseFloat(e.target.value) || 0 })}
                  style={{
                    background: `rgba(45,212,191,0.07)`,
                    border: `1px solid rgba(45,212,191,0.25)`,
                    borderRadius: 11,
                    padding: '11px 15px',
                    color: T.tealL,
                    fontSize: 26,
                    fontWeight: 900,
                    outline: 'none',
                    width: 130,
                    fontFamily: 'Fraunces, serif',
                    cursor: isApprover ? 'not-allowed' : 'text',
                  }}
                />
                <span style={{ color: T.t3, fontSize: 13 }}>per tonne</span>
              </div>
            </div>

            <Slider label="Demand Multiplier" field="demand" disabled={p.mode === 'auto'} />
            <Slider label="Supply Multiplier" field="supply" disabled={p.mode === 'auto'} />
            <Slider label="Living Credit Multiplier" field="living" />

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {isApprover ? (
                <Btn disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} title="Super Admin privilege required">
                  <Lock size={13} /> Save Config (Locked)
                </Btn>
              ) : (
                <Btn onClick={() => handleSave()} disabled={saving}>
                  <Save size={13} />
                  {saving ? 'Saving…' : 'Save Config'}
                </Btn>
              )}
              <Btn variant="secondary" onClick={loadConfig}>
                <RotateCcw size={13} />
                Reset
              </Btn>
              {savedMsg && (
                <span style={{ fontSize: 12, color: savedMsg.includes('failed') || savedMsg.includes('required') ? T.roseL : T.teal, fontWeight: 600 }}>
                  {savedMsg}
                </span>
              )}
            </div>
          </Card>
        </div>

        <div>
          <Card style={{ marginBottom: 16 }}>
            <SectionHeader title="Live Price Preview" subtitle="Effective rate broadcast across marketplace" />
            <div
              style={{
                background: 'linear-gradient(135deg,color-mix(in srgb, var(--teal) 8%, transparent),color-mix(in srgb, var(--teal) 4%, transparent))',
                border: `1px solid color-mix(in srgb, var(--teal) 22%, transparent)`,
                borderRadius: 13,
                padding: 24,
                marginBottom: 18,
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${withAlpha(T.teal, '60', 50)},transparent)` }} />
              <div style={{ fontSize: 10, color: T.teal, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                Effective Market Price {p.mode === 'auto' && '(Algorithmic Auto)'}
              </div>
              <div style={{ fontSize: 58, fontWeight: 900, color: T.tealL, fontFamily: 'Fraunces, serif', letterSpacing: '-2px', lineHeight: 1, textShadow: `0 0 40px rgba(45,212,191,0.6)` }}>
                ${final}
              </div>
              <div style={{ fontSize: 12, color: T.t3, marginTop: 6 }}>per tonne CO₂e</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { l: 'Base Price', v: `$${p.base.toFixed(2)}` },
                { l: '× Demand Multiplier', v: `${p.demand.toFixed(2)}× ${p.mode === 'auto' ? '(Auto)' : ''}` },
                { l: '× Supply Multiplier', v: `${p.supply.toFixed(2)}× ${p.mode === 'auto' ? '(Auto)' : ''}` },
                { l: '× Living Credit Multiplier', v: `${p.living.toFixed(2)}×` },
              ].map(({ l, v }) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid rgba(255,255,255,0.04)`, fontSize: 13 }}>
                  <span style={{ color: T.t3 }}>{l}</span>
                  <span style={{ color: T.t1, fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader title="Price History" subtitle="Immutable audit snapshots stored in database" />
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={priceHistoryData}>
                <defs>
                  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.teal} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={T.teal} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: T.t3, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: T.t3, fontSize: 10 }} axisLine={false} tickLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip content={<CT />} />
                <Area type="monotone" dataKey="price" stroke={T.teal} strokeWidth={2} fill="url(#pg)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function AdminAnalytics() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [climate, setClimate] = useState(null);

  useEffect(() => {
    Promise.all([
      fetchPlatformStats(),
      fetchAllProjects(),
      fetchPricingConfig(),
      fetchClimateAnalytics(),
    ]).then(([s, p, pr, c]) => {
      if (s.data) setStats(s.data);
      if (Array.isArray(p.data)) setProjects(p.data);
      if (pr.data) setPricing(pr.data);
      if (c.data) setClimate(c.data);
    }).catch(() => {});
  }, []);

  // Compute live type distribution
  const approvedProjects = projects.filter((p) => !p.status || p.status === 'approved');
  const typeMap = {};
  approvedProjects.forEach((p) => {
    const type = (p.plantation_type || p.type || 'Other').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    typeMap[type] = (typeMap[type] || 0) + (p.credits || 0);
  });
  const creditsByTypeData =
    Object.keys(typeMap).length > 0
      ? Object.entries(typeMap).map(([name, value]) => ({ name, value }))
      : [];

  const radarData =
    climate?.co_benefits && climate.co_benefits.length > 0
      ? climate.co_benefits.map((c) => ({ metric: c.metric, score: c.value }))
      : [
          { metric: 'Flood Control', score: 78 },
          { metric: 'Biodiversity', score: 85 },
          { metric: 'Fisheries', score: 62 },
          { metric: 'Coastal Prot.', score: 71 },
          { metric: 'Carbon Seq.', score: 93 },
          { metric: 'Livelihood', score: 67 },
        ];

  const historyData =
    pricing?.history && pricing.history.length > 0
      ? pricing.history.map((h) => ({ month: h.month, credits: Math.round(h.price * 1400) }))
      : [];

  const revenueDisplay = stats?.total_funding_usd ? `$${Math.round(stats.total_funding_usd / 1000)}K` : '$580K';
  const availableCredits = stats?.total_credits ? Math.round(stats.total_credits).toLocaleString() : '48,800';
  const approvalRate = stats?.approval_rate ? `${stats.approval_rate}%` : '87.5%';
  const avgPrice = pricing?.final_price ? `$${pricing.final_price.toFixed(2)}` : '$29.40';

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="Platform Analytics" subtitle="Comprehensive performance and impact insights" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 15, marginBottom: 24 }}>
        <KPICard icon={DollarSign} label="Total Revenue" value={revenueDisplay} sub="From verified credit sales" color={T.emeraldL} />
        <KPICard icon={TrendingUp} label="Avg Credit Price" value={avgPrice} sub="Current effective rate" color={T.teal} />
        <KPICard icon={Package} label="Credits Available" value={availableCredits} sub={`Across ${stats?.active_projects || 5} active projects`} color={T.goldL} />
        <KPICard icon={Activity} label="Verification Rate" value={approvalRate} sub="Of submitted projects" color={T.violetLL} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <Card>
          <SectionHeader title="Credits by Project Type" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={creditsByTypeData} barSize={34}>
              <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.teal} />
                  <stop offset="100%" stopColor={T.tealDD} stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fill: T.t3, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.t3, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CT />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="url(#bg)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHeader title="Climate Resilience Radar" />
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: T.t3, fontSize: 10 }} />
              <Radar name="Score" dataKey="score" stroke={T.teal} fill={T.teal} fillOpacity={0.15} strokeWidth={2} />
              <Tooltip content={<CT />} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card>
        <SectionHeader title="Monthly Generation Trend" />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={historyData} barSize={30}>
            <defs>
              <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={T.violetL} stopOpacity={0.9} />
                <stop offset="100%" stopColor={T.violet} stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fill: T.t3, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.t3, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CT />} />
            <Bar dataKey="credits" radius={[5, 5, 0, 0]} fill="url(#bg2)" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
