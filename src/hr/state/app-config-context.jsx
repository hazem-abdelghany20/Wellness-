import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'wellness:hr-app-config';

// Mirrors TWEAK_DEFAULTS in src/hr/App.jsx.
const DEFAULTS = {
  theme:      'dark',
  lang:       'en',
  density:    'comfortable',
  layout:     'default',
  chartStyle: 'line',
};

const HRAppConfigContext = createContext(null);

export function HRAppConfigProvider({ children }) {
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
  return <HRAppConfigContext.Provider value={value}>{children}</HRAppConfigContext.Provider>;
}

export function useHRAppConfig() {
  const ctx = useContext(HRAppConfigContext);
  if (!ctx) throw new Error('useHRAppConfig must be used inside HRAppConfigProvider');
  return ctx;
}
