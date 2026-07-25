import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [zoomLevel, setZoomLevel] = useState(() => {
    try {
      const saved = localStorage.getItem('target-settings-zoom');
      return saved ? parseFloat(saved) : 1;
    } catch {
      return 1;
    }
  });

  const [maxColumns, setMaxColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('target-settings-columns');
      return saved ? parseInt(saved, 10) : 4;
    } catch {
      return 4; // Default to 4 columns on large screens
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('target-settings-zoom', zoomLevel.toString());
      // Appliquer le zoom globalement
      document.documentElement.style.zoom = zoomLevel;
      // Corriger la hauteur pour compenser le zoom sur les unités vh
      document.documentElement.style.setProperty('--app-height', `${100 / zoomLevel}vh`);
    } catch (e) {
      console.error('Failed to save zoom setting:', e);
    }
  }, [zoomLevel]);

  useEffect(() => {
    try {
      localStorage.setItem('target-settings-columns', maxColumns.toString());
    } catch (e) {
      console.error('Failed to save columns setting:', e);
    }
  }, [maxColumns]);

  return (
    <SettingsContext.Provider value={{ zoomLevel, setZoomLevel, maxColumns, setMaxColumns }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
