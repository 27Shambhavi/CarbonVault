import { useState } from 'react';
import { useApp } from '../../AppContext.jsx';
import { T } from '../UI.jsx';
import { LiveBadge } from '../LiveBadge.jsx';
import AppFooter from '../Footer.jsx';
import {
  Globe, LayoutDashboard, Trophy, ShoppingCart, Award,
  FileSearch, Sun, Moon, LogIn, ArrowRight
} from 'lucide-react';
import { ROUTE_TABLE } from '../../routes/routeTable.js';

const PUBLIC_ICONS = {
  dashboard: LayoutDashboard,
  leaderboard: Trophy,
  projects: ShoppingCart,
  climate: Globe,
  certificates: Award,
  audit: FileSearch,
};

export default function PublicShell({ children }) {
  const {
    page, setPage, logout, theme, toggleTheme,
    liveStatus, lastEventAt, lastError
  } = useApp();

  const navItems = ROUTE_TABLE.public;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: T.bg0, color: T.t1 }}>
      {/* ── Public Explorer Header ── */}
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
            height: 62,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(45,212,191,0.15)', border: `1px solid ${T.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={18} color={T.tealL} />
            </div>
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 900, fontSize: 16, color: T.t1, lineHeight: 1.1 }}>
                CarbonVault
              </div>
              <div style={{ fontSize: 9, color: T.tealL, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Public Trust Registry
              </div>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              overflowX: 'auto',
            }}
          >
            {navItems.map((item) => {
              const Icon = PUBLIC_ICONS[item.id] || LayoutDashboard;
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
                    background: active ? 'rgba(45,212,191,0.14)' : 'transparent',
                    color: active ? T.tealL : T.t3,
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.14s',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    borderBottom: `2px solid ${active ? T.teal : 'transparent'}`,
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

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LiveBadge status={liveStatus} lastEventAt={lastEventAt} lastError={lastError} />

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
              <span>Public</span>
            </div>

            <button
              onClick={toggleTheme}
              style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8, padding: 6, cursor: 'pointer', color: T.t2 }}
            >
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} color={T.goldL} />}
            </button>

            {/* Sign In CTA */}
            <button
              onClick={logout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${T.border}`,
                color: T.t1,
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <LogIn size={13} />
              <span>Sign In / Demo</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main View Area ── */}
      <main style={{ flex: 1, minWidth: 320, overflowX: 'hidden' }}>
        {children}
      </main>

      <AppFooter />
    </div>
  );
}
