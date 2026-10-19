/**
 * Frontend/src/routes/routeTable.js
 * Central route table defining navigation labels, page titles (h1), and role access.
 * Invariant: Every nav item in every role's shell must match this table.
 * Used by nav.spec.js and routes.spec.js to assert 100% route and title parity.
 */

export const ROUTE_TABLE = {
  admin: [
    { id: 'dashboard', label: 'Home', title: 'Admin Operations Console' },
    { id: 'approvals', label: 'Review Queue (oversight)', title: 'Review Queue (oversight)' },
    { id: 'organisations', label: 'Organisations', title: 'Organisation Verification' },
    { id: 'users', label: 'Users', title: 'Platform Users' },
    { id: 'pricing', label: 'Pricing', title: 'Carbon Pricing Engine' },
    { id: 'payments_payouts', label: 'Payments and Payouts', title: 'Payments and Payouts' },
    { id: 'analytics', label: 'Platform Analytics', title: 'Platform Analytics' },
    { id: 'ml_models', label: 'ML Models', title: 'Machine Learning Engine' },
    { id: 'audit', label: 'Audit', title: 'Public Audit Trail' },
    { id: 'settings', label: 'Settings', title: 'Account & Organisation Settings' },
  ],
  verifier: [
    { id: 'dashboard', label: 'Assignments', title: 'Field Verification Workbench' },
    { id: 'map', label: 'Map', title: 'Field Inspection Map' },
    { id: 'completed', label: 'Completed', title: 'Verified Project Archive' },
    { id: 'profile', label: 'Profile', title: 'Verifier Accreditation Profile' },
  ],
  ngo: [
    { id: 'dashboard', label: 'Workspace', title: 'NGO Project Workspace' },
    { id: 'projects', label: 'My Projects', title: 'My Projects' },
    { id: 'new_project', label: 'New Project', title: 'Register Carbon Project' },
    { id: 'site_suitability', label: 'Site Suitability', title: 'Site Suitability Assessment' },
    { id: 'ngo_marketplace', label: 'Marketplace', title: 'Carbon Credit Marketplace' },
  ],
  corporate: [
    { id: 'dashboard', label: 'Portfolio', title: 'Corporate Climate Portfolio' },
    { id: 'marketplace', label: 'Marketplace', title: 'Carbon Credit Marketplace' },
    { id: 'wallet', label: 'My Wallet', title: 'Corporate Credit Wallet' },
    { id: 'esg', label: 'ESG Reports', title: 'Corporate ESG Disclosure' },
    { id: 'calculator', label: 'Footprint Calculator', title: 'Carbon Footprint Calculator' },
  ],
  public: [
    { id: 'dashboard', label: 'Impact Stats', title: 'Global Ecological Impact' },
    { id: 'leaderboard', label: 'Leaderboard', title: 'Carbon Impact Leaderboard' },
    { id: 'projects', label: 'Marketplace View', title: 'Public Carbon Marketplace' },
    { id: 'climate', label: 'Climate Insights', title: 'Climate & Satellite Insights' },
    { id: 'certificates', label: 'Certificates', title: 'Public Retirement Certificates' },
    { id: 'audit', label: 'Audit Trail', title: 'Immutable Audit Ledger' },
  ]
};

/**
 * Get route info for a given role and page id
 * @param {string} role 
 * @param {string} pageId 
 */
export function getRouteInfo(role, pageId) {
  const routes = ROUTE_TABLE[role] || ROUTE_TABLE.public;
  return routes.find(r => r.id === pageId) || routes[0];
}
