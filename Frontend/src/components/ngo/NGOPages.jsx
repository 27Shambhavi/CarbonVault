import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../../AppContext.jsx';
import { createProject, fetchProjects, fetchDashboard, fetchMapProjects, fetchMarketplaceRequests, checkSiteSuitability, acceptBuyRequest } from '../../services/api.js';
import { Card, SectionHeader, Table, Badge, MRVScore, KPICard, Modal, Btn, T } from '../UI.jsx';
import { ProjectMap } from '../GoogleMap.jsx';
import { TreePine, Layers, ShoppingCart, Plus, MapPin, Upload, CheckCircle, Clock, TrendingUp, Search, Filter, Star, AlertCircle, X, Leaf, DollarSign } from 'lucide-react';

// ── Shared constants ────────────────────────────────────────────────────────────
const NGO_ID = 1; // Hardcoded for demo — backend auto-creates NGO by name

// 7 plantation types with CO₂ info
const PLANTATION_TYPES = [
  { value: 'bamboo',     label: '🎋 Bamboo',      co2: '10–20 credits/acre/year' },
  { value: 'eucalyptus', label: '🌳 Eucalyptus',   co2: '8–15 credits/acre/year' },
  { value: 'teak',       label: '🌳 Teak',         co2: '3–8 credits/acre/year' },
  { value: 'neem',       label: '🌳 Neem',         co2: '2–6 credits/acre/year' },
  { value: 'mangrove',   label: '🌊 Mangrove',     co2: '20–40 credits/acre/year' },
  { value: 'pine',       label: '🌲 Pine',         co2: '5–10 credits/acre/year' },
  { value: 'banyan',     label: '🌳 Banyan',       co2: '2–5 credits/acre/year' },
  { value: 'mixed',      label: '⚡ Mixed Plantation', co2: '10–25+ credits/acre/year' },
];

const inp = { background:'var(--input-bg, rgba(255,255,255,0.04))', border:`1px solid ${T.border}`, borderRadius:9, padding:'10px 14px', color:T.t1, fontSize:14, outline:'none', width:'100%', fontFamily:'Plus Jakarta Sans, sans-serif' };
const lbl = { fontSize:10, color:T.t3, fontWeight:700, letterSpacing:'0.7px', textTransform:'uppercase', marginBottom:7, display:'block' };

// ── Toast Notification ──────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, type === 'error' ? 5000 : 4000);
    return () => clearTimeout(timer);
  }, [onClose, type]);

  const colors = {
    success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(52,211,153,0.35)', text: T.emeraldL, icon: CheckCircle },
    error:   { bg: 'rgba(244,63,94,0.12)',  border: 'rgba(251,113,133,0.35)', text: T.roseL,    icon: AlertCircle },
  };
  const c = colors[type] || colors.success;
  const Icon = c.icon;

  return (
    <div style={{
      position:'fixed', bottom:24, right:24, zIndex:9999,
      background:'#0c1020', border:`1px solid ${c.border}`,
      borderRadius:13, padding:'14px 20px', display:'flex', alignItems:'center', gap:12,
      boxShadow:`0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px ${c.border}`,
      animation:'fadeUp 0.25s ease', maxWidth:420,
    }}>
      <div style={{ background:c.bg, borderRadius:8, padding:8, display:'flex', flexShrink:0 }}>
        <Icon size={16} color={c.text} />
      </div>
      <div style={{ flex:1, fontSize:13, color:T.t1, fontWeight:600, lineHeight:1.5 }}>{message}</div>
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', padding:4, display:'flex' }}>
        <X size={14} color={T.t3} />
      </button>
    </div>
  );
}

// Hook for toast state
function useToast() {
  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, key: Date.now() });
  }, []);
  const hideToast = useCallback(() => setToast(null), []);
  const ToastEl = toast ? <Toast key={toast.key} message={toast.message} type={toast.type} onClose={hideToast} /> : null;
  return { showToast, ToastEl };
}

const CT = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (<div style={{background:'#0c1020',border:`1px solid rgba(45,212,191,0.2)`,borderRadius:10,padding:'10px 14px'}}>
    <div style={{color:T.teal,fontSize:11,fontWeight:700,marginBottom:3}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{color:T.t1,fontSize:12,fontWeight:700}}>{typeof p.value==='number'?p.value.toLocaleString():p.value}</div>)}
  </div>);
};

// ── Helper: generate polygon from center + area ─────────────────────────────────
function generatePolygonWKT(lat, lng, areaHectares) {
  // Create a simple rectangular polygon centered on lat/lng
  // 1 hectare ≈ 0.01 km² → side ≈ 100m → ~0.0009 degrees
  const sideKm = Math.sqrt(areaHectares * 0.01); // km
  const dLat = sideKm / 111.32; // ~111.32 km per degree latitude
  const dLng = sideKm / (111.32 * Math.cos(lat * Math.PI / 180));

  const coords = [
    `${(parseFloat(lng) - dLng).toFixed(6)} ${(parseFloat(lat) - dLat).toFixed(6)}`,
    `${(parseFloat(lng) + dLng).toFixed(6)} ${(parseFloat(lat) - dLat).toFixed(6)}`,
    `${(parseFloat(lng) + dLng).toFixed(6)} ${(parseFloat(lat) + dLat).toFixed(6)}`,
    `${(parseFloat(lng) - dLng).toFixed(6)} ${(parseFloat(lat) + dLat).toFixed(6)}`,
    `${(parseFloat(lng) - dLng).toFixed(6)} ${(parseFloat(lat) - dLat).toFixed(6)}`, // close
  ];

  return `POLYGON((${coords.join(', ')}))`;
}

// ── NGO Dashboard ──────────────────────────────────────────────────────────────
export function NGODashboard() {
  const { refreshKey } = useApp();
  const [data, setData] = useState(null);
  const [recentProjects, setRecentProjects] = useState([]);
  const [mapFeatures, setMapFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchDashboard(NGO_ID),
      fetchProjects(NGO_ID),
      fetchMapProjects(NGO_ID),
    ])
      .then(([dashRes, projRes, mapRes]) => {
        if (dashRes.error) { setError(dashRes.error); return; }
        setData(dashRes.data);
        if (!projRes.error && Array.isArray(projRes.data)) {
          setRecentProjects(projRes.data.slice(-4).reverse());
        }
        if (!mapRes.error && Array.isArray(mapRes.data?.projects)) {
          setMapFeatures(mapRes.data.projects);
        }
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) return (
    <div style={{padding:28, display:'flex', justifyContent:'center', alignItems:'center', minHeight:'40vh'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:`3px solid rgba(45,212,191,0.15)`,borderTop:`3px solid ${T.teal}`,borderRadius:'50%',margin:'0 auto 16px',animation:'spinSlow 0.8s linear infinite'}}/>
        <div style={{fontSize:14,color:T.t2}}>Loading dashboard…</div>
      </div>
    </div>
  );
  if (error || !data) return (
    <div style={{padding:28}}>
      <Card style={{textAlign:'center',padding:40}}>
        <AlertCircle size={32} color={T.roseL} style={{margin:'0 auto 12px'}} />
        <div style={{fontSize:16,fontWeight:700,color:T.t1,marginBottom:8}}>Failed to load dashboard</div>
        <div style={{fontSize:13,color:T.t3}}>{error || 'Could not connect to backend. Ensure the API server is running on port 8000.'}</div>
      </Card>
    </div>
  );

  return (
    <div style={{padding:28}}>
      <SectionHeader title="NGO Dashboard" subtitle="EcoGuard Brazil — project overview and performance"/>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:15,marginBottom:24}}>
        <KPICard icon={TreePine}   label="Active Projects"    value={data.active_projects}              sub={`${data.total_projects} total submitted`} trend="up"   color={T.teal}/>
        <KPICard icon={Layers}     label="Verified Credits" value={(data.total_credits || 0).toLocaleString()} sub="Tonnes CO₂e verified"         trend="up"   color={T.emeraldL}/>
        <KPICard icon={Leaf}       label="Shadow Credits"  value={(data.total_shadow_credits || 0).toLocaleString()} sub="5-year projection" trend="up" color={T.violetL || T.teal}/>
        <KPICard icon={DollarSign} label="Total Funding" value={`$${(data.total_funding || 0).toLocaleString()}`} sub="Revenue from credit sales" trend="up" color={T.goldL}/>
      </div>

      {/* Map of projects */}
      <Card style={{marginBottom:22}}>
        <SectionHeader title="Project Locations" subtitle="Plantation polygons from your submissions (pending and approved)"/>
        <ProjectMap features={mapFeatures} height={340} />
      </Card>

      {/* Recent projects */}
      <Card>
        <SectionHeader title="Recent Projects"/>
        {recentProjects.length === 0 ? (
          <div style={{textAlign:'center',padding:32,color:T.t3,fontSize:13}}>No projects yet. Create your first project to get started!</div>
        ) : (
          recentProjects.map((p, i) => {
            const statusIcon = p.status === 'approved' ? CheckCircle : p.status === 'rejected' ? AlertCircle : Clock;
            const statusColor = p.status === 'approved' ? T.emeraldL : p.status === 'rejected' ? T.roseL : T.goldL;
            const Icon = statusIcon;
            return (
              <div key={p.project_id} style={{display:'flex',gap:12,alignItems:'center',padding:'12px 0',borderBottom:i<recentProjects.length-1?`1px solid rgba(255,255,255,0.04)`:'none'}}>
                <div style={{background:`${statusColor}15`,borderRadius:8,padding:8,display:'flex',flexShrink:0}}><Icon size={14} color={statusColor}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:T.t1,fontWeight:600}}>{p.name}</div>
                  <div style={{fontSize:11,color:T.t3,marginTop:2}}>{p.project_id} · {p.plantation_type} · {p.area_hectares} ha</div>
                </div>
                <div style={{textAlign:'right',marginRight:8}}>
                  <div style={{fontSize:13,color:T.emeraldL,fontWeight:700}}>{(p.credits || 0).toLocaleString()} credits</div>
                  <div style={{fontSize:10,color:T.t3}}>{p.price_per_ton ? `$${p.price_per_ton}/t` : ''}</div>
                </div>
                <Badge type={p.status} label={p.status}/>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

// ── My Projects ────────────────────────────────────────────────────────────────
export function NGOProjects() {
  const { refreshKey } = useApp();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProjects(NGO_ID)
      .then(res => {
        if (res.error) { setError(res.error); return; }
        setProjects(Array.isArray(res.data) ? res.data : []);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = projects.filter(p => (filter === 'all' || p.status === filter) && p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return (
    <div style={{padding:28, display:'flex', justifyContent:'center', alignItems:'center', minHeight:'40vh'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:`3px solid rgba(45,212,191,0.15)`,borderTop:`3px solid ${T.teal}`,borderRadius:'50%',margin:'0 auto 16px',animation:'spinSlow 0.8s linear infinite'}}/>
        <div style={{fontSize:14,color:T.t2}}>Loading projects…</div>
      </div>
    </div>
  );

  return (
    <div style={{padding:28}}>
      <SectionHeader title="My Projects" subtitle="All submitted and approved projects" action={<Btn><Plus size={13}/>New Project</Btn>}/>

      {error && (
        <Card style={{marginBottom:16,padding:16,border:'1px solid rgba(244,63,94,0.25)'}}>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <AlertCircle size={16} color={T.roseL}/>
            <span style={{fontSize:13,color:T.roseL}}>{error}</span>
          </div>
        </Card>
      )}

      <div style={{display:'flex',gap:10,marginBottom:20}}>
        <div style={{position:'relative',flex:1,maxWidth:320}}>
          <Search size={13} color={T.t3} style={{position:'absolute',left:12,top:12}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search projects..." style={{...inp,paddingLeft:36}}/>
        </div>
        {['all','approved','pending','rejected'].map(s=>(
          <button key={s} onClick={()=>setFilter(s)}
            style={{background:filter===s?'rgba(45,212,191,0.1)':'rgba(255,255,255,0.03)',border:`1px solid ${filter===s?'rgba(45,212,191,0.35)':T.border}`,borderRadius:9,padding:'9px 16px',color:filter===s?T.teal:T.t3,fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'capitalize',transition:'all 0.15s'}}>
            {s==='all'?'All':s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <div style={{textAlign:'center',padding:40,color:T.t3,fontSize:13}}>
            {projects.length === 0 ? 'No projects found. Create your first project!' : 'No projects match the current filter.'}
          </div>
        ) : (
          <Table
            headers={['Project ID','Name','Type','Area (ha)','Credits','Shadow','Price/t','Status']}
            rows={filtered.map(p=>[
              <span style={{color:T.teal,fontWeight:700,fontSize:12}}>{p.project_id}</span>,
              <span style={{fontWeight:600,color:T.t1}}>{p.name}</span>,
              <Badge type={p.status==='approved'?'reforestation':p.status==='rejected'?'rejected':'pending'} label={p.plantation_type}/>,
              <span style={{color:T.t2}}>{p.area_hectares}</span>,
              <span style={{color:T.emeraldL,fontWeight:700}}>{(p.credits || 0).toLocaleString()}</span>,
              <span style={{color:T.violetL || T.teal,fontWeight:600,fontSize:12}}>{(p.shadow_credits || 0).toLocaleString()}</span>,
              <span style={{color:T.goldL,fontWeight:700}}>{p.price_per_ton ? `$${p.price_per_ton}` : '—'}</span>,
              <Badge type={p.status} label={p.status}/>,
            ])}
          />
        )}
      </Card>
    </div>
  );
}

// ── New Project ────────────────────────────────────────────────────────────────
export function NGONewProject() {
  const { triggerRefresh } = useApp();
  const { showToast, ToastEl } = useToast();
  const [form,setForm] = useState({name:'',ngo:'EcoGuard Brazil',lat:'',lng:'',area:'',plantType:'mangrove',trees:'',startDate:'',notes:'',polygon:''});
  const [images,setImages] = useState([]);
  const [submitted,setSubmitted] = useState(false);
  const [submitting,setSubmitting] = useState(false);
  const [actualProjectId, setActualProjectId] = useState(null);
  const [createdScores, setCreatedScores] = useState(null);
  const f = (k,v)=>setForm({...form,[k]:v});

  const resetForm = () => {
    setForm({name:'',ngo:'EcoGuard Brazil',lat:'',lng:'',area:'',plantType:'mangrove',trees:'',startDate:'',notes:'',polygon:''});
    setImages([]);
    setCreatedScores(null);
  };

  // Auto-generate polygon when lat/lng/area change
  const autoGeneratePolygon = () => {
    if (form.lat && form.lng && form.area) {
      const wkt = generatePolygonWKT(parseFloat(form.lat), parseFloat(form.lng), parseFloat(form.area));
      f('polygon', wkt);
      showToast('Polygon auto-generated from coordinates and area');
    } else {
      showToast('Enter latitude, longitude, and area first', 'error');
    }
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!form.name.trim()) { showToast('Please enter a project name', 'error'); return; }
    if (!form.lat || !form.lng) { showToast('Please enter latitude and longitude', 'error'); return; }
    if (!form.area) { showToast('Please enter the area in hectares', 'error'); return; }
    if (!form.trees) { showToast('Please enter the number of trees', 'error'); return; }
    if (!form.startDate) { showToast('Please select a start date', 'error'); return; }
    if (!images.length) { showToast('Please upload at least one evidence image before submitting.', 'error'); return; }
    if (!form.polygon.trim() || !form.polygon.toUpperCase().includes('POLYGON')) {
      showToast('Please provide a valid WKT polygon for the plantation area. Use "Auto Generate" or enter manually.', 'error');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('project_name', form.name.trim());
    formData.append('ngo_name', form.ngo.trim());
    formData.append('latitude', parseFloat(form.lat));
    formData.append('longitude', parseFloat(form.lng));
    formData.append('plantation_type', form.plantType.toLowerCase());
    formData.append('area_hectares', parseFloat(form.area));
    formData.append('number_of_trees', parseInt(form.trees, 10));
    formData.append('start_date', form.startDate);
    formData.append('polygon_wkt', form.polygon.trim());
    formData.append('evidence_image', images[0].file); // actual File object

    const { data, error } = await createProject(formData);
    setSubmitting(false);

    if (error) {
      showToast(`Failed to create project: ${error}`, 'error');
      return;
    }

    setActualProjectId(data.project_id);
    setCreatedScores({ mrv: data.mrvScore, fraud: data.fraudRisk, env: data.envScore });
    setSubmitted(true);
    triggerRefresh(); // Notify Dashboard & My Projects to re-fetch
    showToast('Project created successfully! Awaiting admin review.');
  };

  if(submitted) return (
    <div style={{padding:28,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'60vh'}}>
      <div style={{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(52,211,153,0.3)',borderRadius:20,padding:48,textAlign:'center',maxWidth:520}}>
        <CheckCircle size={52} color={T.emeraldL} style={{margin:'0 auto 20px'}}/>
        <div style={{fontSize:28,fontWeight:900,color:T.t1,fontFamily:'Fraunces, serif',marginBottom:8}}>Project Submitted!</div>
        <div style={{fontSize:15,color:T.t3,marginBottom:20,lineHeight:1.7}}>Your project has been registered and sent for admin review.</div>
        <div style={{background:'rgba(45,212,191,0.08)',border:'1px solid rgba(45,212,191,0.2)',borderRadius:12,padding:16,marginBottom:16}}>
          <div style={{fontSize:11,color:T.teal,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:4}}>Generated Project ID</div>
          <div style={{fontSize:32,fontWeight:900,color:T.tealL,fontFamily:'Fraunces, serif'}}>{actualProjectId}</div>
        </div>
        {createdScores && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
            <div style={{background:'rgba(45,212,191,0.06)',borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:10,color:T.t3,textTransform:'uppercase',marginBottom:4}}>MRV</div>
              <div style={{fontSize:20,fontWeight:800,color:T.teal,fontFamily:'Fraunces, serif'}}>{createdScores.mrv}</div>
            </div>
            <div style={{background:(createdScores.fraud||0)>50?'rgba(244,63,94,0.06)':'rgba(16,185,129,0.06)',borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:10,color:T.t3,textTransform:'uppercase',marginBottom:4}}>Risk</div>
              <div style={{fontSize:20,fontWeight:800,color:(createdScores.fraud||0)>50?T.roseL:T.emeraldL,fontFamily:'Fraunces, serif'}}>{createdScores.fraud}%</div>
            </div>
            <div style={{background:'rgba(16,185,129,0.06)',borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:10,color:T.t3,textTransform:'uppercase',marginBottom:4}}>ENV</div>
              <div style={{fontSize:20,fontWeight:800,color:T.emeraldL,fontFamily:'Fraunces, serif'}}>{createdScores.env}</div>
            </div>
          </div>
        )}
        <Btn onClick={()=>{setSubmitted(false);resetForm();}}>Submit Another Project</Btn>
      </div>
      {ToastEl}
    </div>
  );

  // Show map preview if lat/lng entered
  const previewProject = form.lat&&form.lng ? [{id:'NEW',name:form.name||'New Project',lat:parseFloat(form.lat),lng:parseFloat(form.lng),status:'pending'}] : [];

  // CO₂ info for selected type
  const selectedType = PLANTATION_TYPES.find(t => t.value === form.plantType) || PLANTATION_TYPES[4];

  // Estimate credits preview
  const estimatedCredits = form.area ? (() => {
    const rates = { bamboo:15, eucalyptus:11.5, teak:5.5, neem:4, mangrove:30, pine:7.5, banyan:3.5, mixed:15 };
    const rate = rates[form.plantType] || 10;
    const areaAcres = parseFloat(form.area) * 2.47105;
    return Math.round(rate * areaAcres);
  })() : 0;

  return (
    <div style={{padding:28}}>
      <SectionHeader title="New Project Registration" subtitle="Submit a new carbon project for verification"/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        {/* Form */}
        <div>
          <Card style={{marginBottom:16}}>
            <SectionHeader title="Project Details"/>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Project Name</label>
              <input value={form.name} onChange={e=>f('name',e.target.value)} placeholder="e.g. Amazon Phase 2 Reforestation" style={inp}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>NGO / Organization Name</label>
              <input value={form.ngo} onChange={e=>f('ngo',e.target.value)} style={inp}/>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div>
                <label style={lbl}>Latitude</label>
                <input value={form.lat} onChange={e=>f('lat',e.target.value)} placeholder="-3.4653" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Longitude</label>
                <input value={form.lng} onChange={e=>f('lng',e.target.value)} placeholder="-62.2159" style={inp}/>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div>
                <label style={lbl}>Area (hectares)</label>
                <input type="number" value={form.area} onChange={e=>f('area',e.target.value)} placeholder="1200" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Number of Trees</label>
                <input type="number" value={form.trees} onChange={e=>f('trees',e.target.value)} placeholder="48000" style={inp}/>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Plantation Type</label>
              <select value={form.plantType} onChange={e=>f('plantType',e.target.value)} style={{...inp,cursor:'pointer'}}>
                {PLANTATION_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div style={{marginTop:6,background:'rgba(45,212,191,0.06)',border:'1px solid rgba(45,212,191,0.15)',borderRadius:8,padding:'8px 12px',fontSize:12}}>
                <span style={{color:T.t3}}>CO₂ Rate: </span>
                <span style={{color:T.emeraldL,fontWeight:700}}>{selectedType.co2}</span>
                <span style={{color:T.t3}}> · 1 Credit = 1 ton CO₂</span>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Start Date</label>
              <input type="date" value={form.startDate} onChange={e=>f('startDate',e.target.value)} style={inp}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={lbl}>Additional Notes</label>
              <textarea value={form.notes} onChange={e=>f('notes',e.target.value)} rows={3} placeholder="Describe the project scope, methodology, co-benefits..." style={{...inp,resize:'vertical'}}/>
            </div>
          </Card>

          {/* Polygon Input — MANDATORY */}
          <Card style={{marginBottom:16}}>
            <SectionHeader title="Plantation Area Polygon" subtitle="Required — WKT polygon defining the plantation boundary"/>
            <div style={{marginBottom:10}}>
              <label style={lbl}>WKT Polygon <span style={{color:T.roseL}}>*</span></label>
              <textarea
                value={form.polygon}
                onChange={e=>f('polygon',e.target.value)}
                rows={4}
                placeholder="POLYGON((lon1 lat1, lon2 lat2, lon3 lat3, lon4 lat4, lon1 lat1))"
                style={{...inp,resize:'vertical',fontFamily:'monospace',fontSize:12}}
              />
            </div>
            <Btn variant="secondary" onClick={autoGeneratePolygon} style={{marginBottom:10}}>
              <MapPin size={13}/>Auto-Generate from Coordinates & Area
            </Btn>
            <div style={{fontSize:11,color:T.t3,lineHeight:1.6}}>
              Enter a WKT POLYGON string or click "Auto-Generate" to create one from latitude, longitude, and area. This is used for fraud detection spatial analysis.
            </div>
          </Card>

          {/* Evidence Upload */}
          <Card>
            <SectionHeader title="Upload Evidence"/>
            <div
              onClick={()=>document.getElementById('evidenceInput').click()}
              style={{border:`2px dashed rgba(45,212,191,0.25)`,borderRadius:12,padding:32,textAlign:'center',cursor:'pointer',transition:'all 0.2s',background:'rgba(45,212,191,0.02)'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(45,212,191,0.5)';e.currentTarget.style.background='rgba(45,212,191,0.05)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(45,212,191,0.25)';e.currentTarget.style.background='rgba(45,212,191,0.02)';}}>
              <Upload size={28} color={T.teal} style={{margin:'0 auto 10px'}}/>
              <div style={{fontSize:14,color:T.t2,fontWeight:600}}>Drop files or click to upload</div>
              <div style={{fontSize:12,color:T.t3,marginTop:4}}>Photos, drone footage, field reports (JPG, PNG, PDF)</div>
              <input id="evidenceInput" type="file" multiple accept="image/*,.pdf" style={{display:'none'}}
                onChange={e=>setImages([...images,...Array.from(e.target.files).map(f=>({name:f.name,size:(f.size/1024).toFixed(1)+'KB',file:f}))])}/>
            </div>
            {images.length>0 && (
              <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:7}}>
                {images.map((img,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'rgba(45,212,191,0.06)',borderRadius:8,padding:'8px 12px'}}>
                    <span style={{fontSize:12,color:T.t2}}>{img.name}</span>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:11,color:T.t3}}>{img.size}</span>
                      <button onClick={(e)=>{e.stopPropagation();setImages(images.filter((_,idx)=>idx!==i));}} style={{background:'none',border:'none',cursor:'pointer',padding:2,display:'flex'}}>
                        <X size={12} color={T.t3}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{marginTop:16}}>
              <Btn style={{width:'100%',justifyContent:'center'}} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Project'}
              </Btn>
            </div>
          </Card>
        </div>

        {/* Right: map preview + summary */}
        <div>
          <Card style={{marginBottom:16}}>
            <SectionHeader title="Location Preview" subtitle={previewProject.length?`Showing: ${form.lat}, ${form.lng}`:'Enter lat/lng to preview on map'}/>
            <ProjectMap
              features={[]}
              projects={previewProject.length ? previewProject : [{ id: '?', name: 'Enter coordinates', lat: 20, lng: 20, status: 'pending' }]}
              previewWkt={form.polygon?.trim() || ''}
              height={300}
            />
          </Card>

          <Card style={{marginBottom:16}}>
            <SectionHeader title="Project Summary"/>
            <div style={{background:'rgba(45,212,191,0.07)',border:'1px solid rgba(45,212,191,0.2)',borderRadius:12,padding:22,textAlign:'center',marginBottom:14}}>
              <div style={{fontSize:10,color:T.teal,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:6}}>ID assigned on submit</div>
              <div style={{fontSize:28,fontWeight:900,color:T.tealL,fontFamily:'Fraunces, serif',letterSpacing:'-1px'}}>PRJ-XXX-XXXXXX</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[['Project Name',form.name||'—'],['Plant Type',selectedType.label],['Area',form.area?form.area+' ha':'—'],['Trees',form.trees?Number(form.trees).toLocaleString():'—'],['Start Date',form.startDate||'—'],['Polygon',form.polygon?'✓ Set':'✗ Required']].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid rgba(255,255,255,0.04)`,fontSize:13}}>
                  <span style={{color:T.t3}}>{k}</span><span style={{color:k==='Polygon'&&v.includes('Required')?T.roseL:T.t1,fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Estimated Credits Preview */}
          {form.area && (
            <Card>
              <SectionHeader title="Estimated Credits" subtitle="Based on plantation type and area"/>
              <div style={{background:'rgba(16,185,129,0.07)',border:'1px solid rgba(52,211,153,0.2)',borderRadius:12,padding:22,textAlign:'center',marginBottom:14}}>
                <div style={{fontSize:10,color:T.emeraldL,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:6}}>Estimated Annual Credits</div>
                <div style={{fontSize:36,fontWeight:900,color:T.emeraldL,fontFamily:'Fraunces, serif',textShadow:`0 0 20px rgba(16,185,129,0.4)`}}>{estimatedCredits.toLocaleString()}</div>
                <div style={{fontSize:12,color:T.t3,marginTop:4}}>tonnes CO₂/year</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'5px 0',borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
                  <span style={{color:T.t3}}>Area (acres)</span>
                  <span style={{color:T.t1,fontWeight:600}}>{(parseFloat(form.area) * 2.47105).toFixed(1)}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'5px 0',borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
                  <span style={{color:T.t3}}>Base price</span>
                  <span style={{color:T.goldL,fontWeight:600}}>₹1,000 / credit (~$12)</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'5px 0'}}>
                  <span style={{color:T.t3}}>Est. Annual Value</span>
                  <span style={{color:T.emeraldL,fontWeight:700}}>₹{(estimatedCredits * 1000).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
      {ToastEl}
    </div>
  );
}

// ── Site Suitability ────────────────────────────────────────────────────────────
export function NGOSiteSuitability() {
  const [lat,setLat]     = useState('');
  const [lng,setLng]     = useState('');
  const [apiKey,setApiKey] = useState('');
  const [checking,setChecking] = useState(false);
  const [result,setResult] = useState(null);
  const { showToast, ToastEl } = useToast();

  const handleCheck = async () => {
    if(!lat||!lng){ showToast('Please enter coordinates', 'error'); return; }
    setChecking(true);
    setResult(null);

    const { data, error } = await checkSiteSuitability(parseFloat(lat), parseFloat(lng));

    if (error) {
      showToast('Failed to check suitability: ' + error, 'error');
      setChecking(false);
      return;
    }

    setResult({
      suitable: data.suitability_score > 0.5,
      score: Math.round(data.suitability_score * 100),
      soilType: 'Unknown',
      rainfall: 'Unknown',
      climate: 'Unknown',
      biodiversity: 'Unknown',
      floodRisk: 'Unknown',
      recommendation: data.suitability_score > 0.5 ? 'Suitable' : 'Not suitable'
    });
    setChecking(false);
  };

  const previewPts = lat&&lng?[{id:'SIT',name:'Check Site',lat:parseFloat(lat),lng:parseFloat(lng),status:'pending'}]:[];

  return (
    <div style={{padding:28}}>
      <SectionHeader title="Site Suitability Engine" subtitle="Check if a location is suitable for carbon plantation"/>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div>
          <Card style={{marginBottom:16}}>
            <SectionHeader title="Enter Site Coordinates"/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div><label style={lbl}>Latitude</label><input value={lat} onChange={e=>setLat(e.target.value)} placeholder="-3.4653" style={inp}/></div>
              <div><label style={lbl}>Longitude</label><input value={lng} onChange={e=>setLng(e.target.value)} placeholder="-62.2159" style={inp}/></div>
            </div>
            <div style={{marginBottom:16}}>
              <label style={lbl}>Site Suitability API Key</label>
              <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="Enter your API key..." style={inp}/>
              <div style={{fontSize:11,color:T.t3,marginTop:5}}>API key is stored securely and used only for analysis requests.</div>
            </div>
            <Btn style={{width:'100%',justifyContent:'center'}} onClick={handleCheck} disabled={checking}>
              {checking?'Analyzing Site...':'Check Suitability'}
            </Btn>
          </Card>

          {/* Result */}
          {result && (
            <Card>
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
                {result.suitable
                  ?<div style={{width:48,height:48,borderRadius:'50%',background:'rgba(16,185,129,0.15)',display:'flex',alignItems:'center',justifyContent:'center'}}><CheckCircle size={24} color={T.emeraldL}/></div>
                  :<div style={{width:48,height:48,borderRadius:'50%',background:'rgba(244,63,94,0.12)',display:'flex',alignItems:'center',justifyContent:'center'}}><AlertCircle size={24} color={T.roseL}/></div>}
                <div>
                  <div style={{fontSize:18,fontWeight:800,color:result.suitable?T.emeraldL:T.roseL,fontFamily:'Fraunces, serif'}}>{result.suitable?'✓ Suitable for Plantation':'✗ Not Recommended'}</div>
                  <div style={{fontSize:12,color:T.t3,marginTop:2}}>Suitability Score: <strong style={{color:T.t1}}>{result.score}/100</strong></div>
                </div>
              </div>
              <div style={{height:6,background:'rgba(255,255,255,0.07)',borderRadius:4,overflow:'hidden',marginBottom:18}}>
                <div style={{height:'100%',width:`${result.score}%`,background:`linear-gradient(90deg,${result.suitable?T.emeraldL:T.roseL}88,${result.suitable?T.emeraldL:T.roseL})`,borderRadius:4}}/>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:16}}>
                {[['Soil Type',result.soilType],['Annual Rainfall',result.rainfall],['Climate Zone',result.climate],['Biodiversity',result.biodiversity],['Flood Risk',result.floodRisk]].map(([k,v])=>(
                  <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid rgba(255,255,255,0.04)`,fontSize:13}}>
                    <span style={{color:T.t3}}>{k}</span><span style={{color:T.t1,fontWeight:600}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{background:`rgba(${result.suitable?'16,185,129':'244,63,94'},0.07)`,border:`1px solid rgba(${result.suitable?'52,211,153':'244,63,94'},0.2)`,borderRadius:10,padding:14}}>
                <div style={{fontSize:13,color:T.t2,lineHeight:1.65}}>{result.recommendation}</div>
              </div>
            </Card>
          )}
          {checking && (
            <Card style={{textAlign:'center',padding:40}}>
              <div style={{width:44,height:44,border:`3px solid rgba(45,212,191,0.15)`,borderTop:`3px solid ${T.teal}`,borderRadius:'50%',margin:'0 auto 16px',animation:'spinSlow 0.8s linear infinite'}}/>
              <div style={{fontSize:14,color:T.t2}}>Analyzing site conditions…</div>
            </Card>
          )}
        </div>

        {/* Map */}
        <div>
          <Card>
            <SectionHeader title="Site Location" subtitle={lat&&lng?`${lat}°, ${lng}°`:'Enter coordinates to preview'}/>
            <ProjectMap projects={previewPts.length ? previewPts : []} height={360} />
          </Card>
        </div>
      </div>
      {ToastEl}
    </div>
  );
}

// ── NGO Marketplace ─────────────────────────────────────────────────────────────
export function NGOMarketplace() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payModal,setPayModal] = useState(null);
  const [paid,setPaid]       = useState({});
  const { showToast, ToastEl } = useToast();

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchMarketplaceRequests(NGO_ID)
      .then(res => {
        if (res.error) { setError(res.error); return; }
        setRequests(Array.isArray(res.data) ? res.data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSell = async (req) => {
    // Accept the request on the backend first
    const { error } = await acceptBuyRequest(req.id);
    if (error) {
      showToast(`Failed to accept request: ${error}`, 'error');
    }
    setPayModal(req);
  };

  const handleRazorPay = async (req) => {
    setPaid({...paid,[req.id]:true});
    setPayModal(null);
    showToast(`Payment received for ${req.project_name || req.project_id}!`);
  };

  const inrAmount = (usd) => `₹${(usd*83.5).toLocaleString('en-IN',{maximumFractionDigits:0})}`;

  if (loading) return (
    <div style={{padding:28, display:'flex', justifyContent:'center', alignItems:'center', minHeight:'40vh'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:`3px solid rgba(45,212,191,0.15)`,borderTop:`3px solid ${T.teal}`,borderRadius:'50%',margin:'0 auto 16px',animation:'spinSlow 0.8s linear infinite'}}/>
        <div style={{fontSize:14,color:T.t2}}>Loading marketplace…</div>
      </div>
    </div>
  );

  return (
    <div style={{padding:28}}>
      <SectionHeader title="Marketplace" subtitle="Corporate buy requests — accept and receive payment via Razorpay"/>

      {error && (
        <Card style={{marginBottom:16,padding:16,border:'1px solid rgba(244,63,94,0.25)'}}>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            <AlertCircle size={16} color={T.roseL}/>
            <span style={{fontSize:13,color:T.roseL}}>{error}</span>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14,marginBottom:22}}>
        {[
          {l:'Open Requests',  v:requests.filter(r=>r.status==='pending').length, c:T.goldL},
          {l:'Total Offer Value',v:inrAmount(requests.reduce((s,r)=>s+(r.total||0),0)),c:T.emeraldL},
          {l:'Completed Sales', v:requests.filter(r=>r.status==='accepted').length,c:T.teal},
        ].map(({l,v,c})=>(
          <div key={l} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${T.border}`,borderRadius:12,padding:'16px 20px',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${c}50,transparent)`}}/>
            <div style={{fontSize:26,fontWeight:800,fontFamily:'Fraunces, serif',color:c}}>{v}</div>
            <div style={{fontSize:11,color:T.t3,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginTop:5}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Buy requests */}
      <Card>
        <SectionHeader title="Corporate Buy Requests" subtitle="Companies requesting to purchase your credits"/>
        {requests.length === 0 ? (
          <div style={{textAlign:'center',padding:40,color:T.t3,fontSize:13}}>No buy requests yet.</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {requests.map(req=>(
              <div key={req.id} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${paid[req.id]?'rgba(16,185,129,0.3)':req.status==='accepted'?'rgba(16,185,129,0.2)':T.border}`,borderRadius:13,padding:18,display:'flex',alignItems:'center',gap:16}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:6}}>
                    <span style={{fontSize:11,color:T.teal,fontWeight:700}}>{req.id}</span>
                    <span style={{fontSize:13,fontWeight:700,color:T.t1}}>{req.buyer}</span>
                    <Badge type={paid[req.id]?'approved':req.status==='accepted'?'approved':req.status} label={paid[req.id]?'Sold':req.status==='accepted'?'Accepted':req.status}/>
                  </div>
                  <div style={{fontSize:12,color:T.t3,marginBottom:4}}>Project: <span style={{color:T.t2}}>{req.project_name}</span> · {req.project_id}</div>
                  <div style={{display:'flex',gap:18,fontSize:12}}>
                    <span style={{color:T.t3}}>Tonnes: <strong style={{color:T.t2}}>{(req.tons||0).toLocaleString()}</strong></span>
                    <span style={{color:T.t3}}>Price/t: <strong style={{color:T.goldL}}>${req.price_per_ton}</strong></span>
                    <span style={{color:T.t3}}>Total: <strong style={{color:T.emeraldL}}>{inrAmount(req.total||0)}</strong></span>
                  </div>
                </div>
                <div style={{flexShrink:0}}>
                  {paid[req.id]
                    ? <div style={{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(52,211,153,0.3)',borderRadius:9,padding:'8px 16px',color:T.emeraldL,fontSize:13,fontWeight:700}}>✓ Payment Received</div>
                    : req.status==='accepted'
                      ? <Btn variant="gold" onClick={()=>handleSell(req)}>Receive Payment</Btn>
                      : (
                        <div style={{display:'flex',gap:8}}>
                          <Btn onClick={()=>handleSell(req)}>Accept & Sell</Btn>
                          <Btn variant="secondary">Decline</Btn>
                        </div>
                      )
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Razorpay Modal */}
      <Modal open={!!payModal} onClose={()=>setPayModal(null)} title="Razorpay Payment" width={440}>
        {payModal && (
          <div>
            <div style={{background:'rgba(45,212,191,0.06)',border:'1px solid rgba(45,212,191,0.18)',borderRadius:12,padding:20,marginBottom:20}}>
              <div style={{fontSize:11,color:T.teal,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:8}}>Payment Summary</div>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {[['Buyer',payModal.buyer],['Project',payModal.project_name||payModal.project_id],['Credits',(payModal.tons||0).toLocaleString()+'t'],['Amount (USD)',`$${(payModal.total||0).toLocaleString()}`],['Amount (INR)',inrAmount(payModal.total||0)]].map(([k,v])=>(
                  <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:13,padding:'5px 0',borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
                    <span style={{color:T.t3}}>{k}</span><span style={{color:T.t1,fontWeight:700}}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:10,padding:14,marginBottom:20,fontSize:12,color:T.t3,lineHeight:1.6}}>
              <strong style={{color:T.goldL}}>Razorpay Integration:</strong> In production, clicking below opens the Razorpay checkout with <code style={{color:T.teal}}>rzp_test_...</code> key. This demo simulates the payment flow.
            </div>
            <Btn style={{width:'100%',justifyContent:'center',background:'linear-gradient(135deg,#00BAF2,#0099cc)',color:'#fff',boxShadow:'0 4px 16px rgba(0,186,242,0.3)'}} onClick={()=>handleRazorPay(payModal)}>
              💳 Pay via Razorpay — {inrAmount(payModal.total||0)}
            </Btn>
          </div>
        )}
      </Modal>
      {ToastEl}
    </div>
  );
}