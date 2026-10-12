// ── CarbonVault API Service Layer ────────────────────────────────────────────
// Real Data Architecture: talks directly to FastAPI backend, no invented mock fallbacks.
// Uses Vite proxy (/api → http://127.0.0.1:8000) or VITE_API_BASE_URL.

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
let _backendOnline = true;
let _authToken = null;

export function setAuthToken(token) {
  _authToken = token;
  if (token) {
    try { localStorage.setItem('carbonvault_jwt', token); } catch {}
  } else {
    try { localStorage.removeItem('carbonvault_jwt'); } catch {}
  }
}

export function getAuthToken() {
  if (!_authToken) {
    try { _authToken = localStorage.getItem('carbonvault_jwt'); } catch {}
  }
  return _authToken;
}

// Legacy helper kept for backward compatibility; replaced by JWT bearer tokens
export function setApiAdminContext() {}

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
export async function request(url, options = {}, retries = 1, backoffMs = 2000) {
  try {
    // Default 60s timeout to accommodate Render free-tier cold starts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const headers = {
      ...(options.headers || {}),
    };

    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions = {
      ...options,
      headers,
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
      if ((res.status === 502 || res.status === 503 || res.status === 504) && retries > 0 && (!options.method || options.method === 'GET')) {
        await new Promise(r => setTimeout(r, backoffMs));
        return request(url, options, retries - 1, backoffMs * 2);
      }
      return { data: null, error: (data && data.detail) || `Request failed (${res.status})` };
    }

    _backendOnline = true;
    return { data, error: null };
  } catch (err) {
    if (retries > 0 && (!options.method || options.method === 'GET')) {
      await new Promise(r => setTimeout(r, backoffMs));
      return request(url, options, retries - 1, backoffMs * 2);
    }
    _backendOnline = false;
    return { data: null, error: err.message || 'Network error' };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HEALTH & AUTH APIs
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchHealth() {
  return request(`${API_BASE}/health`);
}

export async function loginUser(email, password) {
  return request(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// PROJECT APIs
// ══════════════════════════════════════════════════════════════════════════════

/** Create a new project (FormData with file upload). */
export async function createProject(formData) {
  return request(`${API_BASE}/projects/create-project`, {
    method: 'POST',
    body: formData,
  });
}

/** Fetch projects for a specific NGO */
export async function fetchProjects(ngoId) {
  const res = await request(`${API_BASE}/projects/projects?ngo_id=${ngoId}`);
  if (res.error) return { data: [], error: res.error };
  return res;
}

/** Fetch dashboard summary for an NGO */
export async function fetchDashboard(ngoId) {
  return request(`${API_BASE}/projects/dashboard/${ngoId}`);
}

/** Approved projects with GeoJSON polygons (global). Optional ngo_id = all statuses for that NGO. */
export async function fetchMapProjects(ngoId = null) {
  const q = ngoId != null && ngoId !== '' ? `?ngo_id=${encodeURIComponent(ngoId)}` : '';
  const res = await request(`${API_BASE}/projects/map${q}`);
  if (res.error) return { data: { projects: [] }, error: res.error };
  return res;
}

/** Pending projects with polygons (admin map overlay). */
export async function fetchMapPendingProjects() {
  const res = await request(`${API_BASE}/projects/pending`);
  if (res.error) return { data: { projects: [] }, error: res.error };
  return res;
}

/** Fetch ALL projects (admin) */
export async function fetchAllProjects() {
  const res = await request(`${API_BASE}/projects/all-projects`);
  if (res.error) return { data: [], error: res.error };
  return res;
}

/** Update project status (admin multi-stage lifecycle with comment) */
export async function updateProjectStatus(projectId, status, comment = null, changedBy = null) {
  return request(`${API_BASE}/projects/${projectId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status,
      comment,
      changed_by: changedBy || 'Alex Mercer (Admin)',
    }),
  });
}

/** Fetch Project Status History / Audit Trail */
export async function fetchProjectHistory(projectId) {
  return request(`${API_BASE}/projects/${projectId}/history`);
}

/** Submit Quarterly Progress Update (NGO) */
export async function submitProgressUpdate(projectId, formData) {
  return request(`${API_BASE}/projects/${projectId}/progress`, {
    method: 'POST',
    body: formData,
  });
}

/** Fetch Quarterly Progress Updates for Timeline */
export async function fetchProjectProgress(projectId) {
  return request(`${API_BASE}/projects/${projectId}/progress`);
}

// ══════════════════════════════════════════════════════════════════════════════
// FRAUD DETECTION APIs
// ══════════════════════════════════════════════════════════════════════════════

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
  const res = await request(`${API_BASE}/marketplace/requests/${ngoId}`);
  if (res.error) return { data: [], error: res.error };
  return res;
}

/** Fetch marketplace listings for corporate buyers with optional multi-param filtering */
export async function fetchMarketplaceListings(filters = {}) {
  const q = new URLSearchParams();
  if (filters.plantation_type && filters.plantation_type !== 'all') q.append('plantation_type', filters.plantation_type);
  if (filters.min_price != null && filters.min_price !== '') q.append('min_price', filters.min_price);
  if (filters.max_price != null && filters.max_price !== '') q.append('max_price', filters.max_price);
  if (filters.min_mrv != null && filters.min_mrv !== '') q.append('min_mrv', filters.min_mrv);
  if (filters.search) q.append('search', filters.search);
  const qs = q.toString() ? `?${q.toString()}` : '';
  const res = await request(`${API_BASE}/marketplace/listings${qs}`);
  if (res.error) return { data: [], error: res.error };
  return res;
}

/** Side-by-side Project Comparison API */
export async function compareProjects(projectIds) {
  return request(`${API_BASE}/marketplace/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_ids: projectIds }),
  });
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

export async function checkSiteSuitability(lat, lon, area = 100) {
  return request(`${API_BASE}/suitability/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, area }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// GRS APIs
// ══════════════════════════════════════════════════════════════════════════════

export async function calculateGRS(data) {
  return request(`${API_BASE}/grs/calculate-grs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function fetchLeaderboard() {
  const res = await request(`${API_BASE}/grs/leaderboard`);
  if (res.error) return { data: [], error: res.error };
  return res;
}

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENT / RAZORPAY APIs
// ══════════════════════════════════════════════════════════════════════════════

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

export async function buyCredits(paymentData) {
  return request(`${API_BASE}/payment/buy-credits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentData),
  });
}

export async function fetchTransactions(companyName) {
  const res = await request(`${API_BASE}/payment/transactions/${encodeURIComponent(companyName)}`);
  if (res.error) return { data: [], error: res.error };
  return res;
}

export async function fetchWallet(companyName) {
  return request(`${API_BASE}/payment/wallet/${encodeURIComponent(companyName)}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// ESG REPORT APIs
// ══════════════════════════════════════════════════════════════════════════════

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

export async function fetchPlatformStats() {
  return request(`${API_BASE}/projects/stats`);
}

export async function fetchPublicStats() {
  return request(`${API_BASE}/public/stats`);
}

export async function fetchOverviewStats(role = 'admin', period = '30d') {
  return request(`${API_BASE}/stats/overview?role=${encodeURIComponent(role)}&period=${encodeURIComponent(period)}`);
}

export async function fetchAuditLogs() {
  return request(`${API_BASE}/projects/audit-logs`);
}

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

// ══════════════════════════════════════════════════════════════════════════════
// CERTIFICATES & CLIMATE APIs
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchCertificates() {
  const res = await request(`${API_BASE}/certificates`);
  if (res.error) return { data: [], error: res.error };
  return res;
}

export async function fetchCertificateDetail(certId) {
  return request(`${API_BASE}/certificates/${encodeURIComponent(certId)}`);
}

export async function verifyCertificate(certId) {
  return request(`${API_BASE}/certificates/verify/${encodeURIComponent(certId)}`);
}

export function getCertificateDownloadUrl(certId, format = 'png') {
  return `${API_BASE}/certificates/${encodeURIComponent(certId)}/download?format=${format}`;
}

export function getCertificateImageUrl(certId) {
  return `${API_BASE}/certificates/${encodeURIComponent(certId)}/image`;
}

export async function fetchClimateAnalytics() {
  return request(`${API_BASE}/projects/climate-analytics`);
}

// ══════════════════════════════════════════════════════════════════════════════
// PRICING ENGINE APIs
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchPricingConfig() {
  return request(`${API_BASE}/pricing`);
}

export async function savePricingConfig(config) {
  return request(`${API_BASE}/pricing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

export async function fetchPricingForecast() {
  return request(`${API_BASE}/pricing/forecast`);
}

// ══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT APIs
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchUsers() {
  const res = await request(`${API_BASE}/users`);
  if (res.error) return { data: [], error: res.error };
  return res;
}

export async function inviteUser(userData) {
  return request(`${API_BASE}/users/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  });
}

export async function updateUserStatus(userId, status) {
  return request(`${API_BASE}/users/${userId}/status?status=${encodeURIComponent(status)}`, {
    method: 'PATCH',
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS APIs
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchNotifications(params = {}) {
  const q = new URLSearchParams();
  if (params.role) q.append('role', params.role);
  if (params.email) q.append('email', params.email);
  if (params.unread_only) q.append('unread_only', 'true');
  const qs = q.toString() ? `?${q.toString()}` : '';
  const res = await request(`${API_BASE}/notifications${qs}`);
  if (res.error) return { data: [], error: res.error };
  return res;
}

export async function fetchUnreadNotifCount(params = {}) {
  const q = new URLSearchParams();
  if (params.role) q.append('role', params.role);
  if (params.email) q.append('email', params.email);
  const qs = q.toString() ? `?${q.toString()}` : '';
  return request(`${API_BASE}/notifications/unread-count${qs}`);
}

export async function markNotificationRead(id) {
  return request(`${API_BASE}/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsRead(params = {}) {
  const q = new URLSearchParams();
  if (params.role) q.append('role', params.role);
  if (params.email) q.append('email', params.email);
  const qs = q.toString() ? `?${q.toString()}` : '';
  return request(`${API_BASE}/notifications/mark-all-read${qs}`, {
    method: 'POST',
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// CORPORATE FOOTPRINT CALCULATOR APIs
// ══════════════════════════════════════════════════════════════════════════════

export async function calculateFootprint(data) {
  return request(`${API_BASE}/calculator/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function fetchFootprintHistory(corporateName) {
  return request(`${API_BASE}/calculator/history/${encodeURIComponent(corporateName || 'Corporate Buyer')}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// PROJECT MANAGEMENT & REPORT EXPORT
// ══════════════════════════════════════════════════════════════════════════════

export async function deleteProject(projectId) {
  return request(`${API_BASE}/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
}

export async function importProjectsCSV(file) {
  const formData = new FormData();
  formData.append('file', file);
  return request(`${API_BASE}/projects/import-csv`, {
    method: 'POST',
    body: formData,
  });
}

export function getPlatformPDFUrl() {
  return `${API_BASE}/projects/export-pdf`;
}

export async function downloadPlatformPDF() {
  const url = getPlatformPDFUrl();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download PDF report (${res.status})`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `CarbonVault_Platform_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}
