/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans Devanagari', 'Noto Sans', 'sans-serif'],
      },
      colors: {
        // Government letterhead palette - matches the masthead used across
        // the other Health Office projects (ACTION PLAN 2083-84, VBD
        // Surveillance): navy title, maroon ministry line, gold rule, a
        // crimson flag strip. UI chrome only - never used for chart data,
        // which stays on the dataviz-validated palette in lib/palette.ts.
        govt: {
          navy: '#0B2C5E',
          'navy-dark': '#062044',
          maroon: '#8F1A2B',
          gold: '#C8A951',
          crimson: '#DC143C',
        },
      },
    },
  },
  plugins: [],
}
