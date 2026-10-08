import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { demoAccounts } from './data/mockData.js';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, setApiAdminContext } from './services/api.js';

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

  const refreshNotifications = useCallback(async () => {
    try {
      const role = user?.role;
      const email = user?.email;
      const res = await fetchNotifications({ role, email });
      if (Array.isArray(res.data)) {
        setNotifications(res.data);
        const unread = res.data.filter(n => !n.read).length;
        setUnreadNotifCount(unread);
      }
    } catch (err) {
      console.warn('Could not fetch notifications:', err);
    }
  }, [user]);

  const markNotifAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadNotifCount(c => Math.max(0, c - 1));
    try {
      await markNotificationRead(id);
    } catch (e) {
      console.warn('Failed to mark notification read:', e);
    }
  };

  const markAllNotifsAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadNotifCount(0);
    try {
      await markAllNotificationsRead({ role: user?.role, email: user?.email });
    } catch (e) {
      console.warn('Failed to mark all notifications read:', e);
    }
  };

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
    const account = demoAccounts.find(a => a.role === role && (!customAdminRole || a.admin_role === customAdminRole)) || demoAccounts.find(a => a.role === role);
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

  // Increment to trigger re-fetch in Dashboard / My Projects after project creation
  const triggerRefresh = () => setRefreshKey(k => k + 1);

  return (
    <AppContext.Provider value={{
      user, page, setPage, login, logout,
      notifOpen, setNotifOpen, profileOpen, setProfileOpen,
      sidebarOpen, setSidebarOpen, refreshKey, triggerRefresh,
      theme, setTheme, toggleTheme,
      notifications, unreadNotifCount, refreshNotifications,
      markNotifAsRead, markAllNotifsAsRead,
      switchAdminRole,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
