import { useState, useEffect } from 'react';
import { fetchAllProjects, fetchMapProjects, fetchMapPendingProjects, updateProjectStatus } from '../../services/api.js';
import { Card, SectionHeader, Badge, MRVScore, Modal, Btn, T } from '../UI.jsx';
import { ProjectMap } from '../GoogleMap.jsx';
import { CheckCircle, XCircle, MessageSquare, AlertTriangle, ImageOff, ZoomIn, Leaf, DollarSign } from 'lucide-react';

const API_BASE = '/api';

export default function AdminApprovals() {
  const [projects, setProjects] = useState([]);
  const [mapFeatures, setMapFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState(null);
  const [fs, setFs] = useState('all');
  const [modal, setModal] = useState(null);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [imgLightbox, setImgLightbox] = useState(null);

  const loadMapFeatures = () => {
    Promise.all([fetchMapProjects(), fetchMapPendingProjects()]).then(([a, b]) => {
      const approved = a.data?.projects || [];
      const pending = b.data?.projects || [];
      setMapFeatures([...approved, ...pending]);
    });
  };

  const loadProjects = () => {
    setLoading(true);
    loadMapFeatures();
    fetchAllProjects()
      .then(res => {
        if (!res.error && Array.isArray(res.data)) {
          setProjects(res.data);
          if (res.data.length > 0 && !selId) setSelId(res.data[0].project_id || res.data[0].id);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProjects(); }, []);

  // Derive selected project from list (always in sync)
  const sel = projects.find(p => (p.project_id || p.id) === selId) || null;

  const filtered = fs === 'all' ? projects : projects.filter(p => p.status === fs);

  // Build the evidence image URL from backend data
  const getEvidenceUrl = (project) => {
    if (!project) return null;
    // Backend returns evidence_image like "/uploads/PRJ-MAN-XXXX.jpg"
    if (project.evidence_image) {
      return `${API_BASE}${project.evidence_image}`;
    }
    return null;
  };

  const handleApprove = async () => {
    if (!sel) return;
    setActionLoading(true);
    const { data, error } = await updateProjectStatus(sel.project_id || sel.id, 'approved');
    setActionLoading(false);
    setModal(null);
    if (!error) {
      loadMapFeatures();
      // Update the project in-place with credit data from response
      setProjects(prev => prev.map(p =>
        (p.project_id || p.id) === (sel.project_id || sel.id)
          ? {
              ...p,
              status: 'approved',
              credits: data?.credits || p.credits,
              shadow_credits: data?.shadow_credits || p.shadow_credits,
              price_per_ton: data?.price_per_ton || p.price_per_ton,
              total_funding: data?.total_funding || p.total_funding,
            }
          : p
      ));
      // Reload all projects to get fully updated data
      setTimeout(loadProjects, 500);
    }
  };

  const handleReject = async () => {
    if (!sel) return;
    setActionLoading(true);
    const { error } = await updateProjectStatus(sel.project_id || sel.id, 'rejected');
    setActionLoading(false);
    setModal(null);
    if (!error) {
      loadMapFeatures();
      setProjects(prev => prev.map(p =>
        (p.project_id || p.id) === (sel.project_id || sel.id)
          ? { ...p, status: 'rejected' }
          : p
      ));
    }
  };

  const ta = {background:'rgba(255,255,255,0.04)',border:`1px solid ${T.border}`,borderRadius:9,padding:'10px 14px',color:T.t1,fontSize:14,outline:'none',width:'100%',resize:'vertical',fontFamily:'Plus Jakarta Sans, sans-serif'};

  const inrAmount = (usd) => `₹${(usd*83.5).toLocaleString('en-IN',{maximumFractionDigits:0})}`;

  if (loading) return (
    <div style={{padding:28, display:'flex', justifyContent:'center', alignItems:'center', minHeight:'40vh'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:`3px solid rgba(45,212,191,0.15)`,borderTop:`3px solid ${T.teal}`,borderRadius:'50%',margin:'0 auto 16px',animation:'spinSlow 0.8s linear infinite'}}/>
        <div style={{fontSize:14,color:T.t2}}>Loading projects…</div>
      </div>
    </div>
  );

  const evidenceUrl = sel ? getEvidenceUrl(sel) : null;

  return (
    <div style={{padding:28}}>
      <Card style={{marginBottom:18,padding:0,overflow:'hidden'}}>
        <div style={{padding:'16px 20px 10px'}}>
          <SectionHeader
            title="Plantation map"
            subtitle="Approved (green) and pending (yellow). Click a polygon to select a project in the list."
          />
        </div>
        <ProjectMap
          features={mapFeatures}
          adminMode
          selectedId={selId}
          onFeatureSelect={(id) => setSelId(id)}
          height={300}
        />
      </Card>

      <div style={{display:'grid',gridTemplateColumns:'272px 1fr',gap:18,minHeight:'calc(100vh - 86px)'}}>
      {/* List */}
      <div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:13}}>
          {['all','pending','approved','rejected'].map(s=>(
            <button key={s} onClick={()=>setFs(s)}
              style={{background:fs===s?'rgba(45,212,191,0.1)':'transparent',border:`1px solid ${fs===s?'rgba(45,212,191,0.35)':T.border}`,borderRadius:7,padding:'5px 11px',color:fs===s?T.teal:T.t3,fontSize:11,fontWeight:700,cursor:'pointer',textTransform:'capitalize',transition:'all 0.14s'}}>
              {s}
            </button>
          ))}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {filtered.map(p=>(
            <button key={p.project_id || p.id} onClick={()=>setSelId(p.project_id || p.id)}
              style={{background:selId===(p.project_id||p.id)?'rgba(45,212,191,0.06)':'rgba(255,255,255,0.02)',border:`1px solid ${selId===(p.project_id||p.id)?'rgba(45,212,191,0.28)':T.border}`,borderRadius:11,padding:13,cursor:'pointer',textAlign:'left',transition:'all 0.17s',position:'relative',overflow:'hidden'}}>
              {selId===(p.project_id||p.id) && <div style={{position:'absolute',left:0,top:0,bottom:0,width:2,background:`linear-gradient(180deg, ${T.teal}, ${T.tealL})`}}/>}
              <div style={{fontSize:12,fontWeight:600,color:T.t1,marginBottom:5,lineHeight:1.35,paddingLeft:selId===(p.project_id||p.id)?6:0}}>{p.name}</div>
              <div style={{fontSize:11,color:T.t3,marginBottom:4,paddingLeft:selId===(p.project_id||p.id)?6:0}}>{p.ngo || 'Unknown'} · {p.plantation_type}</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingLeft:selId===(p.project_id||p.id)?6:0}}>
                <Badge type={p.status} label={p.status}/>
                {(p.credits || 0) > 0 && <span style={{fontSize:10,color:T.emeraldL,fontWeight:700}}>{(p.credits||0).toLocaleString()}t</span>}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{textAlign:'center',padding:24,color:T.t3,fontSize:13}}>No projects match this filter</div>
          )}
        </div>
      </div>

      {/* Detail */}
      {sel && (
        <div>
          <Card style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22}}>
              <div>
                <h2 style={{fontSize:20,fontWeight:800,color:T.t1,fontFamily:'Fraunces, serif',letterSpacing:'-0.4px',marginBottom:10}}>{sel.name}</h2>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  <Badge type={sel.plantation_type || sel.type || 'other'} label={(sel.plantation_type || sel.type || 'other').replace('_',' ')}/>
                  <Badge type={sel.status} label={sel.status}/>
                  <span style={{fontSize:12,color:T.t3}}>📍 {sel.location}</span>
                </div>
                {sel.polygon_area_hectares != null && sel.polygon_area_hectares > 0 && (
                  <div style={{
                    marginTop:14,
                    padding:'12px 14px',
                    borderRadius:10,
                    background:'rgba(45,212,191,0.08)',
                    border:'1px solid rgba(45,212,191,0.22)',
                    fontSize:13,
                    color:T.t2,
                    lineHeight:1.55,
                    maxWidth:520,
                  }}>
                    This project covers <strong style={{color:T.teal}}>{Number(sel.polygon_area_hectares).toFixed(3)} hectares</strong> for plantation
                    {sel.polygon_area_sq_meters != null && (
                      <span style={{color:T.t3}}> ({Math.round(sel.polygon_area_sq_meters).toLocaleString()} m² from polygon geometry)</span>
                    )}.
                  </div>
                )}
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:34,fontWeight:900,color:T.teal,fontFamily:'Fraunces, serif',lineHeight:1,textShadow:`0 0 24px rgba(45,212,191,0.4)`}}>{(sel.credits || 0).toLocaleString()}</div>
                <div style={{fontSize:10,color:T.t3,textTransform:'uppercase',letterSpacing:'0.5px',marginTop:4}}>Verified Credits</div>
                {(sel.shadow_credits || 0) > 0 && (
                  <div style={{fontSize:12,color:T.violetL || T.teal,fontWeight:600,marginTop:4}}>
                    <Leaf size={10} style={{display:'inline',verticalAlign:'middle',marginRight:3}}/>{(sel.shadow_credits||0).toLocaleString()} shadow
                  </div>
                )}
              </div>
            </div>

            {/* ── MRV / Fraud / Env Scores ── */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:11,marginBottom:20}}>
              {[
                {l:'MRV Score', c: sel.mrvScore ? <MRVScore score={sel.mrvScore}/> : <span style={{fontSize:22,fontWeight:800,color:T.teal,fontFamily:'Fraunces, serif'}}>—</span>},
                {l:'Fraud Risk', c: <span style={{fontWeight:800,fontSize:22,fontFamily:'Fraunces, serif',color:(sel.fraudRisk||0)>50?T.roseL:(sel.fraudRisk||0)>25?T.goldL:T.emeraldL}}>{sel.fraudRisk != null ? `${sel.fraudRisk}%` : '—'}</span>},
                {l:'Env. Score', c: sel.envScore ? <MRVScore score={sel.envScore}/> : <span style={{fontSize:22,fontWeight:800,color:T.teal,fontFamily:'Fraunces, serif'}}>—</span>}
              ].map(({l,c})=>(
                <div key={l} style={{background:'rgba(255,255,255,0.03)',borderRadius:10,padding:14}}>
                  <div style={{fontSize:10,color:T.t3,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>{l}</div>
                  {c}
                </div>
              ))}
            </div>

            {/* Credit & Pricing Details (show when approved) */}
            {sel.status === 'approved' && (sel.credits || 0) > 0 && (
              <div style={{background:'rgba(16,185,129,0.05)',border:'1px solid rgba(52,211,153,0.2)',borderRadius:12,padding:18,marginBottom:20}}>
                <div style={{fontSize:10,color:T.emeraldL,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:12}}>
                  <DollarSign size={11} style={{display:'inline',verticalAlign:'middle',marginRight:3}}/>Carbon Credit Summary
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                  {[
                    ['Verified Credits', `${(sel.credits||0).toLocaleString()} t`, T.emeraldL],
                    ['Shadow Credits', `${(sel.shadow_credits||0).toLocaleString()} t`, T.violetL || T.teal],
                    ['Price/Credit', sel.price_per_ton ? `$${sel.price_per_ton} (${inrAmount(sel.price_per_ton)})` : '—', T.goldL],
                    ['Total Funding', sel.total_funding ? `$${(sel.total_funding||0).toLocaleString()}` : '—', T.teal],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{textAlign:'center'}}>
                      <div style={{fontSize:10,color:T.t3,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:6}}>{label}</div>
                      <div style={{fontSize:14,fontWeight:800,color,fontFamily:'Fraunces, serif'}}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Project details */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:20}}>
              {[
                ['Project ID', sel.project_id || sel.id],
                ['NGO', sel.ngo || 'Unknown'],
                ['Plantation Type', (sel.plantation_type || '—').replace('_',' ')],
                ['Area', sel.area_hectares ? `${sel.area_hectares} ha (${(sel.area_hectares * 2.47105).toFixed(1)} acres)` : '—'],
                ['Trees', sel.number_of_trees ? sel.number_of_trees.toLocaleString() : '—'],
                ['Price/t', sel.price_per_ton ? `$${sel.price_per_ton}` : '—'],
                ['Start Date', sel.start_date || '—'],
                ['Polygon', sel.polygon_wkt ? '✓ Provided' : '✗ Missing'],
              ].map(([k,v]) => (
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid rgba(255,255,255,0.04)`,fontSize:13}}>
                  <span style={{color:T.t3}}>{k}</span>
                  <span style={{color:k==='Polygon'&&v.includes('Missing')?T.roseL:T.t1,fontWeight:600}}>{v}</span>
                </div>
              ))}
            </div>

            {/* ── Field Evidence: Actual Uploaded Image ── */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:10,color:T.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:10}}>Field Evidence (NGO Upload)</div>
              {evidenceUrl ? (
                <div style={{display:'flex',gap:10}}>
                  <div style={{borderRadius:10,overflow:'hidden',border:`1px solid ${T.border}`,transition:'border-color 0.2s',cursor:'pointer',position:'relative'}}
                    onClick={() => setImgLightbox(evidenceUrl)}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(45,212,191,0.4)';e.currentTarget.querySelector('.zoom-overlay').style.opacity='1';}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.querySelector('.zoom-overlay').style.opacity='0';}}>
                    <img src={evidenceUrl} alt={`Evidence for ${sel.name}`}
                         style={{width:280,height:180,objectFit:'cover',display:'block'}}
                         onError={e => {e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='flex');}}/>
                    <div className="zoom-overlay" style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity 0.2s'}}>
                      <ZoomIn size={24} color="#fff"/>
                    </div>
                  </div>
                  {/* Score summary next to image */}
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
                    <div style={{background:'rgba(45,212,191,0.06)',borderRadius:8,padding:'8px 12px',fontSize:12}}>
                      <span style={{color:T.t3}}>MRV: </span>
                      <span style={{color:T.teal,fontWeight:700}}>{sel.mrvScore ?? '—'}</span>
                    </div>
                    <div style={{background:(sel.fraudRisk||0)>50?'rgba(244,63,94,0.06)':'rgba(16,185,129,0.06)',borderRadius:8,padding:'8px 12px',fontSize:12}}>
                      <span style={{color:T.t3}}>Risk: </span>
                      <span style={{color:(sel.fraudRisk||0)>50?T.roseL:(sel.fraudRisk||0)>25?T.goldL:T.emeraldL,fontWeight:700}}>{sel.fraudRisk != null ? `${sel.fraudRisk}%` : '—'}</span>
                    </div>
                    <div style={{background:'rgba(45,212,191,0.06)',borderRadius:8,padding:'8px 12px',fontSize:12}}>
                      <span style={{color:T.t3}}>ENV: </span>
                      <span style={{color:T.emeraldL,fontWeight:700}}>{sel.envScore ?? '—'}</span>
                    </div>
                    <div style={{fontSize:11,color:T.t3,marginTop:4,lineHeight:1.5}}>
                      Image analyzed for GPS metadata, ecological plausibility, polygon integrity, and temporal consistency.
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{border:`2px dashed rgba(255,255,255,0.08)`,borderRadius:12,padding:32,textAlign:'center',background:'rgba(255,255,255,0.01)'}}>
                  <ImageOff size={32} color={T.t3} style={{margin:'0 auto 10px'}}/>
                  <div style={{fontSize:13,color:T.t3,fontWeight:600}}>No evidence image uploaded</div>
                  <div style={{fontSize:11,color:T.t4,marginTop:4}}>The NGO did not attach field evidence for this project</div>
                </div>
              )}
            </div>

            {(sel.fraudRisk || 0) > 50 && (
              <div style={{background:'rgba(244,63,94,0.07)',border:'1px solid rgba(244,63,94,0.22)',borderRadius:10,padding:14,marginBottom:20,display:'flex',gap:10}}>
                <AlertTriangle size={15} color={T.roseL} style={{flexShrink:0,marginTop:2}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:T.roseL,marginBottom:3}}>High Fraud Risk Detected</div>
                  <div style={{fontSize:12,color:'#7a4050',lineHeight:1.5}}>AI flagged potential image manipulation and GPS inconsistencies. Manual review strongly recommended before approval.</div>
                </div>
              </div>
            )}

            {sel.status==='pending' && (
              <div style={{display:'flex',gap:10}}>
                <Btn onClick={()=>setModal('approve')}><CheckCircle size={13}/>Approve</Btn>
                <Btn variant="danger" onClick={()=>setModal('reject')}><XCircle size={13}/>Reject</Btn>
                <Btn variant="secondary" onClick={()=>setModal('data')}><MessageSquare size={13}/>Request Data</Btn>
              </div>
            )}
            {sel.status==='approved' && <Btn variant="gold" onClick={()=>setModal('mint')}>✦ Mint Credits</Btn>}
          </Card>
        </div>
      )}
      </div>

      {/* ── Image Lightbox Modal ── */}
      <Modal open={!!imgLightbox} onClose={()=>setImgLightbox(null)} title="Evidence Image" width={720}>
        {imgLightbox && (
          <div style={{textAlign:'center'}}>
            <img src={imgLightbox} alt="Evidence full-size" style={{maxWidth:'100%',maxHeight:'65vh',borderRadius:12,objectFit:'contain',border:`1px solid ${T.border}`}}/>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:16}}>
              <div style={{background:'rgba(45,212,191,0.06)',borderRadius:8,padding:'10px 14px'}}>
                <div style={{fontSize:10,color:T.t3,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>MRV Score</div>
                <div style={{fontSize:20,fontWeight:800,color:T.teal,fontFamily:'Fraunces, serif'}}>{sel?.mrvScore ?? '—'}</div>
              </div>
              <div style={{background:(sel?.fraudRisk||0)>50?'rgba(244,63,94,0.06)':'rgba(16,185,129,0.06)',borderRadius:8,padding:'10px 14px'}}>
                <div style={{fontSize:10,color:T.t3,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>Fraud Risk</div>
                <div style={{fontSize:20,fontWeight:800,color:(sel?.fraudRisk||0)>50?T.roseL:(sel?.fraudRisk||0)>25?T.goldL:T.emeraldL,fontFamily:'Fraunces, serif'}}>{sel?.fraudRisk != null ? `${sel.fraudRisk}%` : '—'}</div>
              </div>
              <div style={{background:'rgba(16,185,129,0.06)',borderRadius:8,padding:'10px 14px'}}>
                <div style={{fontSize:10,color:T.t3,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>Env Score</div>
                <div style={{fontSize:20,fontWeight:800,color:T.emeraldL,fontFamily:'Fraunces, serif'}}>{sel?.envScore ?? '—'}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal==='approve'} onClose={()=>setModal(null)} title="Confirm Approval" width={460}>
        <p style={{color:T.t2,marginBottom:16,fontSize:14,lineHeight:1.65}}>Approve <strong style={{color:T.t1}}>{sel?.name}</strong>? Carbon credits will be <strong style={{color:T.emeraldL}}>automatically calculated</strong> using the {sel?.plantation_type} CO₂ sequestration rate and the project's area.</p>
        <div style={{background:'rgba(45,212,191,0.06)',borderRadius:10,padding:14,marginBottom:16}}>
          <div style={{fontSize:11,color:T.teal,fontWeight:700,textTransform:'uppercase',marginBottom:8}}>What happens on approval:</div>
          <div style={{fontSize:12,color:T.t2,lineHeight:1.7}}>
            1. Credit calculation based on CO₂/acre/year rate<br/>
            2. Shadow credits projected for 5 years<br/>
            3. Verification score computed from MRV/fraud/env<br/>
            4. Price set at ₹1,000/credit with ecosystem multiplier<br/>
            5. Certificate generated for the project
          </div>
        </div>
        <div style={{display:'flex',gap:10}}>
          <Btn onClick={handleApprove} disabled={actionLoading}>{actionLoading ? 'Approving & Calculating…' : 'Confirm Approval'}</Btn>
          <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
        </div>
      </Modal>

      <Modal open={modal==='reject'} onClose={()=>setModal(null)} title="Reject Project" width={440}>
        <div>
          <label style={{fontSize:10,color:T.t3,fontWeight:700,letterSpacing:'0.6px',textTransform:'uppercase',marginBottom:8,display:'block'}}>Rejection Reason</label>
          <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={4} placeholder="Explain the rejection..." style={ta}/>
          <div style={{display:'flex',gap:10,marginTop:16}}>
            <Btn variant="danger" onClick={handleReject} disabled={actionLoading}>{actionLoading ? 'Rejecting…' : 'Reject Project'}</Btn>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={modal==='data'} onClose={()=>setModal(null)} title="Request Additional Data" width={440}>
        <div>
          <label style={{fontSize:10,color:T.t3,fontWeight:700,letterSpacing:'0.6px',textTransform:'uppercase',marginBottom:8,display:'block'}}>Message to NGO</label>
          <textarea rows={4} placeholder="Describe what additional evidence or data is needed..." style={ta}/>
          <div style={{display:'flex',gap:10,marginTop:16}}>
            <Btn onClick={()=>setModal(null)}>Send Request</Btn>
            <Btn variant="secondary" onClick={()=>setModal(null)}>Cancel</Btn>
          </div>
        </div>
      </Modal>

      <Modal open={modal==='mint'} onClose={()=>setModal(null)} title="Carbon Credit Certificate" width={460}>
        <div style={{background:'rgba(45,212,191,0.07)',border:'1px solid rgba(45,212,191,0.2)',borderRadius:12,padding:22,marginBottom:18,textAlign:'center'}}>
          <div style={{fontSize:10,color:T.teal,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:6}}>Verified Credits</div>
          <div style={{fontSize:42,fontWeight:900,color:T.tealL,fontFamily:'Fraunces, serif',textShadow:`0 0 28px rgba(45,212,191,0.5)`}}>{(sel?.credits || 0).toLocaleString()}</div>
          <div style={{fontSize:12,color:T.t3,marginTop:5}}>tonnes CO₂e</div>
        </div>
        {(sel?.shadow_credits || 0) > 0 && (
          <div style={{background:'rgba(124,58,237,0.06)',border:'1px solid rgba(167,139,250,0.2)',borderRadius:10,padding:14,marginBottom:16,textAlign:'center'}}>
            <div style={{fontSize:10,color:T.violetL || T.teal,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:4}}>Shadow Credits (5yr Projection)</div>
            <div style={{fontSize:24,fontWeight:800,color:T.violetL || T.teal,fontFamily:'Fraunces, serif'}}>{(sel?.shadow_credits||0).toLocaleString()}</div>
          </div>
        )}
        {sel?.price_per_ton && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
            <div style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:'10px 14px',textAlign:'center'}}>
              <div style={{fontSize:10,color:T.t3,textTransform:'uppercase',marginBottom:4}}>Price/Credit</div>
              <div style={{fontSize:16,fontWeight:700,color:T.goldL}}>${sel.price_per_ton}</div>
              <div style={{fontSize:11,color:T.t3}}>{inrAmount(sel.price_per_ton)}</div>
            </div>
            <div style={{background:'rgba(255,255,255,0.03)',borderRadius:8,padding:'10px 14px',textAlign:'center'}}>
              <div style={{fontSize:10,color:T.t3,textTransform:'uppercase',marginBottom:4}}>Total Value</div>
              <div style={{fontSize:16,fontWeight:700,color:T.emeraldL}}>${((sel.credits||0)*(sel.price_per_ton||0)).toLocaleString()}</div>
              <div style={{fontSize:11,color:T.t3}}>{inrAmount((sel.credits||0)*(sel.price_per_ton||0))}</div>
            </div>
          </div>
        )}
        <Btn style={{width:'100%',justifyContent:'center'}} onClick={()=>setModal(null)}>✦ Generate Certificates</Btn>
      </Modal>
    </div>
  );
}
