/**
 * ThemeContext — Atlased
 *
 * Manages light/dark theme state with localStorage persistence.
 * Sets [data-theme="dark"] on the root HTML element.
 *
 * Usage:
 *   const { theme, toggleTheme } = useTheme();
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';
export type ColorScheme = 'atlas' | 'sunset' | 'forest' | 'ocean' | 'mono';

export interface ColorSchemeOption {
  id: ColorScheme;
  label: string;
  description: string;
}

export const COLOR_SCHEME_OPTIONS: ColorSchemeOption[] = [
  { id: 'atlas', label: 'Atlas', description: 'Balanced indigo accents' },
  { id: 'sunset', label: 'Sunset', description: 'Warm coral and amber tones' },
  { id: 'forest', label: 'Forest', description: 'Green-focused natural palette' },
  { id: 'ocean', label: 'Ocean', description: 'Teal and cyan coastal palette' },
  { id: 'mono', label: 'Mono', description: 'Neutral grayscale minimal look' },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within <ThemeProvider>');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('light');
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>('atlas');

  // Initialize theme + color scheme from localStorage (or system preference)
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    const savedScheme = localStorage.getItem('colorScheme') as ColorScheme | null;
    const validScheme: ColorScheme =
      savedScheme && COLOR_SCHEME_OPTIONS.some((option) => option.id === savedScheme)
        ? savedScheme
        : 'atlas';

    setColorSchemeState(validScheme);
    applyColorScheme(validScheme);

    if (savedTheme) {
      setThemeState(savedTheme);
      applyTheme(savedTheme);
    } else {
      // Detect system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initialTheme: Theme = prefersDark ? 'dark' : 'light';
      setThemeState(initialTheme);
      applyTheme(initialTheme);
    }
  }, []);

  const setTheme = (nextTheme: Theme) => {
    setThemeState((currentTheme) => {
      if (currentTheme === nextTheme) {
        return currentTheme;
      }
      applyTheme(nextTheme);
      localStorage.setItem('theme', nextTheme);
      return nextTheme;
    });
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      applyTheme(next);
      localStorage.setItem('theme', next);
      return next;
    });
  };

  const setColorScheme = (scheme: ColorScheme) => {
    setColorSchemeState((currentScheme) => {
      if (currentScheme === scheme) {
        return currentScheme;
      }
      applyColorScheme(scheme);
      localStorage.setItem('colorScheme', scheme);
      return scheme;
    });
  };

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', newTheme);
  };

  const applyColorScheme = (scheme: ColorScheme) => {
    const root = document.documentElement;
    root.setAttribute('data-scheme', scheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        colorScheme,
        setColorScheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
