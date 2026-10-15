import { useState, useEffect } from 'react';
import { useApp } from '../../AppContext.jsx';
import { T, Modal, Button, Badge } from '../UI.jsx';
import {
  submitOrgProfile, fetchOrgProfile, fetchPendingKycProfiles, reviewKycProfile
} from '../../services/api.js';
import { ShieldCheck, Building2, AlertTriangle, CheckCircle, Clock, XCircle, FileText, Send } from 'lucide-react';

export function OnboardingKYCModal({ open, onClose, onComplete }) {
  const { user } = useApp();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    legal_name: '',
    registration_number: '',
    country: 'India',
    org_type: user?.role === 'ngo' ? 'ngo' : 'corporate',
  });
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (open) {
      loadProfile();
    }
  }, [open]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await fetchOrgProfile();
      if (res.data) {
        setProfile(res.data);
        setFormData({
          legal_name: res.data.legal_name || '',
          registration_number: res.data.registration_number || '',
          country: res.data.country || 'India',
          org_type: res.data.org_type || (user?.role === 'ngo' ? 'ngo' : 'corporate'),
        });
      }
    } catch {
      // Profile not created yet
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.legal_name.trim() || !formData.registration_number.trim()) {
      setErrorMsg('Legal organisation name and registration number are required.');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      const res = await submitOrgProfile(formData);
      setSuccessMsg('Organisation KYC submitted successfully. Under compliance review.');
      if (res.data?.profile) setProfile(res.data.profile);
      if (onComplete) onComplete(res.data?.profile);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit KYC details.');
    } finally {
      setLoading(false);
    }
  };

  const status = profile?.kyc_status || 'not_started';

  return (
    <Modal open={open} onClose={onClose} title="Organisation Identity & KYC-Lite" width={560}>
      <div style={{ padding: '4px 0' }}>
        {/* Status banner */}
        <div style={{
          padding: '14px 16px', borderRadius: 10, marginBottom: 20,
          background: status === 'verified' ? 'rgba(16,185,129,0.08)' : status === 'pending' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${status === 'verified' ? T.emerald : status === 'pending' ? T.gold : T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {status === 'verified' ? <CheckCircle size={22} color={T.emeraldL} /> :
             status === 'pending' ? <Clock size={22} color={T.goldL} /> :
             <AlertTriangle size={22} color={T.t3} />}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>
                KYC Verification Status: <span style={{ textTransform: 'uppercase', color: status === 'verified' ? T.emeraldL : status === 'pending' ? T.goldL : T.t2 }}>{status.replace('_', ' ')}</span>
              </div>
              <div style={{ fontSize: 11, color: T.t3, marginTop: 2 }}>
                {status === 'verified' ? 'Organisation identity is officially accredited for credit issuance & trading.' :
                 status === 'pending' ? 'Identity verification under review by platform compliance administrators.' :
                 'Please register legal entity credentials to unlock project submission and credits trading.'}
              </div>
            </div>
          </div>
          <Badge type={status === 'verified' ? 'teal' : status === 'pending' ? 'gold' : 'muted'} label={status} />
        </div>

        {successMsg && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.12)', border: `1px solid ${T.emerald}`, color: T.emeraldL, fontSize: 12, marginBottom: 16 }}>
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: `1px solid ${T.crimson}`, color: T.crimsonL, fontSize: 12, marginBottom: 16 }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 6 }}>
              Legal Entity Name <span style={{ color: T.crimson }}>*</span>
            </label>
            <input
              type="text"
              value={formData.legal_name}
              onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
              placeholder="e.g. Amazonia Bio-Resilience Institute Ltda"
              disabled={status === 'verified'}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`,
                color: T.t1, fontSize: 13, outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 6 }}>
                Registration / Tax ID <span style={{ color: T.crimson }}>*</span>
              </label>
              <input
                type="text"
                value={formData.registration_number}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                placeholder="e.g. CNPJ 12.345.678/0001-90"
                disabled={status === 'verified'}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`,
                  color: T.t1, fontSize: 13, outline: 'none'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 6 }}>
                Country of Jurisdiction
              </label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="e.g. Brazil, India, Kenya"
                disabled={status === 'verified'}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`,
                  color: T.t1, fontSize: 13, outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 6 }}>
              Organisation Type
            </label>
            <select
              value={formData.org_type}
              onChange={(e) => setFormData({ ...formData, org_type: e.target.value })}
              disabled={status === 'verified'}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`,
                color: T.t1, fontSize: 13, outline: 'none'
              }}
            >
              <option value="ngo">NGO / Project Developer (Restoration Entity)</option>
              <option value="corporate">Corporate Enterprise (Carbon Buyer)</option>
              <option value="verifier">Accredited GHG Verifier / Auditor</option>
            </select>
          </div>

          {status !== 'verified' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
              <Button variant="primary" type="submit" disabled={loading}>
                <Send size={14} style={{ marginRight: 6 }} />
                {loading ? 'Submitting…' : status === 'pending' ? 'Update & Re-Submit' : 'Submit for KYC Approval'}
              </Button>
            </div>
          )}
        </form>
      </div>
    </Modal>
  );
}

export function AdminKYCReviewQueue() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    setLoading(true);
    try {
      const res = await fetchPendingKycProfiles();
      setProfiles(res.data || []);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (decision) => {
    if (!selectedProfile) return;
    setActionLoading(true);
    try {
      await reviewKycProfile(selectedProfile.id, decision, reviewNotes);
      setMsg(`Organisation KYC marked as ${decision}.`);
      setSelectedProfile(null);
      setReviewNotes('');
      loadPending();
    } catch (err) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ background: 'var(--surface-card, rgba(14,18,27,0.8))', border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.t1, fontFamily: 'Fraunces, serif' }}>
            Organisation KYC Compliance Queue
          </div>
          <div style={{ fontSize: 12, color: T.t3, marginTop: 2 }}>
            Review legal corporate registrations and restore NGO transparency certificates before project approval.
          </div>
        </div>
        <Badge type="gold" label={`${profiles.length} Pending Review`} />
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(45,212,191,0.1)', border: `1px solid ${T.teal}`, color: T.tealL, fontSize: 12, marginBottom: 14 }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 30, textAlign: 'center', color: T.t3, fontSize: 13 }}>Loading pending KYC applications…</div>
      ) : profiles.length === 0 ? (
        <div style={{ padding: 36, textAlign: 'center', color: T.t3, fontSize: 13, border: `1px dashed ${T.border}`, borderRadius: 10 }}>
          <CheckCircle size={32} color={T.emeraldL} style={{ margin: '0 auto 8px' }} />
          Zero organisations currently pending KYC verification. All entities are compliant.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profiles.map((p) => (
            <div key={p.id} style={{
              padding: '14px 16px', borderRadius: 10, background: 'var(--glass2, rgba(255,255,255,0.03))',
              border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Building2 size={24} color={T.tealL} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>{p.legal_name}</div>
                  <div style={{ fontSize: 12, color: T.t3, marginTop: 2 }}>
                    Reg: <strong style={{ color: T.t2 }}>{p.registration_number}</strong> · Country: {p.country} · Type: <span style={{ textTransform: 'uppercase' }}>{p.org_type}</span>
                  </div>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setSelectedProfile(p)}>
                Review Application
              </Button>
            </div>
          ))}
        </div>
      )}

      {selectedProfile && (
        <Modal open={!!selectedProfile} onClose={() => setSelectedProfile(null)} title={`Review KYC: ${selectedProfile.legal_name}`} width={520}>
          <div style={{ padding: '6px 0' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 8, border: `1px solid ${T.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: T.t3 }}>Entity Registration Number:</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.t1, marginTop: 2 }}>{selectedProfile.registration_number}</div>
              <div style={{ fontSize: 12, color: T.t3, marginTop: 8 }}>Country / Jurisdiction:</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.t1 }}>{selectedProfile.country}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 6 }}>
                Compliance Officer Notes
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Enter verification notes or registry reference ID…"
                rows={3}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`,
                  color: T.t1, fontSize: 13, outline: 'none', resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="danger" disabled={actionLoading} onClick={() => handleDecision('rejected')}>
                <XCircle size={14} style={{ marginRight: 6 }} /> Reject KYC
              </Button>
              <Button variant="primary" disabled={actionLoading} onClick={() => handleDecision('verified')}>
                <CheckCircle size={14} style={{ marginRight: 6 }} /> Approve & Verify Organisation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
