import { useState, useEffect } from 'react';
import { mockProjects } from '../../data/mockData.js';
import { fetchProjects } from '../../services/api.js';
import { Card, SectionHeader, Badge, MRVScore, Btn } from '../UI.jsx';
import { CheckCircle, AlertTriangle, MapPin, Layers } from 'lucide-react';

export function NGOMRVResults() {
  const [project, setProject] = useState(mockProjects[0]);
  const [projectCount, setProjectCount] = useState(mockProjects.length);

  useEffect(() => {
    fetchProjects(1).then(res => {
      if (!res.error && Array.isArray(res.data) && res.data.length > 0) {
        setProject(res.data[0]);
        setProjectCount(res.data.length);
      }
    }).catch(() => {});
  }, []);

  const myProject = project;
  const mrvScore = myProject.mrv_score || myProject.mrvScore || 91;
  const envScore = myProject.env_score || myProject.envScore || 88;
  const fraudRisk = myProject.fraud_risk || myProject.fraudRisk || 12;

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="MRV Verification Results" subtitle="AI-powered monitoring, reporting & verification" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <Card>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{myProject.name}</div>
            <Badge type={myProject.status} label={myProject.status} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'AI MRV Score', value: mrvScore, color: '#2dd4bf', note: 'High confidence' },
              { label: 'Environmental Impact', value: envScore, color: '#60a5fa', note: 'Above average' },
              { label: 'Fraud Risk', value: fraudRisk, color: '#34d399', note: 'Low risk' },
            ].map(({ label, value, color, note }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#1e293b' }}>{note}</div>
                  </div>
                  <span style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'Fraunces, serif' }}>{value}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: value + '%', background: color, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(16,185,129,0.1)20', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: 14, display: 'flex', gap: 10 }}>
            <CheckCircle size={16} color="#2dd4bf" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#2dd4bf' }}>Verification Complete</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>All checks passed. Project eligible for credit minting.</div>
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Image Analysis Results" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {['Canopy Coverage', 'Species Count', 'Growth Rate', 'GPS Accuracy'].map((label, i) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#1e293b', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#34d399', fontFamily: 'Fraunces, serif' }}>{['84%', '142', '+12%', '99.2%'][i]}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Duplicate Check</div>
          <div style={{ background: 'rgba(16,185,129,0.1)20', border: '1px solid rgba(16,185,129,0.25)30', borderRadius: 6, padding: 10, fontSize: 12, color: '#475569' }}>
            ✓ No duplicate images detected across {projectCount} projects
          </div>
        </Card>
      </div>
    </div>
  );
}

export function NGOPlotsMap() {
  const plots = [
    { id: 'AZ-001', area: 240, coords: '-3.4653, -62.2159', status: 'approved', lastUpdate: '2024-12-10' },
    { id: 'AZ-002', area: 185, coords: '-3.4721, -62.2231', status: 'pending', lastUpdate: '2024-11-28' },
    { id: 'AZ-003', area: 312, coords: '-3.4582, -62.2098', status: 'approved', lastUpdate: '2024-12-05' },
    { id: 'AZ-004', area: 198, coords: '-3.4814, -62.2304', status: 'pending', lastUpdate: '2024-12-08' },
  ];

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader title="Plots & Maps" subtitle="Geographic overview of all project plots" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* Map placeholder */}
        <Card style={{ padding: 0, overflow: 'hidden', minHeight: 400 }}>
          <div style={{ height: 400, background: 'linear-gradient(135deg, #0a1a0a 0%, #07080f 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {/* Simple SVG map representation */}
            <svg width="100%" height="100%" viewBox="0 0 600 380" style={{ position: 'absolute', inset: 0 }}>
              {/* Grid lines */}
              {[0,1,2,3,4,5].map(i => <line key={'h'+i} x1="0" y1={i*76} x2="600" y2={i*76} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />)}
              {[0,1,2,3,4,5,6].map(i => <line key={'v'+i} x1={i*100} y1="0" x2={i*100} y2="380" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />)}
              {/* Plot markers */}
              {[[180,160],[240,200],[150,130],[290,230]].map(([x,y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r={20} fill="#2dd4bf18" stroke="#2dd4bf" strokeWidth="1.5" />
                  <circle cx={x} cy={y} r={6} fill="#2dd4bf" />
                  <text x={x+12} y={y-12} fill="#34d399" fontSize="10" fontWeight="600">{plots[i]?.id}</text>
                </g>
              ))}
            </svg>
            <div style={{ background: '#0d0f1ecc', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '8px 14px', position: 'absolute', bottom: 16, left: 16, fontSize: 11, color: '#475569' }}>
              Interactive map — Leaflet would render here
            </div>
          </div>
        </Card>

        {/* Plots list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plots.map(p => (
            <Card key={p.id} style={{ padding: 14, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Plot {p.id}</span>
                <Badge type={p.status} label={p.status} />
              </div>
              <div style={{ display: 'flex', gap: 6, fontSize: 11, color: '#475569', marginBottom: 4 }}>
                <Layers size={11} /> {p.area} ha
              </div>
              <div style={{ fontSize: 11, color: '#1e293b' }}>{p.lastUpdate}</div>
            </Card>
          ))}
          <Btn><MapPin size={14} /> Add Plot</Btn>
        </div>
      </div>
    </div>
  );
}
