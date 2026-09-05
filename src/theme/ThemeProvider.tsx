import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyTheme,
  persistThemePreference,
  readThemePreference,
  resolveTheme,
  THEME_EVENT,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const defaultValue: ThemeContextValue = {
  preference: "system",
  resolved: "light",
  setPreference: persistThemePreference,
};

const ThemeContext = createContext<ThemeContextValue>(defaultValue);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readThemePreference());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(readThemePreference()));

  useEffect(() => {
    const sync = () => {
      const next = readThemePreference();
      setPreferenceState(next);
      setResolved(applyTheme(next));
    };
    sync();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    window.addEventListener(THEME_EVENT, sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener(THEME_EVENT, sync);
    };
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      setPreference: (next) => {
        setPreferenceState(next);
        setResolved(persistThemePreference(next));
      },
    }),
    [preference, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
