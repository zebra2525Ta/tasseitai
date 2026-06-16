'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({
  darkMode: true,
  setDarkMode: (value: boolean) => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      // ⭕ html要素に「dark」クラスをつけ、ライト用の属性を消す
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      // ⭕ html要素から「dark」クラスを消し、ライト用の属性をつける
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }
  }, [darkMode]);

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);