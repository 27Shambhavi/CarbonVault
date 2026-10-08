import { useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

/* ── Design tokens mapped to CSS variables with Dark fallbacks ─ */
export const T = {
  bg0: 'var(--bg0, #040508)',
  bg1: 'var(--bg1, #080b12)',
  bg2: 'var(--bg2, #0d1120)',
  bg3: 'var(--bg3, #111829)',
  bg4: 'var(--bg4, #161f34)',
  glass: 'var(--glass, rgba(255,255,255,0.035))',
  glass2: 'var(--glass2, rgba(255,255,255,0.06))',
  border: 'var(--border, rgba(255,255,255,0.07))',
  border2: 'var(--border2, rgba(255,255,255,0.13))',
  cardBg: 'var(--card-bg, rgba(13,17,32,0.72))',
  modalBg: 'var(--modal-bg, #0c1020)',
  sidebarBg: 'var(--sidebar-bg, rgba(4,5,8,0.96))',
  topbarBg: 'var(--topbar-bg, rgba(4,5,8,0.9))',
  menuBg: 'var(--menu-bg, #090c18)',
  inputBg: 'var(--input-bg, rgba(255,255,255,0.04))',
  teal: 'var(--teal, #2dd4bf)',
  tealD: 'var(--teal-d, #14b8a6)',
  tealDD: 'var(--teal-dd, #0d9488)',
  tealL: 'var(--teal-l, #5eead4)',
  gold: 'var(--gold, #f59e0b)',
  goldL: 'var(--gold-l, #fbbf24)',
  goldLL: 'var(--gold-ll, #fde68a)',
  rose: 'var(--rose, #f43f5e)',
  roseL: 'var(--rose-l, #fb7185)',
  violet: 'var(--violet, #7c3aed)',
  violetL: 'var(--violet-l, #8b5cf6)',
  violetLL: 'var(--violet-ll, #a78bfa)',
  sky: 'var(--sky, #0ea5e9)',
  skyL: 'var(--sky-l, #38bdf8)',
  emerald: 'var(--emerald, #10b981)',
  emeraldL: 'var(--emerald-l, #34d399)',
  t1: 'var(--t1, #f1f5f9)',
  t2: 'var(--t2, #94a3b8)',
  t3: 'var(--t3, #475569)',
  t4: 'var(--t4, #1e293b)',
};

/** Helper to blend CSS variables or hex colors safely with opacity */
export const withAlpha = (color, hexSuffix = '20', percent = 15) => {
  if (typeof color === 'string' && color.includes('var(')) {
    return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
  }
  return `${color}${hexSuffix}`;
};

/* ── Glass card (theme-aware) ─────────────────────────────── */
export const gc = (extra={}) => ({
  background: 'var(--card-bg, rgba(13,17,32,0.72))',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: `1px solid var(--border, rgba(255,255,255,0.07))`,
  borderRadius: 14,
  boxShadow: 'var(--shadow-card, 0 1px 2px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.25))',
  padding: 24,
  ...extra,
});

/* ── Badge map ──────────────────────────────────────────── */
const BM = {
  approved:  {bg:'color-mix(in srgb, var(--emerald, #10b981) 12%, transparent)', color:T.emeraldL, border:'color-mix(in srgb, var(--emerald, #10b981) 25%, transparent)'},
  pending:   {bg:'color-mix(in srgb, var(--gold, #f59e0b) 14%, transparent)',    color:T.goldL,    border:'color-mix(in srgb, var(--gold, #f59e0b) 28%, transparent)'},
  rejected:  {bg:'color-mix(in srgb, var(--rose, #f43f5e) 14%, transparent)',    color:T.roseL,    border:'color-mix(in srgb, var(--rose, #f43f5e) 28%, transparent)'},
  minted:    {bg:'color-mix(in srgb, var(--sky, #0ea5e9) 14%, transparent)',     color:T.skyL,     border:'color-mix(in srgb, var(--sky, #0ea5e9) 28%, transparent)'},
  draft:     {bg:'color-mix(in srgb, var(--violet, #7c3aed) 14%, transparent)',  color:T.violetL,  border:'color-mix(in srgb, var(--violet, #7c3aed) 28%, transparent)'},
  active:    {bg:'color-mix(in srgb, var(--emerald, #10b981) 12%, transparent)', color:T.emeraldL, border:'color-mix(in srgb, var(--emerald, #10b981) 25%, transparent)'},
  sold_out:  {bg:'color-mix(in srgb, var(--rose, #f43f5e) 12%, transparent)',    color:T.roseL,    border:'color-mix(in srgb, var(--rose, #f43f5e) 25%, transparent)'},
  suspended: {bg:'color-mix(in srgb, var(--gold, #f59e0b) 14%, transparent)',    color:T.goldL,    border:'color-mix(in srgb, var(--gold, #f59e0b) 28%, transparent)'},
  ngo:       {bg:'color-mix(in srgb, var(--sky, #0ea5e9) 14%, transparent)',     color:T.skyL,     border:'color-mix(in srgb, var(--sky, #0ea5e9) 28%, transparent)'},
  buyer:     {bg:'color-mix(in srgb, var(--violet, #7c3aed) 14%, transparent)',  color:T.violetL,  border:'color-mix(in srgb, var(--violet, #7c3aed) 28%, transparent)'},
  admin:     {bg:'color-mix(in srgb, var(--gold, #f59e0b) 14%, transparent)',    color:T.goldL,    border:'color-mix(in srgb, var(--gold, #f59e0b) 28%, transparent)'},
  public:    {bg:'color-mix(in srgb, var(--teal, #2dd4bf) 14%, transparent)',    color:T.teal,     border:'color-mix(in srgb, var(--teal, #2dd4bf) 28%, transparent)'},
  reforestation: {bg:'color-mix(in srgb, var(--emerald, #10b981) 12%, transparent)', color:T.emeraldL, border:'color-mix(in srgb, var(--emerald, #10b981) 25%, transparent)'},
  renewable:     {bg:'color-mix(in srgb, var(--sky, #0ea5e9) 14%, transparent)', color:T.skyL, border:'color-mix(in srgb, var(--sky, #0ea5e9) 28%, transparent)'},
  methane:       {bg:'color-mix(in srgb, var(--gold, #f59e0b) 14%, transparent)', color:T.goldL, border:'color-mix(in srgb, var(--gold, #f59e0b) 28%, transparent)'},
  carbon_capture:{bg:'color-mix(in srgb, var(--violet, #7c3aed) 14%, transparent)', color:T.violetL, border:'color-mix(in srgb, var(--violet, #7c3aed) 28%, transparent)'},
  Platinum:{bg:'color-mix(in srgb, var(--t2) 12%, transparent)', color:T.t1, border:'color-mix(in srgb, var(--t2) 25%, transparent)'},
  Gold:    {bg:'color-mix(in srgb, var(--gold, #f59e0b) 16%, transparent)', color:T.goldL, border:'color-mix(in srgb, var(--gold, #f59e0b) 35%, transparent)'},
  Silver:  {bg:'color-mix(in srgb, var(--t3) 14%, transparent)', color:T.t2, border:'color-mix(in srgb, var(--t3) 25%, transparent)'},
  Bronze:  {bg:'color-mix(in srgb, var(--gold-l, #fbbf24) 14%, transparent)', color:T.gold, border:'color-mix(in srgb, var(--gold-l, #fbbf24) 25%, transparent)'},
};

/* ── Badge ──────────────────────────────────────────────── */
export function Badge({ type, label, children }) {
  const m = BM[type] || BM.public;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:5,
      padding:'2px 9px', borderRadius:20, fontSize:10.5, fontWeight:700,
      letterSpacing:'0.5px', textTransform:'uppercase',
      background:m.bg, color:m.color, border:`1px solid ${m.border}`,
    }}>
      <span style={{width:4,height:4,borderRadius:'50%',background:m.color,flexShrink:0,boxShadow:`0 0 4px ${m.color}`}}/>
      {children || label || type}
    </span>
  );
}

/* ── KPI Card ───────────────────────────────────────────── */
export function KPICard({ icon:Icon, label, value, sub, trend, color=T.teal }) {
  const [hov, setHov] = useState(false);
  const glowBg = withAlpha(color, '18', 12);
  const iconBg = withAlpha(color, '14', 12);
  const iconBorder = withAlpha(color, '30', 25);
  const borderHover = withAlpha(color, '44', 35);
  return (
    <div
      style={{
        ...gc({padding:22}),
        position:'relative', overflow:'hidden',
        transition:'all 0.22s cubic-bezier(0.4,0,0.2,1)',
        borderColor: hov ? borderHover : T.border,
        transform: hov ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hov
          ? `var(--shadow-card-hover, 0 8px 30px rgba(0,0,0,0.15))`
          : gc().boxShadow,
      }}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
    >
      {/* Glow orb */}
      <div style={{position:'absolute',top:-40,right:-40,width:120,height:120,borderRadius:'50%',background:`radial-gradient(circle, ${glowBg} 0%, transparent 65%)`,pointerEvents:'none',transition:'opacity 0.3s',opacity:hov?1:0.5}}/>
      {/* Top shimmer line */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg, transparent 0%, ${withAlpha(color, '60', 50)} 50%, transparent 100%)`,opacity:hov?1:0.4,transition:'opacity 0.3s'}}/>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
        <div style={{width:44,height:44,borderRadius:12,background:iconBg,border:`1px solid ${iconBorder}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon size={20} color={color} />
        </div>
        {trend==='up' && <span style={{display:'flex',alignItems:'center',gap:3,fontSize:11,color:T.emeraldL,fontWeight:700,background:'color-mix(in srgb, var(--emerald, #10b981) 12%, transparent)',padding:'2px 7px',borderRadius:20,border:'1px solid color-mix(in srgb, var(--emerald, #10b981) 25%, transparent)'}}><TrendingUp size={10}/>+12%</span>}
        {trend==='down' && <span style={{display:'flex',alignItems:'center',gap:3,fontSize:11,color:T.roseL,fontWeight:700,background:'color-mix(in srgb, var(--rose, #f43f5e) 12%, transparent)',padding:'2px 7px',borderRadius:20,border:'1px solid color-mix(in srgb, var(--rose, #f43f5e) 25%, transparent)'}}><TrendingDown size={10}/>−4%</span>}
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
          <tr style={{background:'var(--table-header-bg, rgba(255,255,255,0.02))'}}>
            {headers.map((h,i)=>(
              <th key={i} style={{padding:'9px 14px',textAlign:'left',fontSize:10,fontWeight:700,letterSpacing:'0.9px',textTransform:'uppercase',color:T.t3,borderBottom:`1px solid ${T.border}`}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row,i)=>(
            <tr key={i}
              style={{cursor:onRowClick?'pointer':'default',transition:'background 0.12s'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--table-hover, rgba(45,212,191,0.03))'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}
              onClick={()=>onRowClick&&onRowClick(row)}>
              {row.map((cell,j)=>(
                <td key={j} style={{padding:'12px 14px',fontSize:13,color:T.t2,borderBottom:`1px solid var(--table-border, rgba(255,255,255,0.03))`}}>{cell}</td>
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
      <div style={{width:60,height:4,background:'var(--border, rgba(255,255,255,0.07))',borderRadius:4,overflow:'hidden'}}>
        <div style={{width:`${score}%`,height:'100%',background:`linear-gradient(90deg, ${withAlpha(color, '70', 70)}, ${color})`,borderRadius:4,boxShadow:`0 0 6px ${withAlpha(color, '80', 60)}`}}/>
      </div>
      <span style={{fontSize:12,fontWeight:700,color,minWidth:22}}>{score}</span>
    </div>
  );
}

/* ── Modal ──────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, width=600 }) {
  if (!open) return null;
  return (
    <div style={{position:'fixed',inset:0,background:'var(--modal-backdrop, rgba(4,5,8,0.85))',backdropFilter:'blur(12px)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{
        background:'var(--modal-bg, #0c1020)',
        border:`1px solid var(--modal-border, rgba(45,212,191,0.18))`,
        boxShadow:`var(--shadow-modal, 0 25px 80px rgba(0,0,0,0.7))`,
        borderRadius:18,width:'100%',maxWidth:width,maxHeight:'90vh',overflow:'auto',
        animation:'fadeUp 0.2s ease',
      }}>
        <div style={{padding:'18px 24px',borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:15,fontWeight:700,color:T.t1}}>{title}</span>
          <button onClick={onClose} style={{background:'var(--glass2, rgba(255,255,255,0.05))',border:`1px solid ${T.border}`,color:T.t3,cursor:'pointer',width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,lineHeight:1,transition:'all 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.border2}
            onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>×</button>
        </div>
        <div style={{padding:24}}>{children}</div>
      </div>
    </div>
  );
}

/* ── Button ─────────────────────────────────────────────── */
export function Btn({ children, onClick, variant='primary', small, disabled, style={} }) {
  const vs = {
    primary:{
      background:`linear-gradient(135deg, ${T.teal} 0%, ${T.tealDD} 100%)`,
      border:'none', color:'#ffffff',
      boxShadow:`0 4px 20px var(--teal-glow, rgba(45,212,191,0.3)), inset 0 1px 0 rgba(255,255,255,0.2)`,
    },
    secondary:{
      background:'var(--btn-secondary-bg, rgba(255,255,255,0.05))',
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
      border:'none', color:'#fff',
      boxShadow:`0 4px 16px rgba(245,158,11,0.3), inset 0 1px 0 rgba(255,255,255,0.2)`,
    },
  };
  const base = vs[variant]||vs.primary;
  const sz = small?{padding:'5px 11px',fontSize:11}:{padding:'9px 18px',fontSize:13};
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        ...base, ...sz,
        borderRadius:9, fontWeight:700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        display:'inline-flex', alignItems:'center', gap:6,
        fontFamily:'Plus Jakarta Sans, sans-serif', transition:'all 0.18s',
        ...style
      }}
      onMouseEnter={e=>{if(!disabled){e.currentTarget.style.opacity='0.87';e.currentTarget.style.transform='translateY(-1px)';}}}
      onMouseLeave={e=>{if(!disabled){e.currentTarget.style.opacity='1';e.currentTarget.style.transform='translateY(0)';}}}>
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
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border, rgba(255,255,255,0.06))" strokeWidth={8}/>
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
