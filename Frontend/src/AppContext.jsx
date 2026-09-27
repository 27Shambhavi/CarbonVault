import { createContext, useContext, useState, useEffect } from 'react';
import { demoAccounts } from './data/mockData.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [page, setPage]           = useState('dashboard');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const login = (role) => {
    if (role === 'public') {
      setUser({ role: 'public', name: 'Public Visitor', org: 'Carbon Transparency Portal', email: 'guest@carbonvault.com' });
      setPage('dashboard');
      return;
    }
    const account = demoAccounts.find(a => a.role === role);
    if (!account) return;
    setUser(account);
    setPage('dashboard');
  };

  const logout = () => { setUser(null); setPage('dashboard'); };

  // Increment to trigger re-fetch in Dashboard / My Projects after project creation
  const triggerRefresh = () => setRefreshKey(k => k + 1);

  return (
    <AppContext.Provider value={{
      user, page, setPage, login, logout,
      notifOpen, setNotifOpen, profileOpen, setProfileOpen,
      sidebarOpen, setSidebarOpen, refreshKey, triggerRefresh,
      theme, setTheme, toggleTheme,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
