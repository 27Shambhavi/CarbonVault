import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, setApiAdminContext } from './services/api.js';
import { useLiveStream } from './hooks/useLiveStream.js';
import { LiveToastContainer } from './components/LiveToast.jsx';

export const demoAccounts = [
  { id: 1, name: 'Alex Mercer', email: 'admin@carbonvault.com', role: 'admin', admin_role: 'super_admin', org: 'Platform HQ' },
  { id: 2, name: 'Sarah Jenkins', email: 'approver@carbonvault.com', role: 'admin', admin_role: 'approver', org: 'CarbonVault Auditing' },
  { id: 3, name: 'EcoGuard Brazil', email: 'contact@ecoguard.org', role: 'ngo', org: 'EcoGuard Brazil' },
  { id: 4, name: 'Microsoft Sustainability', email: 'carbon@microsoft.com', role: 'corporate', org: 'Microsoft Sustainability' },
  { id: 5, name: 'Public Auditor', email: 'guest@carbonvault.com', role: 'public', org: 'Carbon Transparency Portal' },
];

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [page, setPage]           = useState('dashboard');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Dynamic notifications state
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Live Toast notifications
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev.slice(-3), { id, ...toast }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Theme: default is 'dark', persisted via localStorage
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem('carbonvault_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const setTheme = (nextTheme) => {
    const valid = nextTheme === 'light' ? 'light' : 'dark';
    setThemeState(valid);
    try {
      localStorage.setItem('carbonvault_theme', valid);
    } catch (e) {
      console.warn('Could not save theme:', e);
    }
    document.documentElement.setAttribute('data-theme', valid);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Connect Real-Time SSE Stream Hook
  const liveStream = useLiveStream(user);

  const refreshNotifications = useCallback(async () => {
    try {
      const role = user?.role;
      const email = user?.email;
      const res = await fetchNotifications({ role, email });
      if (Array.isArray(res.data)) {
        setNotifications(res.data);
        const unread = res.data.filter((n) => !n.read).length;
        setUnreadNotifCount(unread);
      }
    } catch (err) {
      console.warn('Could not fetch notifications:', err);
    }
  }, [user]);

  const markNotifAsRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadNotifCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(id);
    } catch (e) {
      console.warn('Failed to mark notification read:', e);
    }
  };

  const markAllNotifsAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadNotifCount(0);
    try {
      await markAllNotificationsRead({ role: user?.role, email: user?.email });
    } catch (e) {
      console.warn('Failed to mark all notifications read:', e);
    }
  };

  // Increment to trigger re-fetch in Dashboard / My Projects / Marketplace
  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // React to live stream events in real time
  useEffect(() => {
    if (!liveStream.lastEvent) return;
    const ev = liveStream.lastEvent;
    const payload = ev.payload || {};

    // Trigger instant re-fetch on data updates
    if (
      [
        'project.created',
        'project.status_changed',
        'credits.minted',
        'pricing.updated',
        'payment.completed',
        'marketplace.buy_request',
        'marketplace.request_accepted',
        'notification.created',
      ].includes(ev.type)
    ) {
      triggerRefresh();
      refreshNotifications();
    }

    // Emit live toast
    if (ev.type === 'project.status_changed') {
      addToast({
        type: ev.type,
        title: `Project Status: ${payload.status ? String(payload.status).toUpperCase() : 'Updated'}`,
        message: `Project ${payload.project_id || payload.name || ''} is now ${payload.status}.`,
      });
    } else if (ev.type === 'credits.minted') {
      addToast({
        type: ev.type,
        title: 'Credits Minted',
        message: `${Number(payload.credits || 0).toLocaleString()} tCO₂e issued for ${payload.project_id || 'project'}.`,
      });
    } else if (ev.type === 'pricing.updated') {
      addToast({
        type: ev.type,
        title: 'Live Price Updated',
        message: `Carbon price updated to $${Number(payload.effective_usd || payload.final_price || 0).toFixed(2)}/t.`,
      });
    } else if (ev.type === 'marketplace.buy_request') {
      addToast({
        type: ev.type,
        title: 'New Buy Request',
        message: `${payload.corporate_name} offered $${Number(payload.offered_price || 0).toFixed(2)}/t.`,
      });
    } else if (ev.type === 'payment.completed') {
      addToast({
        type: ev.type,
        title: 'Payment Completed',
        message: `${payload.corporate_name} purchased ${Number(payload.quantity || 0).toLocaleString()} tonnes.`,
      });
    }
  }, [liveStream.lastEvent, triggerRefresh, refreshNotifications, addToast]);

  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 15000);
    return () => clearInterval(interval);
  }, [refreshNotifications, refreshKey]);

  const switchAdminRole = (newAdminRole) => {
    if (user && user.role === 'admin') {
      const isApprover = newAdminRole === 'approver';
      const updatedUser = {
        ...user,
        admin_role: newAdminRole,
        name: isApprover ? 'Sarah Jenkins' : 'Alex Mercer',
        email: isApprover ? 'approver@carbonvault.com' : 'admin@carbonvault.com',
      };
      setUser(updatedUser);
      setApiAdminContext(newAdminRole, updatedUser.email);
    }
  };

  const login = (role, customAdminRole) => {
    if (role === 'public') {
      setUser({ role: 'public', name: 'Public Visitor', org: 'Carbon Transparency Portal', email: 'guest@carbonvault.com' });
      setApiAdminContext('', 'guest@carbonvault.com');
      setPage('dashboard');
      return;
    }
    const account =
      demoAccounts.find((a) => a.role === role && (!customAdminRole || a.admin_role === customAdminRole)) ||
      demoAccounts.find((a) => a.role === role);
    if (!account) return;
    setUser(account);
    if (account.role === 'admin') {
      setApiAdminContext(account.admin_role || 'super_admin', account.email);
    } else {
      setApiAdminContext('', account.email);
    }
    setPage('dashboard');
  };

  const logout = () => {
    setUser(null);
    setApiAdminContext('', '');
    setPage('dashboard');
  };

  return (
    <AppContext.Provider
      value={{
        user,
        page,
        setPage,
        login,
        logout,
        notifOpen,
        setNotifOpen,
        profileOpen,
        setProfileOpen,
        sidebarOpen,
        setSidebarOpen,
        refreshKey,
        triggerRefresh,
        theme,
        setTheme,
        toggleTheme,
        notifications,
        unreadNotifCount,
        refreshNotifications,
        markNotifAsRead,
        markAllNotifsAsRead,
        switchAdminRole,
        // Live Real-Time Spine exports
        liveStatus: liveStream.status,
        lastEventAt: liveStream.lastEventAt,
        lastError: liveStream.lastError,
        liveEvents: liveStream.events,
        subscribeToEvent: liveStream.subscribe,
        addToast,
        toasts,
        dismissToast,
      }}
    >
      {children}
      <LiveToastContainer toasts={toasts} onDismiss={dismissToast} />
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
