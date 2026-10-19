import { useState } from 'react';
import { useApp } from '../../AppContext.jsx';
import { T } from '../UI.jsx';
import { LiveBadge } from '../LiveBadge.jsx';
import AppFooter from '../Footer.jsx';
import { NotificationCenter } from '../Layout.jsx';
import {
  Leaf, Bell, Settings, User, LogOut, ChevronRight, X, Menu,
  LayoutDashboard, Users, FolderCheck, DollarSign, BarChart3,
  Search, ShieldCheck, Activity, FileSearch, Sun, Moon, Building2, Wallet
} from 'lucide-react';
import { ROUTE_TABLE } from '../../routes/routeTable.js';

const ADMIN_ICONS = {
  dashboard: LayoutDashboard,
  approvals: FolderCheck,
  organisations: Building2,
  users: Users,
  pricing: DollarSign,
  payments_payouts: Wallet,
  analytics: BarChart3,
  ml_models: Activity,
  audit: FileSearch,
  settings: Settings,
};

export default function AdminShell({ children }) {
  const {
    user, page, setPage, logout, theme, toggleTheme,
    notifOpen, setNotifOpen, unreadNotifCount,
    liveStatus, lastEventAt, lastError
  } = useApp();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const navItems = ROUTE_TABLE.admin;
  const activeRoute = navItems.find((r) => r.id === page) || navItems[0];

  const filteredNav = searchQuery.trim()
    ? navItems.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : navItems;

  const iconBtn = (onClick, content, title) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'var(--glass2, rgba(255,255,255,0.04))',
        border: `1px solid ${T.border}`,
        borderRadius: 9,
        padding: 8,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = T.teal;
        e.currentTarget.style.background = 'color-mix(in srgb, var(--teal) 10%, transparent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.background = 'var(--glass2, rgba(255,255,255,0.04))';
      }}
    >
      {content}
    </button>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bg0, color: T.t1 }}>
      {/* ── Left Sidebar (Dense Operator Console) ── */}
      <aside
        className="no-print"
        style={{
          width: sidebarOpen ? 256 : 0,
          minHeight: '100vh',
          background: 'var(--sidebar-bg, rgba(6,9,18,0.96))',
          backdropFilter: 'blur(24px)',
          borderRight: `1px solid ${T.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.24s cubic-bezier(0.4,0,0.2,1)',
          flexShrink: 0,
          position: 'relative',
          zIndex: 110,
        }}
      >
        {/* Top Gold Accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${T.goldL}80, transparent)` }} />

        {/* Brand / Logo */}
        <div style={{ padding: '18px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: `linear-gradient(135deg, ${T.gold}, ${T.goldD || '#b45309'})`, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(245,158,11,0.3)' }}>
              <ShieldCheck size={18} color="#000000" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 900, fontSize: 16, color: T.t1, letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>CarbonVault</div>
              <div style={{ fontSize: 9, color: T.goldL, fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase' }}>Admin Desk</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ background: 'transparent', border: 'none', color: T.t3, cursor: 'pointer', padding: 4 }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Role Pill */}
        <div style={{ padding: '12px 14px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 9, padding: '8px 12px' }}>
            <div style={{ fontSize: 9, color: T.goldL, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.goldL }} />
              <span>Admin · Platform HQ</span>
            </div>
            <div style={{ fontSize: 12, color: T.t1, fontWeight: 600, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.org || 'Platform Governance'}
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9, color: T.t4, fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', padding: '6px 8px 6px' }}>
            Operations Menu
          </div>
          {filteredNav.map((item) => {
            const Icon = ADMIN_ICONS[item.id] || LayoutDashboard;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                data-testid={`nav-${item.id}`}
                onClick={() => setPage(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 8,
                  marginBottom: 2,
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                  color: active ? T.goldL : T.t3,
                  fontWeight: active ? 700 : 500,
                  fontSize: 13,
                  transition: 'all 0.12s',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  borderLeft: `2.5px solid ${active ? T.goldL : 'transparent'}`,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'var(--glass2, rgba(255,255,255,0.04))';
                    e.currentTarget.style.color = T.t1;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = T.t3;
                  }
                }}
              >
                <Icon size={14} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {active && <ChevronRight size={12} style={{ opacity: 0.6 }} />}
              </button>
            );
          })}
        </nav>

        {/* User Card */}
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}` }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User size={13} color={T.goldL} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.t1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Admin'}</div>
              <div style={{ fontSize: 10, color: T.t3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              style={{ background: 'none', border: 'none', color: T.roseL, cursor: 'pointer', padding: 4 }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <header
          className="no-print"
          style={{
            height: 58,
            background: 'var(--topbar-bg, rgba(6,9,18,0.92))',
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            gap: 12,
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          {!sidebarOpen && iconBtn(() => setSidebarOpen(true), <Menu size={15} color={T.goldL} />, 'Open Menu')}

          {/* Quick Search */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--glass2, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: '4px 10px', gap: 8, width: 220 }}>
            <Search size={13} color={T.t3} />
            <input
              type="text"
              placeholder="Search admin desk…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: T.t1, fontSize: 12, width: '100%' }}
            />
          </div>

          <div style={{ flex: 1 }} />

          {/* Live Status Pill */}
          <LiveBadge status={liveStatus} lastEventAt={lastEventAt} lastError={lastError} />

          {/* Role Badge */}
          <div
            data-testid="role-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: 20,
              padding: '4px 12px',
              gap: 6,
              fontSize: 11.5,
              fontWeight: 800,
              color: T.goldL,
              letterSpacing: '0.4px',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.goldL }} />
            <span>Admin</span>
          </div>

          {/* Theme Toggle */}
          {iconBtn(
            toggleTheme,
            theme === 'light' ? <Moon size={15} color={T.violet} /> : <Sun size={15} color={T.goldL} />,
            theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'
          )}

          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            {iconBtn(() => setNotifOpen(true), <Bell size={15} color={T.teal} />, 'Notifications')}
            {unreadNotifCount > 0 && (
              <div style={{ position: 'absolute', top: -3, right: -3, width: 16, height: 16, background: '#ef4444', borderRadius: '50%', fontSize: 9, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </div>
            )}
          </div>

          {/* User Menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(251,191,36,0.25)',
                borderRadius: 9,
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <User size={12} color={T.goldL} />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.goldL }}>{user?.name?.split(' ')[0] || 'Admin'}</span>
            </button>
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  background: 'var(--menu-bg, #090c18)',
                  border: `1px solid ${T.border2}`,
                  borderRadius: 10,
                  padding: 6,
                  minWidth: 160,
                  zIndex: 200,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}
              >
                <button
                  onClick={() => { setPage('settings'); setMenuOpen(false); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'none', border: 'none', color: T.t2, cursor: 'pointer', borderRadius: 6, fontSize: 13, textAlign: 'left' }}
                >
                  <Settings size={13} /> Settings
                </button>
                <button
                  onClick={logout}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'none', border: 'none', color: T.roseL, cursor: 'pointer', borderRadius: 6, fontSize: 13, textAlign: 'left' }}
                >
                  <LogOut size={13} /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </main>
        <AppFooter />
      </div>

      <NotificationCenter />
    </div>
  );
}
