/**
 * Frontend/src/utils/formatters.js
 * Centralized formatting helpers for CarbonVault.
 * Invariant: No hand-built percentage or currency strings that can lead to bugs like "100.0%%" or broken currency glyphs.
 */

/**
 * Format currency amount cleanly
 * @param {number|string} amount 
 * @param {string} currency 'USD' | 'INR'
 * @param {number} decimals 
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'USD', decimals = 2) {
  if (amount == null || amount === '') return currency === 'INR' ? '₹0.00' : '$0.00';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return currency === 'INR' ? '₹0.00' : '$0.00';

  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format percentage safely without double %% defects
 * @param {number|string} val 
 * @param {number} decimals 
 * @returns {string}
 */
export function formatPercent(val, decimals = 1) {
  if (val == null || val === '') return '0.0%';
  let str = String(val).trim();
  // Strip any existing percentage signs
  str = str.replace(/%+$/, '');
  const num = parseFloat(str);
  if (isNaN(num)) return '0.0%';
  return `${num.toFixed(decimals)}%`;
}

/**
 * Format integer/float numbers with comma grouping
 * @param {number|string} val 
 * @param {number} decimals 
 * @returns {string}
 */
export function formatNumber(val, decimals = 0) {
  if (val == null || val === '') return '0';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}
