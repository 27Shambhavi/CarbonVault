import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../AppContext.jsx';
import {
  fetchAllProjects, updateProjectStatus, fetchMapPendingProjects
} from '../../services/api.js';
import {
  Card, SectionHeader, Table, Badge, MRVScore, KPICard, Modal, Btn, T
} from '../UI.jsx';
import {
  FolderCheck, ShieldCheck, AlertTriangle, Eye, CheckCircle2,
  XCircle, HelpCircle, FileText, Camera, Clock, ArrowRight, RefreshCw
} from 'lucide-react';
import DataBoundary from '../DataBoundary.jsx';

export default function ApproverDashboard() {
  const { user, navigateToProject, addToast, triggerRefresh, refreshKey } = useApp();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Review decision modal state
  const [reviewModal, setReviewModal] = useState(null); // { project, action: 'approved' | 'rejected' | 'info' }
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPendingProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAllProjects();
      if (res.error) {
        setError(res.error);
      } else {
        const list = Array.isArray(res.data) ? res.data : [];
        setProjects(list);
      }
    } catch (err) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingProjects();
  }, [loadPendingProjects, refreshKey]);

  const handleDecision = async () => {
    if (!reviewModal) return;
    const { project, action } = reviewModal;
    setSubmitting(true);
    try {
      const targetStatus = action === 'info' ? 'pending' : action;
      const res = await updateProjectStatus(
        project.project_id || project.id,
        targetStatus,
        reviewNotes || `Reviewer decision: ${action}`,
        user?.name || user?.email || 'Approver'
      );
      if (!res.error) {
        addToast({
          type: 'success',
          title: `Project ${action === 'approved' ? 'Approved' : 'Updated'}`,
          message: `${project.name} decision recorded in immutable audit log.`
        });
        setReviewModal(null);
        setReviewNotes('');
        loadPendingProjects();
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

  const pendingList = projects.filter((p) => p.status === 'pending');
  const flaggedList = projects.filter((p) => (p.fraudRisk || 0) > 40 || (p.fraud_risk || 0) > 40);
  const approvedList = projects.filter((p) => p.status === 'approved');

  return (
    <DataBoundary loading={loading} error={error} onRetry={loadPendingProjects} loadingMessage="Loading approver workbench…">
      <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(45,212,191,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FolderCheck size={20} color={T.teal} />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, margin: 0, fontFamily: 'Fraunces, serif' }}>
                  Project Reviewer & Approver Workbench
                </h1>
                <div style={{ fontSize: 13, color: T.t3, marginTop: 2 }}>
                  Ecological MRV fidelity, fraud screening signals, and scientific approval decisions.
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Badge type="teal" label="Scientific Review Queue" />
            <Badge type="gold" label={`Reviewer: ${user?.name || 'Auditor'}`} />
          </div>
        </div>

        {/* KPIs (strictly without financial/pricing data) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <KPICard icon={Clock} label="Pending Review" value={pendingList.length} sub="Awaiting decision" color={T.goldL} />
          <KPICard icon={AlertTriangle} label="Flagged for Anomalies" value={flaggedList.length} sub="Fraud risk > 40" color={T.roseL} />
          <KPICard icon={ShieldCheck} label="Approved Projects" value={approvedList.length} sub="Issued into registry" color={T.emeraldL} />
          <KPICard icon={Camera} label="Photo Screening Gates" value="Active" sub="ExG & Laplacian sharpness" color={T.teal} />
        </div>

        {/* Priority Pending Queue Table */}
        <Card style={{ marginBottom: 24 }}>
          <SectionHeader
            title="Projects Awaiting Scientific Review & Approval"
            subtitle="Click on any project to inspect full 8-tab evidence dossier"
            action={
              <Btn variant="secondary" onClick={loadPendingProjects} style={{ fontSize: 12 }}>
                <RefreshCw size={12} /> Refresh Queue
              </Btn>
            }
          />

          {pendingList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: T.t3, fontSize: 13 }}>
              🎉 All project submissions have been reviewed! No items in pending queue.
            </div>
          ) : (
            <Table
              headers={['Project ID & Name', 'Ecology Type', 'Hectares', 'Tree Count', 'MRV Score', 'Fraud Risk', 'Actions']}
              rows={pendingList.map((p) => [
                <div>
                  <button
                    onClick={() => navigateToProject(p.project_id || p.id)}
                    style={{ background: 'none', border: 'none', padding: 0, color: T.teal, fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {p.name} <Eye size={12} />
                  </button>
                  <div style={{ fontSize: 11, color: T.t3, fontFamily: 'monospace', marginTop: 2 }}>
                    {p.project_id || p.id} · {p.ngo_name || 'Partner NGO'}
                  </div>
                </div>,
                <Badge type="reforestation" label={p.plantation_type} />,
                <span style={{ color: T.t2 }}>{p.area_hectares} ha</span>,
                <span style={{ color: T.emeraldL, fontWeight: 600 }}>{(p.number_of_trees || 0).toLocaleString()}</span>,
                <MRVScore score={p.mrvScore || p.mrv_score || 85} size="sm" />,
                <span style={{ color: (p.fraudRisk || p.fraud_risk || 0) > 40 ? T.roseL : T.emeraldL, fontWeight: 700 }}>
                  {p.fraudRisk || p.fraud_risk || 12}/100
                </span>,
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setReviewModal({ project: p, action: 'approved' })}
                    style={{ background: 'rgba(16,185,129,0.12)', border: `1px solid ${T.emeraldL}`, color: T.emeraldL, borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setReviewModal({ project: p, action: 'rejected' })}
                    style={{ background: 'rgba(244,63,94,0.12)', border: `1px solid ${T.roseL}`, color: T.roseL, borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => setReviewModal({ project: p, action: 'info' })}
                    style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.border}`, color: T.t2, borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Info
                  </button>
                </div>,
              ])}
            />
          )}
        </Card>

        {/* Recently Decided Projects */}
        <Card>
          <SectionHeader title="Recently Decided Projects" subtitle="Audited registry records" />
          <Table
            headers={['Project ID & Name', 'Ecology Type', 'Developer', 'Status', 'MRV Score', 'Inspection Link']}
            rows={projects.slice(0, 10).map((p) => [
              <div>
                <div style={{ color: T.t1, fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: T.t3, fontFamily: 'monospace' }}>{p.project_id || p.id}</div>
              </div>,
              <Badge type={p.status === 'approved' ? 'reforestation' : 'gold'} label={p.plantation_type} />,
              <span style={{ color: T.t2 }}>{p.ngo_name || 'Registered NGO'}</span>,
              <Badge type={p.status} label={p.status} />,
              <MRVScore score={p.mrvScore || p.mrv_score || 85} size="sm" />,
              <button
                onClick={() => navigateToProject(p.project_id || p.id)}
                style={{ background: 'none', border: 'none', color: T.teal, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                Inspect Dossier <ArrowRight size={12} />
              </button>,
            ])}
          />
        </Card>

        {/* Decision Modal */}
        <Modal
          open={!!reviewModal}
          onClose={() => setReviewModal(null)}
          title={`Confirm Decision: ${reviewModal?.action?.toUpperCase()}`}
          width={500}
        >
          {reviewModal && (
            <div>
              <div style={{ fontSize: 13, color: T.t2, marginBottom: 14 }}>
                You are about to mark project <strong style={{ color: T.t1 }}>{reviewModal.project.name}</strong> ({reviewModal.project.project_id || reviewModal.project.id}) as{' '}
                <strong style={{ color: reviewModal.action === 'approved' ? T.emeraldL : T.roseL }}>{reviewModal.action.toUpperCase()}</strong>.
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                  Reviewer Notes & Justification (Recorded in Audit Trail)
                </label>
                <textarea
                  rows={4}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter scientific justification, MRV checks performed, or reason for rejection/info request..."
                  style={{
                    width: '100%',
                    background: 'var(--input-bg, rgba(255,255,255,0.04))',
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    padding: 12,
                    color: T.t1,
                    fontSize: 13,
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Btn variant="secondary" onClick={() => setReviewModal(null)}>Cancel</Btn>
                <Btn
                  disabled={submitting}
                  style={{
                    background: reviewModal.action === 'approved' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#f43f5e,#be123c)',
                    color: '#fff',
                  }}
                  onClick={handleDecision}
                >
                  {submitting ? 'Recording Decision…' : `Confirm ${reviewModal.action.toUpperCase()}`}
                </Btn>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DataBoundary>
  );
}
