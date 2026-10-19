import { useState, useEffect } from 'react';
import { useApp } from '../AppContext.jsx';
import { fetchPublicStats, loginUser, registerUser, setAuthToken, fetchReady, fetchDemoAccounts } from '../services/api.js';
import { useBackendHealth } from '../services/health.js';
import AppFooter from '../components/Footer.jsx';
import { T, withAlpha } from '../components/UI.jsx';
import {
  Leaf, ShieldCheck, Eye, EyeOff, Zap, TrendingUp, Award, TreePine,
  Building2, Globe, Sun, Moon, Loader2, CheckCircle2, UserPlus, LogIn,
  ArrowRight, Activity, UserCheck
} from 'lucide-react';

// Animated floating particle
function Particle({ x, y, size, opacity, duration }) {
  return (
    <div style={{
      position: 'absolute', left: `${x}%`, top: `${y}%`,
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle, rgba(45,212,191,${opacity}) 0%, transparent 70%)`,
      animation: `float ${duration}s ease-in-out infinite`,
      animationDelay: `${Math.random() * 4}s`,
      pointerEvents: 'none',
    }} />
  );
}

const defaultDemoRoles = [
  {
    role: 'admin',
    label: 'Admin',
    desc: 'Runs platform & approves with verifier sign-off.',
    tooltip: 'Platform operations: health, KYC review, users, pricing, payments & reconciliation, Review Queue oversight & project decisions, ML retraining, audit.',
    icon: ShieldCheck,
    color: T.goldL,
    email: 'admin@carbonvault.com',
    pass: 'admin123',
    name: 'Alex Mercer'
  },
  {
    role: 'verifier',
    label: 'Verifier',
    desc: 'Verifies sites in field & signs off.',
    tooltip: 'Field verification: inspect polygons, upload field evidence, sign off on verification.',
    icon: Award,
    color: T.tealL,
    email: 'verifier@carbonvault.com',
    pass: 'verifier123',
    name: 'Marcus Vance'
  },
  {
    role: 'ngo',
    label: 'NGO',
    desc: 'Registers projects & receives funding.',
    tooltip: 'Project developer: registers projects, uploads MRV data, submits quarterly updates, receives funding.',
    icon: TreePine,
    color: T.emeraldL,
    email: 'contact@ecoguard.org',
    pass: 'ngo123',
    name: 'EcoGuard Brazil'
  },
  {
    role: 'corporate',
    label: 'Corporate',
    desc: 'Buys & retires credits.',
    tooltip: 'Marketplace: buys and retires verified credits, downloads official retirement certificates.',
    icon: Building2,
    color: T.violetLL,
    email: 'carbon@microsoft.com',
    pass: 'corp123',
    name: 'Microsoft Sustainability'
  },
];

export default function LoginPage() {
  const { login, theme, toggleTheme, addToast } = useApp();
  const [tab, setTab] = useState('signin'); // 'signin' | 'register'

  // Sign In State
  const [activeRole, setActiveRole] = useState('admin');
  const [email, setEmail] = useState('admin@carbonvault.com');
  const [password, setPassword] = useState('admin123');
  const [showPass, setShowPass] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState(null);

  // Demo tiles state (404 in production mode hides tiles)
  const [demoMode, setDemoMode] = useState(true);
  const [roleTiles, setRoleTiles] = useState(defaultDemoRoles);

  // Register State
  const [regRole, setRegRole] = useState('ngo'); // 'ngo' | 'corporate'
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regShowPass, setRegShowPass] = useState(false);
  // NGO fields
  const [regOrgName, setRegOrgName] = useState('');
  const [regCountry, setRegCountry] = useState('India');
  const [regRegNumber, setRegRegNumber] = useState('');
  // Corporate fields
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regIndustry, setRegIndustry] = useState('Technology & Cloud');
  const [regWebsite, setRegWebsite] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regError, setRegError] = useState(null);
  const [regSuccess, setRegSuccess] = useState(null);
  // Health & Stats State (Unified Source of Truth)
  const health = useBackendHealth();
  const [loaded, setLoaded] = useState(false);
  const [publicStats, setPublicStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Load demo accounts from server (404 in production mode)
  useEffect(() => {
    fetchDemoAccounts()
      .then((res) => {
        if (res.error && (res.status === 404 || res.error.includes('404') || res.error.includes('Production'))) {
          setDemoMode(false);
          return;
        }
        if (res.data && Array.isArray(res.data.accounts)) {
          const map = {};
          res.data.accounts.forEach((acc) => {
            map[acc.role] = acc;
          });
          setRoleTiles((prev) =>
            prev.map((r) => {
              const matched = map[r.role];
              return matched
                ? { ...r, email: matched.email || r.email, pass: matched.password || r.pass, name: matched.name || r.name }
                : r;
            })
          );
        }
      })
      .catch(() => {
        // Keep default client demo tiles
      });
  }, []);

  // Fetch public platform stats whenever backend is online
  useEffect(() => {
    setTimeout(() => setLoaded(true), 80);

    const loadStats = () => {
      fetchPublicStats()
        .then((res) => {
          if (res.data) setPublicStats(res.data);
        })
        .catch(() => {})
        .finally(() => setStatsLoading(false));
    };

    loadStats();
    if (health.status === 'Online') {
      loadStats();
    }
  }, [health.status]);

  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 100,
    size: 4 + Math.random() * 12, opacity: 0.08 + Math.random() * 0.18,
    duration: 5 + Math.random() * 8,
  }));

  // Hero Stats Formatters (Cold-Start Aware)
  const isOnline = health.status === 'Online';
  const isWaking = health.status.startsWith('Waking');
  const isAvailable = isOnline && publicStats != null;

  const verifiedCreditsText = isAvailable
    ? `${Number(publicStats.total_tonnes_sequestered || 0).toLocaleString()} t`
    : (isWaking ? '...' : (statsLoading ? '...' : '—'));
  const activeProjectsText = isAvailable
    ? `${publicStats.verified_projects_count ?? '0'}`
    : (isWaking ? '...' : (statsLoading ? '...' : '—'));
  const fundingText = isAvailable
    ? `$${Number(publicStats.total_capital_deployed_usd || 0).toLocaleString()}`
    : (isWaking ? '...' : (statsLoading ? '...' : '—'));
  const activeNgosText = isAvailable
    ? `${publicStats.active_ngos_count ?? '0'}`
    : (isWaking ? '...' : (statsLoading ? '...' : '—'));

  const stats = [
    { n: verifiedCreditsText, l: 'Tonnes Sequestered', icon: Award, color: T.teal },
    { n: activeProjectsText, l: 'Verified Projects', icon: TreePine, color: T.skyL },
    { n: fundingText, l: 'Capital Deployed', icon: TrendingUp, color: T.goldL },
    { n: activeNgosText, l: 'Partner Organizations', icon: Zap, color: T.emeraldL },
  ];

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const targetEmail = email.trim();
      const res = await loginUser(targetEmail, password, 10000);
      if (res.data && res.data.access_token) {
        setAuthToken(res.data.access_token);
        const serverUser = res.data.user || {};
        const serverRole = serverUser.role || 'public';
        const serverRoleDisplay = serverRole.charAt(0).toUpperCase() + serverRole.slice(1);

        // Server authoritative role feedback: if tile clicked and account role disagree
        if (activeRole && activeRole !== serverRole && addToast) {
          addToast({
            type: 'info',
            title: 'Signed in as ' + serverRoleDisplay,
            message: `Server authenticated your account as ${serverRoleDisplay} (${serverUser.email})`,
          });
        }

        login(serverUser, res.data.access_token);
        return;
      }
      if (res.error) {
        setLoginError(res.error);
        return;
      }
      setLoginError("Authentication failed: invalid server response. Please retry.");
    } catch (err) {
      setLoginError(err.message || "Connection timeout. Please check your network and retry.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    if (e) e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    if (!regFullName.trim()) {
      setRegError('Please provide your full name.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setRegError('Please provide a valid email address.');
      return;
    }
    if (regPassword.length < 8) {
      setRegError('Password must be at least 8 characters long.');
      return;
    }

    setIsRegistering(true);
    try {
      const payload = {
        email: regEmail.trim().toLowerCase(),
        password: regPassword,
        full_name: regFullName.trim(),
        role: regRole,
        ...(regRole === 'ngo' ? {
          organization_name: regOrgName.trim() || regFullName.trim(),
          country: regCountry.trim(),
          registration_number: regRegNumber.trim()
        } : {
          company_name: regCompanyName.trim() || regFullName.trim(),
          industry: regIndustry.trim(),
          country: regCountry.trim(),
          website: regWebsite.trim()
        })
      };

      const res = await registerUser(payload, 15000);
      if (res.data && res.data.status === 'ok') {
        setRegSuccess('Account created successfully! You can now sign in.');
        setEmail(regEmail.trim().toLowerCase());
        setPassword(regPassword);
        setTimeout(() => {
          setTab('signin');
          setRegSuccess(null);
        }, 1200);
        return;
      }
      if (res.error) {
        setRegError(res.error);
        return;
      }
      setRegError('Registration failed. Please check details and try again.');
    } catch (err) {
      setRegError(err.message || 'Registration timeout. Please check network and retry.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: T.bg0, position: 'relative', overflow: 'hidden', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-18px) scale(1.05)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spinSlow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes shimmerLine { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes pulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:0.9;transform:scale(1.03)} }
        @keyframes scanline { 0%{top:-2px} 100%{top:100%} }
      `}</style>

      {/* Animated particles and background glow */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {particles.map(p => <Particle key={p.id} {...p} />)}
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '60%', background: `radial-gradient(ellipse, rgba(45,212,191,0.09) 0%, transparent 65%)`, animation: 'pulse 8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-5%', width: '50%', height: '50%', background: `radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 65%)`, animation: 'pulse 10s ease-in-out infinite', animationDelay: '3s' }} />

        {/* Dot grid */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }} aria-hidden>
          <defs><pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.35)" /></pattern></defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      <div style={{ flex: 1, display: 'flex', position: 'relative', zIndex: 1, flexWrap: 'wrap' }}>
        {/* LEFT PANEL */}
        <div style={{ flex: 1, minWidth: 340, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '36px 56px', position: 'relative', zIndex: 1 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 28 }}>
            <div style={{
              width: 46, height: 46,
              background: `linear-gradient(135deg, ${T.teal} 0%, ${T.tealDD} 100%)`,
              borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 24px rgba(45,212,191,0.4), inset 0 1px 0 rgba(255,255,255,0.25)`,
            }}>
              <Leaf size={22} color="#ffffff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontFamily: 'Fraunces, serif', fontWeight: 900, fontSize: 22, color: T.t1, letterSpacing: '-0.5px' }}>CarbonVault</div>
              <div style={{ fontSize: 9.5, color: T.teal, fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase', marginTop: 1 }}>Carbon Intelligence Platform</div>
            </div>
          </div>

          {/* Headline */}
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 44, fontWeight: 900, color: T.t1, lineheight: 1.1, letterSpacing: '-1.5px', marginBottom: 16 }}>
            Track Carbon.<br />
            <span style={{ background: `linear-gradient(135deg, ${T.teal} 0%, ${T.tealL} 40%, ${T.skyL} 100%)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', backgroundSize: '200% auto', animation: 'shimmerLine 4s linear infinite' }}>
              Verify Impact.
            </span><br />
            Build Trust.
          </h1>
          <p style={{ color: T.t3, fontSize: 14, maxWidth: 420, lineHeight: 1.75, marginBottom: 28 }}>
            AI-powered MRV verification, automated fraud detection, and immutable cryptographic audit trails for voluntary carbon credit markets.
          </p>

          {/* Dynamic Real Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 440 }}>
            {stats.map(({ n, l, icon: Icon, color }) => (
              <div key={l} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.22s' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}14`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} color={color} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.t1, fontFamily: 'Fraunces, serif', lineHeight: 1 }}>{n}</div>
                  <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 3 }}>{l}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ height: 1, flex: 1, background: `linear-gradient(90deg, rgba(45,212,191,0.4), transparent)` }} />
            <span style={{ fontSize: 11, color: isAvailable ? T.t4 : (isWaking ? T.goldL : T.goldLL), fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              {isAvailable ? 'Cryptographic Audit & Satellite MRV Ledger' : (isWaking ? 'Waking up the server… live figures shortly' : 'Live figures unavailable')}
            </span>
          </div>
        </div>

        {/* RIGHT AUTH PANEL */}
        <div style={{ width: 510, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '44px 44px', background: 'var(--sidebar-bg, rgba(8,11,18,0.97))', backdropFilter: 'blur(24px)', borderLeft: `1px solid ${T.border}`, position: 'relative', zIndex: 1, opacity: loaded ? 1 : 0, transition: 'opacity 0.6s ease' }}>
          {/* Top shimmer accent */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${withAlpha(T.teal, '70', 70)}, ${withAlpha(T.tealL, '90', 80)}, ${withAlpha(T.teal, '70', 70)}, transparent)`, backgroundSize: '200% auto', animation: 'shimmerLine 3s linear infinite' }} />

          {/* Top Header Row: Status Indicator & Theme Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            {/* Live API Status Indicator (Unified with /ready & Cold-Start Aware) */}
            {(() => {
              const isOnline = health.status === 'Online';
              const isWaking = health.status.startsWith('Waking');
              const isDegraded = health.status === 'Degraded';
              const pillBg = isOnline
                ? 'rgba(16,185,129,0.1)'
                : isWaking || isDegraded
                ? 'rgba(245,158,11,0.1)'
                : 'rgba(239,68,68,0.1)';
              const pillBorder = isOnline
                ? 'rgba(16,185,129,0.25)'
                : isWaking || isDegraded
                ? 'rgba(245,158,11,0.35)'
                : 'rgba(239,68,68,0.25)';
              const pillColor = isOnline
                ? T.emeraldL
                : isWaking || isDegraded
                ? T.goldL
                : T.roseL;
              const dotColor = isOnline
                ? '#10b981'
                : isWaking || isDegraded
                ? '#f59e0b'
                : '#ef4444';

              return (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 20,
                  background: pillBg,
                  border: `1px solid ${pillBorder}`,
                  fontSize: 11, fontWeight: 600, color: pillColor,
                  transition: 'all 0.25s ease'
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: dotColor, display: 'inline-block',
                    animation: isWaking ? 'pulse 1.2s ease-in-out infinite' : 'none'
                  }} />
                  API: {health.status} {health.latency != null ? `· ${health.latency}ms` : ''} · checked {health.secondsAgo}s ago · Mode: demo
                </div>
              );
            })()}

            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              style={{
                background: 'var(--glass2, rgba(255,255,255,0.06))',
                border: `1px solid ${T.border}`,
                borderRadius: 8, width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              {theme === 'light' ? <Moon size={14} color={T.violet} /> : <Sun size={14} color={T.goldL} />}
            </button>
          </div>

          {/* TAB SELECTOR: SIGN IN / CREATE ACCOUNT */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`, borderRadius: 10, padding: 3, marginBottom: 20 }}>
            <button
              onClick={() => { setTab('signin'); setLoginError(null); }}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
                background: tab === 'signin' ? `linear-gradient(135deg, ${T.teal}, ${T.tealD})` : 'transparent',
                color: tab === 'signin' ? '#021a17' : T.t3,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.18s'
              }}
            >
              <LogIn size={14} /> Sign In
            </button>
            <button
              onClick={() => { setTab('register'); setRegError(null); }}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
                background: tab === 'register' ? `linear-gradient(135deg, ${T.teal}, ${T.tealD})` : 'transparent',
                color: tab === 'register' ? '#021a17' : T.t3,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.18s'
              }}
            >
              <UserPlus size={14} /> Create Account
            </button>
          </div>

          {/* TAB 1: SIGN IN */}
          {tab === 'signin' ? (
            <div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.t1, fontFamily: 'Fraunces, serif', letterSpacing: '-0.4px' }}>Welcome Back</div>
                <div style={{ fontSize: 12.5, color: T.t3, marginTop: 3 }}>Quick demo accounts or enter your registered credentials</div>
              </div>

              {/* Demo Quick-Fill Shortcut Tiles (Demo Mode Only: 404 in production hides tiles) */}
              {demoMode && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 18 }}>
                  {roleTiles.map(({ role, label, desc, tooltip, icon: Icon, color, email: roleEmail, pass }) => {
                    const active = activeRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        data-testid={`demo-tile-${role}`}
                        title={`${label} — ${tooltip}`}
                        onClick={() => { setActiveRole(role); setEmail(roleEmail); setPassword(pass); setLoginError(null); }}
                        style={{
                          background: active ? `color-mix(in srgb, ${color} 14%, transparent)` : 'var(--glass, rgba(255,255,255,0.025))',
                          border: `1px solid ${active ? color : T.border}`,
                          borderRadius: 10, padding: '10px 6px', cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.18s', position: 'relative', overflow: 'hidden',
                          display: 'flex', flexDirection: 'column'
                        }}
                      >
                        {active && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${color},transparent)` }} />}
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: `color-mix(in srgb, ${color} 18%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>
                          <Icon size={12} color={color} />
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: active ? T.t1 : T.t2, whiteSpace: 'nowrap' }}>{label}</div>
                        <div style={{ fontSize: 8.5, color: active ? T.t2 : T.t3, marginTop: 2, lineHeight: 1.25, height: 28, overflow: 'hidden' }}>{desc}</div>
                      </button>
                    );
                  })}
                </div>
              )}

              {loginError && (
                <div style={{ background: 'rgba(244,63,94,0.12)', border: `1px solid ${T.rose}`, borderRadius: 8, padding: '10px 14px', color: T.roseL, fontSize: 12, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span>{loginError}</span>
                  <button onClick={handleLoginSubmit} disabled={isLoggingIn} style={{ background: T.rose, color: '#fff', border: 'none', borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
                </div>
              )}

              <form onSubmit={handleLoginSubmit}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 10.5, color: T.t3, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@organization.com"
                    style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 9, padding: '10px 14px', color: T.t1, fontSize: 13.5, outline: 'none', width: '100%', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  />
                </div>

                <div style={{ marginBottom: 20, position: 'relative' }}>
                  <label style={{ fontSize: 10.5, color: T.t3, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>Password</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 9, padding: '10px 42px 10px 14px', color: T.t1, fontSize: 13.5, outline: 'none', width: '100%', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: 32, background: 'none', border: 'none', color: T.t3, cursor: 'pointer' }}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  style={{
                    background: `linear-gradient(135deg, ${T.teal} 0%, ${T.tealD} 60%, ${T.tealDD} 100%)`,
                    border: 'none', borderRadius: 10, padding: '13px',
                    color: '#021a17', fontSize: 14.5, fontWeight: 800, cursor: 'pointer',
                    width: '100%', fontFamily: 'Fraunces, serif', letterSpacing: '0.2px',
                    boxShadow: `0 6px 20px rgba(45,212,191,0.35)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                >
                  {isLoggingIn ? <Loader2 size={16} style={{ animation: 'spinSlow 1s linear infinite' }} /> : null}
                  {isLoggingIn ? 'Authenticating…' : 'Access Dashboard →'}
                </button>
              </form>
            </div>
          ) : (
            /* TAB 2: CREATE ACCOUNT */
            <div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.t1, fontFamily: 'Fraunces, serif', letterSpacing: '-0.4px' }}>Register Organization</div>
                <div style={{ fontSize: 12.5, color: T.t3, marginTop: 3 }}>Instant self-onboarding for NGOs and corporate sustainability teams</div>
              </div>

              {/* Role Segmented Radio */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => setRegRole('ngo')}
                  style={{
                    background: regRole === 'ngo' ? 'rgba(56,189,248,0.14)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${regRole === 'ngo' ? T.skyL : T.border}`,
                    borderRadius: 9, padding: '9px 12px', textAlign: 'left', cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: regRole === 'ngo' ? T.skyL : T.t2 }}>
                    <TreePine size={13} /> NGO / Developer
                  </div>
                  <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>Register forestry & MRV projects</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRegRole('corporate')}
                  style={{
                    background: regRole === 'corporate' ? 'rgba(167,139,250,0.14)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${regRole === 'corporate' ? T.violetLL : T.border}`,
                    borderRadius: 9, padding: '9px 12px', textAlign: 'left', cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: regRole === 'corporate' ? T.violetLL : T.t2 }}>
                    <Building2 size={13} /> Corporate Buyer
                  </div>
                  <div style={{ fontSize: 10, color: T.t3, marginTop: 2 }}>Buy & retire verified credits</div>
                </button>
              </div>

              {regError && (
                <div style={{ background: 'rgba(244,63,94,0.12)', border: `1px solid ${T.rose}`, borderRadius: 8, padding: '8px 12px', color: T.roseL, fontSize: 12, marginBottom: 12 }}>
                  {regError}
                </div>
              )}
              {regSuccess && (
                <div style={{ background: 'rgba(16,185,129,0.12)', border: `1px solid ${T.emeraldL}`, borderRadius: 8, padding: '8px 12px', color: T.emeraldL, fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} /> {regSuccess}
                </div>
              )}

              <form onSubmit={handleRegisterSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Full Name *</label>
                    <input
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="e.g. Elena Rostova"
                      style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', color: T.t1, fontSize: 13, outline: 'none', width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Email Address *</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="contact@entity.org"
                      style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', color: T.t1, fontSize: 13, outline: 'none', width: '100%' }}
                    />
                  </div>
                </div>

                {regRole === 'ngo' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>NGO / Org Name *</label>
                      <input
                        type="text"
                        required
                        value={regOrgName}
                        onChange={(e) => setRegOrgName(e.target.value)}
                        placeholder="Amazonia Reforest Foundation"
                        style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', color: T.t1, fontSize: 13, outline: 'none', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Govt / Tax Reg. No.</label>
                      <input
                        type="text"
                        value={regRegNumber}
                        onChange={(e) => setRegRegNumber(e.target.value)}
                        placeholder="e.g. NGO-88219-BR"
                        style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', color: T.t1, fontSize: 13, outline: 'none', width: '100%' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Company Name *</label>
                      <input
                        type="text"
                        required
                        value={regCompanyName}
                        onChange={(e) => setRegCompanyName(e.target.value)}
                        placeholder="e.g. Apex Energy Corp"
                        style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', color: T.t1, fontSize: 13, outline: 'none', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Industry</label>
                      <input
                        type="text"
                        value={regIndustry}
                        onChange={(e) => setRegIndustry(e.target.value)}
                        placeholder="e.g. Manufacturing / Logistics"
                        style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', color: T.t1, fontSize: 13, outline: 'none', width: '100%' }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 16, position: 'relative' }}>
                  <label style={{ fontSize: 10, color: T.t3, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Create Password (min 8 chars) *</label>
                  <input
                    type={regShowPass ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Secure password"
                    style={{ background: 'var(--input-bg, rgba(255,255,255,0.04))', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 40px 8px 12px', color: T.t1, fontSize: 13, outline: 'none', width: '100%' }}
                  />
                  <button type="button" onClick={() => setRegShowPass(!regShowPass)} style={{ position: 'absolute', right: 10, top: 28, background: 'none', border: 'none', color: T.t3, cursor: 'pointer' }}>
                    {regShowPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isRegistering}
                  style={{
                    background: `linear-gradient(135deg, ${T.teal} 0%, ${T.tealD} 100%)`,
                    border: 'none', borderRadius: 9, padding: '12px',
                    color: '#021a17', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                    width: '100%', fontFamily: 'Fraunces, serif',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                >
                  {isRegistering ? <Loader2 size={15} style={{ animation: 'spinSlow 1s linear infinite' }} /> : <ArrowRight size={15} />}
                  {isRegistering ? 'Registering Entity…' : 'Create Verified Account'}
                </button>
              </form>
            </div>
          )}

          {/* Public Registry Access (No Login Required) */}
          <div style={{ marginTop: 18, textAlign: 'center' }}>
            <button
              data-testid="explore-public-registry"
              onClick={() => login('public')}
              style={{
                background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 9,
                padding: '10px 14px', color: T.teal, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, transition: 'all 0.15s'
              }}
            >
              <Globe size={14} color={T.teal} /> Explore the public registry (no login)
            </button>
          </div>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
