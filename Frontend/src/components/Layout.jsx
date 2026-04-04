import { useState } from 'react';
import { useApp } from '../AppContext.jsx';
import { mockNotifications } from '../data/mockData.js';
import { T, gc } from './UI.jsx';
import {
  Leaf, Bell, Settings, User, LogOut, ChevronRight, X, Menu,
  LayoutDashboard, Users, FolderCheck, DollarSign, BarChart3,
  Map, Upload, ShieldCheck, TreePine, ShoppingCart,
  Wallet, FileText, Star, Globe, Trophy, FileSearch, Award, Plus,
  Activity, TrendingUp, Layers
} from 'lucide-react';

const adminNav = [
  {id:'dashboard',label:'Dashboard',icon:LayoutDashboard},
  {id:'users',label:'User Management',icon:Users},
  {id:'approvals',label:'Project Approvals',icon:FolderCheck},
  {id:'pricing',label:'Pricing Engine',icon:DollarSign},
  {id:'analytics',label:'Analytics',icon:BarChart3},
];
const ngoNav = [
  {id:'dashboard',      label:'Dashboard',        icon:LayoutDashboard},
  {id:'projects',       label:'My Projects',      icon:TreePine},
  {id:'new_project',    label:'New Project',       icon:Plus},
  {id:'site_suitability',label:'Site Suitability', icon:Map},
  {id:'ngo_marketplace',label:'Marketplace',       icon:ShoppingCart},
];
const corporateNav = [
  {id:'dashboard',   label:'Dashboard',   icon:LayoutDashboard},
  {id:'marketplace', label:'Marketplace', icon:ShoppingCart},
  {id:'wallet',      label:'My Wallet',   icon:Wallet},
  {id:'esg',         label:'ESG Reports', icon:FileText},
];
const navMap = {admin:adminNav, ngo:ngoNav, corporate:corporateNav};

const RC = {
  admin:     {color:T.goldL,    bg:'rgba(245,158,11,0.1)',   border:'rgba(251,191,36,0.22)',   label:'Administrator'},
  ngo:       {color:T.skyL,     bg:'rgba(56,189,248,0.1)',   border:'rgba(56,189,248,0.22)',   label:'NGO Organization'},
  corporate: {color:T.violetLL, bg:'rgba(167,139,250,0.1)',  border:'rgba(167,139,250,0.22)',  label:'Corporate Buyer'},
};

export function Sidebar() {
  const {user,page,setPage,sidebarOpen,setSidebarOpen} = useApp();
  if (!user) return null;
  const nav = navMap[user.role]||[];
  const rc = RC[user.role] || RC.admin;

  return (
    <div style={{
      width:sidebarOpen?252:0, minHeight:'100vh',
      background:'rgba(4,5,8,0.96)', backdropFilter:'blur(24px)',
      borderRight:`1px solid ${T.border}`,
      display:'flex', flexDirection:'column',
      overflow:'hidden', transition:'width 0.28s cubic-bezier(0.4,0,0.2,1)', flexShrink:0,
      position:'relative',
    }}>
      {/* Top accent line */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg, transparent, ${rc.color}50, transparent)`}}/>

      {/* Logo */}
      <div style={{padding:'20px 18px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,background:`linear-gradient(135deg, ${T.teal}, ${T.tealDD})`,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 4px 16px rgba(45,212,191,0.35), inset 0 1px 0 rgba(255,255,255,0.2)`}}>
            <Leaf size={16} color="#021a17" strokeWidth={2.5}/>
          </div>
          <div>
            <div style={{fontFamily:'Fraunces, serif',fontWeight:900,fontSize:17,color:T.t1,letterSpacing:'-0.3px',whiteSpace:'nowrap'}}>CarbonVault</div>
            <div style={{fontSize:9,color:T.teal,fontWeight:700,letterSpacing:'1.5px',textTransform:'uppercase',marginTop:0}}>Carbon Intelligence</div>
          </div>
        </div>
        <button onClick={()=>setSidebarOpen(false)} style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${T.border}`,color:T.t3,cursor:'pointer',width:26,height:26,borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=T.border2}
          onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
          <X size={13}/>
        </button>
      </div>

      {/* Role pill */}
      <div style={{padding:'13px 14px',borderBottom:`1px solid rgba(255,255,255,0.04)`}}>
        <div style={{background:rc.bg,border:`1px solid ${rc.border}`,borderRadius:10,padding:'9px 13px'}}>
          <div style={{fontSize:9,color:`${rc.color}99`,fontWeight:800,letterSpacing:'1px',textTransform:'uppercase'}}>{rc.label}</div>
          <div style={{fontSize:13,color:T.t1,fontWeight:600,marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{user.org}</div>
        </div>
      </div>

      {/* Nav items */}
      <nav style={{flex:1,padding:'8px 10px',overflowY:'auto'}}>
        <div style={{fontSize:9,color:T.t4,fontWeight:800,letterSpacing:'1px',textTransform:'uppercase',padding:'8px 10px 5px'}}>Menu</div>
        {nav.map(({id,label,icon:Icon})=>{
          const active = page===id;
          return (
            <button key={id} onClick={()=>setPage(id)} style={{
              width:'100%',display:'flex',alignItems:'center',gap:9,padding:'9px 11px',
              borderRadius:9,marginBottom:1,border:'none',cursor:'pointer',textAlign:'left',
              background:active?`${rc.color}12`:'transparent',
              color:active?rc.color:T.t3,
              fontWeight:active?600:400,fontSize:13,
              transition:'all 0.14s',whiteSpace:'nowrap',
              fontFamily:'Plus Jakarta Sans, sans-serif',
              borderLeft:`2px solid ${active?rc.color:'transparent'}`,
            }}
            onMouseEnter={e=>{if(!active){e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.color=T.t2;}}}
            onMouseLeave={e=>{if(!active){e.currentTarget.style.background='transparent';e.currentTarget.style.color=T.t3;}}}>
              <Icon size={14}/>
              <span style={{flex:1}}>{label}</span>
              {active && <ChevronRight size={12} style={{opacity:0.5}}/>}
            </button>
          );
        })}
      </nav>

      {/* User card */}
      <div style={{padding:'12px 14px',borderTop:`1px solid rgba(255,255,255,0.04)`}}>
        <div style={{display:'flex',alignItems:'center',gap:9,padding:10,borderRadius:10,background:'rgba(255,255,255,0.03)',border:`1px solid ${T.border}`}}>
          <div style={{width:30,height:30,borderRadius:'50%',background:`${rc.color}1a`,border:`1px solid ${rc.color}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <User size={13} color={rc.color}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,color:T.t1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{user.name}</div>
            <div style={{fontSize:10,color:T.t3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{user.email}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Navbar() {
  const {user,page,setPage,setNotifOpen,sidebarOpen,setSidebarOpen,logout} = useApp();
  const [menuOpen,setMenuOpen] = useState(false);
  if (!user) return null;
  const unread = mockNotifications.filter(n=>!n.read).length;
  const rc = RC[user.role] || RC.admin;
  const pageTitle = (navMap[user.role]||[]).find(n=>n.id===page)?.label || (page==='settings'?'Settings':page==='profile'?'Profile':'Dashboard');

  const iconBtn = (onClick, children) => (
    <button onClick={onClick} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${T.border}`,borderRadius:9,padding:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=`rgba(45,212,191,0.35)`;e.currentTarget.style.background='rgba(45,212,191,0.06)';}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background='rgba(255,255,255,0.04)';}}>
      {children}
    </button>
  );

  return (
    <div style={{height:58,background:'rgba(4,5,8,0.9)',backdropFilter:'blur(20px)',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',padding:'0 20px',gap:10,position:'sticky',top:0,zIndex:100}}>
      {!sidebarOpen && iconBtn(()=>setSidebarOpen(true), <Menu size={15} color={T.teal}/>)}

      <div style={{flex:1,display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:12,color:T.t3}}>{rc.label}</span>
        <span style={{fontSize:12,color:T.t4}}>/</span>
        <span style={{fontSize:13,fontWeight:600,color:T.t2}}>{pageTitle}</span>
      </div>

      {/* Bell */}
      <div style={{position:'relative'}}>
        {iconBtn(()=>setNotifOpen(true), <Bell size={15} color={T.teal}/>)}
        {unread>0 && (
          <div style={{position:'absolute',top:-3,right:-3,width:16,height:16,background:`linear-gradient(135deg,${T.rose},#dc2626)`,borderRadius:'50%',fontSize:9,fontWeight:800,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 2px 8px rgba(244,63,94,0.5), 0 0 0 2px #040508`}}>{unread}</div>
        )}
      </div>

      {iconBtn(()=>setPage('settings'), <Settings size={15} color={T.teal}/>)}

      {/* User menu */}
      <div style={{position:'relative'}}>
        <button onClick={()=>setMenuOpen(!menuOpen)} style={{background:rc.bg,border:`1px solid ${rc.border}`,borderRadius:9,padding:'6px 13px',cursor:'pointer',display:'flex',alignItems:'center',gap:8,transition:'all 0.15s'}}>
          <div style={{width:22,height:22,borderRadius:'50%',background:`${rc.color}1a`,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <User size={11} color={rc.color}/>
          </div>
          <span style={{fontSize:12,fontWeight:700,color:rc.color}}>{user.name.split(' ')[0]}</span>
        </button>
        {menuOpen && (
          <div style={{position:'absolute',right:0,top:'calc(100% + 8px)',background:'#090c18',border:`1px solid ${T.border2}`,borderRadius:12,padding:7,minWidth:175,zIndex:200,boxShadow:'0 16px 48px rgba(0,0,0,0.6)'}}>
            {[
              {label:'Profile',icon:User,color:T.t2,action:()=>{setPage('profile');setMenuOpen(false);}},
              {label:'Logout',icon:LogOut,color:T.roseL,action:logout},
            ].map(({label,icon:Icon,color,action})=>(
              <button key={label} onClick={action} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'9px 11px',background:'none',border:'none',color,cursor:'pointer',borderRadius:8,fontSize:13,fontFamily:'Plus Jakarta Sans,sans-serif',transition:'background 0.12s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.05)'}
                onMouseLeave={e=>e.currentTarget.style.background='none'}>
                <Icon size={13}/>{label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const {notifOpen,setNotifOpen} = useApp();
  const [notifs,setNotifs] = useState(mockNotifications);
  if (!notifOpen) return null;
  const tc = {approval:T.emeraldL,warning:T.roseL,success:T.teal,info:T.skyL};

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(4,5,8,0.65)',backdropFilter:'blur(6px)',zIndex:500}}
      onClick={e=>e.target===e.currentTarget&&setNotifOpen(false)}>
      <div style={{position:'absolute',right:18,top:68,width:370,background:'#090c18',border:`1px solid rgba(45,212,191,0.18)`,borderRadius:16,boxShadow:'0 24px 64px rgba(0,0,0,0.65)'}}>
        <div style={{padding:'15px 18px',borderBottom:`1px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontWeight:700,color:T.t1,fontSize:14}}>Notifications</span>
          <button onClick={()=>setNotifs(notifs.map(n=>({...n,read:true})))} style={{background:`rgba(45,212,191,0.08)`,border:`1px solid rgba(45,212,191,0.2)`,borderRadius:7,padding:'3px 10px',color:T.teal,cursor:'pointer',fontSize:11,fontWeight:700}}>Mark all read</button>
        </div>
        <div style={{maxHeight:390,overflowY:'auto'}}>
          {notifs.map(n=>(
            <div key={n.id} onClick={()=>setNotifs(notifs.map(x=>x.id===n.id?{...x,read:true}:x))}
              style={{padding:'13px 18px',borderBottom:`1px solid rgba(255,255,255,0.03)`,cursor:'pointer',background:n.read?'transparent':'rgba(45,212,191,0.025)',transition:'background 0.12s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.025)'}
              onMouseLeave={e=>e.currentTarget.style.background=n.read?'transparent':'rgba(45,212,191,0.025)'}>
              <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                <div style={{width:6,height:6,borderRadius:'50%',background:n.read?'transparent':tc[n.type],marginTop:5,flexShrink:0,boxShadow:n.read?'none':`0 0 6px ${tc[n.type]}`}}/>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:T.t1}}>{n.title}</div>
                  <div style={{fontSize:12,color:T.t3,marginTop:2,lineHeight:1.5}}>{n.message}</div>
                  <div style={{fontSize:11,color:T.t4,marginTop:4}}>{n.time}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
