import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../services/api.js';

/**
 * useLiveStream
 * Connects to CarbonVault backend SSE stream via `/realtime/stream?ticket=...`
 * Features:
 * - 60s ticket acquisition via `POST /realtime/ticket`
 * - Standard browser `EventSource` connection
 * - Exponential backoff reconnection (1s -> 2s -> 4s -> 8s -> 16s)
 * - 10-second polling fallback if SSE cannot connect or drops repeatedly
 * - Last-Event-ID tracking for replaying missed events
 * - Status states: 'connected' | 'reconnecting' | 'offline'
 */
export function useLiveStream(user = null) {
  const [status, setStatus] = useState('reconnecting');
  const [lastEventAt, setLastEventAt] = useState(null);
  const [events, setEvents] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);

  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const backoffRef = useRef(1000);
  const lastEventIdRef = useRef(0);
  const listenersRef = useRef(new Map());
  const failCountRef = useRef(0);

  // Subscribe callback registry
  const subscribe = useCallback((eventType, callback) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType).add(callback);

    return () => {
      const set = listenersRef.current.get(eventType);
      if (set) {
        set.delete(callback);
        if (set.size === 0) listenersRef.current.delete(eventType);
      }
    };
  }, []);

  const dispatchEvent = useCallback((eventObj) => {
    setLastEventAt(new Date());
    setLastEvent(eventObj);
    setEvents((prev) => [eventObj, ...prev.slice(0, 49)]);

    if (eventObj.id && Number(eventObj.id) > lastEventIdRef.current) {
      lastEventIdRef.current = Number(eventObj.id);
    }

    // Notify registered listeners
    const listeners = listenersRef.current.get(eventObj.type);
    if (listeners) {
      listeners.forEach((cb) => {
        try {
          cb(eventObj);
        } catch (err) {
          console.warn(`Error in listener for ${eventObj.type}:`, err);
        }
      });
    }

    // Wildcard listeners
    const allListeners = listenersRef.current.get('*');
    if (allListeners) {
      allListeners.forEach((cb) => {
        try {
          cb(eventObj);
        } catch (err) {
          console.warn('Error in wildcard listener:', err);
        }
      });
    }
  }, []);

  // Polling fallback mechanism
  const startPollingFallback = useCallback(() => {
    if (pollIntervalRef.current) return;
    setStatus('reconnecting');

    const poll = async () => {
      try {
        const role = user?.role || 'public';
        const email = user?.email || '';
        const url = `${API_BASE}/realtime/events?since_id=${lastEventIdRef.current}&role=${encodeURIComponent(role)}&email=${encodeURIComponent(email)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setStatus('connected');
          if (Array.isArray(data.events) && data.events.length > 0) {
            data.events.forEach((ev) => dispatchEvent(ev));
          }
        } else {
          setStatus('offline');
        }
      } catch (e) {
        setStatus('offline');
      }
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 10000);
  }, [user, dispatchEvent]);

  const stopPollingFallback = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Main SSE connector
  const connectSSE = useCallback(async () => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      startPollingFallback();
      return;
    }

    // Clean up existing instance
    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch {}
      eventSourceRef.current = null;
    }

    try {
      setStatus('reconnecting');
      // Step 1: Obtain single-use 60-second ticket
      const ticketRes = await fetch(`${API_BASE}/realtime/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: user?.role || 'public',
          email: user?.email || null,
          user_id: user?.id ? String(user.id) : null,
        }),
      });

      if (!ticketRes.ok) {
        throw new Error(`Ticket request failed with ${ticketRes.status}`);
      }

      const { ticket } = await ticketRes.json();
      const lastIdParam = lastEventIdRef.current > 0 ? `&last_event_id=${lastEventIdRef.current}` : '';
      const streamUrl = `${API_BASE}/realtime/stream?ticket=${encodeURIComponent(ticket)}${lastIdParam}`;

      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus('connected');
        backoffRef.current = 1000;
        failCountRef.current = 0;
        stopPollingFallback();
      };

      // Heartbeat comment or custom event handling
      es.onmessage = (e) => {
        if (!e.data || e.data.trim() === 'heartbeat') {
          setLastEventAt(new Date());
          return;
        }
        try {
          const payload = JSON.parse(e.data);
          dispatchEvent({
            id: e.lastEventId || Date.now(),
            type: 'message',
            payload,
            timestamp: new Date().toISOString(),
          });
        } catch {
          setLastEventAt(new Date());
        }
      };

      // Register standard platform event listeners
      const eventTypes = [
        'project.created',
        'project.status_changed',
        'credits.minted',
        'pricing.updated',
        'payment.completed',
        'wallet.updated',
        'marketplace.buy_request',
        'marketplace.request_accepted',
        'notification.created',
        'anomaly.alert',
        'greenness.decline',
      ];

      eventTypes.forEach((type) => {
        es.addEventListener(type, (e) => {
          try {
            const payload = JSON.parse(e.data);
            dispatchEvent({
              id: e.lastEventId || Date.now(),
              type,
              payload,
              timestamp: new Date().toISOString(),
            });
          } catch (err) {
            console.warn(`Failed to parse SSE event payload for ${type}:`, err);
          }
        });
      });

      es.onerror = () => {
        setStatus('reconnecting');
        if (es.readyState === EventSource.CLOSED) {
          es.close();
          eventSourceRef.current = null;
          failCountRef.current += 1;

          if (failCountRef.current >= 3) {
            startPollingFallback();
          }

          // Exponential backoff
          const delay = Math.min(backoffRef.current, 16000);
          backoffRef.current = Math.min(backoffRef.current * 2, 16000);

          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            connectSSE();
          }, delay);
        }
      };
    } catch (err) {
      failCountRef.current += 1;
      setStatus(failCountRef.current >= 3 ? 'offline' : 'reconnecting');
      if (failCountRef.current >= 2) {
        startPollingFallback();
      }

      const delay = Math.min(backoffRef.current, 16000);
      backoffRef.current = Math.min(backoffRef.current * 2, 16000);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        connectSSE();
      }, delay);
    }
  }, [user, dispatchEvent, startPollingFallback, stopPollingFallback]);

  useEffect(() => {
    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch {}
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopPollingFallback();
    };
  }, [connectSSE, stopPollingFallback]);

  return {
    status,
    lastEventAt,
    events,
    lastEvent,
    subscribe,
  };
}
