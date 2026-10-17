// ── CarbonVault API Service Layer ────────────────────────────────────────────
// Real Data Architecture: talks directly to FastAPI backend, no invented mock fallbacks.
// Uses Vite proxy (/api → http://127.0.0.1:8000) or VITE_API_BASE_URL.

const RAW_BASE = import.meta.env.VITE_API_BASE_URL;
export const API_BASE = RAW_BASE
  ? RAW_BASE.replace(/\/$/, '')
  : (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? '/api'
      : 'https://carbonvault-api.onrender.com');

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
    try {
      localStorage.setItem('carbonvault_token', token);
      localStorage.setItem('carbonvault_jwt', token);
    } catch {}
  } else {
    try {
      localStorage.removeItem('carbonvault_token');
      localStorage.removeItem('carbonvault_jwt');
    } catch {}
  }
}

export function getAuthToken() {
  if (!_authToken) {
    try {
      _authToken = localStorage.getItem('carbonvault_token') || localStorage.getItem('carbonvault_jwt');
    } catch {}
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
  const timeoutLimit = options.timeout || 15000;
  try {
    // Enforce timeout (default 15s, customizable per request)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutLimit);

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
      return { data: null, error: 'The server is currently waking up. Please wait a moment and retry.' };
    }

    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    if (res.status === 401) {
      // Central 401 handler: sign out cleanly, notify AppContext, never render with missing user
      setAuthToken(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('carbonvault:auth-expired'));
      }
      return { data: null, error: (data && data.detail) || 'Session expired. Please sign in again.' };
    }

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
    const msg = err.name === 'AbortError'
      ? `Request timed out (${Math.round(timeoutLimit / 1000)}s). Server may be starting or offline.`
      : (err.message || 'Network error');
    return { data: null, error: msg };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HEALTH & AUTH APIs
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchHealth() {
  return request(`${API_BASE}/health`, { timeout: 10000 });
}

export async function fetchReady() {
  return request(`${API_BASE}/ready`, { timeout: 10000 });
}

export async function loginUser(email, password, timeoutMs = 15000) {
  return request(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    timeout: timeoutMs,
  }, 0);
}

export async function registerUser(registrationData, timeoutMs = 15000) {
  return request(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registrationData),
    timeout: timeoutMs,
  }, 0);
}

export async function fetchCurrentUserProfile() {
  return request(`${API_BASE}/auth/me`, { timeout: 8000 }, 0);
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

/** Real MODIS NDVI observations (ORNL DAAC Web Service) */
export async function fetchProjectNdvi(projectId) {
  return request(`${API_BASE}/projects/${projectId}/ndvi`);
}

/** Real NASA POWER agroclimatology observations (Daily T2M, PRECTOTCORR, RH2M) */
export async function fetchProjectClimate(projectId, days = 90) {
  return request(`${API_BASE}/projects/${projectId}/climate?days=${days}`);
}

/** Manually trigger satellite and climate backfill */
export async function syncProjectSatellite(projectId) {
  return request(`${API_BASE}/projects/${projectId}/sync-satellite`, { method: 'POST' });
}

/** Phase 4: Fetch consolidated ML assessment (M1 IsolationForest Anomaly, M2 Robust NDVI Monitor, M5 Photo Screening) */
export async function fetchProjectMlAssessment(projectId) {
  return request(`${API_BASE}/projects/${projectId}/ml-assessment`);
}

/** Phase 5: Fetch Grounded AI project narrative with post-check verification */
export async function fetchProjectAiSummary(projectId, audience = 'admin') {
  return request(`${API_BASE}/projects/${projectId}/ai-summary?audience=${audience}`);
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

/** Pre-flight check before project submission (dry run) */
export async function precheckProject(data) {
  return request(`${API_BASE}/fraud/precheck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

/** Fetch full 5-check screening report for a project */
export async function fetchScreeningReport(projectId) {
  return request(`${API_BASE}/fraud/projects/${projectId}/report`);
}

/** Re-run 5-check screening pipeline with real-time SSE progress */
export async function rerunProjectScreening(projectId) {
  return request(`${API_BASE}/fraud/projects/${projectId}/rerun`, {
    method: 'POST',
  });
}

/** Submit explanatory note from NGO for flagged checks */
export async function submitProjectExplanation(projectId, explanation, userName = 'Project Lead') {
  return request(`${API_BASE}/fraud/projects/${projectId}/explanation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ explanation, user_name: userName }),
  });
}

/** Submit verifier feedback on check utility */
export async function submitCheckFeedback(checkId, useful, comments = '') {
  return request(`${API_BASE}/fraud/checks/${checkId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ useful, comments }),
  });
}

/** Upload additional field evidence photo and re-trigger screening */
export async function uploadProjectEvidence(projectId, file, notes = '', userName = 'Project Lead') {
  const formData = new FormData();
  formData.append('file', file);
  if (notes) formData.append('notes', notes);
  formData.append('user_name', userName);
  return request(`${API_BASE}/projects/${projectId}/evidence`, {
    method: 'POST',
    body: formData,
  });
}

/** Update project metadata (area, trees, polygon) and re-trigger screening */
export async function updateProjectMetadata(projectId, data) {
  return request(`${API_BASE}/projects/${projectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
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

export async function fetchPaymentQuote(projectId, quantity, corporateName = '') {
  return request(`${API_BASE}/payment/quote?project_id=${encodeURIComponent(projectId)}&quantity=${encodeURIComponent(quantity)}&corporate_name=${encodeURIComponent(corporateName || '')}`);
}

export async function createOrder(amountINR, currency = 'INR', projectId = null, corporateName = null, quoteId = null) {
  return request(`${API_BASE}/payment/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: amountINR,
      currency,
      project_id: projectId,
      corporate_name: corporateName,
      quote_id: quoteId,
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
  return request(`${API_BASE}/esg/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      corporate_name: corporateName,
      project_id: projectId,
    }),
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// ZERO-HARDCODING CONFIG & GRS APIs
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchPublicConfig() {
  return request(`${API_BASE}/config/public`);
}

export async function fetchPlantationTypes() {
  return request(`${API_BASE}/config/plantation-types`);
}

export async function fetchLiveFxRate() {
  return request(`${API_BASE}/config/fx-rate`);
}

export async function fetchCorporateGrsScore(companyName) {
  return request(`${API_BASE}/grs/score?company_name=${encodeURIComponent(companyName || 'Corporate Buyer')}`);
}

export async function fetchGrsLeaderboard() {
  return request(`${API_BASE}/grs/leaderboard`);
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
// CREDIT INTEGRITY & RETIREMENT REGISTRY APIs (PHASE 5)
// ══════════════════════════════════════════════════════════════════════════════

export async function fetchCreditBatches(projectId) {
  const url = projectId ? `${API_BASE}/credits/batches?project_id=${encodeURIComponent(projectId)}` : `${API_BASE}/credits/batches`;
  return request(url);
}

export async function fetchPublicRetirements(params = {}) {
  const q = new URLSearchParams(params).toString();
  return request(`${API_BASE}/registry/retirements${q ? '?' + q : ''}`);
}

export async function fetchRetirementCertificate(certId) {
  return request(`${API_BASE}/registry/retirements/${encodeURIComponent(certId)}`);
}

export async function executeRetirement(payload) {
  return request(`${API_BASE}/credits/retire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function fetchReconciliationStatus() {
  return request(`${API_BASE}/reconciliation/status`);
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

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 6 & 7: ONBOARDING, KYC, DOCUMENTS, VERIFIER, REFUNDS, PAYOUTS
// ══════════════════════════════════════════════════════════════════════════════

// 1. Organisation Profile & KYC
export async function submitOrgProfile(data) {
  return request(`${API_BASE}/onboarding/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function fetchOrgProfile() {
  return request(`${API_BASE}/onboarding/profile/me`);
}

export async function fetchPendingKycProfiles() {
  return request(`${API_BASE}/onboarding/kyc/pending`);
}

export async function reviewKycProfile(profileId, decision, notes = '') {
  return request(`${API_BASE}/onboarding/kyc/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile_id: profileId,
      decision,
      notes,
    }),
  });
}

// 2. Project Documents (4 Required Documents Gate)
export async function uploadProjectDocument(projectId, file, docType, title = '') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);
  if (title) formData.append('title', title);
  return request(`${API_BASE}/projects/${encodeURIComponent(projectId)}/documents`, {
    method: 'POST',
    body: formData,
  });
}

export async function fetchProjectDocuments(projectId) {
  return request(`${API_BASE}/projects/${encodeURIComponent(projectId)}/documents`);
}

export async function fetchSubmissionReadiness(projectId) {
  return request(`${API_BASE}/projects/${encodeURIComponent(projectId)}/submission-readiness`);
}

// 3. Verifier Gates & Dashboard
export async function assignVerifier(projectId, verifierEmail, notes = '') {
  return request(`${API_BASE}/projects/${encodeURIComponent(projectId)}/verifier/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verifier_email: verifierEmail, notes }),
  });
}

export async function submitVerifierSignoff(projectId, decision, comments = '', reportUrl = '') {
  return request(`${API_BASE}/projects/${encodeURIComponent(projectId)}/verifier/signoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, comments, report_url: reportUrl }),
  });
}

export async function fetchVerifierStatus(projectId) {
  return request(`${API_BASE}/projects/${encodeURIComponent(projectId)}/verifier/status`);
}

// 4. ML Feedback
export async function submitMLFeedback(projectId, flagId, useful, notes = '') {
  return request(`${API_BASE}/projects/${encodeURIComponent(projectId)}/ml-flags/${encodeURIComponent(flagId)}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ useful, notes }),
  });
}

// 5. Account Lifecycle & Data Export
export async function exportUserData() {
  return request(`${API_BASE}/users/me/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function requestAccountDeletion(reason = '') {
  return request(`${API_BASE}/users/me/delete-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

export async function toggleUserStatus(userId, status) {
  return request(`${API_BASE}/users/${encodeURIComponent(userId)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

// 6. Refunds & Payouts Ledger
export async function processPaymentRefund(transactionId, reason = '') {
  return request(`${API_BASE}/payments/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction_id: transactionId, reason }),
  });
}

export async function fetchPayoutsLedger(ngoId = null) {
  const qs = ngoId ? `?ngo_id=${encodeURIComponent(ngoId)}` : '';
  return request(`${API_BASE}/payments/payouts${qs}`);
}

export async function createPayout(ngoId, amountINR, bankLast4 = '9876', ifsc = 'HDFC0001234', reference = '') {
  return request(`${API_BASE}/payments/payouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ngo_id: ngoId,
      amount_inr: amountINR,
      bank_account_last4: bankLast4,
      ifsc_code: ifsc,
      reference_note: reference,
    }),
  });
}

export function getPayoutsExportUrl() {
  return `${API_BASE}/payments/payouts/export-csv`;
}
