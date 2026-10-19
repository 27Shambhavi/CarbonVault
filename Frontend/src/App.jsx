import { AppProvider, useApp } from './AppContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { SettingsPage, ProfilePage } from './components/SettingsProfile.jsx';
import { T } from './components/UI.jsx';

// Role Shells
import { AdminShell, VerifierShell, NgoShell, CorporateShell, PublicShell } from './components/shells/index.js';

// Admin Views
import AdminDashboard from './components/admin/AdminDashboard.jsx';
import AdminUsers from './components/admin/AdminUsers.jsx';
import AdminApprovals from './components/admin/AdminApprovals.jsx';
import { AdminPricing, AdminAnalytics } from './components/admin/AdminPricingAnalytics.jsx';
import { AdminRefundPayouts } from './components/admin/AdminRefundPayouts.jsx';
import AdminMLModels from './components/admin/AdminMLModels.jsx';

// NGO Views
import { NGODashboard, NGOProjects, NGONewProject, NGOSiteSuitability, NGOMarketplace } from './components/ngo/NGOPages.jsx';

// Corporate Views
import { CorporateDashboard, CorporateMarketplace, CorporateWallet, CorporateESG } from './components/corporate/CorporatePages.jsx';
import CorporateCalculator from './components/corporate/CorporateCalculator.jsx';

// Public Views
import { PublicDashboard, PublicLeaderboard, PublicAudit, PublicCertificates, PublicClimate } from './components/public/PublicPages.jsx';

// Verifier View
import VerifierDashboard from './components/verifier/VerifierDashboard.jsx';

// Dynamic Project Screens
import ProjectDetail from './components/projects/ProjectDetail.jsx';
import ProjectWizard from './components/projects/ProjectWizard.jsx';

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
    if (page === 'payments_payouts') return <AdminRefundPayouts />;
    if (page === 'analytics')        return <AdminAnalytics />;
    if (page === 'ml_models')        return <AdminMLModels />;
    if (page === 'audit')            return <PublicAudit />;
    return <AdminDashboard />;
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
      No dashboard for role &quot;{String(user.role)}&quot;. Use Admin, Verifier, NGO, Corporate, or Public Explorer on the login screen.
    </div>
  );
}

function RoleShell({ children }) {
  const { user } = useApp();
  const role = user?.role || 'public';
  if (role === 'admin')     return <AdminShell>{children}</AdminShell>;
  if (role === 'verifier')  return <VerifierShell>{children}</VerifierShell>;
  if (role === 'ngo')       return <NgoShell>{children}</NgoShell>;
  if (role === 'corporate') return <CorporateShell>{children}</CorporateShell>;
  return <PublicShell>{children}</PublicShell>;
}

function AppShell() {
  const { user, page } = useApp();
  if (!user) return <LoginPage />;
  return (
    <RoleShell>
      <ErrorBoundary key={`${user?.role}-${page}`} resetKey={`${user?.role}-${page}`}>
        <PageRouter />
      </ErrorBoundary>
    </RoleShell>
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
