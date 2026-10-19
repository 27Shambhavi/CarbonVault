import { useState } from 'react';
import { useApp } from '../../AppContext.jsx';
import { T } from '../UI.jsx';
import { LiveBadge } from '../LiveBadge.jsx';
import AppFooter from '../Footer.jsx';
import { NotificationCenter } from '../Layout.jsx';
import {
  Building2, LayoutDashboard, ShoppingCart, Wallet, FileText,
  Calculator, Sun, Moon, Bell, LogOut, Award, ArrowRight
} from 'lucide-react';
import { ROUTE_TABLE } from '../../routes/routeTable.js';

const CORP_ICONS = {
  dashboard: LayoutDashboard,
  marketplace: ShoppingCart,
  wallet: Wallet,
  esg: FileText,
  calculator: Calculator,
};

export default function CorporateShell({ children }) {
  const {
    user, page, setPage, logout, theme, toggleTheme,
    setNotifOpen, unreadNotifCount,
    liveStatus, lastEventAt, lastError
  } = useApp();

  const navItems = ROUTE_TABLE.corporate;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: T.bg0, color: T.t1 }}>
      {/* ── Top Marketplace-First Header ── */}
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
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(167,139,250,0.15)', border: `1px solid ${T.violetLL}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={18} color={T.violetLL} />
            </div>
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 900, fontSize: 16, color: T.t1, lineHeight: 1.1 }}>
                CarbonVault
              </div>
              <div style={{ fontSize: 9, color: T.violetLL, fontWeight: 800, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Corporate Climate Portfolio
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
              const Icon = CORP_ICONS[item.id] || LayoutDashboard;
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
                    background: active ? 'rgba(167,139,250,0.14)' : 'transparent',
                    color: active ? T.violetLL : T.t3,
                    fontWeight: active ? 700 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.14s',
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    borderBottom: `2px solid ${active ? T.violetLL : 'transparent'}`,
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

          {/* Quick Buy Action + Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Quick Buy / Marketplace Button */}
            <button
              onClick={() => setPage('marketplace')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                background: `linear-gradient(135deg, ${T.teal}, ${T.tealD})`,
                color: '#021a17',
                border: 'none',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(45,212,191,0.25)',
              }}
            >
              <ShoppingCart size={13} />
              <span>Buy Credits</span>
            </button>

            <LiveBadge status={liveStatus} lastEventAt={lastEventAt} lastError={lastError} />

            <div
              data-testid="role-badge"
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(167,139,250,0.1)',
                border: `1px solid rgba(167,139,250,0.3)`,
                borderRadius: 20,
                padding: '3px 10px',
                gap: 5,
                fontSize: 11,
                fontWeight: 800,
                color: T.violetLL,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.violetLL }} />
              <span>Corporate</span>
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
