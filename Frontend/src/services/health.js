import { useState, useEffect } from 'react';
import { fetchReady } from './api.js';

// Build-time commit injected by vite.config.js
export const BUILD_COMMIT = typeof __APP_COMMIT__ !== 'undefined' && __APP_COMMIT__ !== 'HEAD'
  ? __APP_COMMIT__
  : 'unknown';
export const BUILD_COMMIT_FULL = typeof __APP_COMMIT_FULL__ !== 'undefined' && __APP_COMMIT_FULL__ !== 'HEAD'
  ? __APP_COMMIT_FULL__
  : 'unknown';

let _healthState = {
  status: 'Checking…', // 'Online' | 'Waking up the server… (up to 60 s)' | 'Degraded' | 'Offline' | 'Checking…'
  latency: null,
  lastCheckedAt: null,
  secondsAgo: 0,
  commit: BUILD_COMMIT,
  db: 'checking',
  scheduler: 'idle',
  razorpay: 'checking',
  error: null,
  wakingStartedAt: null,
};

const _subscribers = new Set();

function notifySubscribers() {
  _subscribers.forEach((fn) => {
    try { fn({ ..._healthState }); } catch (e) { console.warn('Health subscriber error:', e); }
  });
}

let _checkInProgress = false;
let _retryTimeoutId = null;

export async function probeBackendHealth(forced = false) {
  if (_checkInProgress && !forced) return _healthState;
  _checkInProgress = true;

  const startPing = performance.now();
  try {
    const res = await fetchReady();
    const elapsed = Math.round(performance.now() - startPing);
    const now = Date.now();

    if (res.data && res.data.status === 'ready') {
      _healthState = {
        status: 'Online',
        latency: elapsed,
        lastCheckedAt: now,
        secondsAgo: 0,
        commit: res.data.commit ? res.data.commit.slice(0, 7) : BUILD_COMMIT,
        db: res.data.database?.status || 'ok',
        scheduler: res.data.scheduler?.status || 'active',
        razorpay: res.data.razorpay || res.data.razorpay_status || 'ok',
        error: null,
        wakingStartedAt: null,
      };
      notifySubscribers();
      _checkInProgress = false;
      return _healthState;
    }

    if (res.data && res.data.status === 'unready') {
      _healthState = {
        status: 'Degraded',
        latency: elapsed,
        lastCheckedAt: now,
        secondsAgo: 0,
        commit: res.data.commit ? res.data.commit.slice(0, 7) : BUILD_COMMIT,
        db: res.data.database?.status || 'error',
        scheduler: 'idle',
        razorpay: res.data.razorpay || 'unknown',
        error: res.data.reason || 'Database degraded',
        wakingStartedAt: null,
      };
      notifySubscribers();
      _checkInProgress = false;
      return _healthState;
    }

    // Handled failure / timeout / 502 / HTML
    handleFailure(res.error || 'Server unreachable');
  } catch (err) {
    handleFailure(err.message || 'Network error');
  } finally {
    _checkInProgress = false;
  }

  return _healthState;
}

function handleFailure(errorMessage) {
  const now = Date.now();
  if (!_healthState.wakingStartedAt) {
    _healthState.wakingStartedAt = now;
  }

  const elapsedWaking = (now - _healthState.wakingStartedAt) / 1000;
  if (elapsedWaking < 65) {
    // Render free instance spins up within 30-60s
    _healthState.status = 'Waking up the server… (up to 60 s)';
    _healthState.db = 'waking';
    _healthState.error = errorMessage;
    _healthState.lastCheckedAt = now;
    _healthState.secondsAgo = 0;
    _healthState.latency = null;
    notifySubscribers();

    // Auto-retry with backoff while waking
    if (_retryTimeoutId) clearTimeout(_retryTimeoutId);
    _retryTimeoutId = setTimeout(() => {
      probeBackendHealth(true);
    }, 3500);
  } else {
    _healthState.status = 'Offline';
    _healthState.db = 'error';
    _healthState.error = errorMessage;
    _healthState.lastCheckedAt = now;
    _healthState.secondsAgo = 0;
    _healthState.latency = null;
    notifySubscribers();
  }
}

// Global ticker for "checked N s ago"
setInterval(() => {
  if (_healthState.lastCheckedAt) {
    const secs = Math.max(0, Math.floor((Date.now() - _healthState.lastCheckedAt) / 1000));
    if (secs !== _healthState.secondsAgo) {
      _healthState.secondsAgo = secs;
      notifySubscribers();
    }
  }
}, 1000);

// Background check on module load and every 30s
probeBackendHealth();
setInterval(() => {
  if (_healthState.status !== 'Waking up the server… (up to 60 s)') {
    probeBackendHealth();
  }
}, 30000);

/** Custom Hook for React components */
export function useBackendHealth() {
  const [state, setState] = useState(_healthState);

  useEffect(() => {
    const unsub = (updated) => setState(updated);
    _subscribers.add(unsub);
    setState({ ..._healthState });
    return () => {
      _subscribers.delete(unsub);
    };
  }, []);

  return {
    ...state,
    recheck: () => probeBackendHealth(true),
  };
}
