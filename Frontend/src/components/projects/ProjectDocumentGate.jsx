import { useState, useEffect } from 'react';
import { T, Button, Badge } from '../UI.jsx';
import {
  fetchProjectDocuments, uploadProjectDocument, fetchSubmissionReadiness
} from '../../services/api.js';
import {
  FileText, Upload, CheckCircle2, AlertCircle, Hash, Clock, FileCheck, ShieldAlert
} from 'lucide-react';

const REQUIRED_DOCS = [
  { type: 'land_proof', label: 'Land Tenure & Concession Deed', desc: 'Proof of land ownership, indigenous stewardship, or government concession rights.' },
  { type: 'methodology_reference', label: 'Methodology Framework', desc: 'Accredited standard methodology reference (e.g. VCS VM0007, Gold Standard, CDM AR-ACM0003).' },
  { type: 'monitoring_plan', label: 'MRV & Remote Sensing Plan', desc: 'Protocols for satellite NDVI tracking, field biometric measurement, and carbon sampling intervals.' },
  { type: 'baseline_notes', label: 'Baseline & Additionality Assessment', desc: 'Historical deforestation baseline, counterfactual modeling, and leakage buffer allocation.' },
];

async function computeSHA256(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function ProjectDocumentGate({ projectId, onReadinessChange, canUpload = true }) {
  const [docs, setDocs] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (projectId) {
      loadDocs();
    }
  }, [projectId]);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const [docsRes, readyRes] = await Promise.all([
        fetchProjectDocuments(projectId),
        fetchSubmissionReadiness(projectId),
      ]);
      setDocs(docsRes.data || []);
      setReadiness(readyRes.data || null);
      if (onReadinessChange) {
        onReadinessChange(readyRes.data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e, docType, label) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingType(docType);
    setMsg(null);
    try {
      const checksum = await computeSHA256(file);
      await uploadProjectDocument(projectId, file, docType, label);
      setMsg({ type: 'success', text: `Uploaded ${file.name} successfully (SHA-256: ${checksum.slice(0, 8)}…)` });
      loadDocs();
    } catch (err) {
      setMsg({ type: 'error', text: `Upload failed: ${err.message}` });
    } finally {
      setUploadingType(null);
    }
  };

  const docMap = {};
  docs.forEach((d) => {
    docMap[d.doc_type] = d;
  });

  const missingList = REQUIRED_DOCS.filter(r => !docMap[r.type]);
  const isComplete = missingList.length === 0;

  return (
    <div style={{ background: 'var(--surface-card, rgba(14,18,27,0.8))', border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.t1, fontFamily: 'Fraunces, serif' }}>
            Four-Document Project Integrity Gate
          </div>
          <div style={{ fontSize: 12, color: T.t3, marginTop: 2 }}>
            Mandatory legal and scientific documentation required before project can be submitted for verification.
          </div>
        </div>
        <Badge
          type={isComplete ? 'teal' : 'danger'}
          label={isComplete ? '4 of 4 Verified' : `${missingList.length} Missing`}
        />
      </div>

      {/* Gate blocker banner */}
      {!isComplete ? (
        <div style={{
          padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)',
          border: `1px solid ${T.crimson}`, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12
        }}>
          <ShieldAlert size={22} color={T.crimsonL} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.crimsonL }}>
              Project Submission Blocked: Incomplete Documentation
            </div>
            <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>
              The &quot;Submit for Review&quot; action is locked until all four required audit documents are uploaded with cryptographic checksums:
              <strong style={{ color: T.t2, marginLeft: 4 }}>
                {missingList.map(m => m.label).join(', ')}
              </strong>.
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          padding: '12px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.08)',
          border: `1px solid ${T.emerald}`, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12
        }}>
          <CheckCircle2 size={22} color={T.emeraldL} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.emeraldL }}>
              Gate Passed: All 4 Required Documents Validated
            </div>
            <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>
              Cryptographic SHA-256 checksums recorded on audit ledger. Project is cleared for Accredited Verifier inspection.
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: 12,
          background: msg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${msg.type === 'success' ? T.emerald : T.crimson}`,
          color: msg.type === 'success' ? T.emeraldL : T.crimsonL,
        }}>
          {msg.text}
        </div>
      )}

      {/* Grid of 4 documents */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {REQUIRED_DOCS.map((docDef) => {
          const doc = docMap[docDef.type];
          const hasDoc = !!doc;
          return (
            <div key={docDef.type} style={{
              padding: 16, borderRadius: 10,
              background: hasDoc ? 'rgba(45,212,191,0.03)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${hasDoc ? 'rgba(45,212,191,0.3)' : T.border}`,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {hasDoc ? <FileCheck size={18} color={T.tealL} /> : <FileText size={18} color={T.t4} />}
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>{docDef.label}</span>
                  </div>
                  <Badge type={hasDoc ? 'teal' : 'danger'} label={hasDoc ? `v${doc.version || 1}` : 'Missing'} />
                </div>
                <div style={{ fontSize: 11, color: T.t3, lineHeight: 1.4, marginBottom: 12 }}>
                  {docDef.desc}
                </div>
              </div>

              {hasDoc ? (
                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: 6, fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.tealL, fontFamily: 'monospace' }}>
                    <Hash size={12} />
                    <span title={doc.checksum_sha256}>
                      SHA-256: {doc.checksum_sha256 ? `${doc.checksum_sha256.slice(0, 12)}…` : 'Recorded'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.t4, marginTop: 4 }}>
                    <Clock size={11} />
                    <span>Uploaded {new Date(doc.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
                </div>
              ) : (
                canUpload && (
                  <label style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 6, border: `1px dashed ${T.border2}`,
                    background: 'var(--glass2, rgba(255,255,255,0.04))', cursor: 'pointer',
                    fontSize: 12, color: T.t2, transition: 'all 0.15s'
                  }}>
                    <Upload size={14} color={T.tealL} />
                    <span>{uploadingType === docDef.type ? 'Hashing & Uploading…' : 'Upload Document'}</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      style={{ display: 'none' }}
                      disabled={uploadingType === docDef.type}
                      onChange={(e) => handleFileUpload(e, docDef.type, docDef.label)}
                    />
                  </label>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
