import { useState, useEffect } from 'react';
import { useApp } from '../../AppContext.jsx';
import { T, Button, Badge, Modal, Card } from '../UI.jsx';
import {
  fetchProjects, submitVerifierSignoff, fetchVerifierStatus, fetchProjectDocuments
} from '../../services/api.js';
import {
  ShieldCheck, CheckCircle2, XCircle, FileText, AlertTriangle, TreePine, Eye, Send, Award, Map, User, Check
} from 'lucide-react';
import { ProjectDocumentGate } from '../projects/ProjectDocumentGate.jsx';
import ProjectScreeningReport from './ProjectScreeningReport.jsx';
import { ProjectMap } from '../GoogleMap.jsx';

export default function VerifierDashboard() {
  const { user, page, navigateToProject } = useApp();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [screeningProject, setScreeningProject] = useState(null);
  const [auditModal, setAuditModal] = useState(false);
  const [decision, setDecision] = useState('verified');
  const [comments, setComments] = useState('');
  const [reportUrl, setReportUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await fetchProjects();
      const allProjects = Array.isArray(res.data) ? res.data : (res.data?.projects || []);
      setProjects(allProjects);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAudit = (proj) => {
    setSelectedProject(proj);
    setComments('');
    setDecision('verified');
    setReportUrl(`https://audit.carbonvault.io/reports/${proj.id}_audit.pdf`);
    setAuditModal(true);
  };

  const handleSubmitSignoff = async () => {
    if (!selectedProject) return;
    setSubmitting(true);
    setMsg(null);
    try {
      await submitVerifierSignoff(selectedProject.id, decision, comments, reportUrl);
      setMsg({ type: 'success', text: `Project "${selectedProject.name}" successfully ${decision} by accredited verifier!` });
      setAuditModal(false);
      loadProjects();
    } catch (err) {
      setMsg({ type: 'error', text: `Verification failed: ${err.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  const currentTab = page === 'map' ? 'map' : page === 'completed' ? 'completed' : page === 'profile' ? 'profile' : 'dashboard';

  let title = 'Field Verification Workbench';
  let subtitle = 'Independent MRV review, legal document verification, and cryptographic issuance sign-off.';
  if (currentTab === 'map') {
    title = 'Field Inspection Map';
    subtitle = 'Interactive field boundaries, satellite NDVI health, and verified project polygons.';
  } else if (currentTab === 'completed') {
    title = 'Verified Project Archive';
    subtitle = 'Permanently signed and verified ecological restoration projects.';
  } else if (currentTab === 'profile') {
    title = 'Verifier Accreditation Profile';
    subtitle = 'ISO 14064-3 Accreditation credentials, authorized audit scope, and verifier identity.';
  }

  const displayedProjects = currentTab === 'completed'
    ? projects.filter(p => p.status === 'verified' || p.status === 'approved' || p.status === 'active')
    : projects;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(45,212,191,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={20} color={T.tealL} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, fontFamily: 'Fraunces, serif', margin: 0 }}>
                {title}
              </h1>
              <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>
                {subtitle}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Badge type="teal" label="ISO 14064-3 Accredited" />
          <Badge type="gold" label={`Verifier: ${user?.email || 'Auditor'}`} />
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13,
          background: msg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${msg.type === 'success' ? T.emerald : T.crimson}`,
          color: msg.type === 'success' ? T.emeraldL : T.crimsonL,
        }}>
          {msg.text}
        </div>
      )}

      {/* Map View */}
      {currentTab === 'map' && (
        <div style={{ background: 'var(--surface-card, rgba(14,18,27,0.8))', border: `1px solid ${T.border}`, borderRadius: 14, padding: 22, marginBottom: 24 }}>
          <div style={{ marginBottom: 16, fontSize: 15, fontWeight: 700, color: T.t1 }}>
            Field Polygon Geofences ({projects.length} sites mapped)
          </div>
          <ProjectMap features={projects} height={480} />
        </div>
      )}

      {/* Profile View */}
      {currentTab === 'profile' && (
        <div style={{ background: 'var(--surface-card, rgba(14,18,27,0.8))', border: `1px solid ${T.border}`, borderRadius: 14, padding: 28, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(45,212,191,0.15)', border: `2px solid ${T.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={32} color={T.tealL} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.t1 }}>{user?.name || 'Marcus Vance'}</div>
              <div style={{ fontSize: 13, color: T.t3 }}>{user?.email || 'verifier@carbonvault.com'} · {user?.org || 'Global Carbon Verifiers'}</div>
              <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                <Badge type="teal" label="Accredited Verifier Level 3" />
                <Badge type="gold" label="Ed25519 Signing Key Active" />
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 700 }}>Accreditation Standard</div>
              <div style={{ fontSize: 14, color: T.t1, fontWeight: 700, marginTop: 4 }}>ISO 14064-3:2019 / GHG Protocol</div>
            </div>
            <div style={{ padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 700 }}>Authorized Methodology</div>
              <div style={{ fontSize: 14, color: T.t1, fontWeight: 700, marginTop: 4 }}>VM0007 / AR-ACM0003 Afforestation</div>
            </div>
            <div style={{ padding: 16, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, color: T.t3, textTransform: 'uppercase', fontWeight: 700 }}>Cryptographic Status</div>
              <div style={{ fontSize: 14, color: T.emeraldL, fontWeight: 700, marginTop: 4 }}>Verified & Bound to Ledger</div>
            </div>
          </div>
        </div>
      )}

      {/* Projects under review queue */}
      {(currentTab === 'dashboard' || currentTab === 'completed') && (
        <div style={{ background: 'var(--surface-card, rgba(14,18,27,0.8))', border: `1px solid ${T.border}`, borderRadius: 14, padding: 22, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.t1, fontFamily: 'Fraunces, serif' }}>
              {currentTab === 'completed' ? 'Verified Project Archive' : 'Assigned Project Audit Queue'}
            </div>
            <span style={{ fontSize: 12, color: T.t3 }}>Showing {displayedProjects.length} restoration projects</span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.t3 }}>Loading projects for audit verification…</div>
          ) : displayedProjects.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.t3 }}>Zero projects found in this queue.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {displayedProjects.map((proj) => {
                const isVerified = proj.status === 'verified' || proj.status === 'active';
                return (
                  <div key={proj.id} style={{
                    padding: '18px 20px', borderRadius: 12,
                    background: 'var(--glass2, rgba(255,255,255,0.02))', border: `1px solid ${T.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TreePine size={22} color={T.emeraldL} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: T.t1 }}>{proj.name}</span>
                          <Badge type={isVerified ? 'teal' : proj.status === 'pending' ? 'gold' : 'muted'} label={proj.status || 'Draft'} />
                          {proj.country && <span style={{ fontSize: 12, color: T.t3 }}>({proj.country})</span>}
                        </div>
                      <div style={{ fontSize: 12, color: T.t3, marginTop: 4 }}>
                        Developer: <strong style={{ color: T.t2 }}>{proj.developer || proj.ngo_name || 'Amazonia Conservation'}</strong> · Total Credits: <strong>{Number(proj.total_credits || 0).toLocaleString()} tCO2e</strong> · Price: <strong>${proj.price || 28}/t</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Button variant="secondary" size="sm" onClick={() => { setScreeningProject(proj); setSelectedProject(null); }}>
                      <ShieldCheck size={13} style={{ marginRight: 6 }} /> Screening & Checks
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => { setSelectedProject(proj); setScreeningProject(null); }}>
                      <Eye size={13} style={{ marginRight: 6 }} /> Docs Gate
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => handleOpenAudit(proj)}>
                      <Award size={13} style={{ marginRight: 6 }} /> Audit Sign-Off
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Selected project Screening Pipeline Report */}
      {screeningProject && (
        <div style={{ marginTop: 24 }}>
          <ProjectScreeningReport
            projectId={screeningProject.project_id || screeningProject.id}
            projectName={screeningProject.name}
            canRerun={true}
            canExplain={true}
            canFeedback={true}
            onClose={() => setScreeningProject(null)}
          />
        </div>
      )}

      {/* Selected project details / document gate */}
      {selectedProject && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.t1, fontFamily: 'Fraunces, serif' }}>
              Project Integrity Inspection: {selectedProject.name}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelectedProject(null)}>Close Inspection</Button>
          </div>
          <ProjectDocumentGate projectId={selectedProject.id} canUpload={false} />
        </div>
      )}

      {/* Audit signoff modal */}
      {auditModal && selectedProject && (
        <Modal open={auditModal} onClose={() => setAuditModal(false)} title={`Independent Verification Sign-Off: ${selectedProject.name}`} width={620}>
          <div style={{ padding: '6px 0' }}>
            <div style={{
              padding: '14px 16px', borderRadius: 10, background: 'rgba(45,212,191,0.06)',
              border: `1px solid ${T.teal}`, marginBottom: 20
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.tealL }}>
                Accredited GHG Auditor Formal Determination
              </div>
              <div style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>
                Pursuant to platform rules and ISO 14064 standards, certifying this project permits carbon credit issuance to the public ledger.
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 8 }}>
                Verification Decision <span style={{ color: T.crimson }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{
                  padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${decision === 'verified' ? T.emerald : T.border}`,
                  background: decision === 'verified' ? 'rgba(16,185,129,0.1)' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <input
                    type="radio"
                    name="decision"
                    value="verified"
                    checked={decision === 'verified'}
                    onChange={() => setDecision('verified')}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.emeraldL }}>Accredited & Verified</div>
                    <div style={{ fontSize: 10, color: T.t3 }}>Meets additionality & MRV standards</div>
                  </div>
                </label>

                <label style={{
                  padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${decision === 'rejected' ? T.crimson : T.border}`,
                  background: decision === 'rejected' ? 'rgba(239,68,68,0.1)' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <input
                    type="radio"
                    name="decision"
                    value="rejected"
                    checked={decision === 'rejected'}
                    onChange={() => setDecision('rejected')}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.crimsonL }}>Reject / Revision Required</div>
                    <div style={{ fontSize: 10, color: T.t3 }}>Deficient MRV or unverified tenure</div>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 6 }}>
                Independent Auditor Summary & Findings
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Detail remote sensing validation, ground-truth sampling methodology, and additionality findings…"
                rows={4}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`,
                  color: T.t1, fontSize: 13, outline: 'none', resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 6 }}>
                Audit Report Permanent Reference / URL
              </label>
              <input
                type="text"
                value={reportUrl}
                onChange={(e) => setReportUrl(e.target.value)}
                placeholder="https://..."
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`,
                  color: T.t1, fontSize: 13, outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" onClick={() => setAuditModal(false)}>Cancel</Button>
              <Button variant={decision === 'verified' ? 'primary' : 'danger'} disabled={submitting} onClick={handleSubmitSignoff}>
                <Send size={14} style={{ marginRight: 6 }} />
                {submitting ? 'Submitting…' : `Submit Formal ${decision === 'verified' ? 'Verification' : 'Rejection'}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
