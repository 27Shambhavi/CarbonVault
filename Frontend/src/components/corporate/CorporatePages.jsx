import { useState, useEffect } from 'react';
import { useApp } from '../../AppContext.jsx';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { mockTransactions, mockGRSData, mockMarketplace, mockESGReport, generateMockESGReport } from '../../data/mockData.js';
import { fetchAllProjects, fetchMapProjects, fetchMarketplaceListings, createBuyRequest, createOrder, buyCredits, fetchTransactions, fetchWallet, generateESGReport, loadRazorpayScript } from '../../services/api.js';
import { Card, SectionHeader, Table, Badge, MRVScore, KPICard, Modal, Btn, T, ScoreGauge, withAlpha } from '../UI.jsx';
import { ProjectMap } from '../GoogleMap.jsx';
import { Package, FileText, Wallet as WalletIcon, TrendingUp, MapPin, Download, Star, ShoppingCart, Leaf, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';

const inp = { background:'var(--input-bg, rgba(255,255,255,0.04))', border:`1px solid ${T.border}`, borderRadius:9, padding:'10px 14px', color:T.t1, fontSize:14, outline:'none', width:'100%', fontFamily:'Plus Jakarta Sans, sans-serif' };

export function CorporateDashboard() {
  const { refreshKey } = useApp();
  const [projects, setProjects] = useState([]);
  const [mapFeatures, setMapFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const myTx = mockTransactions.filter(t=>t.buyer==='Microsoft Sustainability');
  const totalCredits = myTx.reduce((s,t)=>s+t.tons,0);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAllProjects(), fetchMapProjects()])
      .then(([allRes, mapRes]) => {
        if (!allRes.error && Array.isArray(allRes.data)) {
          setProjects(allRes.data.filter(p => p.status === 'approved'));
        }
        if (!mapRes.error && Array.isArray(mapRes.data?.projects)) {
          setMapFeatures(mapRes.data.projects);
        }
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Calculate real totals from backend data
  const realTotalCredits = projects.reduce((s, p) => s + (p.credits || 0), 0);
  const realTotalFunding = projects.reduce((s, p) => s + (p.total_funding || 0), 0);

  if (loading) return (
    <div style={{padding:28, display:'flex', justifyContent:'center', alignItems:'center', minHeight:'40vh'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:`3px solid rgba(45,212,191,0.15)`,borderTop:`3px solid ${T.teal}`,borderRadius:'50%',margin:'0 auto 16px',animation:'spinSlow 0.8s linear infinite'}}/>
        <div style={{fontSize:14,color:T.t2}}>Loading dashboard…</div>
      </div>
    </div>
  );

  return (
    <div style={{padding:28}}>
      <SectionHeader title="Corporate Dashboard" subtitle="Microsoft Sustainability — carbon portfolio overview"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:15,marginBottom:24}}>
        <KPICard icon={Package}    label="Available Credits"     value={realTotalCredits > 0 ? realTotalCredits.toLocaleString() : totalCredits.toLocaleString()} sub="Total tonnes CO₂e"    trend="up" color={T.violetLL || T.violetL}/>
        <KPICard icon={TrendingUp} label="Active Projects"       value={projects.length}          sub="Projects supported"   trend="up" color={T.teal}/>
        <KPICard icon={DollarSign} label="Total Value"           value={realTotalFunding > 0 ? `$${realTotalFunding.toLocaleString()}` : `$${(totalCredits * 28.5).toLocaleString()}`} sub="Portfolio value" trend="up" color={T.emeraldL}/>
        <KPICard icon={Star}       label="GRS Score"             value={mockGRSData.score}               sub="Gold Verifier status" trend="up" color={T.goldL}/>
      </div>
      <Card style={{marginBottom:22}}>
        <SectionHeader title="Supported Project Locations" subtitle="Approved plantation footprints (polygons from verification data)"/>
        <ProjectMap features={mapFeatures} height={360} />
      </Card>
      <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:18}}>
        <Card>
          <SectionHeader title="GRS Score"/>
          <div style={{display:'flex',justifyContent:'center',marginBottom:14}}><ScoreGauge score={mockGRSData.score} max={1000} label="/ 1000"/></div>
          <div style={{textAlign:'center',marginBottom:14}}><Badge type="Gold" label="Gold Verifier"/><div style={{fontSize:12,color:T.t3,marginTop:7}}>Rank #{mockGRSData.rank} of {mockGRSData.total}</div></div>
          {[{l:'Transparency',v:mockGRSData.transparency},{l:'Quality',v:mockGRSData.quality},{l:'Commitment',v:mockGRSData.commitment}].map(({l,v})=>(
            <div key={l} style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}><span style={{color:T.t3}}>{l}</span><span style={{color:T.teal,fontWeight:700}}>{v}%</span></div>
              <div style={{height:4,background:'var(--border, rgba(255,255,255,0.07))',borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${v}%`,background:`linear-gradient(90deg,${withAlpha(T.teal, '70', 60)},${T.teal})`,borderRadius:3}}/></div>
            </div>
          ))}
        </Card>
        <Card>
          <SectionHeader title="Available Projects"/>
          {projects.length > 0 ? (
            <Table headers={['Project','Type','Credits','Price/t','Total Value','Status']}
              rows={projects.map(p=>[
                <span style={{color:T.t1,fontWeight:600,fontSize:13}}>{p.name}</span>,
                <Badge type={p.plantation_type || 'other'} label={(p.plantation_type || 'other').replace('_',' ')}/>,
                <span style={{color:T.teal,fontWeight:700}}>{(p.credits||0).toLocaleString()}</span>,
                <span style={{color:T.goldL,fontWeight:600}}>{p.price_per_ton ? `$${p.price_per_ton}` : '—'}</span>,
                <span style={{color:T.emeraldL,fontWeight:700}}>{p.total_funding ? `$${(p.total_funding||0).toLocaleString()}` : '—'}</span>,
                <Badge type={p.status} label={p.status}/>,
              ])}/>
          ) : (
            <Table headers={['Date','Project','Tonnes','Price/t','Total','Receipt']}
              rows={myTx.map(t=>[
                <span style={{color:T.t3,fontSize:12}}>{t.date}</span>,
                <span style={{color:T.t1,fontWeight:600,fontSize:13}}>{t.project}</span>,
                <span style={{color:T.teal,fontWeight:700}}>{t.tons.toLocaleString()}</span>,
                <span style={{color:T.goldL,fontWeight:600}}>${t.price}</span>,
                <span style={{color:T.emeraldL,fontWeight:700}}>${t.total.toLocaleString()}</span>,
                <button style={{background:'rgba(124,58,237,0.1)',border:'1px solid rgba(167,139,250,0.25)',borderRadius:7,padding:'4px 10px',color:T.violetLL || T.violetL,fontSize:11,cursor:'pointer',fontWeight:700}}>{t.cert}</button>,
              ])}/>
          )}
        </Card>
      </div>
    </div>
  );
}

export function CorporateMarketplace() {
  const { refreshKey, triggerRefresh } = useApp();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyModal,setBuyModal] = useState(null);
  const [qty,setQty]           = useState(25);
  const [purchased,setPurchased] = useState({});
  const [filter,setFilter]     = useState('all');
  const [buying, setBuying]    = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchMarketplaceListings()
      .then(res => {
        if (!res.error && Array.isArray(res.data)) {
          setListings(res.data.length > 0 ? res.data : mockMarketplace);
        } else {
          setListings(mockMarketplace);
        }
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const filtered = filter==='all'?listings:listings.filter(p=>(p.type||'').toLowerCase()===filter);
  const types = ['all',...new Set(listings.map(p=>(p.type||'').toLowerCase()).filter(Boolean))];
  const inrAmount = (usd) => `₹${(usd*83.5).toLocaleString('en-IN',{maximumFractionDigits:0})}`;

  const handleRazorPay = async (item, quantity) => {
    setBuying(true);
    try {
      // 1. Ensure real Razorpay checkout script is loaded
      await loadRazorpayScript();

      // 2. Calculate amount in INR — price is per credit in USD, convert to INR
      const amountUSD = item.price * quantity;
      const amountINR = Math.round(amountUSD * 83.5);

      if (amountINR > 500000) {
        alert(`Notice: Razorpay Test Mode allows a maximum of ₹5,00,000 per order. Current total is ₹${amountINR.toLocaleString('en-IN')}. Please lower the quantity to test successfully.`);
        setBuying(false);
        return;
      }

      // 3. Persist buy request so it appears in NGO Corporate Buy Requests
      try {
        await createBuyRequest('Microsoft Sustainability', item.id, item.price);
      } catch (err) {
        console.warn('Could not record buy request before payment', err);
      }

      // 4. Create order on backend (backend converts INR -> paise, NO double conversion)
      const orderRes = await createOrder(amountINR, 'INR', item.id, 'Microsoft Sustainability');
      if (orderRes.error) {
        alert('Failed to create order: ' + orderRes.error);
        setBuying(false);
        return;
      }
      const order = orderRes.data;

      // 5. If in demo mode (no Razorpay keys), simulate payment automatically
      if (order.demo_mode) {
        const buyRes = await buyCredits({
          razorpay_order_id: order.id,
          razorpay_payment_id: "pay_demo_" + Math.random().toString(36).substring(7),
          razorpay_signature: "demo_signature",
          project_id: item.id,
          corporate_name: 'Microsoft Sustainability',
          quantity: quantity,
          amount: amountINR,
        });
        if (!buyRes.error) {
          setPurchased({...purchased, [item.id]: (purchased[item.id]||0) + quantity});
          alert(`Payment successful! ${quantity} credits purchased.`);
          triggerRefresh();
        } else {
          alert('Payment recorded but save failed: ' + buyRes.error);
        }
        setBuying(false);
        setBuyModal(null);
        return;
      }

      // 4. Open Razorpay popup
      const options = {
        key: order.key_id,
        amount: order.amount,  // already in paise from backend
        currency: order.currency || 'INR',
        name: 'CarbonVault',
        description: `${quantity} credits from ${item.name}`,
        order_id: order.id,
        handler: async function (response) {
          // 4. On success — record the purchase
          const buyRes = await buyCredits({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            project_id: item.id,
            corporate_name: 'Microsoft Sustainability',
            quantity: quantity,
            amount: amountINR,
          });
          if (!buyRes.error) {
            setPurchased({...purchased, [item.id]: (purchased[item.id]||0) + quantity});
            alert(`Payment successful! ${quantity} credits purchased.`);
            triggerRefresh();
          } else {
            alert('Payment recorded but save failed: ' + buyRes.error);
          }
          setBuying(false);
          setBuyModal(null);
        },
        modal: {
          ondismiss: function () {
            setBuying(false);
          }
        },
        prefill: {
          name: 'James Chen',
          email: 'corp@carbonvault.com',
          contact: '9999999999'
        },
        theme: { color: '#2dd4bf' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        alert('Payment failed: ' + (response.error?.description || 'Unknown error'));
        setBuying(false);
      });
      rzp.open();
    } catch (err) {
      alert('Payment error: ' + (err.message || err));
      setBuying(false);
    }
  };

  if (loading) return (
    <div style={{padding:28, display:'flex', justifyContent:'center', alignItems:'center', minHeight:'40vh'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:44,height:44,border:`3px solid rgba(45,212,191,0.15)`,borderTop:`3px solid ${T.teal}`,borderRadius:'50%',margin:'0 auto 16px',animation:'spinSlow 0.8s linear infinite'}}/>
        <div style={{fontSize:14,color:T.t2}}>Loading marketplace…</div>
      </div>
    </div>
  );

  return (
    <div style={{padding:28}}>
      <SectionHeader title="Carbon Credit Marketplace" subtitle="Browse verified projects and purchase credits via Razorpay"/>
      <div style={{display:'flex',gap:8,marginBottom:18,flexWrap:'wrap'}}>
        {types.map(t=>(
          <button key={t} onClick={()=>setFilter(t)} style={{background:filter===t?'rgba(45,212,191,0.1)':'rgba(255,255,255,0.03)',border:`1px solid ${filter===t?'rgba(45,212,191,0.35)':T.border}`,borderRadius:9,padding:'8px 16px',color:filter===t?T.teal:T.t3,fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'capitalize',transition:'all 0.15s'}}>
            {t==='all'?'All Types':t}
          </button>
        ))}
      </div>
      <Card>
        {listings.length === 0 ? (
          <div style={{textAlign:'center',padding:40,color:T.t3,fontSize:13}}>No marketplace listings available yet. Projects need to be approved first.</div>
        ) : (
          <Table headers={['Project ID','🌱','Project Name','Type','Location','Credits (t)','Area','Price/t','Buy']}
            rows={filtered.map(item=>[
              <span style={{color:T.teal,fontWeight:700,fontSize:12}}>{item.id}</span>,
              <div style={{width:34,height:34,borderRadius:8,background:'rgba(16,185,129,0.1)',border:'1px solid rgba(52,211,153,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🌱</div>,
              <span style={{fontWeight:700,color:T.t1,fontSize:13}}>{item.name}</span>,
              <Badge type={item.type==='Reforestation'?'reforestation':item.type==='Mangrove'?'renewable':item.type==='Methane'?'methane':'carbon_capture'} label={item.type}/>,
              <span style={{color:T.t3,fontSize:12,display:'flex',alignItems:'center',gap:4}}><MapPin size={10}/>{item.location}</span>,
              <span style={{color:item.credits>0?T.emeraldL:T.roseL,fontWeight:700}}>{item.credits>0?item.credits.toLocaleString():'Sold Out'}</span>,
              <span style={{color:T.t2}}>{item.area?item.area.toLocaleString()+' ha':'—'}</span>,
              <div>
                <div style={{color:T.goldL,fontWeight:700,fontSize:14}}>${item.price}</div>
                <div style={{color:T.t3,fontSize:10}}>{inrAmount(item.price)}</div>
              </div>,
              item.credits>0?(<button onClick={()=>{setBuyModal(item);setQty(Math.min(25, item.credits));}} style={{background:`linear-gradient(135deg,${T.teal},${T.tealDD || T.teal})`,border:'none',borderRadius:8,padding:'7px 15px',color:'#021a17',fontSize:12,fontWeight:800,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap'}} onMouseEnter={e=>{e.currentTarget.style.opacity='0.85';}} onMouseLeave={e=>{e.currentTarget.style.opacity='1';}}>Buy</button>)
              :(<span style={{color:T.roseL,fontSize:12,fontWeight:700}}>Sold Out</span>),
            ])}
          />
        )}
      </Card>

      <Modal open={!!buyModal} onClose={()=>setBuyModal(null)} title="Purchase Carbon Credits" width={450}>
        {buyModal&&(
          <div>
            <div style={{background:'rgba(45,212,191,0.06)',border:'1px solid rgba(45,212,191,0.18)',borderRadius:12,padding:16,marginBottom:18}}>
              <div style={{fontSize:14,fontWeight:700,color:T.t1,marginBottom:4}}>{buyModal.name}</div>
              <div style={{fontSize:12,color:T.t3}}>ID: {buyModal.id} · Verified: <span style={{color:T.emeraldL,fontWeight:700}}>{buyModal.verified || 85}%</span> · Available: <span style={{color:T.teal,fontWeight:700}}>{(buyModal.credits||0).toLocaleString()}t</span></div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:10,color:T.t3,fontWeight:700,letterSpacing:'0.7px',textTransform:'uppercase',marginBottom:7,display:'block'}}>Quantity (tonnes CO₂e)</label>
              <input type="number" value={qty} onChange={e=>setQty(Math.min(buyModal.credits||9999,Math.max(1,parseInt(e.target.value)||0)))} style={inp}/>
            </div>
            <div style={{background:'rgba(255,255,255,0.03)',borderRadius:10,padding:14,marginBottom:18}}>
              {[['Qty',`${qty.toLocaleString()} t`],['Price/t',`$${buyModal.price} (${inrAmount(buyModal.price)})`],['Total USD',`$${(qty*buyModal.price).toLocaleString()}`],['Total INR',inrAmount(qty*buyModal.price)]].map(([k,v],i)=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:i<3?`1px solid rgba(255,255,255,0.04)`:'none',fontSize:i===3?15:13}}>
                  <span style={{color:T.t3}}>{k}</span><span style={{color:i===3?T.emeraldL:T.t1,fontWeight:i===3?800:600,fontFamily:i===3?'Fraunces,serif':'inherit'}}>{v}</span>
                </div>
              ))}
            </div>
            {Math.round(qty * buyModal.price * 83.5) > 500000 && (
              <div style={{background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:8,padding:'8px 12px',marginBottom:14,fontSize:11,color:T.goldL,lineHeight:1.5}}>
                ⚠️ Order exceeds Razorpay test mode limit (₹5,00,000). Please decrease quantity for testing.
              </div>
            )}
            <Btn style={{width:'100%',justifyContent:'center',background:'linear-gradient(135deg,#072654,#1a56db)',color:'#fff',boxShadow:'0 4px 16px rgba(26,86,219,0.35)',border:'none'}}
              onClick={()=>handleRazorPay(buyModal,qty)} disabled={buying || Math.round(qty * buyModal.price * 83.5) > 500000}>
              {buying ? 'Processing…' : `💳 Pay ${inrAmount(qty*buyModal.price)} via Razorpay`}
            </Btn>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function CorporateWallet() {
  const { refreshKey } = useApp();
  const [transactions, setTransactions] = useState([]);
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const myTx = mockTransactions.filter(t=>t.buyer==='Microsoft Sustainability');
  const totalCredits = myTx.reduce((s,t)=>s+t.tons,0);
  const totalSpent   = myTx.reduce((s,t)=>s+t.total,0);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchTransactions('Microsoft Sustainability'),
      fetchWallet('Microsoft Sustainability'),
    ]).then(([txRes, walRes]) => {
      if (!txRes.error && Array.isArray(txRes.data)) setTransactions(txRes.data);
      if (!walRes.error && walRes.data) setWalletData(walRes.data);
    }).finally(() => setLoading(false));
  }, [refreshKey]);

  const realCredits = walletData?.total_credits || 0;
  const realSpentINR = walletData?.total_spent_inr || 0;
  const realSpentUSD = walletData?.total_spent_usd || 0;
  const inrAmount = (usd) => `₹${(usd*83.5).toLocaleString('en-IN',{maximumFractionDigits:0})}`;

  // Merge real + mock transactions for display
  const allTx = transactions.length > 0 ? transactions : [];

  return (
    <div style={{padding:28}}>
      <SectionHeader title="My Wallet" subtitle="Carbon credit holdings and transaction history" action={<Btn variant="secondary"><Download size={13}/>Export</Btn>}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:15,marginBottom:24}}>
        <KPICard icon={Package}    label="Total Credits"   value={realCredits > 0 ? realCredits.toLocaleString() : totalCredits.toLocaleString()} sub="Tonnes CO₂e held"           trend="up" color={T.violetLL || T.violetL}/>
        <KPICard icon={WalletIcon} label="Portfolio Value" value={realCredits > 0 ? `$${realSpentUSD.toLocaleString()}` : `$${(totalCredits*28.5).toLocaleString()}`} sub="At market price" trend="up" color={T.emeraldL}/>
        <KPICard icon={TrendingUp} label="Total Spent"     value={realSpentINR > 0 ? `₹${realSpentINR.toLocaleString('en-IN')}` : `$${totalSpent.toLocaleString()}`} sub="Lifetime" trend="up" color={T.teal}/>
      </div>
      <Card>
        <SectionHeader title="Transaction History"/>
        {allTx.length > 0 ? (
          <Table headers={['Date','Project','Project ID','Credit Tons','Price/t','Total (INR)','Status']}
            rows={allTx.map(t=>[
              <span style={{color:T.t3,fontSize:12}}>{t.date || '—'}</span>,
              <span style={{fontWeight:600,color:T.t1}}>{t.project_name || '—'}</span>,
              <span style={{color:T.teal,fontWeight:700,fontSize:12}}>{t.project_id}</span>,
              <span style={{color:T.teal,fontWeight:700}}>{(t.quantity||0).toLocaleString()}t</span>,
              <span style={{color:T.goldL}}>${t.price_per_ton || '—'}</span>,
              <span style={{color:T.emeraldL,fontWeight:700}}>₹{(t.amount_inr||0).toLocaleString('en-IN')}</span>,
              <Badge type={t.status === 'completed' ? 'approved' : 'pending'} label={t.status || 'completed'}/>,
            ])}
          />
        ) : (
          <Table headers={['Date','Project','Project ID','Credit Tons','Price/t','Total','Receipt']}
            rows={myTx.map(t=>[
              <span style={{color:T.t3,fontSize:12}}>{t.date}</span>,
              <span style={{fontWeight:600,color:T.t1}}>{t.project}</span>,
              <span style={{color:T.teal,fontWeight:700,fontSize:12}}>{t.projectId}</span>,
              <span style={{color:T.teal,fontWeight:700}}>{t.tons.toLocaleString()}t</span>,
              <span style={{color:T.goldL}}>${t.price}</span>,
              <span style={{color:T.emeraldL,fontWeight:700}}>${t.total.toLocaleString()}</span>,
              <button style={{background:'rgba(124,58,237,0.1)',border:'1px solid rgba(167,139,250,0.25)',borderRadius:7,padding:'5px 11px',color:T.violetLL || T.violetL,fontSize:12,cursor:'pointer',fontWeight:700,display:'flex',alignItems:'center',gap:4}}><Download size={10}/>{t.cert}</button>,
            ])}
          />
        )}
      </Card>
    </div>
  );
}

const ChartTooltip=({active,payload,label})=>{
  if(!active||!payload?.length)return null;
  return(<div style={{background:'var(--card-bg, #0c1020)',border:`1px solid ${T.border2}`,borderRadius:10,padding:'10px 14px',boxShadow:'var(--shadow-modal)'}}>
    <div style={{color:T.teal,fontSize:11,fontWeight:700,marginBottom:4}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{color:T.t2,fontSize:12}}><span style={{color:p.color||T.t1,fontWeight:700}}>{typeof p.value==='number'?p.value.toLocaleString():p.value}</span></div>)}
  </div>);
};

export function CorporateESG() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [usePortfolio, setUsePortfolio] = useState(true);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingProjects, setFetchingProjects] = useState(true);
  const [error, setError] = useState(null);
  const corporateName = 'Microsoft Sustainability';

  // Fetch projects on component mount
  useEffect(() => {
    setFetchingProjects(true);
    fetchAllProjects()
      .then(res => {
        if (!res.error && Array.isArray(res.data)) {
          const approved = res.data.filter(p => p.status === 'approved');
          setProjects(approved);
          if (approved.length > 0) setSelectedProject(approved[0].project_id || approved[0].id);
        }
      })
      .finally(() => setFetchingProjects(false));
  }, []);

  // Generate report handler
  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    
    try {
      const projectId = usePortfolio ? null : selectedProject;
      const result = await generateESGReport(corporateName, projectId);
      
      if (result.error) {
        // Fallback to mock data
        const mockResult = usePortfolio ? generateMockESGReport(null) : generateMockESGReport(projectId);
        if (mockResult.error) {
          setError(mockResult.error);
        } else {
          setReport(mockResult.data);
        }
      } else {
        setReport(result.data);
      }
    } catch (err) {
      setError('Failed to generate report. Using demo data.');
      const mockResult = usePortfolio ? generateMockESGReport(null) : generateMockESGReport(selectedProject);
      setReport(mockResult.data);
    } finally {
      setLoading(false);
    }
  };

  // PDF Export handler
  const handleExportPDF = () => {
    window.print();
  };

  if (fetchingProjects) {
    return (
      <div style={{padding:28,display:'flex',justifyContent:'center',alignItems:'center',minHeight:'60vh'}}>
        <div style={{textAlign:'center'}}>
          <div style={{width:44,height:44,border:`3px solid rgba(45,212,191,0.15)`,borderTop:`3px solid ${T.teal}`,borderRadius:'50%',margin:'0 auto 16px',animation:'spinSlow 0.8s linear infinite'}}/>
          <div style={{fontSize:14,color:T.t2}}>Loading projects…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{padding:28}}>
      <style>{`
        @media print {
          body { background: #fff !important; }
          .no-print { display: none !important; }
          .report-section { page-break-inside: avoid; }
          .chart-container { page-break-inside: avoid; }
        }
      `}</style>

      {/* Header & Controls */}
      <div style={{marginBottom:28}}>
        <SectionHeader title="ESG Reports" subtitle="Generate comprehensive Environmental, Social & Governance impact reports"/>
        
        {/* Project Selector */}
        <div className="no-print" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:22}}>
          <Card style={{padding:16}}>
            <label style={{fontSize:11,color:T.t3,fontWeight:700,letterSpacing:'0.7px',textTransform:'uppercase',marginBottom:10,display:'block'}}>Report Scope</label>
            <div style={{display:'flex',gap:10}}>
              <button
                onClick={() => { setUsePortfolio(true); setSelectedProject(null); }}
                style={{flex:1,padding:'10px 12px',borderRadius:9,border:`2px solid ${usePortfolio?T.teal:T.border}`,background:usePortfolio?`rgba(45,212,191,0.1)`:'rgba(255,255,255,0.03)',color:usePortfolio?T.teal:T.t2,fontWeight:700,fontSize:12,cursor:'pointer',transition:'all 0.15s'}}>
                Full Portfolio
              </button>
              <button
                onClick={() => setUsePortfolio(false)}
                style={{flex:1,padding:'10px 12px',borderRadius:9,border:`2px solid ${!usePortfolio?T.teal:T.border}`,background:!usePortfolio?`rgba(45,212,191,0.1)`:'rgba(255,255,255,0.03)',color:!usePortfolio?T.teal:T.t2,fontWeight:700,fontSize:12,cursor:'pointer',transition:'all 0.15s'}}>
                Single Project
              </button>
            </div>
          </Card>

          {!usePortfolio && (
            <Card style={{padding:16}}>
              <label style={{fontSize:11,color:T.t3,fontWeight:700,letterSpacing:'0.7px',textTransform:'uppercase',marginBottom:10,display:'block'}}>Select Project</label>
              <select
                value={selectedProject || ''}
                onChange={e => setSelectedProject(e.target.value)}
                style={{...inp,height:38}}>
                <option value="">Choose a project...</option>
                {projects.map(p => (
                  <option key={p.project_id || p.id} value={p.project_id || p.id}>
                    {p.name} ({(p.credits || 0).toLocaleString()} t)
                  </option>
                ))}
              </select>
            </Card>
          )}

          <Card style={{padding:16,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
            <Btn
              style={{width:'100%',justifyContent:'center'}}
              onClick={handleGenerateReport}
              disabled={loading || (!usePortfolio && !selectedProject)}>
              {loading ? '⟳ Generating…' : '📊 Generate Report'}
            </Btn>
          </Card>
        </div>

        {error && (
          <Card style={{background:`rgba(244,63,94,0.08)`,border:`1px solid rgba(244,63,94,0.2)`,padding:14,marginBottom:22,display:'flex',gap:12,alignItems:'flex-start'}}>
            <AlertCircle size={18} style={{color:T.rose,flexShrink:0,marginTop:2}}/>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.rose,marginBottom:3}}>Note</div>
              <div style={{fontSize:12,color:T.t3}}>{error}</div>
            </div>
          </Card>
        )}
      </div>

      {/* ESG Report Display */}
      {report && (
        <div>
          {/* Meta Section */}
          <Card style={{marginBottom:20}} className="report-section">
            <SectionHeader
              title="Report Summary"
              action={
                <div className="no-print" style={{display:'flex',gap:10}}>
                  <Btn variant="secondary" small onClick={handleExportPDF}>
                    <Download size={13}/> PDF Export
                  </Btn>
                </div>
              }
            />
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
              <div style={{background:`rgba(45,212,191,0.05)`,border:`1px solid rgba(45,212,191,0.1)`,borderRadius:10,padding:12}}>
                <div style={{fontSize:10,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:6}}>Company</div>
                <div style={{fontSize:14,fontWeight:700,color:T.t1}}>{report.meta.company}</div>
              </div>
              <div style={{background:`rgba(45,212,191,0.05)`,border:`1px solid rgba(45,212,191,0.1)`,borderRadius:10,padding:12}}>
                <div style={{fontSize:10,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:6}}>Reporting Year</div>
                <div style={{fontSize:14,fontWeight:700,color:T.t1}}>{report.meta.reporting_year}</div>
              </div>
              <div style={{background:`rgba(45,212,191,0.05)`,border:`1px solid rgba(45,212,191,0.1)`,borderRadius:10,padding:12}}>
                <div style={{fontSize:10,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:6}}>Scope</div>
                <div style={{fontSize:13,fontWeight:700,color:T.teal}}>{report.meta.scope}</div>
              </div>
              <div style={{background:`rgba(45,212,191,0.05)`,border:`1px solid rgba(45,212,191,0.1)`,borderRadius:10,padding:12}}>
                <div style={{fontSize:10,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:6}}>Generated</div>
                <div style={{fontSize:12,fontWeight:700,color:T.t1}}>{new Date(report.meta.generated_timestamp).toLocaleDateString()}</div>
              </div>
            </div>
          </Card>

          {/* ESG Scores Summary */}
          <Card style={{marginBottom:20}} className="report-section">
            <SectionHeader title="ESG Score Breakdown"/>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:20}}>
              {[
                {label:'Environmental',value:report.esg_scores.environmental,color:T.emeraldL},
                {label:'Social',value:report.esg_scores.social,color:T.skyL},
                {label:'Governance',value:report.esg_scores.governance,color:T.goldL},
              ].map(({label,value,color})=>(
                <div key={label} style={{textAlign:'center'}}>
                  <div style={{fontSize:11,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:12}}>{label}</div>
                  <svg width={140} height={140} viewBox="0 0 140 140" style={{margin:'0 auto',display:'block'}}>
                    <defs>
                      <linearGradient id={`g${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={color} stopOpacity="0.4"/>
                        <stop offset="100%" stopColor={color}/>
                      </linearGradient>
                    </defs>
                    <circle cx={70} cy={70} r={55} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6}/>
                    <circle cx={70} cy={70} r={55} fill="none" stroke={`url(#g${label})`} strokeWidth={6}
                      strokeDasharray={`${(value/100)*345} 345`} strokeLinecap="round"
                      transform="rotate(-90 70 70)"
                      style={{filter:`drop-shadow(0 0 8px ${color})`}}/>
                    <text x={70} y={65} textAnchor="middle" fill={T.t1} fontSize={28} fontWeight={800} fontFamily="Fraunces, serif">{value}</text>
                    <text x={70} y={85} textAnchor="middle" fill={T.t3} fontSize={10} fontFamily="Plus Jakarta Sans, sans-serif">/ 100</text>
                  </svg>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={[
                  {name:'Environmental',value:report.esg_scores.environmental,fill:T.emeraldL},
                  {name:'Social',value:report.esg_scores.social,fill:T.skyL},
                  {name:'Governance',value:report.esg_scores.governance,fill:T.goldL},
                ]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  {[{name:'Environmental',value:report.esg_scores.environmental,fill:T.emeraldL},
                    {name:'Social',value:report.esg_scores.social,fill:T.skyL},
                    {name:'Governance',value:report.esg_scores.governance,fill:T.goldL}].map((entry,i)=>(
                    <Cell key={i} fill={entry.fill}/>
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Environmental Impact */}
          <Card style={{marginBottom:20}} className="report-section">
            <SectionHeader title="Environmental Impact"/>
            
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24}}>
              <div style={{background:`rgba(16,185,129,0.08)`,border:`1px solid rgba(16,185,129,0.15)`,borderRadius:12,padding:16}}>
                <div style={{fontSize:11,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:8}}>Carbon Offset</div>
                <div style={{fontSize:32,fontWeight:900,color:T.emeraldL,fontFamily:'Fraunces, serif',letterSpacing:'-1px'}}>{report.environmental.carbon_offset_total.toLocaleString()}</div>
                <div style={{fontSize:12,color:T.t3,marginTop:4}}>tonnes CO₂e</div>
                <div style={{fontSize:11,color:T.t4,marginTop:6}}>≈ ${report.environmental.carbon_offset_value_usd.toLocaleString()}</div>
              </div>
              <div style={{background:`rgba(20,184,166,0.08)`,border:`1px solid rgba(20,184,166,0.15)`,borderRadius:12,padding:16}}>
                <div style={{fontSize:11,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:8}}>Biodiversity Score</div>
                <div style={{fontSize:32,fontWeight:900,color:T.tealL,fontFamily:'Fraunces, serif',letterSpacing:'-1px'}}>{(report.environmental.biodiversity_score * 100).toFixed(0)}/100</div>
                <div style={{fontSize:12,color:T.t3,marginTop:4}}>Ecosystem health</div>
              </div>
              <div style={{background:`rgba(59,130,246,0.08)`,border:`1px solid rgba(59,130,246,0.15)`,borderRadius:12,padding:16}}>
                <div style={{fontSize:11,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:8}}>Water Conservation</div>
                <div style={{fontSize:32,fontWeight:900,color:T.skyL,fontFamily:'Fraunces, serif',letterSpacing:'-1px'}}>{(report.environmental.water_conservation_ml / 1_000_000).toFixed(1)}M</div>
                <div style={{fontSize:12,color:T.t3,marginTop:4}}>litres saved</div>
              </div>
            </div>

            {/* NDVI Trend Chart */}
            <div style={{marginBottom:20}} className="chart-container">
              <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:12}}>NDVI Monthly Trend (Vegetation Index)</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={report.environmental.ndvi_trend}>
                  <defs><linearGradient id="ndviGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.emeraldL} stopOpacity={0.3}/><stop offset="100%" stopColor={T.emeraldL} stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="month" tick={{fill:T.t3,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis domain={[0,1]} tick={{fill:T.t3,fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Line type="monotone" dataKey="value" stroke={T.emeraldL} strokeWidth={2} dot={{r:3,fill:T.emeraldL}} isAnimationActive={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* LST Trend Chart */}
            <div className="chart-container">
              <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:12}}>Land Surface Temperature Trend (°C)</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={report.environmental.lst_trend}>
                  <defs><linearGradient id="lstGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.skyL} stopOpacity={0.3}/><stop offset="100%" stopColor={T.skyL} stopOpacity={0}/></linearGradient></defs>
                  <XAxis dataKey="month" tick={{fill:T.t3,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis domain={[20,28]} tick={{fill:T.t3,fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Line type="monotone" dataKey="value" stroke={T.skyL} strokeWidth={2} dot={{r:3,fill:T.skyL}} isAnimationActive={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Social Impact */}
          <Card style={{marginBottom:20}} className="report-section">
            <SectionHeader title="Social Impact"/>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
              <div style={{background:`rgba(14,165,233,0.08)`,border:`1px solid rgba(14,165,233,0.15)`,borderRadius:12,padding:16}}>
                <div style={{fontSize:11,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:8}}>Communities Supported</div>
                <div style={{fontSize:32,fontWeight:900,color:T.skyL,fontFamily:'Fraunces, serif',letterSpacing:'-1px'}}>{report.social.communities_supported}</div>
                <div style={{fontSize:12,color:T.t3,marginTop:4}}>Local communities</div>
              </div>
              <div style={{background:`rgba(34,197,94,0.08)`,border:`1px solid rgba(34,197,94,0.15)`,borderRadius:12,padding:16}}>
                <div style={{fontSize:11,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:8}}>Jobs Created</div>
                <div style={{fontSize:32,fontWeight:900,color:T.emeraldL,fontFamily:'Fraunces, serif',letterSpacing:'-1px'}}>{report.social.jobs_created.toLocaleString()}</div>
                <div style={{fontSize:12,color:T.t3,marginTop:4}}>{report.social.jobs_permanent} permanent, {report.social.jobs_seasonal} seasonal</div>
              </div>
              <div style={{background:`rgba(245,158,11,0.08)`,border:`1px solid rgba(245,158,11,0.15)`,borderRadius:12,padding:16}}>
                <div style={{fontSize:11,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:8}}>Training & CSR</div>
                <div style={{fontSize:28,fontWeight:900,color:T.goldL,fontFamily:'Fraunces, serif',letterSpacing:'-1px'}}>{report.social.csr_initiatives}</div>
                <div style={{fontSize:12,color:T.t3,marginTop:4}}>{report.social.training_hours.toLocaleString()} training hours</div>
              </div>
            </div>
          </Card>

          {/* Governance */}
          <Card style={{marginBottom:20}} className="report-section">
            <SectionHeader title="Governance & Compliance"/>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:20}}>
              <div>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:10}}>Compliance Score</div>
                  <div style={{display:'flex',alignItems:'flex-end',gap:12}}>
                    <div style={{fontSize:42,fontWeight:900,color:T.teal,fontFamily:'Fraunces, serif'}}>{(report.governance.compliance_score * 100).toFixed(0)}</div>
                    <div style={{fontSize:12,color:T.t3,marginBottom:8}}>/100</div>
                  </div>
                  <div style={{height:6,background:'var(--border, rgba(255,255,255,0.07))',borderRadius:3,marginTop:10,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${report.governance.compliance_score * 100}%`,background:`linear-gradient(90deg,${T.teal},${T.tealDD})`,borderRadius:3,boxShadow:`0 0 8px ${withAlpha(T.teal, '60', 40)}`}}/>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  <div style={{background:`rgba(14,165,233,0.05)`,border:`1px solid rgba(14,165,233,0.1)`,borderRadius:10,padding:12}}>
                    <div style={{fontSize:10,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:6}}>Audit Status</div>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <CheckCircle size={14} color={T.emeraldL}/>
                      <span style={{fontSize:13,fontWeight:700,color:T.emeraldL}}>{report.governance.audit_status}</span>
                    </div>
                  </div>
                  <div style={{background:`rgba(168,85,247,0.05)`,border:`1px solid rgba(168,85,247,0.1)`,borderRadius:10,padding:12}}>
                    <div style={{fontSize:10,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:6}}>Risk Level</div>
                    <div style={{fontSize:13,fontWeight:700,color:report.governance.risk_level==='Low'?T.emeraldL:report.governance.risk_level==='Medium'?T.goldL:T.rose}}>{report.governance.risk_level}</div>
                  </div>
                </div>
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:T.t2,marginBottom:12}}>Certifications</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {report.governance.certifications.map((cert,i)=>(
                    <div key={i} style={{background:`rgba(45,212,191,0.08)`,border:`1px solid rgba(45,212,191,0.15)`,borderRadius:8,padding:'8px 12px',fontSize:11,color:T.teal,fontWeight:700}}>
                      ✓ {cert}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Carbon by Project */}
          {!usePortfolio === false && report.carbon_by_project && report.carbon_by_project.length > 1 && (
            <Card style={{marginBottom:20}} className="report-section">
              <SectionHeader title="Carbon Offsets by Project"/>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={report.carbon_by_project}>
                  <defs><linearGradient id="carbonGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={T.teal}/><stop offset="100%" stopColor={T.tealDD} stopOpacity={0.7}/></linearGradient></defs>
                  <XAxis dataKey="name" tick={{fill:T.t3,fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:T.t3,fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Bar dataKey="value" radius={[6,6,0,0]} fill="url(#carbonGrad)"/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Methodology & Verification */}
          <Card className="report-section">
            <SectionHeader title="Methodology & Verification"/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
              <div>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:6}}>Verification Method</div>
                  <div style={{fontSize:13,color:T.t1}}>{report.methodology.verification_method}</div>
                </div>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:6}}>Analysis Engine</div>
                  <div style={{fontSize:13,color:T.t1}}>{report.methodology.engine}</div>
                </div>
                <div>
                  <div style={{fontSize:11,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:6}}>Confidence Level</div>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{height:4,flex:1,background:'rgba(255,255,255,0.07)',borderRadius:3,overflow:'hidden'}}>
                      <div style={{height:'100%',width:`${report.methodology.confidence_level * 100}%`,background:`linear-gradient(90deg,${T.teal},${T.tealDD})`,borderRadius:3}}/>
                    </div>
                    <span style={{fontSize:12,fontWeight:700,color:T.teal,minWidth:40}}>{(report.methodology.confidence_level * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
              <div>
                <div style={{fontSize:11,color:T.t3,fontWeight:700,letterSpacing:'0.5px',textTransform:'uppercase',marginBottom:12}}>Standards & Frameworks</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {report.methodology.standards.map((std,i)=>(
                    <div key={i} style={{background:`rgba(167,139,250,0.08)`,border:`1px solid rgba(167,139,250,0.15)`,borderRadius:8,padding:'10px 12px',fontSize:12,color:T.violetL,fontWeight:600}}>
                      • {std}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{marginTop:20,padding:14,background:`rgba(45,212,191,0.05)`,borderRadius:10,fontSize:11,color:T.t3,lineHeight:1.6}}>
              <strong style={{color:T.teal}}>Report Integrity:</strong> This ESG report was generated using satellite-derived environmental metrics (NDVI & Land Surface Temperature proxies) and verified through our MRV-engine. Data is aligned with GRI 305, ISSB IFRS S2, and TCFD frameworks for investor and auditor acceptance.
            </div>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!report && !loading && (
        <Card style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'50vh',padding:56}}>
          <div style={{fontSize:56,marginBottom:16}}>📊</div>
          <div style={{fontFamily:'Fraunces, serif',fontSize:24,fontWeight:900,color:T.t1,letterSpacing:'-0.5px',marginBottom:8}}>Ready to Generate</div>
          <div style={{fontSize:13,color:T.t3,textAlign:'center',maxWidth:400,lineHeight:1.6}}>
            Select your reporting scope (Full Portfolio or Single Project) and click "Generate Report" to create a comprehensive ESG impact report with charts, metrics, and verified data.
          </div>
        </Card>
      )}
    </div>
  );
}
