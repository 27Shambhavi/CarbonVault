// src/components/ProjectComparisonModal.jsx
import React, { useState, useEffect } from 'react';
import { compareProjects } from '../services/api.js';
import { Modal, Btn, Badge, T, withAlpha } from './UI.jsx';
import {
  Scale, ShieldCheck, TreePine, MapPin, DollarSign,
  TrendingUp, Leaf, CheckCircle2, ArrowRight, X, AlertCircle, RefreshCw
} from 'lucide-react';

export default function ProjectComparisonModal({ projectIds, onClose, onSelectBuy }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectIds || projectIds.length < 2) return;
    setLoading(true);
    setError(null);

    compareProjects(projectIds)
      .then((res) => {
        if (Array.isArray(res.data)) {
          setData(res.data);
        } else {
          setError(res.error || 'Failed to compare projects');
        }
      })
      .catch((err) => {
        setError(err.message || 'Comparison request failed');
      })
      .finally(() => setLoading(false));
  }, [projectIds]);

  if (!projectIds || projectIds.length < 2) return null;

  return (
    <Modal open={Boolean(projectIds && projectIds.length >= 2)} onClose={onClose} width={980}>
      <div style={{ padding: '8px 4px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Scale size={20} color={T.skyL || '#38bdf8'} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: T.t1, margin: 0 }}>
                Side-by-Side Project Comparison
              </h2>
              <span style={{ fontSize: 12, color: T.t2 }}>
                Comparing {projectIds.length} verified ecological restoration projects from the live registry
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: T.t2,
              cursor: 'pointer', padding: 6, borderRadius: 6
            }}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{
              width: 40, height: 40, border: '3px solid rgba(56,189,248,0.15)',
              borderTop: `3px solid ${T.skyL}`, borderRadius: '50%',
              margin: '0 auto 16px', animation: 'spinSlow 0.8s linear infinite'
            }} />
            <div style={{ fontSize: 14, color: T.t2 }}>Loading multi-dimensional project metrics…</div>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: T.roseL }}>
            {error}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `200px repeat(${data.length}, minmax(220px, 1fr))`,
              gap: 12,
              alignItems: 'stretch'
            }}>
              {/* Row 1: Project Header */}
              <div style={{ padding: 14, background: 'transparent', fontWeight: 700, color: T.t3, fontSize: 12, textTransform: 'uppercase' }}>
                Project Overview
              </div>
              {data.map((p) => (
                <div key={p.project_id} style={{
                  padding: 16, borderRadius: 12, background: T.bg1,
                  border: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.t1, marginBottom: 4 }}>
                      {p.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Badge color="emerald">{p.type}</Badge>
                      <span style={{ fontSize: 11, color: T.t3, fontFamily: 'monospace' }}>{p.project_id}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.t2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} color={T.t3} /> {p.location}
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectBuy && onSelectBuy(p)}
                    style={{
                      marginTop: 14,
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none', borderRadius: 8, padding: '8px 12px',
                      color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      boxShadow: '0 2px 10px rgba(16,185,129,0.25)'
                    }}
                  >
                    Select & Purchase <ArrowRight size={13} />
                  </button>
                </div>
              ))}

              {/* Row 2: Price per Tonne */}
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', fontWeight: 600, color: T.t2, fontSize: 13, display: 'flex', alignItems: 'center' }}>
                Price / Tonne CO₂e
              </div>
              {data.map((p) => (
                <div key={p.project_id} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.goldL }}>
                    ${p.price_usd} <span style={{ fontSize: 11, fontWeight: 500, color: T.t3 }}>/ t</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.t3 }}>₹{p.price_inr?.toLocaleString('en-IN')} INR</div>
                </div>
              ))}

              {/* Row 3: Available Credits */}
              <div style={{ padding: '12px 14px', background: 'transparent', fontWeight: 600, color: T.t2, fontSize: 13, display: 'flex', alignItems: 'center' }}>
                Available Credits
              </div>
              {data.map((p) => (
                <div key={p.project_id} style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: p.available_credits > 0 ? T.emeraldL : T.roseL }}>
                    {(p.available_credits || 0).toLocaleString()}
                  </span>
                  <span style={{ fontSize: 11, color: T.t3, marginLeft: 4 }}>tonnes in vault</span>
                </div>
              ))}

              {/* Row 4: MRV Quality Score */}
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', fontWeight: 600, color: T.t2, fontSize: 13, display: 'flex', alignItems: 'center' }}>
                MRV Quality Score
              </div>
              {data.map((p) => (
                <div key={p.project_id} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.teal }}>{p.mrv_score} / 100</span>
                    <span style={{ fontSize: 11, color: T.emeraldL, fontWeight: 600 }}>Satellite Verified</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${p.mrv_score}%`, background: T.teal, borderRadius: 3 }} />
                  </div>
                </div>
              ))}

              {/* Row 5: Environmental & Co-Benefit Score */}
              <div style={{ padding: '12px 14px', background: 'transparent', fontWeight: 600, color: T.t2, fontSize: 13, display: 'flex', alignItems: 'center' }}>
                Environmental Co-Benefits
              </div>
              {data.map((p) => (
                <div key={p.project_id} style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.skyL }}>{p.env_score} / 100</span>
                  <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>Biodiversity & Watershed</div>
                </div>
              ))}

              {/* Row 6: Project Scale (Area & Trees) */}
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', fontWeight: 600, color: T.t2, fontSize: 13, display: 'flex', alignItems: 'center' }}>
                Scale & Plant Count
              </div>
              {data.map((p) => (
                <div key={p.project_id} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>
                    {p.area_hectares?.toLocaleString()} ha
                  </div>
                  <div style={{ fontSize: 11, color: T.t3 }}>
                    {p.trees_count ? `${p.trees_count.toLocaleString()} trees planted` : 'Diverse canopy'}
                  </div>
                </div>
              ))}

              {/* Row 7: Carbon Sequestration Efficiency */}
              <div style={{ padding: '12px 14px', background: 'transparent', fontWeight: 600, color: T.t2, fontSize: 13, display: 'flex', alignItems: 'center' }}>
                Sequestration Density
              </div>
              {data.map((p) => (
                <div key={p.project_id} style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>
                    {p.co2_per_ha} tCO₂e / ha
                  </span>
                </div>
              ))}

              {/* Row 8: Field Survival & Canopy Cover */}
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', fontWeight: 600, color: T.t2, fontSize: 13, display: 'flex', alignItems: 'center' }}>
                Latest Quarterly Health
              </div>
              {data.map((p) => (
                <div key={p.project_id} style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                  {p.survival_rate ? (
                    <div style={{ fontSize: 12, color: T.t1 }}>
                      Survival: <strong style={{ color: T.emeraldL }}>{p.survival_rate}%</strong>
                      {p.canopy_cover && <span> • Canopy: <strong style={{ color: T.skyL }}>{p.canopy_cover}%</strong></span>}
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: T.t3 }}>Baseline verification active</span>
                  )}
                </div>
              ))}

              {/* Row 9: Developer NGO */}
              <div style={{ padding: '12px 14px', background: 'transparent', fontWeight: 600, color: T.t2, fontSize: 13, display: 'flex', alignItems: 'center' }}>
                Executing Developer
              </div>
              {data.map((p) => (
                <div key={p.project_id} style={{ padding: '12px 14px' }}>
                  <span style={{ fontSize: 13, color: T.t1, fontWeight: 500 }}>{p.ngo_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
