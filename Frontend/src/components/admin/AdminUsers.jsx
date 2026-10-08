import { useState, useEffect } from 'react';
import { useApp } from '../../AppContext.jsx';
import { fetchUsers, inviteUser, updateUserStatus } from '../../services/api.js';
import { Card, SectionHeader, Table, Badge, Modal, Btn, T } from '../UI.jsx';
import { Search, UserPlus, ShieldAlert, Lock } from 'lucide-react';

export default function AdminUsers() {
  const { user: currentUser } = useApp();
  const isApprover = currentUser?.admin_role === 'approver';

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState(null);
  const [invite, setInvite] = useState(false);
  const [inviteData, setInviteData] = useState({ name: '', email: '', role: 'ngo' });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const loadUsers = () => {
    setLoading(true);
    fetchUsers()
      .then(res => {
        if (Array.isArray(res.data)) {
          setUsers(res.data);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleInvite = async () => {
    if (isApprover) {
      setInviteError('Super Admin privilege required to invite users');
      return;
    }
    if (!inviteData.name || !inviteData.email) {
      setInviteError('Please fill in both name and email');
      return;
    }
    setInviting(true);
    setInviteError('');
    const res = await inviteUser(inviteData);
    setInviting(false);
    if (!res.error) {
      setInvite(false);
      setInviteData({ name: '', email: '', role: 'ngo' });
      loadUsers();
    } else {
      setInviteError(res.error);
    }
  };

  const handleToggleStatus = async (user) => {
    if (isApprover) return;
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    const res = await updateUserStatus(user.id, nextStatus);
    if (!res.error) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: nextStatus } : u));
      if (sel && sel.id === user.id) {
        setSel({ ...sel, status: nextStatus });
      }
    }
  };

  const displayUsers = users;

  const filtered = displayUsers.filter(u =>
    (filter === 'all' || u.role === filter) &&
    (u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const inp = { background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 9, padding: '10px 14px', color: T.t1, fontSize: 14, outline: 'none', width: '100%', fontFamily: 'Plus Jakarta Sans, sans-serif' };

  return (
    <div style={{ padding: 28 }}>
      <SectionHeader
        title="User Management"
        subtitle="Manage platform users, roles and access levels"
        action={
          isApprover ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: T.goldL, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Lock size={12} /> Read-only mode
              </span>
              <Btn
                disabled
                style={{ opacity: 0.5, cursor: 'not-allowed' }}
                title="Super Admin privilege required to invite users"
              >
                <UserPlus size={13} /> Invite User
              </Btn>
            </div>
          ) : (
            <Btn onClick={() => setInvite(true)}><UserPlus size={13} />Invite User</Btn>
          )
        }
      />

      {/* Approver role notification banner */}
      {isApprover && (
        <div style={{
          background: 'rgba(56,189,248,0.08)',
          border: `1px solid rgba(56,189,248,0.25)`,
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <ShieldAlert size={18} color={T.skyL} />
          <div style={{ fontSize: 13, color: T.skyL }}>
            <strong>Project Approver Role:</strong> You have read-only access to user directories. Inviting new users and suspending accounts requires <strong>Super Admin</strong> authorization.
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 13, marginBottom: 22 }}>
        {[
          { l: 'Total Users', value: displayUsers.length, color: T.t1 },
          { l: 'NGOs', value: displayUsers.filter(u => u.role === 'ngo').length, color: T.skyL },
          { l: 'Buyers', value: displayUsers.filter(u => u.role === 'buyer').length, color: T.violetLL },
          { l: 'Suspended', value: displayUsers.filter(u => u.status === 'suspended').length, color: T.roseL },
        ].map(({ l, value, color }) => (
          <div key={l} style={{ background: 'var(--card-bg, rgba(255,255,255,0.03))', border: `1px solid ${T.border}`, borderRadius: 12, padding: '16px 18px', textAlign: 'center', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${color}40,transparent)` }} />
            <div style={{ fontSize: 30, fontWeight: 800, fontFamily: 'Fraunces, serif', color, letterSpacing: '-1px' }}>{value}</div>
            <div style={{ fontSize: 10, color: T.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginTop: 5 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <Search size={13} color={T.t3} style={{ position: 'absolute', left: 13, top: 12 }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            style={{ ...inp, paddingLeft: 36 }} />
        </div>
        {['all', 'ngo', 'buyer', 'admin'].map(r => (
          <button key={r} onClick={() => setFilter(r)}
            style={{ background: filter === r ? 'rgba(45,212,191,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${filter === r ? 'rgba(45,212,191,0.35)' : T.border}`, borderRadius: 9, padding: '9px 16px', color: filter === r ? T.teal : T.t3, fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.15s' }}>
            {r === 'all' ? 'All Users' : r.toUpperCase()}
          </button>
        ))}
      </div>

      <Card>
        <Table
          headers={['Organization', 'Email', 'Role', 'Projects', 'Credits', 'Joined', 'Status', 'Actions']}
          rows={filtered.map(u => [
            <span style={{ fontWeight: 700, color: T.t1 }}>{u.name}</span>,
            <span style={{ color: T.t3, fontSize: 12 }}>{u.email}</span>,
            u.role === 'admin' ? (
              <span style={{
                background: u.admin_role === 'approver' ? 'rgba(56,189,248,0.15)' : 'rgba(217,119,6,0.15)',
                color: u.admin_role === 'approver' ? T.skyL : T.goldL,
                border: `1px solid ${u.admin_role === 'approver' ? 'rgba(56,189,248,0.3)' : 'rgba(217,119,6,0.3)'}`,
                padding: '3px 8px',
                borderRadius: 6,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.5px'
              }}>
                {u.admin_role === 'approver' ? 'APPROVER' : 'SUPER ADMIN'}
              </span>
            ) : (
              <Badge type={u.role} label={u.role.toUpperCase()} />
            ),
            <span style={{ color: T.teal, fontWeight: 600 }}>{u.projects}</span>,
            <span style={{ color: T.emeraldL, fontWeight: 700 }}>{(u.credits || 0).toLocaleString()}</span>,
            <span style={{ color: T.t3, fontSize: 12 }}>{u.joined}</span>,
            <Badge type={u.status} label={u.status} />,
            <button onClick={() => setSel(u)} style={{ background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 7, padding: '4px 11px', color: T.teal, fontSize: 12, cursor: 'pointer', fontWeight: 700, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,191,0.14)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(45,212,191,0.08)'; }}>
              View
            </button>
          ])}
        />
      </Card>

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.name || ''} width={520}>
        {sel && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[{ l: 'Email', v: sel.email }, { l: 'Role', v: sel.role === 'admin' ? (sel.admin_role === 'approver' ? 'Project Approver' : 'Super Admin') : <Badge type={sel.role} label={sel.role.toUpperCase()} /> }, { l: 'Projects', v: sel.projects }, { l: 'Credits', v: (sel.credits || 0).toLocaleString() }, { l: 'Joined', v: sel.joined }, { l: 'Status', v: <Badge type={sel.status} label={sel.status} /> }].map(({ l, v }) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 9, padding: 13 }}>
                <div style={{ fontSize: 9, color: T.t3, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6 }}>{l}</div>
                <div style={{ fontSize: 13, color: T.t1 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {isApprover ? (
              <div style={{ fontSize: 12, color: T.t3, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={13} color={T.goldL} /> Super Admin permission required to modify user status.
              </div>
            ) : (
              sel.status === 'active' ? (
                <Btn variant="danger" onClick={() => handleToggleStatus(sel)}>Suspend Account</Btn>
              ) : (
                <Btn onClick={() => handleToggleStatus(sel)}>Activate Account</Btn>
              )
            )}
            <Btn variant="secondary" onClick={() => setSel(null)}>Close</Btn>
          </div>
        </>}
      </Modal>

      <Modal open={invite} onClose={() => setInvite(false)} title="Invite New User" width={430}>
        <div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 7, display: 'block' }}>Email Address</label>
            <input value={inviteData.email} onChange={e => setInviteData({ ...inviteData, email: e.target.value })} placeholder="user@company.com" style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 7, display: 'block' }}>Organization Name</label>
            <input value={inviteData.name} onChange={e => setInviteData({ ...inviteData, name: e.target.value })} placeholder="EcoGuard Solutions" style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 7, display: 'block' }}>Role (NGO / Buyer)</label>
            <select value={inviteData.role} onChange={e => setInviteData({ ...inviteData, role: e.target.value })} style={{ ...inp, height: 42 }}>
              <option value="ngo">NGO (Project Developer)</option>
              <option value="buyer">Buyer (Corporate)</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          {inviteError && <div style={{ color: T.roseL, fontSize: 12, marginBottom: 10 }}>{inviteError}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Btn onClick={handleInvite} disabled={inviting}>{inviting ? 'Sending…' : 'Send Invite'}</Btn>
            <Btn variant="secondary" onClick={() => setInvite(false)}>Cancel</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

