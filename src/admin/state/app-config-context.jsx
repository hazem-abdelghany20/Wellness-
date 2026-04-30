import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'wellness:admin-app-config';

const DEFAULTS = {
  themeKey:   'dark',
  lang:       'en',
  density:    'comfortable',
  chartStyle: 'area',
  layout:     'default',
};

const AdminAppConfigContext = createContext(null);

export function AdminAppConfigProvider({ children }) {
  const [cfg, setCfg] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch { return DEFAULTS; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
  }, [cfg]);

  const value = { cfg, setCfg, patch: (p) => setCfg(c => ({ ...c, ...p })) };
  return <AdminAppConfigContext.Provider value={value}>{children}</AdminAppConfigContext.Provider>;
}

export function useAdminAppConfig() {
  const ctx = useContext(AdminAppConfigContext);
  if (!ctx) throw new Error('useAdminAppConfig must be used inside AdminAppConfigProvider');
  return ctx;
}
