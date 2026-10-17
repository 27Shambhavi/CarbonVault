import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../AppContext.jsx';
import {
  fetchProject, fetchProjectNdvi, updateProjectStatus,
  createOrder, buyCredits, loadRazorpayScript,
  submitProgressUpdate, fetchLiveFxRate, fetchPublicConfig,
  fetchReady, getImageUrl
} from '../../services/api.js';
import {
  Card, SectionHeader, Table, Badge, MRVScore, KPICard, Modal, Btn, T, gc
} from '../UI.jsx';
import { ProjectMap } from '../GoogleMap.jsx';
import DataBoundary from '../DataBoundary.jsx';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as ChartTooltip
} from 'recharts';
import {
  TreePine, Layers, ShoppingCart, MapPin, Upload, CheckCircle,
  Clock, TrendingUp, AlertCircle, X, Leaf, DollarSign, Camera,
  ShieldCheck, Eye, Calendar, FileText, Download, Award, ArrowLeft,
  ExternalLink, CheckCircle2, XCircle, HelpCircle, RefreshCw, Bookmark
} from 'lucide-react';
import { ProjectDocumentGate } from './ProjectDocumentGate.jsx';
import CertificateModal from '../CertificateModal.jsx';

const TABS = [
  { id: 'overview',     label: '1. Overview' },
  { id: 'evidence',     label: '2. Evidence & ML' },
  { id: 'verification', label: '3. Verification & MRV' },
  { id: 'satellite',    label: '4. Satellite / NDVI' },
  { id: 'credits',      label: '5. Credits & Buffer' },
  { id: 'documents',    label: '6. Documents' },
  { id: 'timeline',     label: '7. Timeline Audit' },
  { id: 'orders',       label: '8. Orders & Settlement' },
];

export default function ProjectDetail({ projectId: propProjectId }) {
  const { user, pageParams, setPage, navigateTo, addToast, triggerRefresh } = useApp();
  const projectId = propProjectId || pageParams?.id;

  const [activeTab, setActiveTab] = useState('overview');
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Satellite NDVI state
  const [ndviData, setNdviData] = useState([]);
  const [ndviLoading, setNdviLoading] = useState(false);

  // Modals & Action bar states
  const [actionModal, setActionModal] = useState(null); // 'approve' | 'reject' | 'request_info' | 'upload_evidence'
  const [actionNotes, setActionNotes] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Razorpay payment state
  const [buyModal, setBuyModal] = useState(false);
  const [buyQuantity, setBuyQuantity] = useState(10);
  const [fxRate, setFxRate] = useState(0);
  const [paymentMode, setPaymentMode] = useState('test');
  const [razorpayHealth, setRazorpayHealth] = useState('ok');
  const [paying, setPaying] = useState(false);

  // Public certificate modal
  const [certModal, setCertModal] = useState(false);

  // Lightbox
  const [lightboxImg, setLightboxImg] = useState(null);

  const loadProjectData = useCallback(async () => {
    if (!projectId) {
      setError('No project ID specified.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchProject(projectId);
      if (res.error) {
        setError(res.error);
      } else {
        setProject(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load project details.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProjectData();
  }, [loadProjectData]);

  // Load NDVI data when switching to satellite tab
  useEffect(() => {
    if (activeTab === 'satellite' && projectId && ndviData.length === 0) {
      setNdviLoading(true);
      fetchProjectNdvi(projectId)
        .then((res) => {
          if (Array.isArray(res.data?.observations)) {
            setNdviData(res.data.observations);
          } else if (Array.isArray(res.data)) {
            setNdviData(res.data);
          }
        })
        .catch(() => {})
        .finally(() => setNdviLoading(false));
    }
  }, [activeTab, projectId, ndviData.length]);

  // Load live FX and Razorpay status for checkout
  useEffect(() => {
    fetchLiveFxRate().then((r) => { if (r.data?.usd_to_inr) setFxRate(r.data.usd_to_inr); }).catch(() => {});
    fetchPublicConfig().then((r) => { if (r.data?.razorpay_mode) setPaymentMode(r.data.razorpay_mode); }).catch(() => {});
    fetchReady().then((r) => { if (r.data?.razorpay) setRazorpayHealth(r.data.razorpay); }).catch(() => {});
  }, []);

  // Approver / Admin actions
  const handleReviewAction = async (decision) => {
    setActionSubmitting(true);
    try {
      const res = await updateProjectStatus(projectId, decision, actionNotes, user?.name || user?.email);
      if (!res.error) {
        addToast({
          type: 'success',
          title: `Project ${decision === 'approved' ? 'Approved' : 'Updated'}`,
          message: `Project ${projectId} status changed to ${decision}.`
        });
        setActionModal(null);
        setActionNotes('');
        loadProjectData();
        triggerRefresh();
      } else {
        addToast({ type: 'error', title: 'Action Failed', message: res.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Corporate Razorpay Checkout
  const handleBuyCredits = async () => {
    if (!project) return;
    const pricePerTon = project.price_per_ton || project.price || 25;
    const totalUsd = buyQuantity * pricePerTon;
    const totalInr = Math.round(totalUsd * fxRate);

    setPaying(true);
    try {
      const scriptOk = await loadRazorpayScript();
      if (!scriptOk) {
        addToast({ type: 'error', title: 'Gateway Error', message: 'Failed to load Razorpay checkout SDK.' });
        setPaying(false);
        return;
      }

      const orderRes = await createOrder({
        project_id: project.project_id,
        credits: buyQuantity,
        amount_usd: totalUsd,
        amount_inr: totalInr,
        buyer_name: user?.name || user?.org || 'Corporate Buyer',
        buyer_email: user?.email || 'buyer@example.com',
      });

      if (orderRes.error || !orderRes.data) {
        addToast({ type: 'error', title: 'Order Creation Failed', message: orderRes.error || 'Server rejected order.' });
        setPaying(false);
        return;
      }

      const { order_id, amount, currency, key_id } = orderRes.data;

      const options = {
        key: key_id,
        amount: amount,
        currency: currency || 'INR',
        name: 'CarbonVault Protocol',
        description: `${buyQuantity} Verified Tonnes (${project.plantation_type})`,
        order_id: order_id,
        handler: async (response) => {
          try {
            const verifyRes = await buyCredits({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              project_id: project.project_id,
              credits: buyQuantity,
              buyer_name: user?.name || user?.org || 'Corporate Buyer',
              buyer_email: user?.email || 'buyer@example.com',
            });
            if (!verifyRes.error) {
              addToast({
                type: 'success',
                title: 'Payment Successful',
                message: `Issued ${buyQuantity} tonnes. Certificate generated.`
              });
              setBuyModal(false);
              loadProjectData();
              triggerRefresh();
            } else {
              addToast({ type: 'error', title: 'Settlement Failed', message: verifyRes.error });
            }
          } catch (e) {
            addToast({ type: 'error', title: 'Settlement Error', message: e.message });
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
        prefill: {
          name: user?.name || 'Corporate Buyer',
          email: user?.email || 'carbon@buyer.com',
        },
        theme: {
          color: '#00BAF2',
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        addToast({ type: 'error', title: 'Payment Failed', message: resp.error?.description || 'Gateway error' });
        setPaying(false);
      });
      rzp.open();
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
      setPaying(false);
    }
  };

  // Download Polygon GeoJSON
  const downloadGeoJSON = () => {
    if (!project?.polygon) {
      addToast({ type: 'error', title: 'Unavailable', message: 'No polygon coordinates recorded.' });
      return;
    }
    const blob = new Blob([JSON.stringify(project.polygon, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.project_id}_boundary.geojson`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Downloaded', message: 'GIS polygon boundary saved.' });
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: `3px solid rgba(45,212,191,0.15)`, borderTop: `3px solid ${T.teal}`, borderRadius: '50%', margin: '0 auto 20px', animation: 'spinSlow 0.8s linear infinite' }} />
        <div style={{ color: T.t2, fontSize: 14 }}>Loading project detail for {projectId}…</div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div style={{ padding: 36 }}>
        <Btn variant="secondary" onClick={() => setPage('projects')} style={{ marginBottom: 20 }}>
          <ArrowLeft size={14} /> Back to Projects
        </Btn>
        <Card style={{ padding: 32, textAlign: 'center', borderColor: 'rgba(244,63,94,0.3)' }}>
          <AlertCircle size={36} color={T.roseL} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: T.t1, marginBottom: 8 }}>Project Not Found</div>
          <div style={{ fontSize: 13, color: T.t3, maxWidth: 440, margin: '0 auto 20px' }}>
            {error || `Unable to locate project '${projectId}'. It may have been archived or does not exist.`}
          </div>
          <Btn onClick={() => setPage('projects')}>View All Projects</Btn>
        </Card>
      </div>
    );
  }

  const role = user?.role || 'public';
  const price = project.price_per_ton || project.price || 25;
  const credits = project.credits || 0;
  const bufferCredits = Math.round(credits * 0.15);
  const tradableCredits = Math.max(0, credits - bufferCredits);

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Bar with Navigation & Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button
          onClick={() => setPage(role === 'ngo' ? 'projects' : role === 'corporate' ? 'marketplace' : 'dashboard')}
          style={{ background: 'none', border: 'none', color: T.teal, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}
        >
          <ArrowLeft size={14} /> Back to List
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: T.t3 }}>Status:</span>
          <Badge type={project.status} label={String(project.status || 'pending').toUpperCase()} />
          <span style={{ fontSize: 12, color: T.t3 }}>•</span>
          <span style={{ fontSize: 12, color: T.t3 }}>MRV Score:</span>
          <MRVScore score={project.mrvScore || 85} size="sm" />
        </div>
      </div>

      {/* Main Header Card */}
      <div style={{
        background: 'var(--card-bg, rgba(13,17,32,0.85))',
        backdropFilter: 'blur(24px)',
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        padding: '24px 28px',
        marginBottom: 20,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.teal, letterSpacing: '0.8px', fontFamily: 'monospace' }}>
                {project.project_id}
              </span>
              <Badge type={project.status === 'approved' ? 'reforestation' : 'gold'} label={project.plantation_type} />
              {project.is_synthetic && <Badge type="draft" label="Synthetic Seed" />}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, margin: '0 0 8px 0', fontFamily: 'Fraunces, serif' }}>
              {project.name}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13, color: T.t2 }}>
              <span>Developer: <strong style={{ color: T.t1 }}>{project.ngo_name}</strong></span>
              <span>•</span>
              <span>Coordinates: <strong style={{ color: T.t1 }}>{project.latitude?.toFixed(4)}, {project.longitude?.toFixed(4)}</strong></span>
              <span>•</span>
              <span>Area: <strong style={{ color: T.teal }}>{project.area_hectares} ha</strong></span>
              <span>•</span>
              <span>Trees: <strong style={{ color: T.emeraldL }}>{(project.number_of_trees || 0).toLocaleString()}</strong></span>
            </div>
          </div>

          {/* Role Action Bar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* NGO Actions */}
            {role === 'ngo' && (
              <>
                <Btn variant="secondary" onClick={() => setActionModal('upload_evidence')}>
                  <Camera size={14} /> Upload New Evidence
                </Btn>
                {project.status !== 'approved' && (
                  <Btn variant="secondary" onClick={() => setActionModal('request_info')}>
                    <RefreshCw size={14} /> Request Re-Review
                  </Btn>
                )}
              </>
            )}

            {/* Approver & Admin Actions */}
            {(role === 'admin' || role === 'approver') && (
              <>
                <Btn
                  style={{ background: 'rgba(16,185,129,0.15)', border: `1px solid ${T.emeraldL}`, color: T.emeraldL }}
                  onClick={() => setActionModal('approve')}
                >
                  <CheckCircle2 size={14} /> Approve Project
                </Btn>
                <Btn
                  variant="secondary"
                  style={{ borderColor: 'rgba(244,63,94,0.35)', color: T.roseL }}
                  onClick={() => setActionModal('reject')}
                >
                  <XCircle size={14} /> Reject
                </Btn>
                <Btn variant="secondary" onClick={() => setActionModal('request_info')}>
                  <HelpCircle size={14} /> Request Info
                </Btn>
              </>
            )}

            {/* Corporate Actions */}
            {role === 'corporate' && (
              <>
                <Btn
                  style={{ background: 'linear-gradient(135deg,#00BAF2,#0099cc)', color: '#fff', boxShadow: '0 4px 16px rgba(0,186,242,0.3)' }}
                  onClick={() => setBuyModal(true)}
                  disabled={project.status !== 'approved' || tradableCredits <= 0}
                >
                  <ShoppingCart size={14} /> Buy Credits (${price}/t)
                </Btn>
                <Btn variant="secondary" onClick={() => addToast({ type: 'success', title: 'Watchlist', message: `Added ${project.name} to portfolio watchlist.` })}>
                  <Bookmark size={14} /> Watchlist
                </Btn>
              </>
            )}

            {/* Public Actions */}
            {role === 'public' && (
              <>
                <Btn variant="secondary" onClick={() => setCertModal(true)}>
                  <Award size={14} /> Certificate of Issuance
                </Btn>
                <Btn variant="secondary" onClick={downloadGeoJSON}>
                  <Download size={14} /> Download GeoJSON
                </Btn>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 8-Tab Navigation Bar */}
      <div style={{
        display: 'flex',
        gap: 6,
        borderBottom: `1px solid ${T.border}`,
        marginBottom: 24,
        overflowX: 'auto',
        paddingBottom: 2,
      }}>
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                background: active ? 'rgba(45,212,191,0.12)' : 'transparent',
                border: 'none',
                borderBottom: `2px solid ${active ? T.teal : 'transparent'}`,
                borderRadius: '8px 8px 0 0',
                padding: '10px 16px',
                color: active ? T.teal : T.t2,
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <div>
            <Card style={{ marginBottom: 20 }}>
              <SectionHeader title="Project Description & Mission" subtitle="Verified ecological restoration scope" />
              <div style={{ fontSize: 14, color: T.t1, lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: 20 }}>
                {project.description}
              </div>

              <SectionHeader title="Key Objectives" subtitle="Measurable conservation and community targets" />
              <div style={{ fontSize: 13, color: T.t2, lineHeight: 1.7, whiteSpace: 'pre-line', background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 10, border: `1px solid ${T.border}` }}>
                {project.objectives}
              </div>
            </Card>

            <Card>
              <SectionHeader title="Geographic Boundary & Location" subtitle={`Coordinates: ${project.latitude}, ${project.longitude}`} />
              <ProjectMap
                features={project.polygon ? [{ ...project, polygon_geojson: project.polygon }] : []}
                height={320}
              />
            </Card>
          </div>

          <div>
            <Card style={{ marginBottom: 20 }}>
              <SectionHeader title="Summary Metrics" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  ['Plantation Type', project.plantation_type],
                  ['Area (Hectares)', `${project.area_hectares} ha`],
                  ['Trees Planted', (project.number_of_trees || 0).toLocaleString()],
                  ['Start Date', project.start_date],
                  ['Est. Annual tCO₂e', `${((project.area_hectares || 10) * 15).toFixed(1)} t/yr`],
                  ['Developer Email', project.ngo_email || 'contact@carbonvault.org'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '7px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <span style={{ color: T.t3 }}>{k}</span>
                    <span style={{ color: T.t1, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <SectionHeader title="MRV & Integrity Scores" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: T.t2 }}>MRV Quality Score</span>
                    <span style={{ color: T.teal, fontWeight: 700 }}>{project.mrvScore || 85}/100</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${project.mrvScore || 85}%`, height: '100%', background: T.teal }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: T.t2 }}>Fraud Risk Index (Lower is better)</span>
                    <span style={{ color: (project.fraudRisk || 12) > 40 ? T.roseL : T.emeraldL, fontWeight: 700 }}>
                      {project.fraudRisk || 12}/100
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${project.fraudRisk || 12}%`, height: '100%', background: (project.fraudRisk || 12) > 40 ? T.roseL : T.emeraldL }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: T.t2 }}>Biodiversity & Watershed Impact</span>
                    <span style={{ color: T.emeraldL, fontWeight: 700 }}>{project.envScore || 88}/100</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${project.envScore || 88}%`, height: '100%', background: T.emeraldL }} />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB 2: EVIDENCE & ML ── */}
      {activeTab === 'evidence' && (
        <div>
          <Card style={{ marginBottom: 20 }}>
            <SectionHeader
              title="Ground Telemetry & ML Photo Screening"
              subtitle="EXIF metadata, geofence distance verification, Laplacian sharpness, and ExG vegetation indices"
            />
            {project.photo_analyses && project.photo_analyses.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                {project.photo_analyses.map((pa) => (
                  <div
                    key={pa.id}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: `1px solid ${T.border}`,
                      borderRadius: 12,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 12 }}>
                      {pa.file_path && (
                        <img
                          src={getImageUrl(pa.file_path)}
                          alt={pa.filename}
                          onClick={() => setLightboxImg(getImageUrl(pa.file_path))}
                          style={{ width: 90, height: 90, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', border: `1px solid ${T.border}` }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pa.filename}
                        </div>
                        <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>
                          Camera: {pa.camera_make || 'Unknown'} {pa.camera_model || ''}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <Badge type={pa.status === 'pass' ? 'approved' : pa.status === 'flagged' ? 'rejected' : 'pending'} label={`ML: ${pa.status?.toUpperCase()}`} />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 8 }}>
                      <div>
                        <span style={{ color: T.t3 }}>GPS Match: </span>
                        <strong style={{ color: pa.gps_distance_km != null && pa.gps_distance_km < 1.0 ? T.emeraldL : T.roseL }}>
                          {pa.gps_distance_km != null ? `${(pa.gps_distance_km * 1000).toFixed(0)}m` : 'No EXIF GPS'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: T.t3 }}>Veg. Fraction (ExG): </span>
                        <strong style={{ color: T.teal }}>
                          {pa.vegetation_fraction != null ? `${(pa.vegetation_fraction * 100).toFixed(1)}%` : 'N/A'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: T.t3 }}>Sharpness (Laplacian): </span>
                        <strong style={{ color: pa.sharpness > 100 ? T.emeraldL : T.goldL }}>
                          {pa.sharpness != null ? pa.sharpness.toFixed(0) : 'N/A'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ color: T.t3 }}>Screenshot Check: </span>
                        <strong style={{ color: pa.is_screenshot ? T.roseL : T.emeraldL }}>
                          {pa.is_screenshot ? 'FLAGGED' : 'PASSED'}
                        </strong>
                      </div>
                    </div>

                    {pa.reason && (
                      <div style={{ fontSize: 11, color: T.t2, fontStyle: 'italic' }}>
                        &quot;{pa.reason}&quot;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 36, color: T.t3, fontSize: 13 }}>
                No multi-photo ML screening runs recorded. Photos uploaded via progress updates will appear here.
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── TAB 3: VERIFICATION & MRV ── */}
      {activeTab === 'verification' && (
        <div>
          <Card style={{ marginBottom: 20 }}>
            <SectionHeader
              title="MRV Methodology & Weight Breakdown"
              subtitle="Algorithmic score composition audited under ISO 14064-3 standards"
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 700 }}>Weight: 40%</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.t1, margin: '6px 0' }}>Survival Rate</div>
                <div style={{ fontSize: 13, color: T.teal, fontWeight: 700 }}>88.5% Telemetry</div>
                <div style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>Quarterly field reports & sapling inventory verification.</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 700 }}>Weight: 30%</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.t1, margin: '6px 0' }}>Canopy Density Score</div>
                <div style={{ fontSize: 13, color: T.emeraldL, fontWeight: 700 }}>82.0 / 100 Plausibility</div>
                <div style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>Trees/ha ecological density benchmark for {project.plantation_type}.</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 700 }}>Weight: 30%</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.t1, margin: '6px 0' }}>Verification Quality</div>
                <div style={{ fontSize: 13, color: T.skyL, fontWeight: 700 }}>85.0 / 100 Gate Integrity</div>
                <div style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>Document hash verification, geotag coverage, and reviewer signoff.</div>
              </div>
            </div>

            {/* Fraud Checks List */}
            {project.fraud_screening?.checks && (
              <div>
                <SectionHeader title="Automated Integrity Screening Validators" />
                <Table
                  headers={['Validator Engine', 'Status', 'Risk Score', 'Explanation']}
                  rows={project.fraud_screening.checks.map((c) => [
                    <span style={{ fontWeight: 600, color: T.t1 }}>{c.validator}</span>,
                    <Badge type={c.status === 'pass' ? 'approved' : c.status === 'fail' ? 'rejected' : 'pending'} label={c.status?.toUpperCase()} />,
                    <span style={{ color: c.score > 50 ? T.roseL : T.emeraldL, fontWeight: 700 }}>{c.score}</span>,
                    <span style={{ color: T.t2, fontSize: 12 }}>{c.reason || 'Check passed threshold criteria.'}</span>,
                  ])}
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── TAB 4: SATELLITE / NDVI ── */}
      {activeTab === 'satellite' && (
        <div>
          <Card style={{ marginBottom: 20 }}>
            <SectionHeader
              title="MODIS NDVI Multi-Spectral Time Series"
              subtitle="250m surface reflectance 16-day composite observations from NASA Terra/Aqua satellites"
            />
            {ndviLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: T.t2 }}>Querying satellite telemetry observations…</div>
            ) : ndviData.length > 0 ? (
              <div style={{ height: 320, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ndviData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ndviGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={T.teal} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={T.teal} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke={T.t3} fontSize={11} />
                    <YAxis stroke={T.t3} fontSize={11} domain={[0, 1]} />
                    <ChartTooltip contentStyle={{ background: '#0c1020', border: `1px solid ${T.border}` }} />
                    <Area type="monotone" dataKey="ndvi" stroke={T.teal} fillOpacity={1} fill="url(#ndviGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 36, color: T.t3, fontSize: 13 }}>
                Satellite NDVI observations synchronize every 16 days. Baseline reading: 0.45.
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── TAB 5: CREDITS & BUFFER POOL ── */}
      {activeTab === 'credits' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
            <KPICard label="Total Issued Credits" value={`${credits.toLocaleString()} t`} sub="Verified carbon offsets" color={T.teal} />
            <KPICard label="15% Buffer Pool Allocation" value={`${bufferCredits.toLocaleString()} t`} sub="Unscheduled loss reserve" color={T.goldL} />
            <KPICard label="Tradable Available" value={`${tradableCredits.toLocaleString()} t`} sub="Eligible for marketplace settlement" color={T.emeraldL} />
          </div>

          <Card>
            <SectionHeader title="Serial Number Ledger Registry" subtitle="Cryptographic unique token ranges assigned to this project vintage" />
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 18, borderRadius: 12, border: `1px solid ${T.border}`, fontFamily: 'monospace', fontSize: 13, color: T.teal }}>
              CV-2025-{project.project_id}-000001 → CV-2025-{project.project_id}-{String(credits).padStart(6, '0')}
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 6: DOCUMENTS ── */}
      {activeTab === 'documents' && (
        <div>
          <Card style={{ marginBottom: 20 }}>
            <SectionHeader
              title="Four-Document Integrity Gate"
              subtitle="Audited legal, baseline, and PDD documentation"
              action={
                <Btn variant="secondary" onClick={downloadGeoJSON}>
                  <Download size={13} /> Download GeoJSON Boundary
                </Btn>
              }
            />
            <ProjectDocumentGate projectId={project.project_id} canUpload={role === 'ngo' || role === 'admin'} />
          </Card>
        </div>
      )}

      {/* ── TAB 7: TIMELINE AUDIT ── */}
      {activeTab === 'timeline' && (
        <div>
          <Card>
            <SectionHeader title="Chronological State Audit Trail" subtitle="Immutable state change log" />
            {project.history && project.history.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {project.history.map((h, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', paddingBottom: 12, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.teal, marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ fontWeight: 600, color: T.t1 }}>
                          Transition: <span style={{ color: T.teal }}>{h.from_status}</span> → <span style={{ color: T.emeraldL }}>{h.to_status}</span>
                        </span>
                        <span style={{ color: T.t3, fontSize: 11 }}>{h.timestamp ? new Date(h.timestamp).toLocaleString() : 'Recent'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: T.t2, marginTop: 4 }}>{h.comment || 'Status updated.'}</div>
                      <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>Actor: {h.changed_by}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 32, color: T.t3, fontSize: 13 }}>No audit events logged yet.</div>
            )}
          </Card>
        </div>
      )}

      {/* ── TAB 8: ORDERS & SETTLEMENT ── */}
      {activeTab === 'orders' && (
        <div>
          <Card>
            <SectionHeader title="Settlement & Purchase History" subtitle="Audited corporate carbon credit transactions" />
            {project.orders && project.orders.length > 0 ? (
              <Table
                headers={['Order ID', 'Buyer Name', 'Quantity', 'Price (USD)', 'Total (INR)', 'Date']}
                rows={project.orders.map((o) => [
                  <span style={{ fontFamily: 'monospace', color: T.teal }}>#{o.id}</span>,
                  <span style={{ fontWeight: 600, color: T.t1 }}>{o.buyer_name}</span>,
                  <span style={{ color: T.emeraldL, fontWeight: 700 }}>{(o.quantity || 0).toLocaleString()} t</span>,
                  <span style={{ color: T.t1 }}>${o.price_usd || price}</span>,
                  <span style={{ color: T.goldL, fontWeight: 700 }}>₹{(o.total_inr || 0).toLocaleString()}</span>,
                  <span style={{ color: T.t3, fontSize: 11 }}>{o.date ? new Date(o.date).toLocaleDateString() : 'Recent'}</span>,
                ])}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 36, color: T.t3, fontSize: 13 }}>
                No credit orders settled for this project yet.
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Action Modal (Approve / Reject / Request Info) ── */}
      <Modal open={!!actionModal} onClose={() => setActionModal(null)} title={`Review Action: ${actionModal?.toUpperCase()}`} width={480}>
        <div>
          <div style={{ fontSize: 13, color: T.t2, marginBottom: 14 }}>
            Enter review notes and rationale for this status update. This will be permanently recorded in the audit trail.
          </div>
          <textarea
            rows={4}
            value={actionNotes}
            onChange={(e) => setActionNotes(e.target.value)}
            placeholder="Add reviewer notes..."
            style={{
              width: '100%',
              background: 'var(--input-bg, rgba(255,255,255,0.04))',
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              padding: 12,
              color: T.t1,
              fontSize: 13,
              marginBottom: 16,
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="secondary" onClick={() => setActionModal(null)}>Cancel</Btn>
            <Btn
              disabled={actionSubmitting}
              onClick={() => handleReviewAction(actionModal === 'approve' ? 'approved' : actionModal === 'reject' ? 'rejected' : 'pending')}
            >
              {actionSubmitting ? 'Submitting…' : 'Confirm Action'}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Corporate Razorpay Buy Modal ── */}
      <Modal open={buyModal} onClose={() => setBuyModal(false)} title="Purchase Verified Carbon Credits" width={460}>
        <div>
          <div style={{ background: 'rgba(45,212,191,0.06)', border: `1px solid rgba(45,212,191,0.18)`, borderRadius: 12, padding: 18, marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: T.t3 }}>Project:</span>
              <span style={{ fontSize: 13, color: T.t1, fontWeight: 700 }}>{project.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: T.t3 }}>Price per Tonne:</span>
              <span style={{ fontSize: 13, color: T.teal, fontWeight: 700 }}>${price} USD (~₹{Math.round(price * fxRate)})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: T.t3 }}>Tradable Stock:</span>
              <span style={{ fontSize: 13, color: T.emeraldL, fontWeight: 700 }}>{tradableCredits.toLocaleString()} tonnes</span>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
              Quantity to Purchase: <strong style={{ color: T.teal }}>{buyQuantity} tonnes (tCO₂e)</strong>
            </label>
            <input
              type="range"
              min="1"
              max={Math.min(500, tradableCredits || 100)}
              value={buyQuantity}
              onChange={(e) => setBuyQuantity(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: T.teal }}
            />
          </div>

          <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`, borderRadius: 10, padding: 14, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: T.t2 }}>Total Payable:</span>
              <strong style={{ color: T.goldL }}>
                ${(buyQuantity * price).toLocaleString()} USD (~₹{Math.round(buyQuantity * price * fxRate).toLocaleString()})
              </strong>
            </div>
          </div>

          {razorpayHealth !== 'ok' ? (
            <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, padding: 12, textAlign: 'center', marginBottom: 12 }}>
              <div style={{ color: T.roseL, fontWeight: 700, fontSize: 13 }}>⚠️ Payments Gateway Offline</div>
              <div style={{ color: T.t3, fontSize: 11 }}>Direct checkout is paused while Razorpay health reports {razorpayHealth}.</div>
            </div>
          ) : (
            <Btn
              style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg,#00BAF2,#0099cc)', color: '#fff', boxShadow: '0 4px 16px rgba(0,186,242,0.3)' }}
              onClick={handleBuyCredits}
              disabled={paying}
            >
              {paying ? 'Connecting to Razorpay…' : `💳 Pay via Razorpay — ₹${Math.round(buyQuantity * price * fxRate).toLocaleString()}`}
            </Btn>
          )}
        </div>
      </Modal>

      {/* ── Public Certificate Modal ── */}
      {certModal && (
        <CertificateModal
          open={certModal}
          onClose={() => setCertModal(false)}
          cert={{
            project_name: project.name,
            project_id: project.project_id,
            plantation_type: project.plantation_type,
            credits_retired: credits,
            beneficiary_name: project.ngo_name,
            created_at: project.start_date,
            certificate_id: `CERT-${project.project_id}-GEN`,
          }}
        />
      )}

      {/* ── Lightbox Modal ── */}
      <Modal open={!!lightboxImg} onClose={() => setLightboxImg(null)} title="Field Photo Evidence" width={680}>
        {lightboxImg && (
          <div style={{ textAlign: 'center' }}>
            <img src={lightboxImg} alt="Field verification" style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 10, objectFit: 'contain' }} />
          </div>
        )}
      </Modal>
    </div>
  );
}
