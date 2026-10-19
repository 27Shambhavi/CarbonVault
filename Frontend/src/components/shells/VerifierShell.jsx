import { useState } from 'react';
import { useApp } from '../../AppContext.jsx';
import { T } from '../UI.jsx';
import { LiveBadge } from '../LiveBadge.jsx';
import AppFooter from '../Footer.jsx';
import { NotificationCenter } from '../Layout.jsx';
import {
  Award, ShieldCheck, Map, FolderCheck, User, LogOut, Sun, Moon, Bell, Menu, X
} from 'lucide-react';
import { ROUTE_TABLE } from '../../routes/routeTable.js';

const VERIFIER_ICONS = {
  dashboard: FolderCheck,
  map: Map,
  completed: Award,
  profile: User,
};

export default function VerifierShell({ children }) {
  const {
    user, page, setPage, logout, theme, toggleTheme,
    setNotifOpen, unreadNotifCount,
    liveStatus, lastEventAt, lastError
  } = useApp();

  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = ROUTE_TABLE.verifier;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: T.bg0, color: T.t1 }}>
      {/* ── Top Header ── */}
      <header
        className="no-print"
        style={{
          height: 60,
          background: 'var(--topbar-bg, rgba(6,9,18,0.95))',
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(45,212,191,0.15)', border: `1px solid ${T.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={18} color={T.tealL} />
          </div>
          <div>
            <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 900, fontSize: 16, color: T.t1, lineHeight: 1.1 }}>
              CarbonVault
            </div>
            <div style={{ fontSize: 9, color: T.tealL, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              Field Auditor Desk
            </div>
          </div>
        </div>

        {/* Desktop Nav in Header */}
        <nav
          className="verifier-desktop-nav"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.03)',
            padding: '4px 6px',
            borderRadius: 10,
            border: `1px solid ${T.border}`
          }}
        >
          {navItems.map((item) => {
            const Icon = VERIFIER_ICONS[item.id] || FolderCheck;
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
                  padding: '7px 13px',
                  borderRadius: 7,
                  border: 'none',
                  background: active ? 'rgba(45,212,191,0.16)' : 'transparent',
                  color: active ? T.tealL : T.t3,
                  fontWeight: active ? 700 : 500,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                }}
              >
                <Icon size={14} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'none', mdDisplay: 'block' }}>
            <LiveBadge status={liveStatus} lastEventAt={lastEventAt} lastError={lastError} />
          </div>

          <div
            data-testid="role-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(45,212,191,0.1)',
              border: `1px solid rgba(45,212,191,0.3)`,
              borderRadius: 20,
              padding: '3px 10px',
              gap: 5,
              fontSize: 11,
              fontWeight: 800,
              color: T.tealL,
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.tealL }} />
            <span>Verifier</span>
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
      </header>

      {/* ── Main View Area ── */}
      <main style={{ flex: 1, paddingBottom: 68, minWidth: 320, overflowX: 'hidden' }}>
        {children}
      </main>

      {/* ── Mobile Bottom Tab Bar (Responsive for <= 640px) ── */}
      <nav
        className="no-print verifier-mobile-bottom-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          background: 'var(--bottombar-bg, rgba(6,9,18,0.97))',
          backdropFilter: 'blur(20px)',
          borderTop: `1px solid ${T.border}`,
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 200,
          padding: '0 8px',
        }}
      >
        {navItems.map((item) => {
          const Icon = VERIFIER_ICONS[item.id] || FolderCheck;
          const active = page === item.id;
          return (
            <button
              key={item.id}
              data-testid={`mobile-nav-${item.id}`}
              onClick={() => setPage(item.id)}
              style={{
                flex: 1,
                minHeight: 46,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: active ? T.tealL : T.t3,
                cursor: 'pointer',
                gap: 4,
                padding: '4px 0',
                transition: 'color 0.15s',
              }}
            >
              <Icon size={17} color={active ? T.tealL : T.t3} />
              <span style={{ fontSize: 10, fontWeight: active ? 800 : 500, letterSpacing: '0.3px' }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <AppFooter />
      <NotificationCenter />
    </div>
  );
}
