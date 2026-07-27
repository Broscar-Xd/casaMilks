/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        // Paleta extraída del logo Casa Milks
        milk: {
          50: '#fdf9f2',
          100: '#faf1e3',
          200: '#f3e0c3',
          300: '#eacb9e',
          400: '#deb078',
          500: '#d1965a',
        },
        cocoa: {
          50: '#f7f1eb',
          100: '#eadfd2',
          200: '#d5bfa6',
          300: '#bd9976',
          400: '#a5764e',
          500: '#8b5a2b',
          600: '#794c25',
          700: '#633d1f',
          800: '#4b2e18',
          900: '#362010',
          950: '#211309',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-5px)' },
          '40%, 80%': { transform: 'translateX(5px)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
      animation: {
        shake: 'shake 0.4s ease-in-out',
        float: 'float 5s ease-in-out infinite',
      },
      boxShadow: {
        'soft': '0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card': '0 1px 4px 0 rgba(0,0,0,0.04), 0 2px 8px -1px rgba(0,0,0,0.06)',
        'elevated': '0 4px 16px -2px rgba(0,0,0,0.08), 0 2px 8px -1px rgba(0,0,0,0.04)',
        'modal': '0 20px 60px -8px rgba(0,0,0,0.15), 0 8px 24px -4px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
    },
  },
  plugins: [],
};
