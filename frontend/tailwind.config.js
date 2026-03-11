/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0f0d0b',
        surface: '#1a1614',
        border: '#2d2824',
        muted: '#9a9188',
        accent: '#c4a574',
        'accent-dim': '#8b7355',
        success: '#6b9080',
        missing: '#8b7355',
        error: '#e8a0a0',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '12px',
      },
    },
  },
  plugins: [],
};
