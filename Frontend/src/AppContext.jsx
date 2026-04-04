import { createContext, useContext, useState } from 'react';
import { demoAccounts } from './data/mockData.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [page, setPage]           = useState('dashboard');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const login = (role) => {
    const account = demoAccounts.find(a => a.role === role);
    if (!account) return;
    setUser(account);
    setPage('dashboard');
  };

  const logout = () => { setUser(null); setPage('dashboard'); };

  // Increment to trigger re-fetch in Dashboard / My Projects after project creation
  const triggerRefresh = () => setRefreshKey(k => k + 1);

  return (
    <AppContext.Provider value={{ user, page, setPage, login, logout, notifOpen, setNotifOpen, profileOpen, setProfileOpen, sidebarOpen, setSidebarOpen, refreshKey, triggerRefresh }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
