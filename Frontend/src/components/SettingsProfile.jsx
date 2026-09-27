import { useState } from 'react';
import { useApp } from '../AppContext.jsx';
import { Card, SectionHeader, Btn } from './UI.jsx';
import { User, Bell, Shield, Settings, LogOut } from 'lucide-react';

const inputStyle = { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'11px 14px', color:'#f1f5f9', fontSize:14, outline:'none', width:'100%', fontFamily:'Plus Jakarta Sans, sans-serif' };
const labelStyle = { fontSize:11, color:'#475569', fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:7, display:'block' };

const Toggle = ({ value, onChange, color='#2dd4bf' }) => (
  <div onClick={()=>onChange(!value)} style={{ width:46, height:26, borderRadius:13, background:value?`linear-gradient(135deg, ${color}, ${color}cc)`:'rgba(255,255,255,0.08)', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0, border:`1px solid ${value?color+'40':'rgba(255,255,255,0.1)'}` }}>
    <div style={{ position:'absolute', top:3, left:value?22:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 2px 4px rgba(0,0,0,0.3)' }} />
  </div>
);

export function SettingsPage() {
  const { user } = useApp();
  const [tab, setTab] = useState('account');
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  const tabs = [
    { id:'account', label:'Account', icon:User },
    { id:'notifications', label:'Notifications', icon:Bell },
    { id:'security', label:'Security', icon:Shield },
    { id:'preferences', label:'Preferences', icon:Settings },
  ];

  return (
    <div style={{ padding:28 }}>
      <SectionHeader title="Settings" subtitle="Manage your account and preferences" />
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
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#e8eaf6' }}>Dark Mode</div>
                  <div style={{ fontSize:12, color:'#475569' }}>Currently active</div>
                </div>
                <Toggle value={darkMode} onChange={setDarkMode} />
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
    </div>
  );
}

export function ProfilePage() {
  const { user, logout } = useApp();
  if (!user) return null;
  const roleColors = { admin:'#fbbf24', ngo:'#38bdf8', corporate:'#a78bfa' };
  const rc = roleColors[user.role] || '#2dd4bf';

  return (
    <div style={{ padding:28 }}>
      <SectionHeader title="Profile" />
      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20 }}>
        <Card style={{ textAlign:'center', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, transparent, ${rc}60, transparent)` }} />
          <div style={{ width:80, height:80, borderRadius:'50%', background:`${rc}14`, border:`2px solid ${rc}40`, display:'flex', alignItems:'center', justifyContent:'center', margin:'8px auto 18px' }}>
            <User size={34} color={rc} />
          </div>
          <div style={{ fontSize:19, fontWeight:800, color:'#f1f5f9', fontFamily:'Fraunces, serif', marginBottom:4 }}>{user.name}</div>
          <div style={{ fontSize:13, color:'#475569', marginBottom:12 }}>{user.org}</div>
          <div style={{ display:'inline-flex', background:`${rc}12`, border:`1px solid ${rc}30`, borderRadius:8, padding:'4px 12px', fontSize:11, fontWeight:700, color:rc, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:20 }}>{user.role}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button style={{ background:'rgba(45,212,191,0.08)', border:'1px solid rgba(45,212,191,0.2)', borderRadius:10, padding:10, color:'#2dd4bf', fontSize:13, cursor:'pointer', fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:600 }}>Edit Profile</button>
            <button onClick={logout} style={{ background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:10, padding:10, color:'#f87171', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:600 }}>
              <LogOut size={14}/> Logout
            </button>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Account Details" />
          {[
            { label:'Email', value:user.email },
            { label:'Organization', value:user.org },
            { label:'Role', value:user.role.toUpperCase() },
            { label:'Member Since', value:'June 2023' },
            { label:'Last Login', value:'Today, 2:34 AM' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', fontSize:13 }}>
              <span style={{ color:'#475569' }}>{label}</span>
              <span style={{ color:'#e8eaf6', fontWeight:500 }}>{value}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
