import { useState, useEffect } from 'react';
import { useApp } from '../AppContext.jsx';
import { Card, SectionHeader, Btn, T, Button, Badge, Modal } from './UI.jsx';
import { User, Bell, Shield, Settings, LogOut, Download, Trash2, Building2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { exportUserData, requestAccountDeletion, fetchOrgProfile } from '../services/api.js';
import { OnboardingKYCModal } from './onboarding/OnboardingKYC.jsx';

const inputStyle = { background:'var(--input-bg, rgba(255,255,255,0.04))', border:`1px solid ${T.border}`, borderRadius:10, padding:'11px 14px', color:T.t1, fontSize:14, outline:'none', width:'100%', fontFamily:'Plus Jakarta Sans, sans-serif' };
const labelStyle = { fontSize:11, color:T.t3, fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:7, display:'block' };

const Toggle = ({ value, onChange, color=T.teal }) => (
  <div onClick={()=>onChange(!value)} style={{ width:46, height:26, borderRadius:13, background:value?`linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 80%, transparent))`:'var(--border2, rgba(255,255,255,0.08))', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0, border:`1px solid ${value?color:'var(--border)'}` }}>
    <div style={{ position:'absolute', top:3, left:value?22:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 2px 4px rgba(0,0,0,0.3)' }} />
  </div>
);

export function SettingsPage() {
  const { user, theme, setTheme, logout } = useApp();
  const [tab, setTab] = useState('account');
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);
  const [kycModal, setKycModal] = useState(false);
  const [orgProfile, setOrgProfile] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    loadOrg();
  }, []);

  const loadOrg = async () => {
    try {
      const res = await fetchOrgProfile();
      if (res.data) setOrgProfile(res.data);
    } catch {}
  };

  const handleExportData = async () => {
    setExportLoading(true);
    setMsg(null);
    try {
      const res = await exportUserData();
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data || res, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `carbonvault_user_data_${user?.email || 'account'}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setMsg({ type: 'success', text: 'Personal and audit data archive successfully downloaded.' });
    } catch (err) {
      setMsg({ type: 'error', text: `Failed to export data: ${err.message}` });
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteRequest = async () => {
    setDeleteLoading(true);
    try {
      await requestAccountDeletion(deleteReason);
      setDeleteModal(false);
      alert('Account deletion request submitted. An administrator will review your data erasure pursuant to GDPR / CCPA within 30 days.');
      logout();
    } catch (err) {
      alert(`Deletion request failed: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const tabs = [
    { id:'account', label:'Account', icon:User },
    { id:'kyc', label:'Organisation KYC', icon:Building2 },
    { id:'privacy', label:'Data & Privacy', icon:Download },
    { id:'notifications', label:'Notifications', icon:Bell },
    { id:'security', label:'Security', icon:Shield },
    { id:'preferences', label:'Preferences', icon:Settings },
  ];

  const kycStatus = orgProfile?.kyc_status || 'not_started';

  return (
    <div style={{ padding:28 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, fontFamily: 'Fraunces, serif', margin: 0 }}>
          Account & Organisation Settings
        </h1>
        <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>
          Manage your account, organisation compliance, and privacy preferences
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
          background: msg.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${msg.type === 'success' ? T.emerald : T.crimson}`,
          color: msg.type === 'success' ? T.emeraldL : T.crimsonL
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'210px 1fr', gap:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {tabs.map(({ id, label, icon:Icon }) => (
            <button key={id} onClick={()=>setTab(id)}
              style={{ background:tab===id?'rgba(45,212,191,0.08)':'transparent', border:`1px solid ${tab===id?'rgba(45,212,191,0.25)':'transparent'}`, borderRadius:10, padding:'10px 14px', color:tab===id?'#2dd4bf':'#475569', fontSize:13, fontWeight:tab===id?600:400, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:8, fontFamily:'Plus Jakarta Sans, sans-serif', transition:'all 0.15s', borderLeft:`2px solid ${tab===id?'#2dd4bf':'transparent'}` }}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <Card>
          {tab==='account' && (
            <div>
              <SectionHeader title="Account Information" />
              {[
                { label:'Full Name', def:user?.name },
                { label:'Email Address', def:user?.email },
                { label:'Organization', def:user?.org },
              ].map(({ label, def }) => (
                <div key={label} style={{ marginBottom:16 }}>
                  <label style={labelStyle}>{label}</label>
                  <input defaultValue={def} style={inputStyle} />
                </div>
              ))}
              <Btn>Save Changes</Btn>
            </div>
          )}

          {tab==='kyc' && (
            <div>
              <SectionHeader title="Organisation KYC-Lite & Legal Identity" />
              <div style={{
                padding: '16px 18px', borderRadius: 10, marginBottom: 20,
                background: kycStatus === 'verified' ? 'rgba(16,185,129,0.08)' : kycStatus === 'pending' ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${kycStatus === 'verified' ? T.emerald : kycStatus === 'pending' ? T.gold : T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Building2 size={26} color={kycStatus === 'verified' ? T.emeraldL : T.goldL} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: T.t1 }}>
                      Legal Entity: {orgProfile?.legal_name || user?.org || 'Not Configured'}
                    </div>
                    <div style={{ fontSize: 12, color: T.t3, marginTop: 2 }}>
                      Registration: <strong>{orgProfile?.registration_number || 'Missing Tax / Reg ID'}</strong> · Country: {orgProfile?.country || 'Unspecified'}
                    </div>
                  </div>
                </div>
                <Badge type={kycStatus === 'verified' ? 'teal' : kycStatus === 'pending' ? 'gold' : 'danger'} label={kycStatus} />
              </div>

              <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.5, marginBottom: 18 }}>
                To comply with international anti-money laundering and carbon credit verification standards, all participating NGOs and Corporate Buyers must undergo KYC verification.
              </div>

              <Button variant="primary" onClick={() => setKycModal(true)}>
                <Building2 size={14} style={{ marginRight: 6 }} />
                {kycStatus === 'verified' ? 'View Registered Credentials' : 'Submit / Update KYC Credentials'}
              </Button>
            </div>
          )}

          {tab==='privacy' && (
            <div>
              <SectionHeader title="Data Privacy, Export & Account Lifecycle" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: 18, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.t1 }}>Export Account Data Archive</div>
                    <div style={{ fontSize: 12, color: T.t3, marginTop: 4 }}>
                      Download a machine-readable JSON archive of your personal profile, transactions, audit logs, and project holdings.
                    </div>
                  </div>
                  <Button variant="secondary" disabled={exportLoading} onClick={handleExportData}>
                    <Download size={14} style={{ marginRight: 6 }} />
                    {exportLoading ? 'Packaging…' : 'Export My Data'}
                  </Button>
                </div>

                <div style={{ padding: 18, borderRadius: 10, background: 'rgba(239,68,68,0.04)', border: `1px solid rgba(239,68,68,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.crimsonL }}>Request Permanent Account Deletion</div>
                    <div style={{ fontSize: 12, color: T.t3, marginTop: 4 }}>
                      Submits an erasure request under GDPR Right to Be Forgotten. Disables active access and schedules cryptographic purging.
                    </div>
                  </div>
                  <Button variant="danger" onClick={() => setDeleteModal(true)}>
                    <Trash2 size={14} style={{ marginRight: 6 }} /> Request Deletion
                  </Button>
                </div>
              </div>
            </div>
          )}

          {tab==='notifications' && (
            <div>
              <SectionHeader title="Notification Preferences" />
              {[
                { label:'Email Notifications', desc:'Receive alerts via email', value:emailNotifs, set:setEmailNotifs, color:'#2dd4bf' },
                { label:'SMS Notifications', desc:'Receive alerts via SMS', value:smsNotifs, set:setSmsNotifs, color:'#2dd4bf' },
              ].map(({ label, desc, value, set, color }) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'#e8eaf6' }}>{label}</div>
                    <div style={{ fontSize:12, color:'#475569', marginTop:2 }}>{desc}</div>
                  </div>
                  <Toggle value={value} onChange={set} color={color} />
                </div>
              ))}
            </div>
          )}

          {tab==='security' && (
            <div>
              <SectionHeader title="Security Settings" />
              {['Current Password','New Password'].map(l=>(
                <div key={l} style={{ marginBottom:16 }}>
                  <label style={labelStyle}>{l}</label>
                  <input type="password" style={inputStyle} />
                </div>
              ))}
              {user?.role==='admin' && (
                <div style={{ marginBottom:16 }}>
                  <label style={labelStyle}>Fraud Detection API Key</label>
                  <input type="password" placeholder="sk-fraud-••••••••••••" style={inputStyle} />
                </div>
              )}
              <Btn>Update Security</Btn>
            </div>
          )}

          {tab==='preferences' && (
            <div>
              <SectionHeader title="Preferences" />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 0', borderBottom:`1px solid ${T.border}` }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:T.t1 }}>Dark Mode</div>
                  <div style={{ fontSize:12, color:T.t3 }}>{theme === 'dark' ? 'Currently active (Dark Theme)' : 'Currently inactive (Light Theme)'}</div>
                </div>
                <Toggle value={theme === 'dark'} onChange={val => setTheme(val ? 'dark' : 'light')} />
              </div>
              <div style={{ marginTop:16 }}>
                <label style={labelStyle}>Language</label>
                <select style={{ ...inputStyle, cursor:'pointer' }}>
                  <option>English</option><option>Portuguese</option><option>Hindi</option>
                </select>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* KYC Modal */}
      <OnboardingKYCModal open={kycModal} onClose={() => setKycModal(false)} onComplete={() => { setKycModal(false); loadOrg(); }} />

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <Modal open={deleteModal} onClose={() => setDeleteModal(false)} title="Confirm Account Deletion Request" width={480}>
          <div style={{ padding: '6px 0' }}>
            <div style={{ padding: 14, borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: `1px solid ${T.crimson}`, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.crimsonL }}>Permanent Action</div>
              <div style={{ fontSize: 11, color: T.t3, marginTop: 4 }}>
                Requesting account erasure will initiate a compliance review. You will be logged out immediately.
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.t2, textTransform: 'uppercase', marginBottom: 6 }}>
                Reason for Leaving (Optional)
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Help us understand why you are closing your account…"
                rows={3}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`,
                  color: T.t1, fontSize: 13, outline: 'none', resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" onClick={() => setDeleteModal(false)}>Cancel</Button>
              <Button variant="danger" disabled={deleteLoading} onClick={handleDeleteRequest}>
                {deleteLoading ? 'Submitting…' : 'Submit Deletion Request'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function ProfilePage() {
  const { user, logout } = useApp();
  const [kycModal, setKycModal] = useState(false);
  const [orgProfile, setOrgProfile] = useState(null);

  useEffect(() => {
    fetchOrgProfile().then(res => { if (res.data) setOrgProfile(res.data); }).catch(() => {});
  }, []);

  if (!user) return null;
  const roleColors = { admin:T.goldL, ngo:T.skyL, corporate:T.violetLL, verifier:T.tealL };
  const rc = roleColors[user.role] || T.teal;
  const kycStatus = orgProfile?.kyc_status || 'not_started';

  return (
    <div style={{ padding:28 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: T.t1, fontFamily: 'Fraunces, serif', margin: 0 }}>
          {user?.role === 'verifier' ? 'Verifier Accreditation Profile' : 'Profile & Entity Identity'}
        </h1>
        <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>
          {user?.role === 'verifier' ? 'ISO 14064-3 Accreditation credentials and auditor authorization' : 'Personal account details and organization affiliation'}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20 }}>
        <Card style={{ textAlign:'center', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, transparent, ${rc}, transparent)` }} />
          <div style={{ width:80, height:80, borderRadius:'50%', background:`color-mix(in srgb, ${rc} 14%, transparent)`, border:`2px solid color-mix(in srgb, ${rc} 40%, transparent)`, display:'flex', alignItems:'center', justifyContent:'center', margin:'8px auto 18px' }}>
            <User size={34} color={rc} />
          </div>
          <div style={{ fontSize:19, fontWeight:800, color:T.t1, fontFamily:'Fraunces, serif', marginBottom:4 }}>{user.name}</div>
          <div style={{ fontSize:13, color:T.t3, marginBottom:12 }}>{user.org}</div>
          <div style={{ display:'inline-flex', background:`color-mix(in srgb, ${rc} 14%, transparent)`, border:`1px solid color-mix(in srgb, ${rc} 30%, transparent)`, borderRadius:8, padding:'4px 12px', fontSize:11, fontWeight:700, color:rc, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:14 }}>{user.role}</div>

          <div style={{ marginBottom: 18 }}>
            <Badge type={kycStatus === 'verified' ? 'teal' : kycStatus === 'pending' ? 'gold' : 'muted'} label={`KYC: ${kycStatus}`} />
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={() => setKycModal(true)} style={{ background:'color-mix(in srgb, var(--teal) 10%, transparent)', border:`1px solid color-mix(in srgb, var(--teal) 25%, transparent)`, borderRadius:10, padding:10, color:T.teal, fontSize:13, cursor:'pointer', fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:600 }}>
              KYC Credentials
            </button>
            <button onClick={logout} style={{ background:'color-mix(in srgb, var(--rose) 10%, transparent)', border:`1px solid color-mix(in srgb, var(--rose) 25%, transparent)`, borderRadius:10, padding:10, color:T.roseL, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:600 }}>
              <LogOut size={14}/> Logout
            </button>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Account Details" />
          {[
            { label:'Email', value:user.email },
            { label:'Legal Organization', value:orgProfile?.legal_name || user.org },
            { label:'Entity Registration', value:orgProfile?.registration_number || 'Pending Submission' },
            { label:'Jurisdiction', value:orgProfile?.country || 'International' },
            { label:'Role Designation', value:user.role.toUpperCase() },
            { label:'KYC Compliance', value:kycStatus.toUpperCase() },
            { label:'Member Since', value:'June 2023' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
              <span style={{ color:T.t3 }}>{label}</span>
              <span style={{ color:T.t1, fontWeight:500 }}>{value}</span>
            </div>
          ))}
        </Card>
      </div>

      <OnboardingKYCModal open={kycModal} onClose={() => setKycModal(false)} />
    </div>
  );
}

