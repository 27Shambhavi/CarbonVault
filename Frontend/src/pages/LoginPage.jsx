import { useState, useEffect } from 'react';
import { useApp } from '../AppContext.jsx';
import { fetchPlatformStats } from '../services/api.js';
import { T, withAlpha } from '../components/UI.jsx';
import { Leaf, ShieldCheck, BarChart3, Eye, EyeOff, Zap, TrendingUp, Award, TreePine, Building2, Globe, Sun, Moon } from 'lucide-react';

// Animated floating particle
function Particle({ x, y, size, opacity, duration }) {
  return (
    <div style={{
      position:'absolute', left:`${x}%`, top:`${y}%`,
      width:size, height:size, borderRadius:'50%',
      background:`radial-gradient(circle, rgba(45,212,191,${opacity}) 0%, transparent 70%)`,
      animation:`float ${duration}s ease-in-out infinite`,
      animationDelay:`${Math.random()*4}s`,
      pointerEvents:'none',
    }}/>
  );
}

export default function LoginPage() {
  const {login, theme, toggleTheme} = useApp();
  const [activeRole, setActiveRole] = useState('admin');
  const [email, setEmail] = useState('admin@carbonvault.com');
  const [password, setPassword] = useState('demo@123');
  const [showPass, setShowPass] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [platformStats, setPlatformStats] = useState(null);

  useEffect(() => {
    setTimeout(()=>setLoaded(true), 80);
    fetchPlatformStats().then(res => {
      if (res.data) setPlatformStats(res.data);
    }).catch(()=>{});
  }, []);

  const roles = [
    {role:'admin',     label:'Admin',      desc:'Platform HQ',         icon:ShieldCheck, color:T.goldL,    email:'admin@carbonvault.com'},
    {role:'ngo',       label:'NGO',        desc:'Project Organization', icon:TreePine,    color:T.skyL,     email:'ngo@carbonvault.com'},
    {role:'corporate', label:'Corporate',  desc:'Carbon Buyer',         icon:Building2,   color:T.violetLL, email:'corp@carbonvault.com'},
  ];

  const particles = Array.from({length:18},(_,i)=>({
    id:i, x:Math.random()*100, y:Math.random()*100,
    size: 4+Math.random()*12, opacity:0.08+Math.random()*0.18,
    duration: 5+Math.random()*8,
  }));

  const activeProjectsCount = platformStats ? platformStats.active_projects : 3;
  const verifiedCreditsCount = platformStats ? `${(platformStats.total_credits || 0).toLocaleString()}` : '41,200';
  const fundingText = platformStats && platformStats.total_funding_usd ? `$${Math.round(platformStats.total_funding_usd/1000)}K` : '$580K';

  const stats = [
    {n: verifiedCreditsCount, l:'Credits Verified',   icon:Award,     color:T.teal},
    {n: `${activeProjectsCount}`, l:'Active Projects',    icon:TreePine,  color:T.skyL},
    {n: fundingText,         l:'Transactions',       icon:TrendingUp,color:T.goldL},
    {n:'99.9%',              l:'AI MRV Uptime',      icon:Zap,       color:T.emeraldL},
  ];

  return (
    <div style={{minHeight:'100vh', display:'flex', background:T.bg0, position:'relative', overflow:'hidden', fontFamily:'Plus Jakarta Sans, sans-serif'}}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-18px) scale(1.05)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spinSlow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes shimmerLine { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes pulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:0.9;transform:scale(1.03)} }
        @keyframes scanline { 0%{top:-2px} 100%{top:100%} }
      `}</style>

      {/* Animated particles */}
      <div style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden'}}>
        {particles.map(p=><Particle key={p.id} {...p}/>)}
        {/* Big ambient glows */}
        <div style={{position:'absolute',top:'-20%',left:'-10%',width:'60%',height:'60%',background:`radial-gradient(ellipse, rgba(45,212,191,0.09) 0%, transparent 65%)`,animation:'pulse 8s ease-in-out infinite'}}/>
        <div style={{position:'absolute',bottom:'-20%',right:'-5%',width:'50%',height:'50%',background:`radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 65%)`,animation:'pulse 10s ease-in-out infinite',animationDelay:'3s'}}/>
        <div style={{position:'absolute',top:'30%',right:'15%',width:'30%',height:'30%',background:`radial-gradient(ellipse, rgba(245,158,11,0.05) 0%, transparent 65%)`,animation:'pulse 7s ease-in-out infinite',animationDelay:'1.5s'}}/>

        {/* Dot grid */}
        <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0.35}} aria-hidden>
          <defs><pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.35)"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#dots)"/>
        </svg>

        {/* Spinning ring decoration */}
        <div style={{position:'absolute',top:'10%',right:'8%',width:200,height:200,border:'1px solid rgba(45,212,191,0.1)',borderRadius:'50%',animation:'spinSlow 30s linear infinite'}}/>
        <div style={{position:'absolute',top:'12%',right:'10%',width:160,height:160,border:'1px solid rgba(245,158,11,0.08)',borderRadius:'50%',animation:'spinSlow 20s linear infinite reverse'}}/>
      </div>

      {/* LEFT PANEL */}
      <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'60px 72px',position:'relative',zIndex:1,opacity:loaded?1:0,transform:loaded?'translateY(0)':'translateY(20px)',transition:'all 0.7s cubic-bezier(0.4,0,0.2,1)'}}>
        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:13,marginBottom:56}}>
          <div style={{width:48,height:48,background:`linear-gradient(135deg, ${T.teal}, ${T.tealDD})`,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 6px 28px rgba(45,212,191,0.45), inset 0 1px 0 rgba(255,255,255,0.25)`,flexShrink:0}}>
            <Leaf size={22} color="#021a17" strokeWidth={2.5}/>
          </div>
          <div>
            <div style={{fontFamily:'Fraunces, serif',fontWeight:900,fontSize:24,color:T.t1,letterSpacing:'-0.5px'}}>CarbonVault</div>
            <div style={{fontSize:9.5,color:T.teal,fontWeight:800,letterSpacing:'2px',textTransform:'uppercase',marginTop:1}}>Carbon Intelligence Platform</div>
          </div>
        </div>

        {/* Headline */}
        <h1 style={{fontFamily:'Fraunces, serif',fontSize:52,fontWeight:900,color:T.t1,lineHeight:1.05,letterSpacing:'-1.5px',marginBottom:20}}>
          Track Carbon.<br/>
          <span style={{background:`linear-gradient(135deg, ${T.teal} 0%, ${T.tealL} 40%, ${T.skyL} 100%)`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',backgroundSize:'200% auto',animation:'shimmerLine 4s linear infinite'}}>
            Verify Impact.
          </span><br/>
          Build Trust.
        </h1>
        <p style={{color:T.t3,fontSize:15,maxWidth:390,lineHeight:1.85,marginBottom:48}}>
          AI-powered MRV verification, real-time fraud detection, and immutable audit trails for the voluntary carbon market.
        </p>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:13,maxWidth:420}}>
          {stats.map(({n,l,icon:Icon,color},i)=>(
            <div key={l} style={{background:'rgba(255,255,255,0.03)',border:`1px solid ${T.border}`,borderRadius:13,padding:'16px 18px',display:'flex',alignItems:'center',gap:13,transition:'all 0.22s',cursor:'default',opacity:loaded?1:0,transform:loaded?'translateY(0)':'translateY(16px)',transitionDelay:`${0.4+i*0.08}s`}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=`${color}38`;e.currentTarget.style.background='rgba(255,255,255,0.055)';e.currentTarget.style.transform='translateY(-2px)';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.transform='translateY(0)';}}>
              <div style={{width:38,height:38,borderRadius:10,background:`${color}14`,border:`1px solid ${color}25`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Icon size={16} color={color}/>
              </div>
              <div>
                <div style={{fontSize:21,fontWeight:800,color:T.t1,fontFamily:'Fraunces, serif',lineHeight:1}}>{n}</div>
                <div style={{fontSize:10,color:T.t3,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginTop:3}}>{l}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{position:'absolute',bottom:16,left:0,right:0,display:'flex',justifyContent:'center'}}>
          <div style={{fontSize:10,color:T.t4,fontWeight:600,letterSpacing:'1px'}}>Made by Shubh Jain, Sakshi Sharma, Shambhavi Jha, Vaibhav Soni</div>
        </div>

        <div style={{marginTop:44,display:'flex',alignItems:'center',gap:14}}>
          <div style={{height:1,flex:1,background:`linear-gradient(90deg, rgba(45,212,191,0.4), transparent)`}}/>
          <span style={{fontSize:11,color:T.t4,fontWeight:600,letterSpacing:'0.8px',textTransform:'uppercase',whiteSpace:'nowrap'}}>Trusted by 48+ organizations</span>
        </div>
      </div>

      {/* RIGHT LOGIN PANEL */}
      <div style={{width:490,display:'flex',flexDirection:'column',justifyContent:'center',padding:'48px 44px',background:'var(--sidebar-bg, rgba(8,11,18,0.97))',backdropFilter:'blur(24px)',borderLeft:`1px solid ${T.border}`,position:'relative',zIndex:1,opacity:loaded?1:0,transition:'opacity 0.8s ease',transitionDelay:'0.2s'}}>
        {/* Animated top shimmer */}
        <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg, transparent, ${withAlpha(T.teal, '70', 70)}, ${withAlpha(T.tealL, '90', 80)}, ${withAlpha(T.teal, '70', 70)}, transparent)`,backgroundSize:'200% auto',animation:'shimmerLine 3s linear infinite'}}/>

        {/* Theme Toggle Button */}
        <div style={{position:'absolute',top:20,right:24,zIndex:10}}>
          <button
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            style={{
              background:'var(--glass2, rgba(255,255,255,0.06))',
              border:`1px solid ${T.border}`,
              borderRadius:9,width:34,height:34,
              display:'flex',alignItems:'center',justifyContent:'center',
              cursor:'pointer',transition:'all 0.15s'
            }}
          >
            {theme === 'light' ? <Moon size={15} color={T.violet} /> : <Sun size={15} color={T.goldL} />}
          </button>
        </div>

        {/* Scanline effect */}
        <div style={{position:'absolute',left:0,right:0,height:40,background:`linear-gradient(180deg, transparent, rgba(45,212,191,0.02), transparent)`,animation:'scanline 6s linear infinite',pointerEvents:'none'}}/>

        <div style={{marginBottom:26}}>
          <h2 style={{fontFamily:'Fraunces, serif',fontSize:28,fontWeight:900,color:T.t1,letterSpacing:'-0.5px',marginBottom:5}}>Sign in</h2>
          <p style={{color:T.t3,fontSize:13}}>Choose a role to explore the platform</p>
        </div>

        {/* Role cards */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:24}}>
          {roles.map(({role,label,desc,icon:Icon,color,email:roleEmail})=>{
            const active=activeRole===role;
            return(
              <button key={role} onClick={()=>{setActiveRole(role);setEmail(roleEmail);}}
                style={{background:active?`color-mix(in srgb, ${color} 14%, transparent)`:'var(--glass, rgba(255,255,255,0.025))',border:`1px solid ${active?color:T.border}`,borderRadius:11,padding:'12px 10px',cursor:'pointer',textAlign:'left',transition:'all 0.18s',position:'relative',overflow:'hidden'}}>
                {active&&<div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${color},transparent)`}}/>}
                <div style={{width:28,height:28,borderRadius:8,background:`color-mix(in srgb, ${color} 18%, transparent)`,border:`1px solid color-mix(in srgb, ${color} 28%, transparent)`,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:7}}>
                  <Icon size={13} color={color}/>
                </div>
                <div style={{fontSize:12,fontWeight:700,color:active?T.t1:T.t2}}>{label}</div>
                <div style={{fontSize:10,color:active?T.t2:T.t3,marginTop:1,lineHeight:1.3}}>{desc}</div>
              </button>
            );
          })}
        </div>

        <div style={{height:1,background:T.border,marginBottom:20}}/>

        {['Email','Password'].map((lbl,i)=>(
          <div key={lbl} style={{marginBottom:i===0?13:24,position:'relative'}}>
            <label style={{fontSize:10,color:T.t3,fontWeight:700,letterSpacing:'0.8px',textTransform:'uppercase',marginBottom:7,display:'block'}}>{lbl}</label>
            <input
              type={i===1?(showPass?'text':'password'):'text'}
              value={i===0?email:password}
              onChange={e=>{i===0?setEmail(e.target.value):setPassword(e.target.value);}}
              style={{background:'var(--input-bg, rgba(255,255,255,0.04))',border:`1px solid ${T.border}`,borderRadius:10,padding:`11px ${i===1?'44px':'15px'} 11px 15px`,color:T.t1,fontSize:14,outline:'none',width:'100%',transition:'border-color 0.2s',fontFamily:'Plus Jakarta Sans,sans-serif'}}
              onFocus={e=>e.target.style.borderColor=T.teal}
              onBlur={e=>e.target.style.borderColor=T.border}
            />
            {i===1&&(
              <button onClick={()=>setShowPass(!showPass)} style={{position:'absolute',right:13,top:34,background:'none',border:'none',color:T.t3,cursor:'pointer',display:'flex',padding:2,transition:'color 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.color=T.teal} onMouseLeave={e=>e.currentTarget.style.color=T.t3}>
                {showPass?<EyeOff size={15}/>:<Eye size={15}/>}
              </button>
            )}
          </div>
          
        ))}

        <button onClick={()=>login(activeRole)}
          style={{background:`linear-gradient(135deg, ${T.teal} 0%, ${T.tealD} 60%, ${T.tealDD} 100%)`,border:'none',borderRadius:11,padding:'14px',color:'#021a17',fontSize:15,fontWeight:800,cursor:'pointer',width:'100%',fontFamily:'Fraunces, serif',letterSpacing:'0.2px',boxShadow:`0 6px 24px rgba(45,212,191,0.35), inset 0 1px 0 rgba(255,255,255,0.2)`,transition:'all 0.2s',display:'flex',alignItems:'center',justifyContent:'center',gap:9}}
          onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 10px 36px rgba(45,212,191,0.55), inset 0 1px 0 rgba(255,255,255,0.2)`;}}
          onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow=`0 6px 24px rgba(45,212,191,0.35), inset 0 1px 0 rgba(255,255,255,0.2)`;}}>
          Access Dashboard →
        </button>

        <div style={{marginTop:16,textAlign:'center'}}>
          <button onClick={()=>login('public')}
            style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:10,padding:'10px 14px',color:T.teal,fontSize:13,fontWeight:600,cursor:'pointer',width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8,transition:'all 0.15s'}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(45,212,191,0.4)';e.currentTarget.style.background='rgba(45,212,191,0.05)';}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background='transparent';}}>
            <Globe size={14} color={T.teal}/> Explore Public Transparency Portal (No Login)
          </button>
        </div>

        <div style={{position:'absolute',bottom:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,rgba(45,212,191,0.3),transparent)`}}/>
        
        
      </div>
    </div>
  );
}
