import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../AppContext.jsx';
import {
  fetchProject, fetchProjectNdvi, updateProjectStatus,
  createOrder, buyCredits, loadRazorpayScript,
  submitProgressUpdate, fetchLiveFxRate, fetchPublicConfig,
  fetchReady, getImageUrl, reassignProject, suspendProject, downloadPlatformPDF
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
  ExternalLink, CheckCircle2, XCircle, HelpCircle, RefreshCw, Bookmark,
  Building2, UserCheck, Send, AlertOctagon, MessageSquare, CheckSquare
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

  // Admin & Approver action bar modal states
  const [overrideModal, setOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [overrideTargetStatus, setOverrideTargetStatus] = useState('approved');

  const [suspendModal, setSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  const [reassignModal, setReassignModal] = useState(false);
  const [reassignApproverId, setReassignApproverId] = useState('');
  const [reassignVerifierId, setReassignVerifierId] = useState('');
  const [reassignNotes, setReassignNotes] = useState('');

  const [commentModal, setCommentModal] = useState(false);
  const [commentText, setCommentText] = useState('');

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

  // Approver / Review actions
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

  // Admin Flagged Override Workflow
  const handleAdminOverride = async () => {
    if (!overrideReason || overrideReason.trim().length < 10) {
      addToast({ type: 'warning', title: 'Reason Required', message: 'Administrative overrides require an audited reason of at least 10 characters.' });
      return;
    }
    if (!overrideConfirmed) {
      addToast({ type: 'warning', title: 'Confirmation Required', message: 'Please confirm that you understand this decision will be flagged in the platform audit trail.' });
      return;
    }

    setActionSubmitting(true);
    try {
      const res = await updateProjectStatus(
        projectId,
        overrideTargetStatus,
        `Admin override: ${overrideReason}`,
        user?.name || 'Alex Mercer (Admin)',
        overrideReason,
        true
      );
      if (!res.error) {
        addToast({
          type: 'success',
          title: 'Override Recorded',
          message: `Project ${projectId} status set to ${overrideTargetStatus} via flagged admin override.`
        });
        setOverrideModal(false);
        setOverrideReason('');
        setOverrideConfirmed(false);
        loadProjectData();
        triggerRefresh();
      } else {
        addToast({ type: 'error', title: 'Override Failed', message: res.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Admin Suspend Project
  const handleSuspendProject = async () => {
    if (!suspendReason || suspendReason.trim().length < 5) {
      addToast({ type: 'warning', title: 'Reason Required', message: 'Please specify reason for suspension (min 5 chars).' });
      return;
    }
    setActionSubmitting(true);
    try {
      const res = await suspendProject(projectId, suspendReason);
      if (!res.error) {
        addToast({
          type: 'warning',
          title: 'Project Suspended',
          message: `${project.name} has been suspended from the public registry.`
        });
        setSuspendModal(false);
        setSuspendReason('');
        loadProjectData();
        triggerRefresh();
      } else {
        addToast({ type: 'error', title: 'Suspension Failed', message: res.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Admin Reassign Project
  const handleReassignProject = async () => {
    setActionSubmitting(true);
    try {
      const res = await reassignProject(projectId, {
        newApproverId: reassignApproverId ? parseInt(reassignApproverId, 10) : null,
        newVerifierId: reassignVerifierId ? parseInt(reassignVerifierId, 10) : null,
        comment: reassignNotes || 'Reassigned via Admin Operations Console',
      });
      if (!res.error) {
        addToast({
          type: 'success',
          title: 'Project Reassigned',
          message: `Review assignments updated for ${project.name}.`
        });
        setReassignModal(false);
        setReassignNotes('');
        loadProjectData();
        triggerRefresh();
      } else {
        addToast({ type: 'error', title: 'Reassignment Failed', message: res.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setActionSubmitting(false);
    }
  };

  // Add Audited Comment
  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setActionSubmitting(true);
    try {
      const res = await updateProjectStatus(
        projectId,
        project.status,
        commentText.trim(),
        user?.name || user?.email
      );
      if (!res.error) {
        addToast({ type: 'success', title: 'Comment Added', message: 'Comment appended to immutable audit log.' });
        setCommentModal(false);
        setCommentText('');
        loadProjectData();
        triggerRefresh();
      } else {
        addToast({ type: 'error', title: 'Comment Failed', message: res.error });
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

          {/* Role-Specific Action Bar (Addendum Section 2) */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* 1. APPROVER ACTIONS: Request data · Approve · Reject · Add comment */}
            {role === 'approver' && (
              <>
                <Btn
                  variant="secondary"
                  onClick={() => setActionModal('request_data')}
                  style={{ borderColor: 'rgba(56,189,248,0.4)', color: T.skyL }}
                >
                  <HelpCircle size={14} /> Request data
                </Btn>
                {(() => {
                  const hasSignoff = Boolean(project.verifier_signed_off || project.verifier_id || (project.mrvScore && project.mrvScore > 80));
                  return (
                    <span title={!hasSignoff ? "Approval disabled: Awaiting verifier field sign-off and complete legal documents" : "Approve and admit into public registry"}>
                      <Btn
                        disabled={!hasSignoff}
                        style={{
                          background: hasSignoff ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${hasSignoff ? T.emeraldL : T.border}`,
                          color: hasSignoff ? T.emeraldL : T.t4,
                          cursor: hasSignoff ? 'pointer' : 'not-allowed'
                        }}
                        onClick={() => handleReviewAction('approved')}
                      >
                        <CheckCircle2 size={14} /> Approve
                      </Btn>
                    </span>
                  );
                })()}
                <Btn
                  variant="secondary"
                  style={{ borderColor: 'rgba(244,63,94,0.35)', color: T.roseL }}
                  onClick={() => setActionModal('reject')}
                >
                  <XCircle size={14} /> Reject
                </Btn>
                <Btn variant="secondary" onClick={() => setCommentModal(true)}>
                  <MessageSquare size={14} /> Add comment
                </Btn>
              </>
            )}

            {/* 2. ADMIN ACTIONS: Reassign · Suspend · Override decision · Open organisation · Add comment */}
            {role === 'admin' && (
              <>
                <Btn variant="secondary" onClick={() => setReassignModal(true)}>
                  <UserCheck size={14} /> Reassign
                </Btn>
                <Btn
                  variant="secondary"
                  style={{ borderColor: 'rgba(244,63,94,0.4)', color: T.roseL }}
                  onClick={() => setSuspendModal(true)}
                >
                  <AlertOctagon size={14} /> Suspend
                </Btn>
                <Btn
                  style={{ background: 'rgba(245,158,11,0.15)', border: `1px solid ${T.goldL}`, color: T.goldL }}
                  onClick={() => setOverrideModal(true)}
                >
                  <ShieldCheck size={14} /> Override decision (reason + confirm)
                </Btn>
                <Btn variant="secondary" onClick={() => setPage('organisations')}>
                  <Building2 size={14} /> Open organisation
                </Btn>
                <Btn variant="secondary" onClick={() => setCommentModal(true)}>
                  <MessageSquare size={14} /> Add comment
                </Btn>
              </>
            )}

            {/* 3. VERIFIER ACTIONS: Sign off · Request re-upload */}
            {role === 'verifier' && (
              <>
                <Btn
                  style={{ background: 'rgba(16,185,129,0.15)', border: `1px solid ${T.emeraldL}`, color: T.emeraldL }}
                  onClick={() => handleReviewAction('verified')}
                >
                  <CheckCircle2 size={14} /> Sign off
                </Btn>
                <Btn variant="secondary" onClick={() => setActionModal('request_reupload')}>
                  <Camera size={14} /> Request re-upload
                </Btn>
              </>
            )}

            {/* 4. NGO ACTIONS: Edit draft · Submit · Upload · Respond */}
            {role === 'ngo' && (
              <>
                {project.status === 'draft' && (
                  <Btn variant="secondary" onClick={() => setPage('new_project')}>
                    <FileText size={14} /> Edit draft
                  </Btn>
                )}
                {project.status === 'draft' && (
                  <Btn style={{ background: `linear-gradient(135deg, ${T.teal}, ${T.tealD})`, color: '#021a17' }} onClick={() => handleReviewAction('pending')}>
                    <Send size={14} /> Submit
                  </Btn>
                )}
                <Btn variant="secondary" onClick={() => setActionModal('upload_evidence')}>
                  <Upload size={14} /> Upload
                </Btn>
                <Btn variant="secondary" onClick={() => setActionModal('respond')}>
                  <MessageSquare size={14} /> Respond
                </Btn>
              </>
            )}

            {/* 5. CORPORATE ACTIONS: Buy · Compare · Fact-sheet PDF */}
            {role === 'corporate' && (
              <>
                <Btn
                  style={{ background: 'linear-gradient(135deg,#00BAF2,#0099cc)', color: '#fff', boxShadow: '0 4px 16px rgba(0,186,242,0.3)' }}
                  onClick={() => setBuyModal(true)}
                  disabled={project.status !== 'approved' || tradableCredits <= 0}
                >
                  <ShoppingCart size={14} /> Buy
                </Btn>
                <Btn variant="secondary" onClick={() => addToast({ type: 'info', title: 'Compare Projects', message: `Added ${project.name} to portfolio comparison view.` })}>
                  <Layers size={14} /> Compare
                </Btn>
                <Btn variant="secondary" onClick={() => downloadPlatformPDF()}>
                  <Download size={14} /> Fact-sheet PDF
                </Btn>
              </>
            )}

            {/* 6. PUBLIC ACTIONS: Verify certificates */}
            {role === 'public' && (
              <>
                <Btn variant="secondary" onClick={() => setCertModal(true)}>
                  <Award size={14} /> Verify certificates
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

      {/* ── Admin Override Modal ── */}
      <Modal open={overrideModal} onClose={() => setOverrideModal(false)} title="Administrative Override Decision" width={560}>
        <div>
          <div style={{ background: 'rgba(245,158,11,0.1)', border: `1px solid rgba(245,158,11,0.35)`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.goldL, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
              <ShieldCheck size={16} /> Flagged Override Governance
            </div>
            <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.5 }}>
              Separation of Duties Warning: Primary approvals belong to assigned project approvers. Admin overrides are rare by design, highlighted in the platform audit trail, and counted under &apos;Overrides this month&apos;.
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', marginBottom: 6 }}>Target Status</label>
            <select
              value={overrideTargetStatus}
              onChange={(e) => setOverrideTargetStatus(e.target.value)}
              style={{ width: '100%', background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, color: T.t1, fontSize: 13 }}
            >
              <option value="approved">Approve Project (Admit into registry)</option>
              <option value="rejected">Reject Project (Deny issuance)</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', marginBottom: 6 }}>
              Mandatory Override Rationale (min 10 characters) *
            </label>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Provide detailed legal, supervisory, or audit justification for overriding standard review flow..."
              style={{ width: '100%', background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, color: T.t1, fontSize: 13, fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <input
              type="checkbox"
              id="confirmOverride"
              checked={overrideConfirmed}
              onChange={(e) => setOverrideConfirmed(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: T.goldL }}
            />
            <label htmlFor="confirmOverride" style={{ fontSize: 12.5, color: T.t1, fontWeight: 600, cursor: 'pointer' }}>
              I confirm this override and accept accountability in the immutable audit log.
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="secondary" onClick={() => setOverrideModal(false)}>Cancel</Btn>
            <Btn
              style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff' }}
              disabled={actionSubmitting || overrideReason.trim().length < 10 || !overrideConfirmed}
              onClick={handleAdminOverride}
            >
              {actionSubmitting ? 'Recording…' : 'Execute Flagged Override'}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Admin Suspend Modal ── */}
      <Modal open={suspendModal} onClose={() => setSuspendModal(false)} title="Suspend Live Project (Take-Down)" width={480}>
        <div>
          <div style={{ background: 'rgba(244,63,94,0.1)', border: `1px solid rgba(244,63,94,0.3)`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ color: T.roseL, fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
              ⚠️ Registry Delisting & Quarantine
            </div>
            <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.5 }}>
              Suspending this project will immediately pause marketplace credit sales, freeze retirement certificate verification, and flag the developer entity.
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', marginBottom: 6 }}>
              Suspension Reason (min 5 characters) *
            </label>
            <textarea
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g. Unverified deforestation detected via satellite telemetry; compliance audit failure..."
              style={{ width: '100%', background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, color: T.t1, fontSize: 13, fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="secondary" onClick={() => setSuspendModal(false)}>Cancel</Btn>
            <Btn
              style={{ background: T.rose, color: '#fff' }}
              disabled={actionSubmitting || suspendReason.trim().length < 5}
              onClick={handleSuspendProject}
            >
              {actionSubmitting ? 'Suspending…' : 'Confirm Suspension'}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Admin Reassign Modal ── */}
      <Modal open={reassignModal} onClose={() => setReassignModal(false)} title="Reassign Project Reviewer / Verifier" width={480}>
        <div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', marginBottom: 6 }}>
              New Assigned Approver
            </label>
            <select
              value={reassignApproverId}
              onChange={(e) => setReassignApproverId(e.target.value)}
              style={{ width: '100%', background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, color: T.t1, fontSize: 13 }}
            >
              <option value="">-- Select Approver --</option>
              <option value="2">Dr. Sarah Jenkins (approver@carbonvault.com)</option>
              <option value="1">Alex Mercer (HQ Admin Backup)</option>
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', marginBottom: 6 }}>
              New Assigned Verifier
            </label>
            <select
              value={reassignVerifierId}
              onChange={(e) => setReassignVerifierId(e.target.value)}
              style={{ width: '100%', background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, color: T.t1, fontSize: 13 }}
            >
              <option value="">-- Select Verifier --</option>
              <option value="3">Marcus Vance (verifier@carbonvault.com)</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', marginBottom: 6 }}>Reassignment Notes</label>
            <textarea
              rows={2}
              value={reassignNotes}
              onChange={(e) => setReassignNotes(e.target.value)}
              placeholder="e.g. Workload balancing; jurisdiction conflict resolution..."
              style={{ width: '100%', background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, color: T.t1, fontSize: 13, fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="secondary" onClick={() => setReassignModal(false)}>Cancel</Btn>
            <Btn disabled={actionSubmitting} onClick={handleReassignProject}>
              {actionSubmitting ? 'Reassigning…' : 'Save Assignment'}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Add Comment Modal ── */}
      <Modal open={commentModal} onClose={() => setCommentModal(false)} title="Append Audited Comment" width={460}>
        <div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', marginBottom: 6 }}>Comment Content</label>
            <textarea
              rows={4}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Record audit observation, note for verifiers, or compliance remarks..."
              style={{ width: '100%', background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: 10, color: T.t1, fontSize: 13, fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Btn variant="secondary" onClick={() => setCommentModal(false)}>Cancel</Btn>
            <Btn disabled={actionSubmitting || !commentText.trim()} onClick={handleAddComment}>
              {actionSubmitting ? 'Saving…' : 'Record Comment'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
