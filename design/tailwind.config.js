/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vinyl: {
          bg: '#0A0A0A',
          card: '#111111',
          border: '#222222',
          groove: '#333333',
        },
      },
      fontFamily: {
        display: ['Bebas Neue', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      maxWidth: {
        app: '600px',
      },
      animation: {
        'vinyl-spin': 'spin 8s linear infinite',
        'vinyl-fast': 'spin 2s linear infinite',
      },
      boxShadow: {
        'glow-orange': '0 0 30px rgba(249,115,22,0.2)',
      },
    },
  },
  plugins: [],
};
