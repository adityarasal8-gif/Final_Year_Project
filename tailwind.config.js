/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Medical Design System
        'medical': {
          primary: '#0D9488',      // Teal-600 (Healing/Trust)
          secondary: '#4F46E5',    // Indigo-600 (Technology/AI)
          success: '#10B981',      // Soft Green
          error: '#EF4444',        // Soft Red
          warning: '#F59E0B',      // Amber
          background: '#F8FAFC',   // Slate-50 (Clinical Clean)
          surface: '#FFFFFF',
          'text-primary': '#0F172A', // Slate-900
          'text-secondary': '#64748B', // Slate-500
        },
        // Legacy colors (for backwards compatibility)
        'phisi-dark': '#1a1a2e',
        'phisi-blue': '#0f3460',
        'phisi-red': '#e94560',
        'phisi-accent': '#16213e',
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      boxShadow: {
        'medical': '0 4px 6px -1px rgba(13, 148, 136, 0.1), 0 2px 4px -1px rgba(13, 148, 136, 0.06)',
        'medical-lg': '0 10px 15px -3px rgba(13, 148, 136, 0.1), 0 4px 6px -2px rgba(13, 148, 136, 0.05)',
      },
    },
  },
  plugins: [],
}
