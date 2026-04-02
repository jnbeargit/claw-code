/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./app/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm dark theme palette
        bg: {
          main: '#292922',
          sidebar: '#1F1F1A',
          card: '#353530',
          hover: '#3A3A34',
        },
        border: {
          DEFAULT: '#3D3D37',
        },
        text: {
          primary: '#E8E4DF',
          secondary: '#9B9790',
          tertiary: '#6B6860',
        },
        accent: {
          blue: '#4A9EFF',
          green: '#4ADE80',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
