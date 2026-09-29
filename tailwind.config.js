/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        devanagari: ['"Yatra One"', '"Rozha One"', '"Tiro Devanagari Hindi"', 'serif'],
        hindiRetro: ['"Rozha One"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        chhath: {
          sindoor: '#ff3e1d',
          kesariya: '#ff7700',
          surya: '#f59e0b',
          ganga: '#0284c7',
          deep: '#d97706',
        }
      },
      animation: {
        'spin-slow': 'spin 12s linear infinite',
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      },
      dropShadow: {
        'retro': '0 4px 20px rgba(0, 0, 0, 0.65)',
        'glow': '0 0 25px rgba(245, 158, 11, 0.45)',
      }
    },
  },
  plugins: [],
};
