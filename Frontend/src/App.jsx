import { AppProvider, useApp } from './AppContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { Sidebar, Navbar, NotificationCenter } from './components/Layout.jsx';
import AppFooter from './components/Footer.jsx';
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
import CorporateCalculator from './components/corporate/CorporateCalculator.jsx';

// Public
import { PublicDashboard, PublicLeaderboard, PublicAudit, PublicCertificates, PublicClimate } from './components/public/PublicPages.jsx';

// Verifier / Approver
import VerifierDashboard from './components/verifier/VerifierDashboard.jsx';
import ApproverDashboard from './components/approver/ApproverDashboard.jsx';

// Dynamic Project & ML screens (Tasks 4 & 5)
import ProjectDetail from './components/projects/ProjectDetail.jsx';
import ProjectWizard from './components/projects/ProjectWizard.jsx';
import AdminMLModels from './components/admin/AdminMLModels.jsx';

function PageRouter() {
  const { user, page } = useApp();
  if (!user) return null;

  // Universal top-level routes accessible across authenticated roles
  if (page === 'settings')       return <SettingsPage />;
  if (page === 'profile')        return <ProfilePage />;
  if (page === 'project_detail') return <ProjectDetail />;
  if (page === 'new_project' && (user.role === 'ngo' || user.role === 'admin')) return <ProjectWizard />;

  if (user.role === 'admin') {
    if (page === 'dashboard')        return <AdminDashboard />;
    if (page === 'approvals')        return <AdminApprovals />;
    if (page === 'organisations')    return <AdminUsers initialTab="organizations" />;
    if (page === 'users')            return <AdminUsers />;
    if (page === 'pricing')          return <AdminPricing />;
    if (page === 'payments_payouts' || page === 'analytics') return <AdminAnalytics />;
    if (page === 'ml_models')        return <AdminMLModels />;
    if (page === 'audit')            return <PublicAudit />;
    return <AdminDashboard />;
  }

  if (user.role === 'approver') {
    // Strictly forbid admin features (pricing, users, payouts, orgs, ml_models)
    if (['pricing', 'users', 'organisations', 'payments_payouts', 'analytics', 'ml_models'].includes(page)) {
      return (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 14, padding: 36, maxWidth: 520, margin: '0 auto' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.roseL, marginBottom: 8, fontFamily: 'Fraunces, serif' }}>
              403 — Administrative Function Forbidden
            </div>
            <div style={{ fontSize: 13, color: T.t2, lineHeight: 1.6, marginBottom: 20 }}>
              Separation of Duties Policy: Approver roles review ecological fidelity and decide project admission, but cannot access administrative operations, pricing, user roles, or financial payouts.
            </div>
            <button
              onClick={() => window.location.href = '/'}
              style={{ background: `linear-gradient(135deg, ${T.teal}, ${T.tealD})`, color: '#021a17', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 800, cursor: 'pointer' }}
            >
              Return to Decision Desk
            </button>
          </div>
        </div>
      );
    }
    return <ApproverDashboard />;
  }

  if (user.role === 'verifier') {
    return <VerifierDashboard />;
  }

  if (user.role === 'ngo') {
    if (page === 'dashboard')        return <NGODashboard />;
    if (page === 'projects')         return <NGOProjects />;
    if (page === 'new_project')      return <ProjectWizard />;
    if (page === 'site_suitability') return <NGOSiteSuitability />;
    if (page === 'ngo_marketplace')  return <NGOMarketplace />;
    return <NGODashboard />;
  }

  if (user.role === 'corporate') {
    if (page === 'dashboard')   return <CorporateDashboard />;
    if (page === 'marketplace') return <CorporateMarketplace />;
    if (page === 'wallet')      return <CorporateWallet />;
    if (page === 'esg')         return <CorporateESG />;
    if (page === 'calculator')  return <CorporateCalculator />;
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
        <AppFooter />
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
