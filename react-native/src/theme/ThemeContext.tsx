import React, { createContext, useContext, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, ColorScheme } from './colors';

interface ThemeContextType {
  colors: ColorScheme;
  isDark: boolean;
  colorScheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const colorScheme: 'light' | 'dark' =
    systemColorScheme === 'dark' ? 'dark' : 'light';
  const isDark = colorScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const value: ThemeContextType = {
    colors,
    isDark,
    colorScheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
