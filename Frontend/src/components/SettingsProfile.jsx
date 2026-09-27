import { useState } from 'react';
import { useApp } from '../AppContext.jsx';
import { Card, SectionHeader, Btn, T } from './UI.jsx';
import { User, Bell, Shield, Settings, LogOut } from 'lucide-react';

const inputStyle = { background:'var(--input-bg, rgba(255,255,255,0.04))', border:`1px solid ${T.border}`, borderRadius:10, padding:'11px 14px', color:T.t1, fontSize:14, outline:'none', width:'100%', fontFamily:'Plus Jakarta Sans, sans-serif' };
const labelStyle = { fontSize:11, color:T.t3, fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:7, display:'block' };

const Toggle = ({ value, onChange, color=T.teal }) => (
  <div onClick={()=>onChange(!value)} style={{ width:46, height:26, borderRadius:13, background:value?`linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 80%, transparent))`:'var(--border2, rgba(255,255,255,0.08))', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0, border:`1px solid ${value?color:'var(--border)'}` }}>
    <div style={{ position:'absolute', top:3, left:value?22:3, width:18, height:18, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 2px 4px rgba(0,0,0,0.3)' }} />
  </div>
);

export function SettingsPage() {
  const { user, theme, setTheme } = useApp();
  const [tab, setTab] = useState('account');
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);

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
    </div>
  );
}

export function ProfilePage() {
  const { user, logout } = useApp();
  if (!user) return null;
  const roleColors = { admin:T.goldL, ngo:T.skyL, corporate:T.violetLL };
  const rc = roleColors[user.role] || T.teal;

  return (
    <div style={{ padding:28 }}>
      <SectionHeader title="Profile" />
      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20 }}>
        <Card style={{ textAlign:'center', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, transparent, ${rc}, transparent)` }} />
          <div style={{ width:80, height:80, borderRadius:'50%', background:`color-mix(in srgb, ${rc} 14%, transparent)`, border:`2px solid color-mix(in srgb, ${rc} 40%, transparent)`, display:'flex', alignItems:'center', justifyContent:'center', margin:'8px auto 18px' }}>
            <User size={34} color={rc} />
          </div>
          <div style={{ fontSize:19, fontWeight:800, color:T.t1, fontFamily:'Fraunces, serif', marginBottom:4 }}>{user.name}</div>
          <div style={{ fontSize:13, color:T.t3, marginBottom:12 }}>{user.org}</div>
          <div style={{ display:'inline-flex', background:`color-mix(in srgb, ${rc} 12%, transparent)`, border:`1px solid color-mix(in srgb, ${rc} 30%, transparent)`, borderRadius:8, padding:'4px 12px', fontSize:11, fontWeight:700, color:rc, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:20 }}>{user.role}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button style={{ background:'color-mix(in srgb, var(--teal) 10%, transparent)', border:`1px solid color-mix(in srgb, var(--teal) 25%, transparent)`, borderRadius:10, padding:10, color:T.teal, fontSize:13, cursor:'pointer', fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:600 }}>Edit Profile</button>
            <button onClick={logout} style={{ background:'color-mix(in srgb, var(--rose) 10%, transparent)', border:`1px solid color-mix(in srgb, var(--rose) 25%, transparent)`, borderRadius:10, padding:10, color:T.roseL, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:600 }}>
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
            <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
              <span style={{ color:T.t3 }}>{label}</span>
              <span style={{ color:T.t1, fontWeight:500 }}>{value}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
