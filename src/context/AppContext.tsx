import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Settings } from '@/lib/types';

type Currency = 'USD' | 'BDT';

type AppValue = {
  settings: Settings | null;
  reloadSettings: () => Promise<void>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  money: (usd: number, decimals?: number) => string;
};

const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );
  const [currency, setCurrencyState] = useState<Currency>(
    localStorage.getItem('currency') === 'BDT' ? 'BDT' : 'USD',
  );

  const reloadSettings = useCallback(async () => {
    const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
    if (error) console.error('settings load failed', error);
    if (data) setSettings(data as Settings);
  }, []);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('theme', next);
    setTheme(next);
  };

  const setCurrency = (c: Currency) => {
    localStorage.setItem('currency', c);
    setCurrencyState(c);
  };

  const money = (usd: number, decimals?: number) => {
    const value = Number(usd) || 0;
    if (currency === 'BDT') {
      const bdt = value * (settings?.usd_to_bdt ?? 125);
      return `৳${bdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: decimals ?? 2 })}`;
    }
    const d = decimals ?? (Math.abs(value) > 0 && Math.abs(value) < 1 ? 4 : 2);
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: d })}`;
  };

  return (
    <AppContext.Provider value={{ settings, reloadSettings, theme, toggleTheme, currency, setCurrency, money }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
