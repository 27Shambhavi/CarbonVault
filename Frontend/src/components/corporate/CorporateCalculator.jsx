// src/components/corporate/CorporateCalculator.jsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../../AppContext.jsx';
import { calculateFootprint, fetchFootprintHistory } from '../../services/api.js';
import { Card, SectionHeader, KPICard, Badge, Btn, T, withAlpha } from '../UI.jsx';
import {
  Calculator, Building2, Users, Plane, Cloud, Zap, ShieldCheck,
  ArrowRight, RefreshCw, History, CheckCircle2, DollarSign, Layers, Sparkles
} from 'lucide-react';

const inpStyle = {
  background: 'var(--input-bg, rgba(255,255,255,0.04))',
  border: `1px solid ${T.border}`,
  borderRadius: 9,
  padding: '10px 14px',
  color: T.t1,
  fontSize: 14,
  outline: 'none',
  width: '100%',
  fontFamily: 'Plus Jakarta Sans, sans-serif'
};

export default function CorporateCalculator() {
  const { user, setPage } = useApp();
  const corporateName = user?.name || 'Corporate Buyer';

  // Input state
  const [inputs, setInputs] = useState({
    corporate_name: corporateName,
    employees: 250,
    sqft: 20000,
    short_haul_flights: 80,
    long_haul_flights: 30,
    cloud_spend_usd: 7500,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('calculator'); // 'calculator' | 'history'

  // Load history & initial calculation on mount
  useEffect(() => {
    loadHistory();
    handleCalculate();
  }, [corporateName]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetchFootprintHistory(corporateName);
      if (Array.isArray(res.data)) {
        setHistory(res.data);
      }
    } catch (err) {
      console.warn('Could not load footprint history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleInputChange = (field, val) => {
    setInputs(prev => ({
      ...prev,
      [field]: field === 'corporate_name' ? val : Math.max(0, Number(val) || 0)
    }));
  };

  const handleCalculate = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res = await calculateFootprint({
        ...inputs,
        corporate_name: inputs.corporate_name || corporateName,
      });
      if (res.data && res.data.status === 'success') {
        setResult(res.data);
        loadHistory();
      }
    } catch (err) {
      console.error('Calculation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreInputs = (item) => {
    if (item.inputs) {
      setInputs({
        corporate_name: item.corporate_name || corporateName,
        employees: item.inputs.employees || 250,
        sqft: item.inputs.sqft || 20000,
        short_haul_flights: item.inputs.short_haul_flights || 0,
        long_haul_flights: item.inputs.long_haul_flights || 0,
        cloud_spend_usd: item.inputs.cloud_spend_usd || 0,
      });
      setActiveTab('calculator');
      handleCalculate();
    }
  };

  // Scope percentages
  const s1 = result?.scope1_tonnes || 0;
  const s2 = result?.scope2_tonnes || 0;
  const s3 = result?.scope3_tonnes || 0;
  const total = result?.total_tonnes || (s1 + s2 + s3) || 1;
  const s1Pct = Math.round((s1 / total) * 100);
  const s2Pct = Math.round((s2 / total) * 100);
  const s3Pct = Math.max(0, 100 - s1Pct - s2Pct);

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(167, 139, 250, 0.15)',
              border: `1px solid rgba(167, 139, 250, 0.3)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Calculator size={20} color={T.violetLL || '#a78bfa'} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: T.t1, margin: 0 }}>
              Corporate Footprint Calculator
            </h1>
            <Badge color="violet">GHG Protocol Scope 1-3</Badge>
          </div>
          <p style={{ color: T.t2, fontSize: 14, margin: 0 }}>
            Audit your corporate emissions footprint and match with verified carbon offsets from real registered projects.
          </p>
        </div>

        {/* View Switcher */}
        <div style={{ display: 'flex', gap: 8, background: T.bg1, padding: 4, borderRadius: 10, border: `1px solid ${T.border}` }}>
          <button
            onClick={() => setActiveTab('calculator')}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: activeTab === 'calculator' ? T.violetLL || '#8b5cf6' : 'transparent',
              color: activeTab === 'calculator' ? '#fff' : T.t2,
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Calculator size={15} /> Estimator
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: activeTab === 'history' ? T.violetLL || '#8b5cf6' : 'transparent',
              color: activeTab === 'history' ? '#fff' : T.t2,
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <History size={15} /> History ({history.length})
          </button>
        </div>
      </div>

      {activeTab === 'calculator' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: 24 }}>
          {/* Left Column: Input Form */}
          <div>
            <Card style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <Building2 size={18} color={T.violetLL} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: T.t1, margin: 0 }}>
                  Operational Parameters
                </h3>
              </div>

              <form onSubmit={handleCalculate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: T.t2, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                    Organization / Entity Name
                  </label>
                  <input
                    type="text"
                    value={inputs.corporate_name}
                    onChange={(e) => handleInputChange('corporate_name', e.target.value)}
                    style={inpStyle}
                    placeholder="e.g. Microsoft Sustainability"
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: T.t2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                      <Users size={13} color={T.teal} /> Headcount / Employees
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={inputs.employees}
                      onChange={(e) => handleInputChange('employees', e.target.value)}
                      style={inpStyle}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: T.t2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                      <Zap size={13} color={T.goldL} /> Facility Area (sq ft)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={inputs.sqft}
                      onChange={(e) => handleInputChange('sqft', e.target.value)}
                      style={inpStyle}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: T.t2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                      <Plane size={13} color={T.skyL} /> Short-Haul Flights/yr
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={inputs.short_haul_flights}
                      onChange={(e) => handleInputChange('short_haul_flights', e.target.value)}
                      style={inpStyle}
                      placeholder="< 1,500 km"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, color: T.t2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                      <Plane size={13} color={T.violetLL} /> Long-Haul Flights/yr
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={inputs.long_haul_flights}
                      onChange={(e) => handleInputChange('long_haul_flights', e.target.value)}
                      style={inpStyle}
                      placeholder="> 1,500 km"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, color: T.t2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                    <Cloud size={13} color={T.emeraldL} /> Monthly Cloud / IT Spend ($ USD)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={inputs.cloud_spend_usd}
                    onChange={(e) => handleInputChange('cloud_spend_usd', e.target.value)}
                    style={inpStyle}
                    placeholder="e.g. 5000"
                  />
                  <span style={{ fontSize: 11, color: T.t3, marginTop: 4, display: 'block' }}>
                    Calculates Scope 3 datacenters & software infrastructure carbon intensity.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 9,
                    padding: '12px 18px',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 8,
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                    transition: 'opacity 0.2s'
                  }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Calculating Real Emissions…
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} /> Compute & Record Emissions
                    </>
                  )}
                </button>
              </form>
            </Card>

            {/* Standards Info Box */}
            <div style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.05)',
              border: `1px solid rgba(56, 189, 248, 0.18)`,
              fontSize: 12,
              color: T.t2,
              lineHeight: 1.6
            }}>
              <div style={{ fontWeight: 600, color: T.skyL, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <ShieldCheck size={14} /> GHG Protocol Corporate Standard Methodology
              </div>
              All estimates conform to standard emission factors (Scope 1 direct mobile/fleet combustion, Scope 2 location-based electricity grids, Scope 3 DEFRA flight proxies & EPA cloud datacenters). Every computation is stored directly to the auditable ledger.
            </div>
          </div>

          {/* Right Column: Breakdown & Project Matching */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Emissions Breakdown Cards */}
            <Card style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: T.t1, margin: 0 }}>
                  Estimated Carbon Footprint
                </h3>
                {result?.created_at && (
                  <span style={{ fontSize: 11, color: T.t3 }}>
                    Audited: {new Date(result.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Total Banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
                border: `1px solid rgba(139, 92, 246, 0.28)`,
                borderRadius: 12,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.violetLL || '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Total Annual Emissions
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 800, color: T.t1, marginTop: 4, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    {(result?.total_tonnes || 0).toLocaleString()} <span style={{ fontSize: 16, fontWeight: 500, color: T.t2 }}>tCO₂e / yr</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: T.t2, marginBottom: 4 }}>Offset Requirement</div>
                  <Badge color="emerald">
                    <CheckCircle2 size={12} style={{ marginRight: 4 }} />
                    {(result?.total_tonnes || 0).toLocaleString()} Credits Needed
                  </Badge>
                </div>
              </div>

              {/* Scope Breakdown Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
                <div style={{ padding: 14, borderRadius: 10, background: T.bg1, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, color: T.skyL, fontWeight: 700, textTransform: 'uppercase' }}>Scope 1</div>
                  <div style={{ fontSize: 12, color: T.t2, margin: '2px 0 8px' }}>Direct Combustion</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: T.t1 }}>
                    {(result?.scope1_tonnes || 0).toLocaleString()} <span style={{ fontSize: 11, color: T.t3 }}>t</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>{s1Pct}% of total</div>
                </div>

                <div style={{ padding: 14, borderRadius: 10, background: T.bg1, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, color: T.goldL, fontWeight: 700, textTransform: 'uppercase' }}>Scope 2</div>
                  <div style={{ fontSize: 12, color: T.t2, margin: '2px 0 8px' }}>Purchased Electricity</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: T.t1 }}>
                    {(result?.scope2_tonnes || 0).toLocaleString()} <span style={{ fontSize: 11, color: T.t3 }}>t</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>{s2Pct}% of total</div>
                </div>

                <div style={{ padding: 14, borderRadius: 10, background: T.bg1, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, color: T.emeraldL, fontWeight: 700, textTransform: 'uppercase' }}>Scope 3</div>
                  <div style={{ fontSize: 12, color: T.t2, margin: '2px 0 8px' }}>Travel & Cloud Ops</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: T.t1 }}>
                    {(result?.scope3_tonnes || 0).toLocaleString()} <span style={{ fontSize: 11, color: T.t3 }}>t</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>{s3Pct}% of total</div>
                </div>
              </div>

              {/* Progress proportion bar */}
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ width: `${s1Pct}%`, background: T.skyL || '#38bdf8' }} title={`Scope 1: ${s1Pct}%`} />
                  <div style={{ width: `${s2Pct}%`, background: T.goldL || '#fbbf24' }} title={`Scope 2: ${s2Pct}%`} />
                  <div style={{ width: `${s3Pct}%`, background: T.emeraldL || '#34d399' }} title={`Scope 3: ${s3Pct}%`} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.t3, marginTop: 6 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.skyL }} /> Scope 1 ({s1Pct}%)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.goldL }} /> Scope 2 ({s2Pct}%)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: T.emeraldL }} /> Scope 3 ({s3Pct}%)
                  </span>
                </div>
              </div>
            </Card>

            {/* Instant Offset Matching */}
            <Card style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: T.t1, margin: 0 }}>
                    Matching Verified Projects
                  </h3>
                  <div style={{ fontSize: 12, color: T.t2, marginTop: 2 }}>
                    Real certified projects in CarbonVault with available credits to offset this footprint
                  </div>
                </div>
                <Btn variant="outline" size="sm" onClick={() => setPage('marketplace')}>
                  View All in Marketplace <ArrowRight size={13} style={{ marginLeft: 4 }} />
                </Btn>
              </div>

              {(!result?.matching_projects || result.matching_projects.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: T.t3, fontSize: 13 }}>
                  No approved projects currently have available credits.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {result.matching_projects.slice(0, 3).map((p) => (
                    <div
                      key={p.project_id}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        background: T.bg1,
                        border: `1px solid ${T.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: T.t1, fontSize: 14 }}>
                            {p.name}
                          </span>
                          <Badge color="emerald">{p.project_type}</Badge>
                          <span style={{ fontSize: 11, color: T.teal, fontWeight: 600 }}>
                            MRV {p.mrv_score}/100
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: T.t2 }}>
                          Vault credits: <strong style={{ color: T.t1 }}>{p.available_credits.toLocaleString()}</strong> tonnes • Price: <strong style={{ color: T.t1 }}>${p.price}/tonne</strong>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: T.t3 }}>Offset Full Footprint</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: T.emeraldL }}>
                          ${p.estimated_cost_usd?.toLocaleString()}
                        </div>
                      </div>

                      <button
                        onClick={() => setPage('marketplace')}
                        style={{
                          background: 'rgba(45, 212, 191, 0.12)',
                          color: T.teal,
                          border: `1px solid rgba(45, 212, 191, 0.3)`,
                          borderRadius: 8,
                          padding: '8px 14px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Offset Now <ArrowRight size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card style={{ padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: T.t1, margin: 0 }}>
                Audited Calculation History
              </h3>
              <div style={{ fontSize: 12, color: T.t2, marginTop: 2 }}>
                Every calculation saved to the CarbonVault database for {corporateName}
              </div>
            </div>
            <Btn variant="outline" size="sm" onClick={loadHistory} disabled={historyLoading}>
              <RefreshCw size={13} className={historyLoading ? 'animate-spin' : ''} style={{ marginRight: 6 }} /> Refresh
            </Btn>
          </div>

          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: T.t3, fontSize: 14 }}>
              No historical estimates found. Run your first calculation in the Estimator tab!
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.border}`, textAlign: 'left', color: T.t2 }}>
                    <th style={{ padding: '10px 14px' }}>Date & Time</th>
                    <th style={{ padding: '10px 14px' }}>Entity</th>
                    <th style={{ padding: '10px 14px' }}>Headcount</th>
                    <th style={{ padding: '10px 14px' }}>Scope 1</th>
                    <th style={{ padding: '10px 14px' }}>Scope 2</th>
                    <th style={{ padding: '10px 14px' }}>Scope 3</th>
                    <th style={{ padding: '10px 14px' }}>Total Footprint</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                      <td style={{ padding: '12px 14px', color: T.t1, whiteSpace: 'nowrap' }}>
                        {h.created_at ? new Date(h.created_at).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : 'N/A'}
                      </td>
                      <td style={{ padding: '12px 14px', color: T.t1, fontWeight: 500 }}>
                        {h.corporate_name}
                      </td>
                      <td style={{ padding: '12px 14px', color: T.t2 }}>
                        {h.inputs?.employees || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: T.skyL }}>
                        {h.scope1_tonnes} t
                      </td>
                      <td style={{ padding: '12px 14px', color: T.goldL }}>
                        {h.scope2_tonnes} t
                      </td>
                      <td style={{ padding: '12px 14px', color: T.emeraldL }}>
                        {h.scope3_tonnes} t
                      </td>
                      <td style={{ padding: '12px 14px', color: T.t1, fontWeight: 700 }}>
                        {h.total_tonnes} tCO₂e
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <Btn
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreInputs(h)}
                        >
                          Restore Inputs
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
