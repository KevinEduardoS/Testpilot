/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        aurora: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(6%, -8%) scale(1.15)' },
          '66%': { transform: 'translate(-6%, 6%) scale(0.95)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        blink: {
          '0%, 50%': { opacity: '1' },
          '50.01%, 100%': { opacity: '0' },
        },
        shine: {
          from: { transform: 'translateX(-120%) skewX(-20deg)' },
          to: { transform: 'translateX(220%) skewX(-20deg)' },
        },
        'pulse-ring': {
          from: { boxShadow: '0 0 0 0 rgb(52 211 153 / 0.45)' },
          to: { boxShadow: '0 0 0 14px rgb(52 211 153 / 0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'rise-in': 'rise-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both',
        aurora: 'aurora 18s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
        blink: 'blink 1s step-end infinite',
        shine: 'shine 2.8s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.2s ease-out 2',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
