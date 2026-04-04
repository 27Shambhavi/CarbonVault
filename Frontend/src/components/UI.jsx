import { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

/* ── Design tokens ──────────────────────────────────────── */
export const T = {
  bg0:'#040508', bg1:'#080b12', bg2:'#0d1120', bg3:'#111829', bg4:'#161f34',
  glass:'rgba(255,255,255,0.035)', glass2:'rgba(255,255,255,0.06)',
  border:'rgba(255,255,255,0.07)', border2:'rgba(255,255,255,0.13)',
  teal:'#2dd4bf', tealD:'#14b8a6', tealDD:'#0d9488', tealL:'#5eead4',
  gold:'#f59e0b', goldL:'#fbbf24', goldLL:'#fde68a',
  rose:'#f43f5e', roseL:'#fb7185',
  violet:'#7c3aed', violetL:'#8b5cf6', violetLL:'#a78bfa',
  sky:'#0ea5e9', skyL:'#38bdf8',
  emerald:'#10b981', emeraldL:'#34d399',
  t1:'#f1f5f9', t2:'#94a3b8', t3:'#475569', t4:'#1e293b',
};

/* ── Glass card ─────────────────────────────────────────── */
export const gc = (extra={}) => ({
  background:'rgba(13,17,32,0.72)',
  backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
  border:`1px solid ${T.border}`,
  borderRadius:14,
  boxShadow:'0 1px 2px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
  padding:24,
  ...extra,
});

/* ── Badge map ──────────────────────────────────────────── */
const BM = {
  approved:  {bg:'rgba(16,185,129,0.12)', color:'#34d399', border:'rgba(52,211,153,0.25)'},
  pending:   {bg:'rgba(245,158,11,0.12)', color:'#fbbf24', border:'rgba(251,191,36,0.25)'},
  rejected:  {bg:'rgba(244,63,94,0.12)',  color:'#fb7185', border:'rgba(251,113,133,0.25)'},
  minted:    {bg:'rgba(14,165,233,0.12)', color:'#38bdf8', border:'rgba(56,189,248,0.25)'},
  draft:     {bg:'rgba(124,58,237,0.12)', color:'#a78bfa', border:'rgba(167,139,250,0.25)'},
  active:    {bg:'rgba(16,185,129,0.12)', color:'#34d399', border:'rgba(52,211,153,0.25)'},
  sold_out:  {bg:'rgba(244,63,94,0.1)',   color:'#fb7185', border:'rgba(251,113,133,0.2)'},
  suspended: {bg:'rgba(245,158,11,0.12)', color:'#fbbf24', border:'rgba(251,191,36,0.25)'},
  ngo:       {bg:'rgba(14,165,233,0.12)', color:'#38bdf8', border:'rgba(56,189,248,0.25)'},
  buyer:     {bg:'rgba(124,58,237,0.12)', color:'#a78bfa', border:'rgba(167,139,250,0.25)'},
  admin:     {bg:'rgba(245,158,11,0.12)', color:'#fbbf24', border:'rgba(251,191,36,0.25)'},
  public:    {bg:'rgba(45,212,191,0.1)',  color:'#5eead4', border:'rgba(45,212,191,0.25)'},
  reforestation: {bg:'rgba(16,185,129,0.12)', color:'#34d399', border:'rgba(52,211,153,0.25)'},
  renewable:     {bg:'rgba(14,165,233,0.12)', color:'#38bdf8', border:'rgba(56,189,248,0.25)'},
  methane:       {bg:'rgba(245,158,11,0.12)', color:'#fbbf24', border:'rgba(251,191,36,0.25)'},
  carbon_capture:{bg:'rgba(124,58,237,0.12)', color:'#a78bfa', border:'rgba(167,139,250,0.25)'},
  Platinum:{bg:'rgba(148,163,184,0.12)', color:'#cbd5e1', border:'rgba(203,213,225,0.25)'},
  Gold:    {bg:'rgba(245,158,11,0.14)', color:'#fbbf24', border:'rgba(251,191,36,0.35)'},
  Silver:  {bg:'rgba(100,116,139,0.12)', color:'#94a3b8', border:'rgba(148,163,184,0.25)'},
  Bronze:  {bg:'rgba(180,83,9,0.12)',   color:'#d97706', border:'rgba(217,119,6,0.25)'},
};

/* ── Badge ──────────────────────────────────────────────── */
export function Badge({ type, label }) {
  const m = BM[type] || BM.public;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'2px 9px', borderRadius:20, fontSize:10.5, fontWeight:700,
      letterSpacing:'0.5px', textTransform:'uppercase',
      background:m.bg, color:m.color, border:`1px solid ${m.border}`,
    }}>
      <span style={{width:4,height:4,borderRadius:'50%',background:m.color,flexShrink:0,boxShadow:`0 0 4px ${m.color}`}}/>
      {label || type}
    </span>
  );
}

/* ── KPI Card ───────────────────────────────────────────── */
export function KPICard({ icon:Icon, label, value, sub, trend, color=T.teal }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        ...gc({padding:22}),
        position:'relative', overflow:'hidden',
        transition:'all 0.22s cubic-bezier(0.4,0,0.2,1)',
        borderColor: hov ? `${color}44` : T.border,
        transform: hov ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hov
          ? `0 1px 2px rgba(0,0,0,0.5), 0 16px 40px rgba(0,0,0,0.3), 0 0 0 1px ${color}30, inset 0 1px 0 rgba(255,255,255,0.07)`
          : gc().boxShadow,
      }}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
    >
      {/* Glow orb */}
      <div style={{position:'absolute',top:-40,right:-40,width:120,height:120,borderRadius:'50%',background:`radial-gradient(circle, ${color}18 0%, transparent 65%)`,pointerEvents:'none',transition:'opacity 0.3s',opacity:hov?1:0.5}}/>
      {/* Top shimmer line */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg, transparent 0%, ${color}60 50%, transparent 100%)`,opacity:hov?1:0.4,transition:'opacity 0.3s'}}/>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
        <div style={{width:44,height:44,borderRadius:12,background:`${color}14`,border:`1px solid ${color}30`,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon size={20} color={color} />
        </div>
        {trend==='up' && <span style={{display:'flex',alignItems:'center',gap:3,fontSize:11,color:T.emeraldL,fontWeight:700,background:'rgba(16,185,129,0.1)',padding:'2px 7px',borderRadius:20,border:'1px solid rgba(52,211,153,0.2)'}}><TrendingUp size={10}/>+12%</span>}
        {trend==='down' && <span style={{display:'flex',alignItems:'center',gap:3,fontSize:11,color:T.roseL,fontWeight:700,background:'rgba(244,63,94,0.1)',padding:'2px 7px',borderRadius:20,border:'1px solid rgba(251,113,133,0.2)'}}><TrendingDown size={10}/>−4%</span>}
      </div>
      <div style={{fontSize:32,fontWeight:800,color:T.t1,fontFamily:'Fraunces, serif',lineHeight:1,letterSpacing:'-1px'}}>{value}</div>
      <div style={{fontSize:11,color:T.t3,fontWeight:600,letterSpacing:'0.7px',textTransform:'uppercase',marginTop:9}}>{label}</div>
      {sub && <div style={{fontSize:11,color:T.t4,marginTop:4}}>{sub}</div>}
    </div>
  );
}

/* ── Card ───────────────────────────────────────────────── */
export function Card({ children, style={} }) {
  return <div style={{...gc(),...style}}>{children}</div>;
}

/* ── Section Header ─────────────────────────────────────── */
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20}}>
      <div>
        <div style={{fontSize:16,fontWeight:700,color:T.t1,letterSpacing:'-0.2px'}}>{title}</div>
        {subtitle && <div style={{fontSize:12,color:T.t3,marginTop:3,lineHeight:1.5}}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

/* ── Table ──────────────────────────────────────────────── */
export function Table({ headers, rows, onRowClick }) {
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead>
          <tr style={{background:'rgba(255,255,255,0.02)'}}>
            {headers.map((h,i)=>(
              <th key={i} style={{padding:'9px 14px',textAlign:'left',fontSize:10,fontWeight:700,letterSpacing:'0.9px',textTransform:'uppercase',color:T.t3,borderBottom:`1px solid ${T.border}`}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i)=>(
            <tr key={i}
              style={{cursor:onRowClick?'pointer':'default',transition:'background 0.12s'}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(45,212,191,0.03)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              onClick={()=>onRowClick&&onRowClick(row)}>
              {row.map((cell,j)=>(
                <td key={j} style={{padding:'12px 14px',fontSize:13,color:T.t2,borderBottom:`1px solid rgba(255,255,255,0.03)`}}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── MRV Score Bar ──────────────────────────────────────── */
export function MRVScore({ score }) {
  const color = score>=80 ? T.emeraldL : score>=60 ? T.goldL : T.roseL;
  return (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <div style={{width:60,height:4,background:'rgba(255,255,255,0.07)',borderRadius:4,overflow:'hidden'}}>
        <div style={{width:`${score}%`,height:'100%',background:`linear-gradient(90deg, ${color}70, ${color})`,borderRadius:4,boxShadow:`0 0 6px ${color}80`}}/>
      </div>
      <span style={{fontSize:12,fontWeight:700,color,minWidth:22}}>{score}</span>
    </div>
  );
}

/* ── Modal ──────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, width=600 }) {
  if (!open) return null;
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(4,5,8,0.85)',backdropFilter:'blur(12px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        background:'#0c1020',
        border:`1px solid rgba(45,212,191,0.18)`,
        boxShadow:`0 25px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), 0 0 60px rgba(45,212,191,0.05)`,
        borderRadius:18,width:'100%',maxWidth:width,maxHeight:'90vh',overflow:'auto',
        animation:'fadeUp 0.2s ease',
      }}>
        <div style={{padding:'18px 24px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:15,fontWeight:700,color:T.t1}}>{title}</span>
          <button onClick={onClose} style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${T.border}`,color:T.t3,cursor:'pointer',width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,lineHeight:1,transition:'all 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.border2}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>×</button>
        </div>
        <div style={{padding:24}}>{children}</div>
      </div>
    </div>
  );
}

/* ── Button ─────────────────────────────────────────────── */
export function Btn({ children, onClick, variant='primary', small, style={} }) {
  const vs = {
    primary:{
      background:`linear-gradient(135deg, ${T.teal} 0%, ${T.tealDD} 100%)`,
      border:'none', color:'#021a17',
      boxShadow:`0 4px 20px rgba(45,212,191,0.3), inset 0 1px 0 rgba(255,255,255,0.2)`,
    },
    secondary:{
      background:'rgba(255,255,255,0.05)',
      border:`1px solid ${T.border2}`,
      color:T.t2,
    },
    danger:{
      background:`linear-gradient(135deg, ${T.rose}, #dc2626)`,
      border:'none', color:'#fff',
      boxShadow:`0 4px 16px rgba(244,63,94,0.3)`,
    },
    gold:{
      background:`linear-gradient(135deg, ${T.goldL}, ${T.gold})`,
      border:'none', color:'#1a0c00',
      boxShadow:`0 4px 16px rgba(245,158,11,0.3), inset 0 1px 0 rgba(255,255,255,0.2)`,
    },
  };
  const base = vs[variant]||vs.primary;
  const sz = small?{padding:'5px 11px',fontSize:11}:{padding:'9px 18px',fontSize:13};
  return (
    <button onClick={onClick}
      style={{...base,...sz,borderRadius:9,fontWeight:700,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6,fontFamily:'Plus Jakarta Sans, sans-serif',transition:'all 0.18s',...style}}
      onMouseEnter={e=>{e.currentTarget.style.opacity='0.87';e.currentTarget.style.transform='translateY(-1px)';}}
      onMouseLeave={e=>{e.currentTarget.style.opacity='1';e.currentTarget.style.transform='translateY(0)';}}>
      {children}
    </button>
  );
}

/* ── Score Gauge ────────────────────────────────────────── */
export function ScoreGauge({ score, max=1000, label }) {
  const pct=(score/max)*100;
  const color=pct>=80?T.emeraldL:pct>=60?T.goldL:T.roseL;
  const r=52,cx=64,cy=64,circ=2*Math.PI*r,dash=(pct/100)*circ;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
      <svg width={128} height={128} viewBox="0 0 128 128">
        <defs>
          <linearGradient id="gGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.4"/>
            <stop offset="100%" stopColor={color}/>
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#gGrad)" strokeWidth={8}
          strokeDasharray={`${dash} ${circ-dash}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{filter:`drop-shadow(0 0 6px ${color})`}}/>
        <text x={cx} y={cy-3} textAnchor="middle" fill={T.t1} fontSize={22} fontWeight={800} fontFamily="Fraunces, serif">{score}</text>
        <text x={cx} y={cy+15} textAnchor="middle" fill={T.t3} fontSize={10} fontFamily="Plus Jakarta Sans, sans-serif">{label||'/ '+max}</text>
      </svg>
    </div>
  );
}

export { BM as badgeMap };
