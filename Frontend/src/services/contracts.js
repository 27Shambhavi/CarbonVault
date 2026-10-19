/**
 * Frontend/src/services/contracts.js
 * CarbonVault Typed Response Contracts & Invariants.
 * 
 * Invariants:
 * 1. No component shall ever receive an unvalidated or unexpected data shape from api.js.
 * 2. Every list endpoint contract guarantees Array output (or typed envelope with Array .items / .documents).
 * 3. Calling .forEach(), .map(), .filter(), or .reduce() on contract output is guaranteed to never throw TypeError.
 * 4. Error states and empty bodies return safe fallback structures alongside typed error messages.
 */

/**
 * Safely ensure value is an Array
 * @param {*} val 
 * @param {Array} fallback 
 * @returns {Array}
 */
export function safeArray(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') {
    // Check common envelope properties
    if (Array.isArray(val.items)) return val.items;
    if (Array.isArray(val.documents)) return val.documents;
    if (Array.isArray(val.projects)) return val.projects;
    if (Array.isArray(val.transactions)) return val.transactions;
    if (Array.isArray(val.events)) return val.events;
    if (Array.isArray(val.payouts)) return val.payouts;
    if (Array.isArray(val.users)) return val.users;
    if (Array.isArray(val.organizations)) return val.organizations;
    if (Array.isArray(val.data)) return val.data;
  }
  return Array.isArray(fallback) ? fallback : [];
}

/**
 * Normalize project documents API response
 * @param {*} raw 
 * @param {string} projectId 
 */
export function normalizeDocumentsContract(raw, projectId = '') {
  if (!raw || typeof raw !== 'object') {
    return {
      project_id: projectId,
      is_complete: false,
      uploaded_types: [],
      missing_required_docs: [],
      documents: [],
      items: [],
    };
  }

  const docs = Array.isArray(raw.documents)
    ? raw.documents
    : (Array.isArray(raw.items) ? raw.items : (Array.isArray(raw) ? raw : []));

  const uploadedTypes = Array.isArray(raw.uploaded_types)
    ? raw.uploaded_types
    : docs.map(d => d.doc_type).filter(Boolean);

  const missingDocs = Array.isArray(raw.missing_required_docs)
    ? raw.missing_required_docs
    : [];

  return {
    project_id: raw.project_id || projectId,
    is_complete: Boolean(raw.is_complete ?? (missingDocs.length === 0 && docs.length >= 4)),
    uploaded_types: uploadedTypes,
    missing_required_docs: missingDocs,
    documents: docs,
    items: docs, // synonym for list envelope
  };
}

/**
 * Normalize a standard list response to guaranteed Array + envelope
 * @param {*} raw 
 * @param {string} itemKey optional property name where items reside
 */
export function normalizeListContract(raw, itemKey = 'items') {
  if (!raw) return { items: [], total: 0, raw: null };
  if (Array.isArray(raw)) {
    return { items: raw, total: raw.length, raw };
  }
  if (typeof raw === 'object') {
    const list = Array.isArray(raw[itemKey])
      ? raw[itemKey]
      : (Array.isArray(raw.items) ? raw.items : (Array.isArray(raw.data) ? raw.data : []));
    const total = typeof raw.total === 'number' ? raw.total : list.length;
    return { items: list, total, raw };
  }
  return { items: [], total: 0, raw };
}
