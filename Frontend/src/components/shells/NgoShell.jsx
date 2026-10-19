import { useState, useEffect } from 'react';
import { useApp } from '../../AppContext.jsx';
import { T } from '../UI.jsx';
import { LiveBadge } from '../LiveBadge.jsx';
import AppFooter from '../Footer.jsx';
import { NotificationCenter } from '../Layout.jsx';
import { fetchProjects } from '../../services/api.js';
import {
  TreePine, LayoutDashboard, Plus, Map, ShoppingCart,
  ChevronDown, Sun, Moon, Bell, LogOut, CheckCircle2, Clock, ShieldCheck
} from 'lucide-react';
import { ROUTE_TABLE } from '../../routes/routeTable.js';

const NGO_ICONS = {
  dashboard: LayoutDashboard,
  projects: TreePine,
  new_project: Plus,
  site_suitability: Map,
  ngo_marketplace: ShoppingCart,
};

const PIPELINE_STAGES = [
  { id: 'draft', label: 'Draft' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'under_review', label: 'In Review' },
  { id: 'field_verification', label: 'Verification' },
  { id: 'approved', label: 'Approved' },
];

export default function NgoShell({ children }) {
  const {
    user, page, setPage, navigateToProject, logout, theme, toggleTheme,
    setNotifOpen, unreadNotifCount, refreshKey,
    liveStatus, lastEventAt, lastError
  } = useApp();

  const [projects, setProjects] = useState([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const navItems = ROUTE_TABLE.ngo;

  useEffect(() => {
    fetchProjects().then((res) => {
      const list = Array.isArray(res.data) ? res.data : (res.data?.projects || []);
      setProjects(list);
    }).catch(() => setProjects([]));
  }, [refreshKey]);

  // Compute stage counts
  const stageCounts = PIPELINE_STAGES.map((st) => ({
    ...st,
    count: projects.filter((p) => {
      const s = (p.status || 'draft').toLowerCase();
      if (st.id === 'under_review') return s === 'under_review' || s === 'pending';
      return s === st.id;
    }).length,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: T.bg0, color: T.t1 }}>
      {/* ── Top Header ── */}
      <header
        className="no-print"
        style={{
          background: 'var(--topbar-bg, rgba(6,9,18,0.95))',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${T.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Brand + Project Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(16,185,129,0.15)', border: `1px solid ${T.emerald}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TreePine size={18} color={T.emeraldL} />
              </div>
              <div style={{ display: 'none', smDisplay: 'block' }}>
                <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 900, fontSize: 16, color: T.t1, lineHeight: 1.1 }}>
                  CarbonVault
                </div>
                <div style={{ fontSize: 9, color: T.emeraldL, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  Project Workspace
                </div>
              </div>
            </div>

            {/* Project Switcher Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setSwitcherOpen(!switcherOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${T.border}`,
                  color: T.t1,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  maxWidth: 220,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {projects.length > 0 ? `Switch Project (${projects.length})` : 'Select Project'}
                </span>
                <ChevronDown size={12} color={T.t3} />
              </button>

              {switcherOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: 260,
                    maxHeight: 320,
                    overflowY: 'auto',
                    background: 'var(--menu-bg, #090c18)',
                    border: `1px solid ${T.border2}`,
                    borderRadius: 10,
                    boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
                    padding: 6,
                    zIndex: 210,
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, color: T.t3, textTransform: 'uppercase', padding: '6px 8px' }}>
                    Active NGO Projects
                  </div>
                  {projects.map((p) => (
                    <button
                      key={p.project_id || p.id}
                      onClick={() => {
                        navigateToProject(p.project_id || p.id);
                        setSwitcherOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: 'transparent',
                        border: 'none',
                        color: T.t1,
                        fontSize: 12,
                        borderRadius: 6,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                        {p.name}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: T.emeraldL }}>
                        {p.status || 'draft'}
                      </span>
                    </button>
                  ))}
                  <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 4, paddingTop: 4 }}>
                    <button
                      onClick={() => { setPage('new_project'); setSwitcherOpen(false); }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 10px',
                        background: 'rgba(16,185,129,0.1)',
                        border: 'none',
                        color: T.emeraldL,
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={13} />
                      <span>Register New Project</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              overflowX: 'auto',
              maxWidth: '100%',
            }}
          >
            {navItems.map((item) => {
              const Icon = NGO_ICONS[item.id] || TreePine;
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  data-testid={`nav-${item.id}`}
                  onClick={() => setPage(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: active ? 'rgba(16,185,129,0.14)' : 'transparent',
                    color: active ? T.emeraldL : T.t3,
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.14s',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    borderBottom: `2px solid ${active ? T.emerald : 'transparent'}`,
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.color = T.t1;
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.color = T.t3;
                  }}
                >
                  <Icon size={14} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Header Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LiveBadge status={liveStatus} lastEventAt={lastEventAt} lastError={lastError} />

            <div
              data-testid="role-badge"
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(16,185,129,0.1)',
                border: `1px solid rgba(16,185,129,0.3)`,
                borderRadius: 20,
                padding: '3px 10px',
                gap: 5,
                fontSize: 11,
                fontWeight: 800,
                color: T.emeraldL,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.emeraldL }} />
              <span>NGO</span>
            </div>

            <button
              onClick={toggleTheme}
              style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, padding: 6, cursor: 'pointer', color: T.t2 }}
            >
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} color={T.goldL} />}
            </button>

            <button
              onClick={() => setNotifOpen(true)}
              style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, padding: 6, cursor: 'pointer', color: T.teal, position: 'relative' }}
            >
              <Bell size={14} />
              {unreadNotifCount > 0 && (
                <span style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: T.rose }} />
              )}
            </button>

            <button
              onClick={logout}
              title="Logout"
              style={{ background: 'none', border: 'none', color: T.roseL, cursor: 'pointer', padding: 6 }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* ── Sub-bar: Project Lifecycle Pipeline Board Indicator ── */}
        <div
          style={{
            padding: '8px 20px',
            background: 'rgba(0,0,0,0.2)',
            borderTop: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            overflowX: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Pipeline Board:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-start', minWidth: 420 }}>
            {stageCounts.map((stage, idx) => (
              <div key={stage.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  onClick={() => setPage('projects')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 10px',
                    borderRadius: 6,
                    background: stage.count > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${stage.count > 0 ? 'rgba(16,185,129,0.3)' : T.border}`,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 600, color: stage.count > 0 ? T.emeraldL : T.t3 }}>
                    {stage.label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      background: stage.count > 0 ? T.emerald : 'rgba(255,255,255,0.1)',
                      color: stage.count > 0 ? '#000000' : T.t3,
                      borderRadius: 10,
                      padding: '1px 6px',
                    }}
                  >
                    {stage.count}
                  </span>
                </div>
                {idx < stageCounts.length - 1 && (
                  <span style={{ color: T.t4, fontSize: 12 }}>&rarr;</span>
                )}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: T.t3, whiteSpace: 'nowrap' }}>
            {user?.org || 'EcoGuard'}
          </div>
        </div>
      </header>

      {/* ── Main View Area ── */}
      <main style={{ flex: 1, minWidth: 320, overflowX: 'hidden' }}>
        {children}
      </main>

      <AppFooter />
      <NotificationCenter />
    </div>
  );
}
