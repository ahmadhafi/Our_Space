import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiPut } from './useApi';

const ThemeContext = createContext(null);

const PRESETS = {
  sakura: { accent: '#f9a8d4', bg: '#fff0f5', label: 'Sakura Pink', dark: false },
  lavender: { accent: '#c084fc', bg: '#f5f0ff', label: 'Lavender Dream', dark: false },
  mint: { accent: '#34d399', bg: '#f0fdf8', label: 'Mint Fresh', dark: false },
  twilight: { accent: '#818cf8', bg: '#1e1b4b', label: 'Twilight', dark: true }
};

function hexToLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function lightenColor(hex, amount = 0.85) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r + (255 - r) * amount);
  const ng = Math.round(g + (255 - g) * amount);
  const nb = Math.round(b + (255 - b) * amount);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function darkenColor(hex, amount = 0.15) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.round(r * (1 - amount));
  const ng = Math.round(g * (1 - amount));
  const nb = Math.round(b * (1 - amount));
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function applyThemeVars(accent, bg) {
  const root = document.documentElement;
  root.style.setProperty('--color-accent', accent);
  root.style.setProperty('--color-accent-light', lightenColor(accent, 0.8));
  root.style.setProperty('--color-bg', bg);
  root.style.setProperty('--color-bg-dark', darkenColor(bg, 0.05));

  // Determine if background is dark
  const isDark = hexToLight(bg) < 128;
  root.setAttribute('data-dark-theme', isDark ? 'true' : 'false');
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState({
    preset: 'sakura',
    accent: '#f9a8d4',
    bg: '#fff0f5'
  });

  const applyTheme = useCallback((preset, accent, bg) => {
    setThemeState({ preset, accent, bg });
    applyThemeVars(accent, bg);
  }, []);

  const initTheme = useCallback((user) => {
    if (!user) return;
    const preset = user.theme_preset || 'sakura';
    const accent = user.accent_color || '#f9a8d4';
    const bg = user.bg_color || '#fff0f5';
    applyTheme(preset, accent, bg);
  }, [applyTheme]);

  const setTheme = useCallback(async (preset, accent, bg) => {
    applyTheme(preset, accent, bg);
    try {
      await apiPut('/api/profile/theme', {
        theme_preset: preset,
        accent_color: accent,
        bg_color: bg
      });
    } catch (err) {
      console.error('Failed to save theme:', err);
    }
  }, [applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, initTheme, PRESETS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
