import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'wellness:app-config';

// Defaults merged from the bundle's TWEAK_DEFAULTS plus the new keys
// reserved by Phase 4 (density). Keep this as the single source of truth.
const DEFAULTS = {
  theme: 'brand',
  lang: 'en',
  density: 'comfortable',
  homeVariant: 'stack',
  checkinVariant: 'sliders',
  leaderboardVariant: 'podium',
};

const AppConfigContext = createContext(null);

export function AppConfigProvider({ children }) {
  const [cfg, setCfg] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    } catch { return DEFAULTS; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); }
    catch { /* quota or private mode — ignore */ }
  }, [cfg]);

  const value = {
    cfg,
    setCfg,
    patch: (p) => setCfg(c => ({ ...c, ...p })),
  };
  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfig must be used inside AppConfigProvider');
  return ctx;
}
