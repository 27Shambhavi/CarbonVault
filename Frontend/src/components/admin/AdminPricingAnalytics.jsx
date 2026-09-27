import { useState } from 'react';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { mockPricing, mockCreditsOverTime, mockCreditsByType, mockResilienceData } from '../../data/mockData.js';
import { Card, SectionHeader, KPICard, Btn, T, withAlpha } from '../UI.jsx';
import { DollarSign, TrendingUp, Package, Activity, Save, RotateCcw } from 'lucide-react';

const CT=({active,payload,label})=>{
  if(!active||!payload?.length)return null;
  return(<div style={{background:'var(--card-bg, #0c1020)',border:`1px solid ${T.border2}`,borderRadius:10,padding:'10px 14px',boxShadow:'var(--shadow-modal)'}}>
    <div style={{color:T.teal,fontSize:11,fontWeight:700,marginBottom:4}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{color:T.t2,fontSize:12}}><span style={{color:T.t1,fontWeight:700}}>{typeof p.value==='number'?p.value.toLocaleString():p.value}</span></div>)}
  </div>);
};

export function AdminPricing() {
  const [p,setP]=useState(mockPricing);
  const final=(p.base*p.demand*p.supply*p.living).toFixed(2);
  const sc={demand:T.teal,supply:T.goldL,living:T.emeraldL};

  const Slider=({label,field,min=0.5,max=2.0})=>{
    const color=sc[field]||T.teal;
    const pct=((p[field]-min)/(max-min))*100;
    return(
      <div style={{marginBottom:22}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:9}}>
          <span style={{fontSize:13,color:T.t2,fontWeight:500}}>{label}</span>
          <span style={{fontSize:19,fontWeight:800,color,fontFamily:'Fraunces, serif'}}>{p[field].toFixed(2)}×</span>
        </div>
        <div style={{position:'relative',height:5,background:'rgba(255,255,255,0.07)',borderRadius:4,marginBottom:8}}>
          <div style={{position:'absolute',left:0,top:0,height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,${color}70,${color})`,borderRadius:4,boxShadow:`0 0 8px ${color}60`}}/>
        </div>
        <input type="range" min={min} max={max} step={0.01} value={p[field]}
          onChange={e=>setP({...p,[field]:parseFloat(e.target.value)})}
          style={{width:'100%',cursor:'pointer',accentColor:color}}/>
      </div>
    );
  };

  return(
    <div style={{padding:28}}>
      <SectionHeader title="Pricing Engine" subtitle="Configure live carbon credit pricing multipliers"/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div>
          <Card style={{marginBottom:16}}>
            <SectionHeader title="Configuration"/>
            <div style={{marginBottom:24}}>
              <label style={{fontSize:10,color:T.t3,fontWeight:700,letterSpacing:'0.7px',textTransform:'uppercase',marginBottom:8,display:'block'}}>Base Price ($/t CO₂e)</label>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <input type="number" value={p.base} onChange={e=>setP({...p,base:parseFloat(e.target.value)})}
                  style={{background:`rgba(45,212,191,0.07)`,border:`1px solid rgba(45,212,191,0.25)`,borderRadius:11,padding:'11px 15px',color:T.tealL,fontSize:26,fontWeight:900,outline:'none',width:130,fontFamily:'Fraunces, serif'}}/>
                <span style={{color:T.t3,fontSize:13}}>per tonne</span>
              </div>
            </div>
            <Slider label="Demand Multiplier" field="demand"/>
            <Slider label="Supply Multiplier" field="supply"/>
            <Slider label="Living Credit Multiplier" field="living"/>
            <div style={{display:'flex',gap:10}}>
              <Btn><Save size={13}/>Save Config</Btn>
              <Btn variant="secondary" onClick={()=>setP(mockPricing)}><RotateCcw size={13}/>Reset</Btn>
            </div>
          </Card>
        </div>
        <div>
          <Card style={{marginBottom:16}}>
            <SectionHeader title="Live Price Preview"/>
            <div style={{background:'linear-gradient(135deg,color-mix(in srgb, var(--teal) 8%, transparent),color-mix(in srgb, var(--teal) 4%, transparent))',border:`1px solid color-mix(in srgb, var(--teal) 22%, transparent)`,borderRadius:13,padding:24,marginBottom:18,textAlign:'center',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${withAlpha(T.teal, '60', 50)},transparent)`}}/>
              <div style={{fontSize:10,color:T.teal,textTransform:'uppercase',letterSpacing:'1px',marginBottom:8}}>Effective Market Price</div>
              <div style={{fontSize:58,fontWeight:900,color:T.tealL,fontFamily:'Fraunces, serif',letterSpacing:'-2px',lineHeight:1,textShadow:`0 0 40px rgba(45,212,191,0.6)`}}>${final}</div>
              <div style={{fontSize:12,color:T.t3,marginTop:6}}>per tonne CO₂e</div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {[{l:'Base Price',v:`$${p.base}`},{l:'× Demand',v:`${p.demand.toFixed(2)}×`},{l:'× Supply',v:`${p.supply.toFixed(2)}×`},{l:'× Living Credit',v:`${p.living.toFixed(2)}×`}].map(({l,v})=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid rgba(255,255,255,0.04)`,fontSize:13}}>
                  <span style={{color:T.t3}}>{l}</span><span style={{color:T.t1,fontWeight:700}}>{v}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <SectionHeader title="Price History"/>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={mockCreditsOverTime.map((d,i)=>({...d,price:24+i*0.8}))}>
                <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.teal} stopOpacity={0.2}/><stop offset="100%" stopColor={T.teal} stopOpacity={0}/></linearGradient></defs>
                <XAxis dataKey="month" tick={{fill:T.t3,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:T.t3,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CT/>}/>
                <Area type="monotone" dataKey="price" stroke={T.teal} strokeWidth={2} fill="url(#pg)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function AdminAnalytics() {
  return(
    <div style={{padding:28}}>
      <SectionHeader title="Platform Analytics" subtitle="Comprehensive performance and impact insights"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:15,marginBottom:24}}>
        <KPICard icon={DollarSign} label="Total Revenue"     value="$580K"  sub="From credit sales"      trend="up"   color={T.emeraldL}/>
        <KPICard icon={TrendingUp} label="Avg Credit Price"  value="$29.40" sub="+8% vs last quarter"    trend="up"   color={T.teal}/>
        <KPICard icon={Package}    label="Credits Available" value="48,800" sub="Across 5 projects"      trend="down" color={T.goldL}/>
        <KPICard icon={Activity}   label="Verification Rate" value="87.5%"  sub="Of submitted projects"  trend="up"   color={T.violetLL}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
        <Card>
          <SectionHeader title="Credits by Project Type"/>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mockCreditsByType} barSize={34}>
              <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.teal}/><stop offset="100%" stopColor={T.tealDD} stopOpacity={0.7}/></linearGradient></defs>
              <XAxis dataKey="name" tick={{fill:T.t3,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:T.t3,fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip content={<CT/>}/>
              <Bar dataKey="value" radius={[6,6,0,0]} fill="url(#bg)"/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <SectionHeader title="Climate Resilience Radar"/>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={mockResilienceData}>
              <PolarGrid stroke="rgba(255,255,255,0.06)"/>
              <PolarAngleAxis dataKey="metric" tick={{fill:T.t3,fontSize:10}}/>
              <Radar name="Score" dataKey="score" stroke={T.teal} fill={T.teal} fillOpacity={0.15} strokeWidth={2}/>
              <Tooltip content={<CT/>}/>
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <Card>
        <SectionHeader title="Monthly Generation Trend"/>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={mockCreditsOverTime} barSize={30}>
            <defs><linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.violetL} stopOpacity={0.9}/><stop offset="100%" stopColor={T.violet} stopOpacity={0.5}/></linearGradient></defs>
            <XAxis dataKey="month" tick={{fill:T.t3,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:T.t3,fontSize:11}} axisLine={false} tickLine={false}/>
            <Tooltip content={<CT/>}/>
            <Bar dataKey="credits" radius={[5,5,0,0]} fill="url(#bg2)"/>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
