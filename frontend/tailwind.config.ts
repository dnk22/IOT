import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0b1326',
        'surface-lowest': '#060e20',
        'surface-low': '#131b2e',
        'surface-container': '#171f33',
        'surface-high': '#222a3d',
        'surface-highest': '#2d3449',
        'on-surface': '#dae2fd',
        'on-surface-variant': '#bcc9cd',
        outline: '#869397',
        'outline-variant': '#3d494c',
        primary: '#4cd7f6',
        secondary: '#4edea3',
        tertiary: '#ffb95f',
        error: '#ffb4ab',
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        panel: '0.5rem',
      },
      boxShadow: {
        panel: '0 18px 45px -32px rgba(0, 0, 0, 0.9)',
        cyan: '0 0 24px -8px rgba(76, 215, 246, 0.2)',
        emerald: '0 0 18px -7px rgba(78, 222, 163, 0.34)',
      },
    },
  },
  plugins: [],
} satisfies Config;
