import { useState, useEffect } from 'react';
import { useApp } from '../../AppContext.jsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { mockCreditsByType } from '../../data/mockData.js';
import { fetchPlatformStats, fetchAllProjects, fetchMapProjects, fetchMapPendingProjects } from '../../services/api.js';
import { KPICard, Card, SectionHeader, Table, Badge, MRVScore, Btn, T } from '../UI.jsx';
import { ProjectMap } from '../GoogleMap.jsx';
import { Layers, FolderCheck, Clock, AlertTriangle, Download } from 'lucide-react';

const CT = ({active,payload,label}) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:'#0c1020',border:'1px solid rgba(45,212,191,0.2)',borderRadius:10,padding:'10px 14px',boxShadow:'0 8px 24px rgba(0,0,0,0.5)'}}>
      <div style={{color:T.teal,fontSize:11,fontWeight:700,marginBottom:4}}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{color:T.t2,fontSize:12}}>{p.name}: <span style={{color:T.t1,fontWeight:700}}>{typeof p.value==='number'?p.value.toLocaleString():p.value}</span></div>)}
    </div>
  );
};

export default function AdminDashboard() {
  const { refreshKey } = useApp();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [mapFeatures, setMapFeatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPlatformStats(), fetchAllProjects(), fetchMapProjects(), fetchMapPendingProjects()])
      .then(([statsRes, allRes, mapRes, pendRes]) => {
        if (statsRes.data) setStats(statsRes.data);
        if (!allRes.error && Array.isArray(allRes.data)) {
          setProjects(allRes.data);
        }
        const approved = mapRes.data?.projects || [];
        const pending = pendRes.data?.projects || [];
        setMapFeatures([...approved, ...pending]);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const activeCount = stats?.active_projects ?? projects.filter(p => p.status === 'approved').length;
  const pendingCount = stats?.pending_projects ?? projects.filter(p => p.status === 'pending').length;
  const flagged = projects.filter(p => (p.fraudRisk || 0) > 50).length;
  const approvedProjects = projects.filter(p => p.status === 'approved');
  const total = stats?.total_credits ?? approvedProjects.reduce((s, p) => s + (p.credits || 0), 0);
  const pieColors = [T.emerald, T.sky, T.goldL, T.violetL];

  // Build pie data from approved projects (consistent with Total Credits Minted)
  const typeMap = {};
  approvedProjects.forEach(p => {
    const type = (p.plantation_type || p.type || 'Other').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    typeMap[type] = (typeMap[type] || 0) + (p.credits || 0);
  });
  const pieData = Object.keys(typeMap).length > 0
    ? Object.entries(typeMap).map(([name, value]) => ({ name, value }))
    : [{ name: 'Mixed', value: total }];

  if (loading) return (
    <div style={{padding:28, display:'flex', justifyContent:'center', alignItems:'center', minHeight:'40vh'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:`3px solid rgba(45,212,191,0.15)`,borderTop:`3px solid ${T.teal}`,borderRadius:'50%',margin:'0 auto 16px',animation:'spinSlow 0.8s linear infinite'}}/>
        <div style={{fontSize:14,color:T.t2}}>Loading dashboard…</div>
      </div>
    </div>
  );

  return (
    <div style={{padding:28,animation:'fadeUp 0.3s ease'}}>
      <SectionHeader
        title="Platform Overview"
        subtitle="Real-time metrics across all projects and users"
        action={<Btn variant="secondary"><Download size={13}/>Export Report</Btn>}
      />

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:15,marginBottom:28}}>
        <KPICard icon={Layers}        label="Total Credits Minted" value={Math.round(total).toLocaleString()} sub="+12% this month"        trend="up"   color={T.teal}/>
        <KPICard icon={FolderCheck}   label="Active Projects"      value={activeCount} sub={`${projects.length || stats?.total_projects || 0} total`} trend="up" color={T.violetL}/>
        <KPICard icon={Clock}         label="Pending Reviews"       value={pendingCount}                sub="Avg 2.1 days"           trend="down" color={T.goldL}/>
        <KPICard icon={AlertTriangle} label="Fraud Flags"           value={flagged}                sub={`${flagged} flagged`}   trend="up"   color={T.roseL}/>
      </div>

      {/* Map + Pie row */}
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:18,marginBottom:22}}>
        <Card style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'20px 24px 14px'}}>
            <SectionHeader title="Plantation Project Locations" subtitle="Approved (green) and pending (yellow) plantation boundaries from stored polygons"/>
          </div>
          <div style={{paddingBottom:0}}>
            <ProjectMap features={mapFeatures} adminMode height={260} />
          </div>
        </Card>

        <Card>
          <SectionHeader title="By Project Type"/>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} innerRadius={30} dataKey="value" paddingAngle={4}>
                {pieData.map((_,i)=><Cell key={i} fill={pieColors[i % pieColors.length]}/>)}
              </Pie>
              <Tooltip content={<CT/>}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:6}}>
            {pieData.map((t,i)=>(
              <div key={t.name} style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:7,fontSize:11,color:T.t3}}>
                  <div style={{width:7,height:7,borderRadius:2,background:pieColors[i % pieColors.length],flexShrink:0,boxShadow:`0 0 4px ${pieColors[i % pieColors.length]}`}}/>
                  {t.name}
                </div>
                <span style={{fontSize:11,fontWeight:700,color:T.t2}}>{t.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card style={{marginBottom:22}}>
        <SectionHeader title="Project Activity Log" subtitle="Latest submissions and admin decisions"/>
        <Table
          headers={['Project','NGO','Type','Status','Credits','Date']}
          rows={projects.map(p=>[
            <span style={{fontWeight:600,color:T.t1,fontSize:13}}>{p.name}</span>,
            <span style={{color:T.t3,fontSize:12}}>{p.ngo || 'Unknown'}</span>,
            <Badge type={p.plantation_type || p.type || 'other'} label={(p.plantation_type || p.type || 'other').replace('_',' ')}/>,
            <Badge type={p.status} label={p.status}/>,
            <span style={{color:T.teal,fontWeight:700}}>{p.credits ? p.credits.toLocaleString() : '—'}</span>,
            <span style={{color:T.t3,fontSize:12}}>{p.start_date || p.created_at || '—'}</span>,
          ])}
        />
      </Card>

      {/* Bottom stat cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:15}}>
        {[
          {label:'Approval Rate', value: projects.length > 0 ? `${Math.round(projects.filter(p=>p.status==='approved').length/projects.length*100)}%` : '—', desc:`${projects.filter(p=>p.status==='approved').length} of ${projects.length} projects approved`, color:T.emeraldL},
          {label:'Avg Processing Time',  value:'2.1 days', desc:'Submission to decision',       color:T.teal},
          {label:'Pending Reviews', value: String(pendingCount), desc:`${pendingCount} awaiting admin review`, color:T.goldL},
        ].map(({label,value,desc,color})=>(
          <Card key={label} style={{textAlign:'center',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg, transparent, ${color}60, transparent)`}}/>
            <div style={{fontSize:38,fontWeight:900,color,fontFamily:'Fraunces, serif',letterSpacing:'-1.5px',lineHeight:1,textShadow:`0 0 20px ${color}50`}}>{value}</div>
            <div style={{fontSize:13,fontWeight:700,color:T.t1,marginTop:10}}>{label}</div>
            <div style={{fontSize:11,color:T.t3,marginTop:4}}>{desc}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
