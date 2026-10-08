import { useState, useEffect } from 'react';
import { useApp } from '../../AppContext.jsx';
import {
  fetchAllProjects,
  fetchMapProjects,
  fetchMapPendingProjects,
  updateProjectStatus,
  fetchProjectHistory,
  deleteProject,
  getImageUrl
} from '../../services/api.js';
import { Card, SectionHeader, Badge, MRVScore, Modal, Btn, T } from '../UI.jsx';
import { ProjectMap } from '../GoogleMap.jsx';
import BulkImportModal from './BulkImportModal.jsx';
import {
  CheckCircle, XCircle, MessageSquare, AlertTriangle, ImageOff,
  ZoomIn, Leaf, DollarSign, Clock, ArrowRight, ShieldCheck, History,
  RotateCcw, Sparkles, Trash2, Lock, Upload
} from 'lucide-react';

const STAGES = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'field_verification', label: 'Field Verification' },
  { key: 'approved', label: 'Approved' },
];

const getStageIndex = (status) => {
  if (status === 'approved') return 4;
  if (status === 'field_verification') return 3;
  if (status === 'under_review') return 2;
  if (status === 'submitted' || status === 'pending') return 1;
  if (status === 'draft') return 0;
  return -1;
};

export default function AdminApprovals() {
  const { refreshKey, triggerRefresh, user } = useApp();
  const isApprover = user?.admin_role === 'approver';
  const adminActor = user?.name ? `${user.name} (${isApprover ? 'Project Approver' : 'Super Admin'})` : 'Alex Mercer (Admin)';

  const [projects, setProjects] = useState([]);
  const [mapFeatures, setMapFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState(null);
  const [fs, setFs] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [imgLightbox, setImgLightbox] = useState(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Status transition modal
  const [transitionModal, setTransitionModal] = useState(null);
  const [comment, setComment] = useState('');

  // Project history
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
          if (res.data.length > 0 && !selId) {
            setSelId(res.data[0].project_id || res.data[0].id);
          }
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProjects(); }, [refreshKey]);

  const loadHistory = (id) => {
    if (!id) return;
    setHistoryLoading(true);
    fetchProjectHistory(id)
      .then(res => {
        if (Array.isArray(res.data)) {
          setHistory(res.data);
        } else {
          setHistory([]);
        }
      })
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    if (selId) loadHistory(selId);
  }, [selId]);

  // Derive selected project from list
  const sel = projects.find(p => (p.project_id || p.id) === selId) || null;

  const filterTabs = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending Action' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'under_review', label: 'Under Review' },
    { id: 'field_verification', label: 'Field Verification' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];

  const filtered = fs === 'all'
    ? projects
    : fs === 'pending'
    ? projects.filter(p => ['pending', 'submitted', 'under_review', 'field_verification', 'draft'].includes(p.status))
    : projects.filter(p => p.status === fs);

  const getEvidenceUrl = (project) => {
    if (!project) return null;
    return getImageUrl(project.evidence_image);
  };

  const handleExecuteTransition = async () => {
    if (!sel || !transitionModal) return;
    setActionLoading(true);
    const { targetStatus, title } = transitionModal;
    const { data, error } = await updateProjectStatus(
      sel.project_id || sel.id,
      targetStatus,
      comment,
      adminActor
    );
    setActionLoading(false);
    setTransitionModal(null);
    setComment('');

    if (!error) {
      loadMapFeatures();
      setProjects(prev => prev.map(p =>
        (p.project_id || p.id) === (sel.project_id || sel.id)
          ? {
              ...p,
              status: targetStatus,
              credits: data?.credits || p.credits,
              shadow_credits: data?.shadow_credits || p.shadow_credits,
              price_per_ton: data?.price_per_ton || p.price_per_ton,
              total_funding: data?.total_funding || p.total_funding,
            }
          : p
      ));
      loadHistory(sel.project_id || sel.id);
      setTimeout(loadProjects, 500);
      triggerRefresh();
    }
  };

  const handleDeleteProject = async (p) => {
    if (isApprover) {
      alert("Super Admin privilege required to delete projects.");
      return;
    }
    const pid = p.project_id || p.id;
    if (!window.confirm(`Are you sure you want to permanently delete '${p.name}' (${pid})? This action cannot be undone.`)) {
      return;
    }
    setActionLoading(true);
    const res = await deleteProject(pid);
    setActionLoading(false);
    if (!res.error) {
      setProjects(prev => prev.filter(item => (item.project_id || item.id) !== pid));
      setSelId(null);
      loadMapFeatures();
      triggerRefresh();
    } else {
      alert(res.error);
    }
  };

  const openTransition = (targetStatus, title, description, confirmText, variant = 'primary') => {
    setComment('');
    setTransitionModal({ targetStatus, title, description, confirmText, variant });
  };

  const ta = {
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${T.border}`,
    borderRadius: 9,
    padding: '10px 14px',
    color: T.t1,
    fontSize: 14,
    outline: 'none',
    width: '100%',
    resize: 'vertical',
    fontFamily: 'Plus Jakarta Sans, sans-serif'
  };

  const inrAmount = (usd) => `₹${(usd * 83.5).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  if (loading) return (
    <div style={{ padding: 28, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, border: `3px solid rgba(45,212,191,0.15)`, borderTop: `3px solid ${T.teal}`, borderRadius: '50%', margin: '0 auto 16px', animation: 'spinSlow 0.8s linear infinite' }} />
        <div style={{ fontSize: 14, color: T.t2 }}>Loading projects…</div>
      </div>
    </div>
  );

  const evidenceUrl = sel ? getEvidenceUrl(sel) : null;
  const currentStageIdx = sel ? getStageIndex(sel.status) : -1;
  const isRejected = sel?.status === 'rejected';

  return (
    <div style={{ padding: 28 }}>
      <Card style={{ marginBottom: 18, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 10px' }}>
          <SectionHeader
            title="Plantation map"
            subtitle="Approved (green) and pending (yellow). Click a polygon to select a project in the list."
            action={
              <Btn onClick={() => setImportModalOpen(true)}>
                <Upload size={13} /> Bulk Import (CSV)
              </Btn>
            }
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

      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: 18, minHeight: 'calc(100vh - 86px)' }}>
        {/* Project List & Filter */}
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 13 }}>
            {filterTabs.map(tab => (
              <button key={tab.id} onClick={() => setFs(tab.id)}
                style={{
                  background: fs === tab.id ? 'rgba(45,212,191,0.1)' : 'transparent',
                  border: `1px solid ${fs === tab.id ? 'rgba(45,212,191,0.35)' : T.border}`,
                  borderRadius: 7,
                  padding: '5px 10px',
                  color: fs === tab.id ? T.teal : T.t3,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.14s'
                }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(p => {
              const pid = p.project_id || p.id;
              const isSelected = selId === pid;
              return (
                <button key={pid} onClick={() => setSelId(pid)}
                  style={{
                    background: isSelected ? 'rgba(45,212,191,0.06)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isSelected ? 'rgba(45,212,191,0.28)' : T.border}`,
                    borderRadius: 11,
                    padding: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.17s',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                  {isSelected && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: `linear-gradient(180deg, ${T.teal}, ${T.tealL})` }} />}
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.t1, marginBottom: 5, lineHeight: 1.35, paddingLeft: isSelected ? 6 : 0 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: T.t3, marginBottom: 4, paddingLeft: isSelected ? 6 : 0 }}>{p.ngo || 'Unknown'} · {p.plantation_type}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: isSelected ? 6 : 0 }}>
                    <Badge type={p.status} label={p.status.replace('_', ' ')} />
                    {(p.credits || 0) > 0 && <span style={{ fontSize: 10, color: T.emeraldL, fontWeight: 700 }}>{(p.credits || 0).toLocaleString()}t</span>}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: T.t3, fontSize: 13 }}>No projects match this filter</div>
            )}
          </div>
        </div>

        {/* Selected Project Details */}
        {sel && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: T.t1, fontFamily: 'Fraunces, serif', letterSpacing: '-0.4px', marginBottom: 8 }}>{sel.name}</h2>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Badge type={sel.plantation_type || sel.type || 'other'} label={(sel.plantation_type || sel.type || 'other').replace('_', ' ')} />
                    <Badge type={sel.status} label={sel.status.replace('_', ' ')} />
                    <span style={{ fontSize: 12, color: T.t3 }}>📍 {sel.location}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 34, fontWeight: 900, color: T.teal, fontFamily: 'Fraunces, serif', lineHeight: 1, textShadow: `0 0 24px rgba(45,212,191,0.4)` }}>
                    {(sel.credits || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>Verified Credits</div>
                  {(sel.shadow_credits || 0) > 0 && (
                    <div style={{ fontSize: 12, color: T.violetL || T.teal, fontWeight: 600, marginTop: 4 }}>
                      <Leaf size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{(sel.shadow_credits || 0).toLocaleString()} shadow
                    </div>
                  )}
                </div>
              </div>

              {/* ── Multi-Stage Stepper ── */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: '16px 20px',
                marginBottom: 22
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                    Verification Lifecycle Progress
                  </div>
                  {isRejected && (
                    <div style={{ fontSize: 11, color: T.roseL, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <XCircle size={12} /> Project Rejected
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                  {STAGES.map((st, idx) => {
                    const isDone = !isRejected && currentStageIdx > idx;
                    const isCurrent = !isRejected && currentStageIdx === idx;
                    return (
                      <div key={st.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 800,
                          background: isDone
                            ? `linear-gradient(135deg, ${T.teal}, ${T.tealDD})`
                            : isCurrent
                            ? 'rgba(45,212,191,0.15)'
                            : 'rgba(255,255,255,0.05)',
                          border: `2px solid ${isDone ? T.teal : isCurrent ? T.teal : 'rgba(255,255,255,0.15)'}`,
                          color: isDone ? '#000' : isCurrent ? T.teal : T.t4,
                          boxShadow: isCurrent ? '0 0 12px rgba(45,212,191,0.3)' : 'none',
                          transition: 'all 0.2s',
                        }}>
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <div style={{
                          fontSize: 10,
                          fontWeight: isCurrent ? 800 : 600,
                          color: isCurrent ? T.t1 : isDone ? T.teal : T.t4,
                          marginTop: 6,
                          textAlign: 'center'
                        }}>
                          {st.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── MRV / Fraud / Env Scores ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 11, marginBottom: 20 }}>
                {[
                  { l: 'MRV Score', c: sel.mrvScore ? <MRVScore score={sel.mrvScore} /> : <span style={{ fontSize: 22, fontWeight: 800, color: T.teal, fontFamily: 'Fraunces, serif' }}>—</span> },
                  { l: 'Fraud Risk', c: <span style={{ fontWeight: 800, fontSize: 22, fontFamily: 'Fraunces, serif', color: (sel.fraudRisk || 0) > 50 ? T.roseL : (sel.fraudRisk || 0) > 25 ? T.goldL : T.emeraldL }}>{sel.fraudRisk != null ? `${sel.fraudRisk}%` : '—'}</span> },
                  { l: 'Env. Score', c: sel.envScore ? <MRVScore score={sel.envScore} /> : <span style={{ fontSize: 22, fontWeight: 800, color: T.teal, fontFamily: 'Fraunces, serif' }}>—</span> }
                ].map(({ l, c }) => (
                  <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 10, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{l}</div>
                    {c}
                  </div>
                ))}
              </div>

              {/* Field Evidence */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: T.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Field Evidence (NGO Upload)</div>
                {evidenceUrl ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${T.border}`, transition: 'border-color 0.2s', cursor: 'pointer', position: 'relative' }}
                      onClick={() => setImgLightbox(evidenceUrl)}>
                      <img src={evidenceUrl} alt={`Evidence for ${sel.name}`}
                        style={{ width: 280, height: 170, objectFit: 'cover', display: 'block' }}
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'flex'); }} />
                      <div className="zoom-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}>
                        <ZoomIn size={24} color="#fff" />
                      </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ background: 'rgba(45,212,191,0.06)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                        <span style={{ color: T.t3 }}>Area: </span>
                        <span style={{ color: T.teal, fontWeight: 700 }}>{sel.area_hectares ? `${sel.area_hectares} ha` : '—'}</span>
                      </div>
                      <div style={{ background: 'rgba(45,212,191,0.06)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                        <span style={{ color: T.t3 }}>Trees: </span>
                        <span style={{ color: T.t1, fontWeight: 700 }}>{sel.number_of_trees ? sel.number_of_trees.toLocaleString() : '—'}</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.t3, marginTop: 4, lineHeight: 1.5 }}>
                        Image analyzed for GPS metadata, ecological plausibility, polygon integrity, and temporal consistency.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ border: `2px dashed rgba(255,255,255,0.08)`, borderRadius: 12, padding: 24, textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                    <ImageOff size={28} color={T.t3} style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 12, color: T.t3, fontWeight: 600 }}>No field evidence image uploaded</div>
                  </div>
                )}
              </div>

              {/* ── Multi-Stage Action Buttons ── */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: '16px 18px',
                marginBottom: 20
              }}>
                <div style={{ fontSize: 11, color: T.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>
                  Stage Transition Controls
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {/* Draft / Submitted / Pending stage */}
                  {(sel.status === 'draft' || sel.status === 'submitted' || sel.status === 'pending') && (
                    <>
                      <Btn onClick={() => openTransition('under_review', 'Advance to Under Review', 'Move this project into formal audit review. Assigned verifier will perform satellite MRV check.', 'Advance Stage')}>
                        <CheckCircle size={14} /> Advance to Under Review
                      </Btn>
                      <Btn variant="danger" onClick={() => openTransition('rejected', 'Reject Project', 'Reject this project submission. NGO will be notified with reason.', 'Reject Submission', 'danger')}>
                        <XCircle size={14} /> Reject
                      </Btn>
                      <Btn variant="secondary" onClick={() => openTransition(sel.status, 'Request NGO Clarification', 'Request updated evidence or boundary correction from NGO.', 'Send Request', 'secondary')}>
                        <MessageSquare size={14} /> Request Data
                      </Btn>
                    </>
                  )}

                  {/* Under Review stage */}
                  {sel.status === 'under_review' && (
                    <>
                      <Btn onClick={() => openTransition('field_verification', 'Advance to Field Verification', 'Move project into field verification stage. Local drone or satellite ground-truthing required.', 'Advance to Field Verification')}>
                        <ShieldCheck size={14} /> Advance to Field Verification
                      </Btn>
                      <Btn variant="danger" onClick={() => openTransition('rejected', 'Reject Project', 'Reject project during review stage.', 'Reject Project', 'danger')}>
                        <XCircle size={14} /> Reject
                      </Btn>
                    </>
                  )}

                  {/* Field Verification stage */}
                  {sel.status === 'field_verification' && (
                    <>
                      <Btn variant="emerald" onClick={() => openTransition('approved', 'Final Approval & Auto-Mint', 'Approve project! Verified carbon credits will be calculated and minted into the marketplace registry.', 'Confirm Final Approval')}>
                        <CheckCircle size={14} /> Final Approval & Mint Credits
                      </Btn>
                      <Btn variant="danger" onClick={() => openTransition('rejected', 'Reject Project', 'Reject project during field verification stage.', 'Reject Project', 'danger')}>
                        <XCircle size={14} /> Reject
                      </Btn>
                    </>
                  )}

                  {/* Approved stage */}
                  {sel.status === 'approved' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: T.emeraldL, fontWeight: 700, fontSize: 13 }}>
                        ✓ Approved & Verified in Marketplace
                      </div>
                      <Btn variant="gold" onClick={() => openTransition('approved', 'Re-calculate & Mint Credits', 'Re-run carbon credit calculations with updated forest growth model.', 'Recalculate')}>
                        <Sparkles size={14} /> Mint Additional Credits
                      </Btn>
                    </div>
                  )}

                  {/* Rejected stage */}
                  {sel.status === 'rejected' && (
                    <Btn variant="secondary" onClick={() => openTransition('under_review', 'Reopen Project for Review', 'Reset project status from rejected back to under review.', 'Reopen Project')}>
                      <RotateCcw size={14} /> Reopen for Review
                    </Btn>
                  )}

                  {/* Delete Project action */}
                  <div style={{ marginLeft: 'auto' }}>
                    {isApprover ? (
                      <button
                        disabled
                        title="Super Admin privilege required to delete projects"
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          color: T.t4,
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'not-allowed',
                          opacity: 0.6
                        }}>
                        <Lock size={12} /> Delete Project
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDeleteProject(sel)}
                        title="Permanently remove project from registry (Super Admin only)"
                        style={{
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.25)',
                          borderRadius: 8,
                          padding: '6px 12px',
                          color: T.roseL,
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}>
                        <Trash2 size={13} /> Delete Project
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Dynamic Audit Trail & Verification History ── */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <History size={15} color={T.teal} />
                  <div style={{ fontSize: 12, color: T.t2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Verification Audit Trail & History
                  </div>
                  <span style={{ fontSize: 11, color: T.t4 }}>({history.length} records)</span>
                </div>

                <div style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: 16
                }}>
                  {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: 14, color: T.t3, fontSize: 12 }}>Loading audit history…</div>
                  ) : history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 14, color: T.t4, fontSize: 12 }}>
                      No stage transitions recorded yet. Initial project creation registered.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {history.map((h, i) => (
                        <div key={h.id || i} style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          paddingBottom: i < history.length - 1 ? 12 : 0,
                          borderBottom: i < history.length - 1 ? `1px solid rgba(255,255,255,0.05)` : 'none'
                        }}>
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: h.to_status === 'approved' ? T.emeraldL : h.to_status === 'rejected' ? T.roseL : T.teal,
                            marginTop: 5,
                            flexShrink: 0
                          }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {h.from_status && (
                                  <>
                                    <span style={{ fontSize: 11, color: T.t3, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>
                                      {h.from_status.replace('_', ' ')}
                                    </span>
                                    <ArrowRight size={10} color={T.t4} />
                                  </>
                                )}
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: h.to_status === 'approved' ? T.emeraldL : h.to_status === 'rejected' ? T.roseL : T.teal,
                                  background: 'rgba(255,255,255,0.05)',
                                  padding: '2px 7px',
                                  borderRadius: 4
                                }}>
                                  {h.to_status.replace('_', ' ')}
                                </span>
                              </div>
                              <span style={{ fontSize: 11, color: T.t4 }}>{h.time || 'recently'}</span>
                            </div>
                            <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.45 }}>{h.comment}</div>
                            <div style={{ fontSize: 10, color: T.t4, marginTop: 2 }}>Action by: <span style={{ color: T.teal }}>{h.changed_by}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* ── Image Lightbox Modal ── */}
      <Modal open={!!imgLightbox} onClose={() => setImgLightbox(null)} title="Evidence Image" width={720}>
        {imgLightbox && (
          <div style={{ textAlign: 'center' }}>
            <img src={imgLightbox} alt="Evidence full-size" style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 12, objectFit: 'contain', border: `1px solid ${T.border}` }} />
          </div>
        )}
      </Modal>

      {/* ── Status Transition Modal ── */}
      <Modal open={!!transitionModal} onClose={() => setTransitionModal(null)} title={transitionModal?.title || 'Transition Project'} width={480}>
        {transitionModal && (
          <div>
            <p style={{ color: T.t2, marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}>
              {transitionModal.description}
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
                Auditor Note / Justification
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                placeholder="Enter verification comments, field observations, or audit notes..."
                style={ta}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn
                variant={transitionModal.variant || 'primary'}
                onClick={handleExecuteTransition}
                disabled={actionLoading}>
                {actionLoading ? 'Updating Stage…' : transitionModal.confirmText || 'Confirm'}
              </Btn>
              <Btn variant="secondary" onClick={() => setTransitionModal(null)}>Cancel</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk CSV Import Modal */}
      <BulkImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          loadProjects();
          triggerRefresh();
        }}
      />
    </div>
  );
}
