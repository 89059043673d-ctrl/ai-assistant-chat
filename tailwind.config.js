import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0a0a0a',
        panel: '#111112',
        panelAlt: '#18181b',
        border: '#27272a',
        text: '#e5e7eb',
        subtext: '#9ca3af',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,.2), 0 8px 24px rgba(0,0,0,.25)',
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.97)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
      },
      animation: {
        pop: 'pop .15s ease-out',
        fadeIn: 'fadeIn .2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
