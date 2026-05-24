/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#030712',       // Deep space black
          surface: '#0f172a',  // Bloomberg slate grey
          border: '#1e293b',   // UI borders
          green: '#22c55e',    // Ticker green
          red: '#ef4444',      // Siren red
          amber: '#f59e0b',    // Stress warning amber
          purple: '#a855f7',   // Neon system grid
          blue: '#3b82f6',     // Terminal blue
        }
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glitch': 'glitch 0.4s ease-in-out infinite alternate',
        'scanline': 'scanline 6s linear infinite',
      },
      keyframes: {
        glitch: {
          '0%': { textShadow: '2px 0 0 #ff00ff, -2px 0 0 #00ffff' },
          '100%': { textShadow: '-2px 0 0 #ff00ff, 2px 0 0 #00ffff' }
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        }
      }
    },
  },
  plugins: [],
}
