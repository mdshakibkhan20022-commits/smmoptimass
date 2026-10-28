/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: v('canvas'),
        surface: v('surface'),
        soft: v('soft'),
        line: v('line'),
        ink: v('ink'),
        muted: v('muted'),
        brand: {
          50: '#ecfdf4',
          100: '#d1fae4',
          200: '#a6f4cc',
          300: '#6ee7ae',
          400: '#34d38b',
          500: '#10b970',
          600: '#05965a',
          700: '#04784a',
          800: '#065f3c',
          900: '#064e33',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 26 21 / 0.04), 0 4px 16px rgb(15 26 21 / 0.04)',
        lift: '0 8px 30px rgb(5 150 90 / 0.18)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'scale-in': 'scale-in 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};
