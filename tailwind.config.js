/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain: '#0c0e14',
        bgSidebar: '#121620',
        bgCard: 'rgba(23, 28, 41, 0.7)',
        bgCardHover: 'rgba(33, 40, 58, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        primary: '#6366f1',
        primaryGlow: '#818cf8',
        accentCyan: '#06b6d4',
        accentEmerald: '#10b981',
        textMain: '#f3f4f6',
        textMuted: '#9ca3af',
        textDim: '#6b7280',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
