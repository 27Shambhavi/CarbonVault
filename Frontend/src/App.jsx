import { AppProvider, useApp } from './AppContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { Sidebar, Navbar, NotificationCenter } from './components/Layout.jsx';
import { SettingsPage, ProfilePage } from './components/SettingsProfile.jsx';
import { T } from './components/UI.jsx';

// Admin
import AdminDashboard from './components/admin/AdminDashboard.jsx';
import AdminUsers from './components/admin/AdminUsers.jsx';
import AdminApprovals from './components/admin/AdminApprovals.jsx';
import { AdminPricing, AdminAnalytics } from './components/admin/AdminPricingAnalytics.jsx';

// NGO
import { NGODashboard, NGOProjects, NGONewProject, NGOSiteSuitability, NGOMarketplace } from './components/ngo/NGOPages.jsx';

// Corporate
import { CorporateDashboard, CorporateMarketplace, CorporateWallet, CorporateESG } from './components/corporate/CorporatePages.jsx';

// Public
import { PublicDashboard, PublicLeaderboard, PublicAudit, PublicCertificates, PublicClimate } from './components/public/PublicPages.jsx';

function PageRouter() {
  const { user, page } = useApp();
  if (!user) return null;
  if (page === 'settings') return <SettingsPage />;
  if (page === 'profile')  return <ProfilePage />;

  if (user.role === 'admin') {
    if (page === 'dashboard') return <AdminDashboard />;
    if (page === 'users')     return <AdminUsers />;
    if (page === 'approvals') return <AdminApprovals />;
    if (page === 'pricing')   return <AdminPricing />;
    if (page === 'analytics') return <AdminAnalytics />;
    return <AdminDashboard />;
  }

  if (user.role === 'ngo') {
    if (page === 'dashboard')        return <NGODashboard />;
    if (page === 'projects')         return <NGOProjects />;
    if (page === 'new_project')      return <NGONewProject />;
    if (page === 'site_suitability') return <NGOSiteSuitability />;
    if (page === 'ngo_marketplace')  return <NGOMarketplace />;
    return <NGODashboard />;
  }

  if (user.role === 'corporate') {
    if (page === 'dashboard')   return <CorporateDashboard />;
    if (page === 'marketplace') return <CorporateMarketplace />;
    if (page === 'wallet')      return <CorporateWallet />;
    if (page === 'esg')         return <CorporateESG />;
    return <CorporateDashboard />;
  }

  if (user.role === 'public') {
    if (page === 'dashboard')    return <PublicDashboard />;
    if (page === 'leaderboard')  return <PublicLeaderboard />;
    if (page === 'audit')        return <PublicAudit />;
    if (page === 'certificates') return <PublicCertificates />;
    if (page === 'climate')      return <PublicClimate />;
    if (page === 'projects')     return <CorporateMarketplace />;
    return <PublicDashboard />;
  }

  return (
    <div style={{ padding: 28, color: T.t2, fontSize: 14 }}>
      No dashboard for role &quot;{String(user.role)}&quot;. Use Admin, NGO, Corporate, or Public Explorer on the login screen.
    </div>
  );
}

function AppShell() {
  const { user, page } = useApp();
  if (!user) return <LoginPage />;
  return (
    <div style={{ display:'flex', minHeight:'100vh', background: T.bg0 }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        <Navbar />
        <main style={{ flex:1, overflowY:'auto' }}>
          <ErrorBoundary key={`${user?.role}-${page}`} resetKey={`${user?.role}-${page}`}>
            <PageRouter />
          </ErrorBoundary>
        </main>
      </div>
      <NotificationCenter />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </ErrorBoundary>
  );
}
