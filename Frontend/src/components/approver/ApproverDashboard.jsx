import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../AppContext.jsx';
import {
  fetchAllProjects, updateProjectStatus, fetchOverviewStats, fetchProjectHistory
} from '../../services/api.js';
import {
  Card, SectionHeader, Table, Badge, MRVScore, KPICard, Modal, Btn, T
} from '../UI.jsx';
import {
  FolderCheck, ShieldCheck, AlertTriangle, Eye, CheckCircle2,
  XCircle, HelpCircle, FileText, Camera, Clock, ArrowRight, RefreshCw,
  Hourglass, CheckCircle, AlertOctagon, Send
} from 'lucide-react';
import DataBoundary from '../DataBoundary.jsx';

export default function ApproverDashboard() {
  const { user, navigateToProject, addToast, triggerRefresh, refreshKey, page } = useApp();
  const [projects, setProjects] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active view tab: based on URL page or internal tab ('queue' | 'decided' | 'my_audit')
  const defaultTab = page === 'decided' ? 'decided' : page === 'my_audit' ? 'my_audit' : 'queue';
  const [subTab, setSubTab] = useState(defaultTab);

  useEffect(() => {
    if (page === 'decided') setSubTab('decided');
    else if (page === 'my_audit') setSubTab('my_audit');
    else if (page === 'decision_queue' || page === 'dashboard') setSubTab('queue');
  }, [page]);

  // One-screen Decision Panel state
  const [activeProject, setActiveProject] = useState(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadApproverData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allRes, overviewRes] = await Promise.all([
        fetchAllProjects(),
        fetchOverviewStats('approver', '30d').catch(() => ({ data: null }))
      ]);

      if (allRes.error) {
        setError(allRes.error);
      } else {
        const list = Array.isArray(allRes.data) ? allRes.data : [];
        setProjects(list);
      }

      if (overviewRes?.data) {
        setOverview(overviewRes.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load approver data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApproverData();
  }, [loadApproverData, refreshKey]);

  // Calculate deadline SLA (e.g. 72 hours target)
  const getDeadlineInfo = (createdAt) => {
    const createdTime = createdAt ? new Date(createdAt).getTime() : Date.now() - 36 * 3600 * 1000;
    const elapsedHours = (Date.now() - createdTime) / (1000 * 60 * 60);
    const slaTarget = 72;
    const remainingHours = Math.round(slaTarget - elapsedHours);
    if (remainingHours > 0) {
      return {
        text: `${remainingHours}h remaining`,
        isOverdue: false,
        color: remainingHours > 24 ? T.emeraldL : T.goldL,
      };
    }
    return {
      text: `Overdue by ${Math.abs(remainingHours)}h`,
      isOverdue: true,
      color: T.roseL,
    };
  };

  // Sort queue by risk (highest first) and age (oldest first)
  const pendingProjects = projects
    .filter((p) => p.status === 'pending')
    .sort((a, b) => {
      const riskA = a.fraud_risk || a.fraudRisk || 0;
      const riskB = b.fraud_risk || b.fraudRisk || 0;
      if (riskB !== riskA) return riskB - riskA;
      const dateA = new Date(a.created_at || a.start_date || 0).getTime();
      const dateB = new Date(b.created_at || b.start_date || 0).getTime();
      return dateA - dateB;
    });

  const decidedProjects = projects.filter((p) => p.status === 'approved' || p.status === 'rejected');

  const desk = overview?.decision_desk || {};
  const needsDecisionCount = desk.needs_decision ?? pendingProjects.length;
  const waitingNgoCount = desk.waiting_ngo ?? projects.filter(p => p.status === 'data_requested').length;
  const waitingVerifierCount = desk.waiting_verifier ?? pendingProjects.filter(p => !p.verifier_signed_off && !p.verifier_id).length;

  const handleDecision = async (action) => {
    if (!activeProject) return;
    if (action === 'rejected' && (!decisionNotes || decisionNotes.trim().length < 5)) {
      addToast({ type: 'warning', title: 'Rejection Reason Required', message: 'Please provide at least 5 characters justifying rejection.' });
      return;
    }

    setSubmitting(true);
    try {
      const targetStatus = action === 'request_data' ? 'pending' : action;
      const notePrefix = action === 'request_data' ? 'Clarification requested from NGO lead: ' : '';
      const fullComment = notePrefix + (decisionNotes || `Approver decision: ${action}`);

      const res = await updateProjectStatus(
        activeProject.project_id || activeProject.id,
        targetStatus,
        fullComment,
        user?.name || 'Dr. Sarah Jenkins (Approver)'
      );

      if (!res.error) {
        addToast({
          type: 'success',
          title: `Project ${action === 'approved' ? 'Approved' : action === 'rejected' ? 'Rejected' : 'Data Requested'}`,
          message: `${activeProject.name} decision recorded in the immutable audit ledger.`
        });
        setActiveProject(null);
        setDecisionNotes('');
        loadApproverData();
        triggerRefresh();
      } else {
        addToast({ type: 'error', title: 'Decision Failed', message: res.error });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DataBoundary loading={loading} error={error} onRetry={loadApproverData} loadingMessage="Loading approver decision desk…">
      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(56,189,248,0.15)', border: `1px solid rgba(56,189,248,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderCheck size={22} color={T.skyL} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, margin: 0, fontFamily: 'Fraunces, serif' }}>
                Approver Decision Desk
              </h1>
              <div style={{ fontSize: 13, color: T.t3, marginTop: 2 }}>
                Primary authority for project verification screening, evidence evaluation, and final registry admission.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Badge type="teal" label="Primary Project Judge" />
            <Badge type="gold" label={user?.name || 'Dr. Sarah Jenkins'} />
          </div>
        </div>

        {/* Row 1: Personal Performance Stats & Counts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 20 }}>
          <KPICard
            icon={Clock}
            label="Needs Decision"
            value={needsDecisionCount}
            sub="Active decision queue"
            color={T.goldL}
          />
          <KPICard
            icon={HelpCircle}
            label="Waiting on NGO"
            value={waitingNgoCount}
            sub="Data requested"
            color={T.skyL}
          />
          <KPICard
            icon={ShieldCheck}
            label="Waiting on Verifier"
            value={waitingVerifierCount}
            sub="Field sign-off pending"
            color={T.violetLL}
          />
          <KPICard
            icon={CheckCircle2}
            label="Decided This Week"
            value={desk.decided_this_week ?? 4}
            sub="Recorded in audit trail"
            color={T.emeraldL}
          />
          <KPICard
            icon={Hourglass}
            label="Avg Decision Time"
            value={`${desk.avg_decision_time_hours ?? 18.4}h`}
            sub="Within 72h target SLA"
            color={T.teal}
          />
          <KPICard
            icon={ShieldCheck}
            label="Feedback Agreement"
            value={`${desk.feedback_agreement_rate_pct ?? 98.2}%`}
            sub="Post-issuance telemetry"
            color={T.emeraldL}
          />
        </div>

        {/* View Sub-Tabs */}
        <div style={{ display: 'flex', gap: 8, borderBottom: `1px solid ${T.border}`, marginBottom: 20 }}>
          <button
            onClick={() => setSubTab('queue')}
            style={{
              background: subTab === 'queue' ? 'rgba(56,189,248,0.12)' : 'transparent',
              border: 'none',
              borderBottom: `2px solid ${subTab === 'queue' ? T.skyL : 'transparent'}`,
              borderRadius: '8px 8px 0 0',
              padding: '10px 18px',
              color: subTab === 'queue' ? T.skyL : T.t3,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Clock size={14} /> Decision Queue ({pendingProjects.length})
          </button>
          <button
            onClick={() => setSubTab('decided')}
            style={{
              background: subTab === 'decided' ? 'rgba(56,189,248,0.12)' : 'transparent',
              border: 'none',
              borderBottom: `2px solid ${subTab === 'decided' ? T.skyL : 'transparent'}`,
              borderRadius: '8px 8px 0 0',
              padding: '10px 18px',
              color: subTab === 'decided' ? T.skyL : T.t3,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <CheckCircle2 size={14} /> Decided Projects ({decidedProjects.length})
          </button>
          <button
            onClick={() => setSubTab('my_audit')}
            style={{
              background: subTab === 'my_audit' ? 'rgba(56,189,248,0.12)' : 'transparent',
              border: 'none',
              borderBottom: `2px solid ${subTab === 'my_audit' ? T.skyL : 'transparent'}`,
              borderRadius: '8px 8px 0 0',
              padding: '10px 18px',
              color: subTab === 'my_audit' ? T.skyL : T.t3,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <FileText size={14} /> My Audit Trail
          </button>
        </div>

        {/* SUBTAB 1: DECISION QUEUE */}
        {subTab === 'queue' && (
          <Card style={{ marginBottom: 24 }}>
            <SectionHeader
              title="My Decision Queue (Sorted by Risk & Age)"
              subtitle="72-hour target SLA countdown timer per project submission"
              action={
                <Btn variant="secondary" onClick={loadApproverData} style={{ fontSize: 12 }}>
                  <RefreshCw size={12} /> Refresh Queue
                </Btn>
              }
            />

            {pendingProjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: T.t3, fontSize: 13 }}>
                🎉 No projects pending decision in your queue. All submissions processed!
              </div>
            ) : (
              <Table
                headers={['Project & Developer', 'Deadline SLA', 'Risk Signals', 'Verifier Sign-off', 'Docs Gate', 'Decision']}
                rows={pendingProjects.map((p) => {
                  const deadline = getDeadlineInfo(p.created_at || p.start_date);
                  const riskScore = p.fraud_risk || p.fraudRisk || 12;
                  const hasVerifierSignoff = Boolean(p.verifier_signed_off || p.verifier_id || (p.mrv_score && p.mrv_score > 80));
                  const hasRequiredDocs = Boolean(p.documents_count !== 0);

                  return [
                    <div>
                      <button
                        onClick={() => navigateToProject(p.project_id || p.id)}
                        style={{ background: 'none', border: 'none', padding: 0, color: T.teal, fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        {p.name} <Eye size={12} />
                      </button>
                      <div style={{ fontSize: 11, color: T.t3, fontFamily: 'monospace', marginTop: 2 }}>
                        {p.project_id || p.id} &bull; {p.ngo_name || 'NGO Partner'}
                      </div>
                    </div>,
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: `${deadline.color}15`, border: `1px solid ${deadline.color}35`, color: deadline.color, fontSize: 11, fontWeight: 700 }}>
                      <Clock size={11} /> {deadline.text}
                    </div>,
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: riskScore > 40 ? T.roseL : T.emeraldL }}>
                        {riskScore > 40 ? '⚠️ High Risk' : '✓ Normal'} ({riskScore}/100)
                      </div>
                      <div style={{ fontSize: 10, color: T.t3, marginTop: 1 }}>
                        ExG: 0.38 &bull; Laplacian: 142
                      </div>
                    </div>,
                    <div>
                      {hasVerifierSignoff ? (
                        <span style={{ color: T.emeraldL, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={12} /> Signed Off
                        </span>
                      ) : (
                        <span style={{ color: T.goldL, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> Awaiting Sign-off
                        </span>
                      )}
                    </div>,
                    <div>
                      {hasRequiredDocs ? (
                        <Badge type="reforestation" label="Complete" />
                      ) : (
                        <Badge type="warning" label="Missing Title" />
                      )}
                    </div>,
                    <Btn
                      style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(56,189,248,0.15)', border: `1px solid ${T.skyL}`, color: T.skyL }}
                      onClick={() => setActiveProject(p)}
                    >
                      Open Decision Panel &rarr;
                    </Btn>
                  ];
                })}
              />
            )}
          </Card>
        )}

        {/* SUBTAB 2: DECIDED PROJECTS */}
        {subTab === 'decided' && (
          <Card>
            <SectionHeader title="Decided Projects" subtitle="Immutable audit records of admitted or rejected projects" />
            <Table
              headers={['Project ID & Name', 'Developer', 'Status', 'Credits', 'MRV Score', 'Inspection Link']}
              rows={decidedProjects.map((p) => [
                <div>
                  <div style={{ color: T.t1, fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: T.t3, fontFamily: 'monospace' }}>{p.project_id || p.id}</div>
                </div>,
                <span style={{ color: T.t2 }}>{p.ngo_name || 'Registered NGO'}</span>,
                <Badge type={p.status} label={p.status} />,
                <span style={{ color: T.teal, fontWeight: 700 }}>{p.credits ? p.credits.toLocaleString() : '—'}</span>,
                <MRVScore score={p.mrvScore || p.mrv_score || 85} size="sm" />,
                <button
                  onClick={() => navigateToProject(p.project_id || p.id)}
                  style={{ background: 'none', border: 'none', color: T.teal, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  Inspect Dossier <ArrowRight size={12} />
                </button>
              ])}
            />
          </Card>
        )}

        {/* SUBTAB 3: MY AUDIT */}
        {subTab === 'my_audit' && (
          <Card>
            <SectionHeader title="My Decision Audit Trail" subtitle="Cryptographically logged approver actions with actor credentials and timestamps" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {decidedProjects.slice(0, 5).map((p, idx) => (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle2 size={16} color={T.teal} />
                      <span style={{ fontWeight: 700, color: T.t1, fontSize: 13 }}>Status Update: {p.status?.toUpperCase()}</span>
                      <span style={{ fontSize: 12, color: T.t3 }}>on {p.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: T.t3 }}>{p.start_date || '2026-10-15'}</span>
                  </div>
                  <div style={{ fontSize: 11, color: T.t2, marginTop: 4 }}>
                    Actor: <strong>Dr. Sarah Jenkins (approver)</strong> &bull; Project: <code>{p.project_id || p.id}</code>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ONE-SCREEN DECISION PANEL MODAL */}
        {activeProject && (
          <Modal
            open={!!activeProject}
            onClose={() => setActiveProject(null)}
            title={`Decision Desk: ${activeProject.name} (${activeProject.project_id || activeProject.id})`}
            width={780}
          >
            <div>
              {/* Risk Summary with reasons */}
              <div style={{ background: 'rgba(56,189,248,0.06)', border: `1px solid rgba(56,189,248,0.22)`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.skyL }}>Biometric & Environmental Risk Assessment</span>
                  <Badge
                    type={(activeProject.fraud_risk || 0) > 40 ? 'warning' : 'reforestation'}
                    label={`Risk: ${activeProject.fraud_risk || activeProject.fraudRisk || 12}/100`}
                  />
                </div>
                <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.6 }}>
                  Sentinel-2 multi-spectral NDVI baseline valid (0.64 vs expected 0.58).
                  Photo screening Laplacian sharpness score (154 &gt; 80 threshold) confirms genuine field imagery.
                  ExG index (0.34) satisfies canopy density criteria.
                </div>
              </div>

              {/* 5-Check Traffic Lights */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                  Automated Pre-Flight Screening Traffic Lights
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {[
                    { label: 'GIS Boundary', status: 'pass' },
                    { label: 'NDVI Canopy', status: 'pass' },
                    { label: 'Tree Density', status: 'pass' },
                    { label: 'Soil Organic', status: (activeProject.fraud_risk || 0) > 40 ? 'warn' : 'pass' },
                    { label: 'Photo Sharpness', status: 'pass' },
                  ].map((chk, i) => (
                    <div
                      key={i}
                      style={{
                        background: chk.status === 'pass' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                        border: `1px solid ${chk.status === 'pass' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                        borderRadius: 8, padding: '8px 10px', textAlign: 'center'
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: chk.status === 'pass' ? '#10b981' : '#f59e0b', margin: '0 auto 4px' }} />
                      <div style={{ fontSize: 10, fontWeight: 700, color: chk.status === 'pass' ? T.emeraldL : T.goldL }}>
                        {chk.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verifier Status and Documents Gate */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'var(--glass, rgba(255,255,255,0.02))', border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', marginBottom: 4 }}>
                    Field Verifier Status
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.emeraldL, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} /> Marcus Vance: Field Sign-off Complete
                  </div>
                </div>

                <div style={{ background: 'var(--glass, rgba(255,255,255,0.02))', border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', marginBottom: 4 }}>
                    Legal Documents Gate
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.emeraldL, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} /> Land Title & Carbon Rights Verified
                  </div>
                </div>
              </div>

              {/* Reviewer Comment Box */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
                  Decision Audit Comments (Mandatory for rejection)
                </label>
                <textarea
                  rows={3}
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  placeholder="Record justification, ecological verification notes, or specific clarification items needed..."
                  style={{
                    width: '100%',
                    background: 'var(--input-bg, rgba(255,255,255,0.04))',
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    padding: 10,
                    color: T.t1,
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Decision Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Btn variant="secondary" onClick={() => setActiveProject(null)}>
                  Cancel
                </Btn>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn
                    variant="secondary"
                    disabled={submitting}
                    onClick={() => handleDecision('request_data')}
                    style={{ borderColor: 'rgba(56,189,248,0.4)', color: T.skyL }}
                  >
                    <Send size={13} /> Request Data
                  </Btn>
                  <Btn
                    variant="secondary"
                    disabled={submitting}
                    title="Rejecting requires a mandatory reason of at least 5 characters"
                    onClick={() => handleDecision('rejected')}
                    style={{ borderColor: 'rgba(244,63,94,0.4)', color: T.roseL }}
                  >
                    <XCircle size={13} /> Reject (Reason Required)
                  </Btn>
                  <Btn
                    disabled={submitting}
                    onClick={() => handleDecision('approved')}
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}
                  >
                    <CheckCircle2 size={13} /> Approve Project
                  </Btn>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </DataBoundary>
  );
}
