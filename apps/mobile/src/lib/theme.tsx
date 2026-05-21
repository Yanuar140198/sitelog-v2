/**
 * Mobile theme system — light/dark/system with persistence.
 * Provides palette tokens consumed by all screens via useTheme().
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'sitelog-theme' });

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface Palette {
  bg: string;
  bgAlt: string;
  panel: string;
  ink: string;
  text: string;
  muted: string;
  brand: string;
  border: string;
}

const LIGHT: Palette = {
  bg: '#FAFAF7',
  bgAlt: '#F0F0EC',
  panel: '#FFFFFF',
  ink: '#0A0A0A',
  text: '#0A0A0A',
  muted: '#666666',
  brand: '#FF5500',
  border: '#0A0A0A',
};

const DARK: Palette = {
  bg: '#0A0A0A',
  bgAlt: '#1A1A1A',
  panel: '#171717',
  ink: '#FAFAF7',
  text: '#FAFAF7',
  muted: '#A0A0A0',
  brand: '#FF6A1A',
  border: '#FAFAF7',
};

const Ctx = createContext<{ mode: ThemeMode; setMode: (m: ThemeMode) => void; resolved: ResolvedTheme; palette: Palette }>({
  mode: 'system', setMode: () => {}, resolved: 'light', palette: LIGHT,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const sys = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = storage.getString('mode') as ThemeMode | undefined;
    return saved ?? 'system';
  });
  function setMode(m: ThemeMode) { setModeState(m); storage.set('mode', m); }
  const resolved: ResolvedTheme = mode === 'system' ? (sys === 'dark' ? 'dark' : 'light') : mode;
  const palette = resolved === 'dark' ? DARK : LIGHT;
  return <Ctx.Provider value={{ mode, setMode, resolved, palette }}>{children}</Ctx.Provider>;
}

export function useTheme() { return useContext(Ctx); }
