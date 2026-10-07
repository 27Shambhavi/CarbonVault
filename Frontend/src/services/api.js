// ── CarbonVault API Service Layer ────────────────────────────────────────────
// Resilient API: tries backend first, falls back to mock data if unavailable.
// Uses Vite proxy (/api → http://127.0.0.1:8000) to avoid CORS.

import {
  mockProjects, mockTransactions, mockMarketplace, mockBuyRequests,
  mockUsers, mockGRSData, mockCreditsOverTime, mockCreditsByType
} from '../data/mockData.js';

const RAW_BASE = import.meta.env.VITE_API_BASE_URL;
export const API_BASE = RAW_BASE ? RAW_BASE.replace(/\/$/, '') : '/api';

/** Helper to get full image URL whether in dev or production */
export function getImageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE === '/api') {
    return cleanPath;
  }
  return `${API_BASE}${cleanPath}`;
}

// ── Backend availability tracking ──────────────────────────────────────────
let _backendOnline = true; // Default optimistic so requests are always attempted

export async function checkBackend() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
    const ctype = res.headers.get('content-type') || '';
    _backendOnline = res.ok && !ctype.includes('text/html');
  } catch {
    _backendOnline = false;
  }
  return _backendOnline;
}

// Background check on load
checkBackend().catch(() => {});

/** Re-check backend status */
export function isBackendOnline() { return _backendOnline; }

// ── Generic fetch wrapper ──────────────────────────────────────────────────
async function request(url, options = {}) {
  try {
    // Default 60s timeout to accommodate Render free-tier cold starts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const fetchOptions = {
      ...options,
      signal: options.signal || controller.signal,
    };

    const res = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    const ctype = res.headers.get('content-type') || '';
    const text = await res.text();

    if (ctype.includes('text/html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      _backendOnline = false;
      return { data: null, error: 'Endpoint returned HTML instead of API response. Check VITE_API_BASE_URL.' };
    }

    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (!res.ok) {
      return { data: null, error: (data && data.detail) || `Request failed (${res.status})` };
    }

    _backendOnline = true;
    return { data, error: null };
  } catch (err) {
    _backendOnline = false;
    return { data: null, error: err.message || 'Network error' };
  }
}

/**
 * Try backend first; if it fails, return mock fallback data.
 * ALWAYS attempts the live backend first.
 */
async function requestWithFallback(url, options = {}, fallback = null) {
  const result = await request(url, options);
  if (result.error && fallback !== null) {
    console.warn(`[CarbonVault API] Backend request failed (${url}): ${result.error}. Using fallback.`);
    return { data: fallback, error: null, fromMock: true, backendError: result.error };
  }
  return { ...result, fromMock: false };
}

// ══════════════════════════════════════════════════════════════════════════════
// PROJECT APIs
// ══════════════════════════════════════════════════════════════════════════════

/** Create a new project (FormData with file upload). No fallback — requires backend. */
export async function createProject(formData) {
  return request(`${API_BASE}/projects/create-project`, {
    method: 'POST',
    body: formData,
  });
}

/** Fetch projects for a specific NGO */
export async function fetchProjects(ngoId) {
  const mockFallback = mockProjects
    .filter(p => p.ngo === 'EcoGuard Brazil')
    .map(p => ({
      project_id: p.id, name: p.name,
      location: `${p.lat}, ${p.lng}`,
      area_hectares: p.area, plantation_type: p.plantType || p.type,
      status: p.status, credits: p.credits, shadow_credits: 0,
      price_per_ton: p.price, total_funding: 0,
      mrvScore: p.mrvScore, fraudRisk: p.fraudRisk, envScore: p.envScore,
      evidence_image: null,
    }));
  return requestWithFallback(`${API_BASE}/projects/projects?ngo_id=${ngoId}`, {}, mockFallback);
}

/** Fetch dashboard summary for an NGO */
export async function fetchDashboard(ngoId) {
  const approved = mockProjects.filter(p => p.status === 'approved');
  const mockDash = {
    total_projects: mockProjects.length,
    active_projects: approved.length,
    total_credits: approved.reduce((s, p) => s + (p.credits || 0), 0),
    total_shadow_credits: 0,
    total_funding: approved.reduce((s, p) => s + (p.credits || 0) * (p.price || 0), 0),
    corporates_involved: ['Microsoft Sustainability', 'Google Carbon Team'],
  };
  return requestWithFallback(`${API_BASE}/projects/dashboard/${ngoId}`, {}, mockDash);
}

/** Approved projects with GeoJSON polygons (global). Optional ngo_id = all statuses for that NGO. */
export async function fetchMapProjects(ngoId = null) {
  const q = ngoId != null && ngoId !== '' ? `?ngo_id=${encodeURIComponent(ngoId)}` : '';
  return requestWithFallback(`${API_BASE}/projects/map${q}`, {}, { projects: [] });
}

/** Pending projects with polygons (admin map overlay). */
export async function fetchMapPendingProjects() {
  return requestWithFallback(`${API_BASE}/projects/pending`, {}, { projects: [] });
}

/** Fetch ALL projects (admin) */
export async function fetchAllProjects() {
  const mockFallback = mockProjects.map(p => ({
    project_id: p.id, name: p.name, ngo: p.ngo,
    location: p.location, lat: p.lat, lng: p.lng,
    area_hectares: p.area, plantation_type: p.type,
    number_of_trees: p.trees, status: p.status,
    credits: p.credits, shadow_credits: 0,
    price_per_ton: p.price, total_funding: 0,
    start_date: p.startDate, created_at: p.startDate,
    mrvScore: p.mrvScore, fraudRisk: p.fraudRisk, envScore: p.envScore,
    evidence_image: null,
  }));
  return requestWithFallback(`${API_BASE}/projects/all-projects`, {}, mockFallback);
}

/** Update project status (admin approve/reject) */
export async function updateProjectStatus(projectId, status) {
  return request(`${API_BASE}/projects/projects/${projectId}/status?status=${status}`, {
    method: 'PATCH',
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// FRAUD DETECTION APIs
// ══════════════════════════════════════════════════════════════════════════════

/** Run fraud detection on a project (if PostGIS is available) */
export async function runFraudDetection(projectId, polygonWkt, imagePath) {
  return request(`${API_BASE}/fraud/check-project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      polygon_wkt: polygonWkt,
      image_path: imagePath,
    }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// MARKETPLACE APIs
// ══════════════════════════════════════════════════════════════════════════════

/** Fetch marketplace buy requests for an NGO */
export async function fetchMarketplaceRequests(ngoId) {
  const mockFallback = mockBuyRequests.map(r => ({
    id: r.id, buyer: r.buyer, project_id: r.projectId,
    project_name: r.project, tons: r.tons,
    price_per_ton: r.pricePerTon, total: r.total, status: r.status,
  }));
  return requestWithFallback(`${API_BASE}/marketplace/requests/${ngoId}`, {}, mockFallback);
}

/** Fetch marketplace listings for corporate buyers */
export async function fetchMarketplaceListings() {
  return requestWithFallback(`${API_BASE}/marketplace/listings`, {}, mockMarketplace);
}

/** Create a buy request (corporate → NGO) */
export async function createBuyRequest(corporateName, projectId, offeredPrice) {
  return request(`${API_BASE}/marketplace/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      corporate_name: corporateName,
      project_id: projectId,
      offered_price: offeredPrice,
    }),
  });
}

/** Accept a buy request */
export async function acceptBuyRequest(requestId) {
  return request(`${API_BASE}/marketplace/accept/${requestId}`, { method: 'POST' });
}

// ══════════════════════════════════════════════════════════════════════════════
// SITE SUITABILITY APIs
// ══════════════════════════════════════════════════════════════════════════════

/** Check site suitability via ML model */
export async function checkSiteSuitability(lat, lon, area = 100) {
  const mockFallback = {
    suitability_score: 0.72 + Math.random() * 0.2,
    input_location: { lat, lon, area },
  };
  return requestWithFallback(`${API_BASE}/suitability/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, area }),
  }, mockFallback);
}

// ══════════════════════════════════════════════════════════════════════════════
// GRS APIs
// ══════════════════════════════════════════════════════════════════════════════

/** Calculate GRS score for a corporate */
export async function calculateGRS(data) {
  return requestWithFallback(`${API_BASE}/grs/calculate-grs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }, {
    Company: data.company_name,
    'Green Reputation Score': mockGRSData.score / 10,
    Badge: 'Gold',
    Breakdown: {
      'Impact Score': 82, 'Quality Score': 78,
      'Commitment Score': 73, 'Credibility Score': 88,
    },
  });
}

/** Get GRS leaderboard */
export async function fetchLeaderboard() {
  return requestWithFallback(`${API_BASE}/grs/leaderboard`, {}, []);
}

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT / RAZORPAY APIs
// ══════════════════════════════════════════════════════════════════════════════

/** Create Razorpay order. Amount is in INR (NOT paise). Backend converts. */
export async function createOrder(amountINR, currency = 'INR', projectId = null, corporateName = null) {
  return request(`${API_BASE}/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amountINR,
      currency,
      project_id: projectId,
      corporate_name: corporateName,
    }),
  });
}

/** Record purchase after Razorpay payment success */
export async function buyCredits(paymentData) {
  return request(`${API_BASE}/payment/buy-credits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentData),
  });
}

/** Fetch transactions for a corporate buyer */
export async function fetchTransactions(companyName) {
  return requestWithFallback(
    `${API_BASE}/payment/transactions/${encodeURIComponent(companyName)}`,
    {},
    []
  );
}

/** Fetch wallet summary for a corporate buyer */
export async function fetchWallet(companyName) {
  return requestWithFallback(
    `${API_BASE}/payment/wallet/${encodeURIComponent(companyName)}`,
    {},
    { corporate_name: companyName, total_credits: 0, total_spent_inr: 0, total_spent_usd: 0 }
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ESG REPORT APIs
// ══════════════════════════════════════════════════════════════════════════════

/** Generate ESG report for corporate (single project or full portfolio) */
export async function generateESGReport(corporateName, projectId = null) {
  return request(`${API_BASE}/esg/generate-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      corporate_name: corporateName,
      project_id: projectId,
    }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// STATS & AUDIT LOG APIs
// ══════════════════════════════════════════════════════════════════════════════

/** Platform-wide aggregate stats for all dashboards & login screen */
export async function fetchPlatformStats() {
  const approved = mockProjects.filter(p => p.status === 'approved');
  const mockFallback = {
    total_projects: mockProjects.length,
    active_projects: approved.length,
    pending_projects: mockProjects.filter(p => p.status === 'pending').length,
    rejected_projects: mockProjects.filter(p => p.status === 'rejected').length,
    total_credits: approved.reduce((s, p) => s + (p.credits || 0), 0),
    total_shadow_credits: 0,
    total_funding_usd: 580000,
    total_transactions: mockTransactions.length,
    total_transaction_value_inr: 3625000,
    total_transaction_value_usd: 43400,
    certificates_issued: 24,
    audits_conducted: 48,
    avg_mrv_score: 86.4,
    fraud_detection_rate: '12.5%',
    approval_rate: '75%',
    co2_removed_tons: 43400,
    countries_active: 5,
  };
  return requestWithFallback(`${API_BASE}/projects/stats`, {}, mockFallback);
}

/** Fetch immutable audit trail */
export async function fetchAuditLogs() {
  const mockFallback = [
    { id: 1, action: 'mint', name: 'PRJ-MAN-AMAZON', timestamp: new Date(Date.now() - 14 * 60000).toISOString(), detail: 'Minted 12,400 verified credits with satellite NDVI verification', user: 'Admin System' },
    { id: 2, action: 'approve', name: 'PRJ-TEK-CONGO1', timestamp: new Date(Date.now() - 2 * 3600000).toISOString(), detail: 'Project approved with GRS quality score of 91/100', user: 'Alex Mercer (Admin)' },
    { id: 3, action: 'create', name: 'PRJ-MAN-SUNDAR', timestamp: new Date(Date.now() - 5 * 3600000).toISOString(), detail: 'New mangrove restoration project submitted with boundary polygon', user: 'Green Delta' },
    { id: 4, action: 'payment', name: 'PRJ-MAN-AMAZON', timestamp: new Date(Date.now() - 24 * 3600000).toISOString(), detail: 'Microsoft purchased 2,000 tonnes (₹4,75,950.00)', user: 'Microsoft Sustainability' },
  ];
  return requestWithFallback(`${API_BASE}/projects/audit-logs`, {}, mockFallback);
}

/** Calculate real-time human-friendly relative time (e.g. '10m ago') from ISO timestamp */
export function timeAgo(timestamp) {
  if (!timestamp) return 'recently';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return String(timestamp);
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/** Dynamically ensure Razorpay checkout script is loaded */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/** Verification Certificates Registry API */
export async function fetchCertificates() {
  const mockFallback = [
    { certificate_id: 'CV-2024-001', project_name: 'Amazon Reforestation Initiative', credits: 12400, issuance_date: '2024-12-15', status: 'VERIFIED', plantation_type: 'Mixed' },
    { certificate_id: 'CV-2024-002', project_name: 'Congo Basin Forest Shield', credits: 22000, issuance_date: '2024-12-14', status: 'VERIFIED', plantation_type: 'Teak' },
    { certificate_id: 'CV-2024-003', project_name: 'Vietnamese Coastal Mangrove', credits: 6800, issuance_date: '2024-12-10', status: 'VERIFIED', plantation_type: 'Mangrove' },
    { certificate_id: 'CV-2024-004', project_name: 'Sundarbans Mangrove Restoration', credits: 8200, issuance_date: '2024-12-08', status: 'VERIFIED', plantation_type: 'Mangrove' },
  ];
  return requestWithFallback(`${API_BASE}/projects/certificates`, {}, mockFallback);
}

/** Climate Resilience & Co-Benefits API */
export async function fetchClimateAnalytics() {
  const mockFallback = {
    co2_removed_tons: 43400,
    forest_area_ha: 14500,
    renewable_energy_gwh: 89.2,
    co_benefits: [
      { metric: 'Flood Control', value: 78 },
      { metric: 'Biodiversity', value: 85 },
      { metric: 'Fisheries', value: 62 },
      { metric: 'Coastal Prot.', value: 71 },
      { metric: 'Carbon Seq.', value: 93 },
      { metric: 'Livelihood', value: 67 },
    ],
  };
  return requestWithFallback(`${API_BASE}/projects/climate-analytics`, {}, mockFallback);
}

/** Pricing Engine Configuration API */
export async function fetchPricingConfig() {
  const mockFallback = {
    base: 28.50,
    demand: 1.12,
    supply: 0.98,
    living: 1.08,
    final_price: 33.78,
    history: mockCreditsOverTime.map((d, i) => ({ month: d.month, price: 24 + i * 0.8 })),
  };
  return requestWithFallback(`${API_BASE}/pricing`, {}, mockFallback);
}

/** Save Pricing Engine Configuration */
export async function savePricingConfig(config) {
  return request(`${API_BASE}/pricing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

/** User Management API */
export async function fetchUsers() {
  return requestWithFallback(`${API_BASE}/users`, {}, mockUsers);
}

/** Invite New User */
export async function inviteUser(userData) {
  return request(`${API_BASE}/users/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
}

/** Update User Status (active / suspended) */
export async function updateUserStatus(userId, status) {
  return request(`${API_BASE}/users/${userId}/status?status=${encodeURIComponent(status)}`, {
    method: 'PATCH',
  });
}

/** Dynamic Notifications API */
export async function fetchNotifications() {
  return requestWithFallback(`${API_BASE}/notifications`, {}, mockNotifications);
}

