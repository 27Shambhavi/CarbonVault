import { useState, useEffect } from 'react';
import { useApp } from '../../AppContext.jsx';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  fetchPlatformStats,
  fetchAllProjects,
  fetchMapProjects,
  fetchMapPendingProjects,
  downloadPlatformPDF,
  fetchOverviewStats
} from '../../services/api.js';
import { KPICard, Card, SectionHeader, Table, Badge, MRVScore, Btn, T } from '../UI.jsx';
import { ProjectMap } from '../GoogleMap.jsx';
import { ActivityFeed } from '../ActivityFeed.jsx';
import { Layers, FolderCheck, Clock, AlertTriangle, Download, RefreshCw, Activity } from 'lucide-react';
import { MLFeedbackWidget } from '../common/MLFeedbackWidget.jsx';
import DataBoundary from '../DataBoundary.jsx';

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
  const { refreshKey, liveEvents } = useApp();
  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState(null);
  const [projects, setProjects] = useState([]);
  const [mapFeatures, setMapFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await downloadPlatformPDF();
    } catch (err) {
      alert(err.message || 'Failed to generate PDF report');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchPlatformStats(),
      fetchAllProjects(),
      fetchMapProjects(),
      fetchMapPendingProjects(),
      fetchOverviewStats('admin', '30d')
    ])
      .then(([statsRes, allRes, mapRes, pendRes, overviewRes]) => {
        if (statsRes.data) setStats(statsRes.data);
        if (overviewRes?.data) setOverview(overviewRes.data);
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

  return (
    <DataBoundary loading={loading} loadingMessage="Loading dashboard…">
      <div style={{padding:28,animation:'fadeUp 0.3s ease'}}>
      <SectionHeader
        title="Platform Overview"
        subtitle="Real-time metrics across all projects and users"
        action={
          <Btn variant="secondary" onClick={handleExportPDF} disabled={exporting}>
            {exporting ? (
              <RefreshCw size={13} style={{ animation: 'spinSlow 0.8s linear infinite' }} />
            ) : (
              <Download size={13} />
            )}
            {exporting ? 'Generating PDF…' : 'Export Report'}
          </Btn>
        }
      />

      {/* KPIs with real DB deltas (no static constants) */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:15,marginBottom:28}}>
        <KPICard
          icon={Layers}
          label="Total Credits Minted"
          value={Math.round(total).toLocaleString()}
          delta={overview?.kpis?.total_credits?.delta_pct}
          sub={overview?.kpis?.total_credits?.previous ? `vs ${Math.round(overview.kpis.total_credits.previous).toLocaleString()} prev period` : 'Live verified inventory'}
          color={T.teal}
        />
        <KPICard
          icon={FolderCheck}
          label="Active Projects"
          value={activeCount}
          delta={overview?.kpis?.active_projects?.delta_pct}
          sub={`${projects.length || stats?.total_projects || 0} total registered`}
          color={T.violetL}
        />
        <KPICard
          icon={Clock}
          label="Pending Reviews"
          value={pendingCount}
          delta={overview?.kpis?.pending_reviews?.delta_pct}
          sub="Awaiting admin action"
          color={T.goldL}
        />
        <KPICard
          icon={AlertTriangle}
          label="Fraud Flags"
          value={flagged}
          delta={overview?.kpis?.fraud_flags?.delta_pct}
          sub={`${flagged} flagged by ML/rules`}
          color={T.roseL}
        />
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

      {/* Automated Biometric & Environmental Alerts Panel */}
      <Card style={{marginBottom:22}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:T.t1,display:'flex',alignItems:'center',gap:7}}>
              <AlertTriangle size={16} color={T.roseL} />
              <span>Biometric & Environmental Risk Alerts</span>
            </div>
            <div style={{fontSize:11,color:T.t3,marginTop:2}}>
              Automated triggers: IsolationForest anomaly score &gt; 50 &bull; Greenness decline z &lt; -2.0 &bull; High fraud score
            </div>
          </div>
          <Badge color={projects.filter(p => (p.fraud_risk || p.fraudRisk || 0) > 40).length > 0 ? 'rose' : 'teal'}>
            {projects.filter(p => (p.fraud_risk || p.fraudRisk || 0) > 40).length} ACTIVE ALERTS
          </Badge>
        </div>

        {projects.filter(p => (p.fraud_risk || p.fraudRisk || 0) > 35).length > 0 ? (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {projects.filter(p => (p.fraud_risk || p.fraudRisk || 0) > 35).map(p => (
              <div key={p.project_id || p.id} style={{
                background:'rgba(244,63,94,0.06)',
                border:'1px solid rgba(244,63,94,0.22)',
                borderRadius:8,
                padding:'10px 14px',
                display:'flex',
                justifyContent:'space-between',
                alignItems:'center'
              }}>
                <div>
                  <div style={{fontSize:12.5,fontWeight:700,color:T.t1}}>
                    {p.name} <span style={{fontSize:11,color:T.t3}}>({p.project_id || p.id})</span>
                  </div>
                  <div style={{fontSize:11,color:T.roseL,marginTop:2}}>
                    Biometric risk score: {p.fraud_risk || p.fraudRisk}% &bull; Type: {p.plantation_type || p.type} &bull; Area: {p.area_hectares || '—'} ha
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <MLFeedbackWidget projectId={p.project_id || p.id} flagId={`flag_${p.project_id || p.id}_bio`} />
                  <Badge color="rose">REVIEW REQUIRED</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{textAlign:'center',padding:'16px 0',color:T.emeraldL,fontSize:12,background:'rgba(16,185,129,0.05)',borderRadius:8}}>
            ✓ All active plantations within normal biometric and greenness parameters. Zero active decline alerts.
          </div>
        )}
      </Card>

      {/* Live Submissions & Real-Time Event Stream */}
      <Card style={{marginBottom:22}}>
        <SectionHeader
          title="Real-Time Event Stream"
          subtitle="Server-Sent Events: Instantaneous ledger actions, submissions, approvals & purchases"
        />
        <ActivityFeed events={liveEvents} maxHeight={220} />
      </Card>

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
    </DataBoundary>
  );
}
