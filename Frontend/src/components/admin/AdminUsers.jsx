import { useState } from 'react';
import { mockUsers } from '../../data/mockData.js';
import { Card, SectionHeader, Table, Badge, Modal, Btn, T } from '../UI.jsx';
import { Search, UserPlus } from 'lucide-react';

export default function AdminUsers() {
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [sel,setSel]=useState(null);
  const [invite,setInvite]=useState(false);

  const filtered = mockUsers.filter(u=>
    (filter==='all'||u.role===filter) &&
    (u.name.toLowerCase().includes(search.toLowerCase())||u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const inp = {background:'var(--input-bg, rgba(255,255,255,0.04))',border:`1px solid ${T.border}`,borderRadius:9,padding:'10px 14px',color:T.t1,fontSize:14,outline:'none',width:'100%',fontFamily:'Plus Jakarta Sans, sans-serif'};

  return (
    <div style={{padding:28}}>
      <SectionHeader title="User Management" subtitle="Manage platform users, roles and access levels" action={<Btn onClick={()=>setInvite(true)}><UserPlus size={13}/>Invite User</Btn>}/>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:13,marginBottom:22}}>
        {[
          {l:'Total Users',value:mockUsers.length,              color:T.t1},
          {l:'NGOs',       value:mockUsers.filter(u=>u.role==='ngo').length,   color:T.skyL},
          {l:'Buyers',     value:mockUsers.filter(u=>u.role==='buyer').length, color:T.violetLL},
          {l:'Suspended',  value:mockUsers.filter(u=>u.status==='suspended').length, color:T.roseL},
        ].map(({l,value,color})=>(
          <div key={l} style={{background:'var(--card-bg, rgba(255,255,255,0.03))',border:`1px solid ${T.border}`,borderRadius:12,padding:'16px 18px',textAlign:'center',position:'relative',overflow:'hidden',boxShadow:'var(--shadow-card)'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${color}40,transparent)`}}/>
            <div style={{fontSize:30,fontWeight:800,fontFamily:'Fraunces, serif',color,letterSpacing:'-1px'}}>{value}</div>
            <div style={{fontSize:10,color:T.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.6px',marginTop:5}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:10,marginBottom:18}}>
        <div style={{position:'relative',flex:1,maxWidth:340}}>
          <Search size={13} color={T.t3} style={{position:'absolute',left:13,top:12}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users..."
            style={{...inp,paddingLeft:36}}/>
        </div>
        {['all','ngo','buyer','admin'].map(r=>(
          <button key={r} onClick={()=>setFilter(r)}
            style={{background:filter===r?'rgba(45,212,191,0.1)':'rgba(255,255,255,0.04)',border:`1px solid ${filter===r?'rgba(45,212,191,0.35)':T.border}`,borderRadius:9,padding:'9px 16px',color:filter===r?T.teal:T.t3,fontSize:12,fontWeight:700,cursor:'pointer',textTransform:'capitalize',transition:'all 0.15s'}}>
            {r==='all'?'All Users':r.toUpperCase()}
          </button>
        ))}
      </div>

      <Card>
        <Table
          headers={['Organization','Email','Role','Projects','Credits','Joined','Status','Actions']}
          rows={filtered.map(u=>[
            <span style={{fontWeight:700,color:T.t1}}>{u.name}</span>,
            <span style={{color:T.t3,fontSize:12}}>{u.email}</span>,
            <Badge type={u.role} label={u.role.toUpperCase()}/>,
            <span style={{color:T.teal,fontWeight:600}}>{u.projects}</span>,
            <span style={{color:T.emeraldL,fontWeight:700}}>{u.credits.toLocaleString()}</span>,
            <span style={{color:T.t3,fontSize:12}}>{u.joined}</span>,
            <Badge type={u.status} label={u.status}/>,
            <button onClick={()=>setSel(u)} style={{background:'rgba(45,212,191,0.08)',border:'1px solid rgba(45,212,191,0.2)',borderRadius:7,padding:'4px 11px',color:T.teal,fontSize:12,cursor:'pointer',fontWeight:700,transition:'all 0.15s'}}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(45,212,191,0.14)';}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(45,212,191,0.08)';}}>
              View
            </button>
          ])}
        />
      </Card>

      <Modal open={!!sel} onClose={()=>setSel(null)} title={sel?.name||''} width={520}>
        {sel && <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
            {[{l:'Email',v:sel.email},{l:'Role',v:<Badge type={sel.role} label={sel.role.toUpperCase()}/>},{l:'Projects',v:sel.projects},{l:'Credits',v:sel.credits.toLocaleString()},{l:'Joined',v:sel.joined},{l:'Status',v:<Badge type={sel.status} label={sel.status}/>}].map(({l,v})=>(
              <div key={l} style={{background:'rgba(255,255,255,0.03)',borderRadius:9,padding:13}}>
                <div style={{fontSize:9,color:T.t3,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.7px',marginBottom:6}}>{l}</div>
                <div style={{fontSize:13,color:T.t1}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{display:'flex',gap:10}}>
            {sel.status==='active'?<Btn variant="danger" onClick={()=>setSel(null)}>Suspend Account</Btn>:<Btn onClick={()=>setSel(null)}>Activate Account</Btn>}
            <Btn variant="secondary" onClick={()=>setSel(null)}>Send Message</Btn>
          </div>
        </>}
      </Modal>

      <Modal open={invite} onClose={()=>setInvite(false)} title="Invite New User" width={430}>
        <div>
          {['Email Address','Organization Name','Role (NGO / Buyer)'].map(l=>(
            <div key={l} style={{marginBottom:14}}>
              <label style={{fontSize:10,color:T.t3,fontWeight:700,letterSpacing:'0.6px',textTransform:'uppercase',marginBottom:7,display:'block'}}>{l}</label>
              <input style={inp}/>
            </div>
          ))}
          <div style={{display:'flex',gap:10,marginTop:8}}>
            <Btn onClick={()=>setInvite(false)}>Send Invite</Btn>
            <Btn variant="secondary" onClick={()=>setInvite(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
