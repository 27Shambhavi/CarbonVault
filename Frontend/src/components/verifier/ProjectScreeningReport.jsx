import { useState, useEffect } from 'react';
import { T, Button, Badge, Modal } from '../UI.jsx';
import {
  fetchScreeningReport, rerunProjectScreening, submitProjectExplanation, submitCheckFeedback
} from '../../services/api.js';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, RefreshCw, MessageSquare,
  ThumbsUp, ThumbsDown, Info, HelpCircle, MapPin, Camera, Sparkles, Satellite, Activity
} from 'lucide-react';

const CHECK_ICONS = {
  geo_boundary: MapPin,
  photo_gps_exif: Camera,
  perceptual_hash: Sparkles,
  satellite_ndvi: Satellite,
  ecological_isolation: Activity,
};

const CHECK_LABELS = {
  geo_boundary: '1. Boundary Geometry & Registry Overlap',
  photo_gps_exif: '2. Field Photo GPS & Proximity Verification',
  perceptual_hash: '3. Image Fingerprint & Replay Screening',
  satellite_ndvi: '4. Satellite NDVI Vegetative Health Trend',
  ecological_isolation: '5. Regional Peer Anomaly & Allometrics',
};

export default function ProjectScreeningReport({
  projectId,
  projectName = '',
  canRerun = true,
  canExplain = true,
  canFeedback = true,
  onClose = null,
}) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState(null);

  // Explanation Modal state
  const [explainModal, setExplainModal] = useState(false);
  const [explanationText, setExplanationText] = useState('');
  const [submittingExplain, setSubmittingExplain] = useState(false);
  const [explainSuccess, setExplainSuccess] = useState(null);

  // Feedback state per check
  const [feedbackNotes, setFeedbackNotes] = useState({});
  const [feedbackStatus, setFeedbackStatus] = useState({});

  useEffect(() => {
    if (projectId) {
      loadReport();
    }
  }, [projectId]);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchScreeningReport(projectId);
      if (res.error) {
        setError(res.error);
      } else {
        setReport(res.data || res);
      }
    } catch (err) {
      setError(err.message || 'Failed to load screening report');
    } finally {
      setLoading(false);
    }
  };

  const handleRerun = async () => {
    setRerunning(true);
    try {
      const res = await rerunProjectScreening(projectId);
      if (res.data) {
        setReport(res.data);
      } else if (!res.error) {
        setReport(res);
      }
    } catch (err) {
      setError(err.message || 'Screening rerun failed');
    } finally {
      setRerunning(false);
    }
  };

  const handleOpenExplain = () => {
    setExplanationText('');
    setExplainSuccess(null);
    setExplainModal(true);
  };

  const handleSubmitExplanation = async () => {
    if (!explanationText.trim()) return;
    setSubmittingExplain(true);
    try {
      const res = await submitProjectExplanation(projectId, explanationText);
      if (res.error) {
        setError(res.error);
      } else {
        setExplainSuccess('Your explanation has been recorded in the permanent audit trail.');
        setTimeout(() => {
          setExplainModal(false);
          loadReport();
        }, 1500);
      }
    } catch (err) {
      setError(err.message || 'Failed to submit explanation');
    } finally {
      setSubmittingExplain(false);
    }
  };

  const handleFeedback = async (checkId, useful) => {
    const note = feedbackNotes[checkId] || '';
    setFeedbackStatus((prev) => ({ ...prev, [checkId]: 'saving' }));
    try {
      await submitCheckFeedback(checkId, useful, note);
      setFeedbackStatus((prev) => ({ ...prev, [checkId]: useful ? 'useful' : 'not_useful' }));
    } catch {
      setFeedbackStatus((prev) => ({ ...prev, [checkId]: 'error' }));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: T.t3 }}>
        <RefreshCw size={24} style={{ animation: 'spin 1.5s linear infinite', marginBottom: 12 }} />
        <div>Evaluating 5-check screening pipeline for {projectId}…</div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div style={{
        padding: 24, borderRadius: 12, background: 'rgba(239,68,68,0.08)',
        border: `1px solid ${T.crimson}`, color: T.crimsonL, margin: '16px 0'
      }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Screening Report Unavailable</div>
        <div style={{ fontSize: 13 }}>{error}</div>
        <Button variant="secondary" size="sm" onClick={loadReport} style={{ marginTop: 14 }}>
          Retry Screening Check
        </Button>
      </div>
    );
  }

  const overall = report?.overall_status || 'consistent';
  const isPass = overall === 'consistent';
  const isWarn = overall === 'needs_attention';
  const isFail = overall === 'manual_review';

  const badgeColor = isPass ? 'teal' : isWarn ? 'gold' : 'crimson';
  const statusLabel = report?.overall_label || (
    isPass ? 'Looks consistent' : isWarn ? 'Needs attention' : 'Needs manual review'
  );

  return (
    <div style={{
      background: 'var(--surface-card, rgba(14,18,27,0.85))',
      border: `1px solid ${T.border}`, borderRadius: 14, padding: 24, margin: '16px 0'
    }}>
      {/* Top Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14, paddingBottom: 20, borderBottom: `1px solid ${T.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: isPass ? 'rgba(16,185,129,0.15)' : isWarn ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ShieldCheck size={24} color={isPass ? T.emeraldL : isWarn ? T.goldL : T.crimsonL} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: T.t1, fontFamily: 'Fraunces, serif' }}>
                Verification & Screening Pipeline: {projectName || projectId}
              </span>
              <Badge type={badgeColor} label={statusLabel} />
            </div>
            <div style={{ fontSize: 12, color: T.t3, marginTop: 4 }}>
              Engine Version: {report?.model_version || 'v2.1'} · Last Checked: {report?.finished_at ? new Date(report.finished_at).toLocaleString() : 'Just now'} · Trigger: {report?.trigger || 'automatic'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {canExplain && (
            <Button variant="secondary" size="sm" onClick={handleOpenExplain}>
              <MessageSquare size={13} style={{ marginRight: 6 }} /> Add Explanation
            </Button>
          )}
          {canRerun && (
            <Button variant="primary" size="sm" onClick={handleRerun} disabled={rerunning}>
              <RefreshCw size={13} style={{ marginRight: 6, animation: rerunning ? 'spin 1s linear infinite' : 'none' }} />
              {rerunning ? 'Evaluating…' : 'Re-run Screening'}
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, margin: '20px 0' }}>
        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--glass2, rgba(255,255,255,0.02))', border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 700 }}>Integrity Score</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: isPass ? T.emeraldL : isWarn ? T.goldL : T.crimsonL, marginTop: 4 }}>
            {report?.integrity_score != null ? `${report.integrity_score}%` : '95.0%'}
          </div>
          <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>Weighted across 5 independent checks</div>
        </div>

        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--glass2, rgba(255,255,255,0.02))', border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 700 }}>Risk Index</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: isPass ? T.emeraldL : isWarn ? T.goldL : T.crimsonL, marginTop: 4 }}>
            {report?.risk_index != null ? report.risk_index.toFixed(3) : '0.050'}
          </div>
          <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>Threshold: &lt; 0.350 is optimal</div>
        </div>

        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--glass2, rgba(255,255,255,0.02))', border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 700 }}>Checks Passed</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: T.t1, marginTop: 4 }}>
            {report?.checks?.filter((c) => c.status === 'pass').length || 0} / {report?.checks?.length || 5}
          </div>
          <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>
            {report?.checks?.filter((c) => c.status === 'warn').length || 0} need attention · {report?.checks?.filter((c) => c.status === 'fail').length || 0} manual review
          </div>
        </div>
      </div>

      {/* Explanations History if present */}
      {report?.explanation && (
        <div style={{
          padding: '14px 18px', borderRadius: 10, background: 'rgba(45,212,191,0.06)',
          border: `1px solid ${T.teal}`, marginBottom: 20
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: T.tealL, textTransform: 'uppercase', marginBottom: 6 }}>
            Developer Explanations & Corrective Actions
          </div>
          <div style={{ fontSize: 13, color: T.t2, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
            {report.explanation}
          </div>
        </div>
      )}

      {/* 5 Individual Check Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {(report?.checks || []).map((check, idx) => {
          const IconComponent = CHECK_ICONS[check.validator] || ShieldCheck;
          const label = CHECK_LABELS[check.validator] || check.validator;
          const status = check.status;
          const checkPass = status === 'pass';
          const checkWarn = status === 'warn';
          const checkFail = status === 'fail';
          const checkNotRun = status === 'not_checked';

          const cardBorder = checkPass ? 'rgba(16,185,129,0.3)' : checkWarn ? 'rgba(245,158,11,0.35)' : checkFail ? 'rgba(239,68,68,0.4)' : T.border;
          const cardBg = checkPass ? 'rgba(16,185,129,0.02)' : checkWarn ? 'rgba(245,158,11,0.03)' : checkFail ? 'rgba(239,68,68,0.04)' : 'transparent';
          const badgeType = checkPass ? 'teal' : checkWarn ? 'gold' : checkFail ? 'crimson' : 'muted';
          const badgeText = checkPass ? 'Looks consistent' : checkWarn ? 'Needs attention' : checkFail ? 'Needs manual review' : 'Awaiting evidence';

          const fbState = feedbackStatus[check.id] || (check.feedback_useful != null ? (check.feedback_useful ? 'useful' : 'not_useful') : null);

          return (
            <div key={check.id || idx} style={{
              borderRadius: 12, border: `1px solid ${cardBorder}`, background: cardBg,
              padding: '18px 20px', transition: 'all 0.2s ease'
            }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: checkPass ? 'rgba(16,185,129,0.1)' : checkWarn ? 'rgba(245,158,11,0.1)' : checkFail ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <IconComponent size={18} color={checkPass ? T.emeraldL : checkWarn ? T.goldL : checkFail ? T.crimsonL : T.t3} />
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: T.t1 }}>{label}</span>
                </div>
                <Badge type={badgeType} label={badgeText} />
              </div>

              {/* Metric & Threshold Row */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12, margin: '14px 0', padding: '10px 14px', borderRadius: 8,
                background: 'rgba(0,0,0,0.2)', border: `1px solid ${T.border}`
              }}>
                <div>
                  <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase' }}>Observed Metric</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.t1, marginTop: 2 }}>
                    {check.metric_value || (check.score != null ? `Score: ${check.score}` : 'Pending')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase' }}>Standard Threshold</div>
                  <div style={{ fontSize: 13, color: T.t2, marginTop: 2 }}>
                    {check.threshold || 'Peer baseline tolerances'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase' }}>Risk Score</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: checkPass ? T.emeraldL : checkWarn ? T.goldL : T.crimsonL, marginTop: 2 }}>
                    {check.score != null ? `${(check.score * 100).toFixed(1)} / 100` : '—'}
                  </div>
                </div>
              </div>

              {/* Explanatory text */}
              <div style={{ fontSize: 13, color: T.t2, lineHeight: 1.5, marginBottom: 10 }}>
                {check.reason}
              </div>

              {/* How to Fix Recommendation if not passing */}
              {check.recommendation && check.recommendation !== 'None.' && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, background: 'rgba(245,158,11,0.08)',
                  border: `1px solid rgba(245,158,11,0.25)`, fontSize: 12, color: T.goldL,
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10
                }}>
                  <Info size={14} style={{ flexShrink: 0 }} />
                  <span><strong>How to address:</strong> {check.recommendation}</span>
                </div>
              )}

              {/* Verifier Feedback controls */}
              {canFeedback && check.id && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: 10, paddingTop: 10, marginTop: 8,
                  borderTop: `1px solid rgba(255,255,255,0.05)`, fontSize: 12
                }}>
                  <span style={{ color: T.t3 }}>Was this flag useful to your review?</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => handleFeedback(check.id, true)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        border: `1px solid ${fbState === 'useful' ? T.emerald : T.border}`,
                        background: fbState === 'useful' ? 'rgba(16,185,129,0.15)' : 'transparent',
                        color: fbState === 'useful' ? T.emeraldL : T.t3, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5
                      }}
                    >
                      <ThumbsUp size={12} /> Useful
                    </button>
                    <button
                      onClick={() => handleFeedback(check.id, false)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        border: `1px solid ${fbState === 'not_useful' ? T.crimson : T.border}`,
                        background: fbState === 'not_useful' ? 'rgba(239,68,68,0.15)' : 'transparent',
                        color: fbState === 'not_useful' ? T.crimsonL : T.t3, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5
                      }}
                    >
                      <ThumbsDown size={12} /> False Positive
                    </button>
                    {fbState && <span style={{ fontSize: 11, color: T.t3 }}>✓ Feedback saved</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Explanation Modal */}
      {explainModal && (
        <Modal
          open={explainModal}
          onClose={() => setExplainModal(false)}
          title={`Add Project Context or Explanation: ${projectId}`}
          width={560}
        >
          <div style={{ padding: '6px 0' }}>
            <div style={{ fontSize: 13, color: T.t3, marginBottom: 14 }}>
              Submit clarifications for any flagged boundary variances, camera geotags, or local ecological factors. Explanations become part of the immutable project audit trail for accredited auditors.
            </div>

            {explainSuccess && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.1)',
                border: `1px solid ${T.emerald}`, color: T.emeraldL, fontSize: 13, marginBottom: 14
              }}>
                {explainSuccess}
              </div>
            )}

            <textarea
              rows={5}
              value={explanationText}
              onChange={(e) => setExplanationText(e.target.value)}
              placeholder="e.g., The boundary difference accounts for access roads along the northern perimeter. Field photos were taken with camera app offline and synced subsequently."
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 8,
                background: 'rgba(0,0,0,0.3)', border: `1px solid ${T.border}`,
                color: T.t1, fontSize: 13, outline: 'none', resize: 'vertical',
                fontFamily: 'inherit', marginBottom: 16
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" size="sm" onClick={() => setExplainModal(false)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitExplanation}
                disabled={submittingExplain || !explanationText.trim()}
              >
                {submittingExplain ? 'Recording…' : 'Record in Audit Log'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
