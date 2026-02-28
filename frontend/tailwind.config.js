/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Pure B&W palette — no color accents
        surface: {
          0:   "#000000",
          50:  "#080808",
          100: "#111111",
          150: "#1a1a1a",
          200: "#222222",
          300: "#333333",
          400: "#555555",
          500: "#888888",
          600: "#aaaaaa",
          700: "#cccccc",
          800: "#e0e0e0",
          900: "#f5f5f5",
          950: "#ffffff",
        },
      },
      fontFamily: {
        display: ['"Inter"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
      animation: {
        "carousel-spin": "carouselSpin 18s linear infinite",
        "shimmer":       "shimmer 2s linear infinite",
        "pulse-slow":    "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":       "fadeIn 0.4s ease-out",
        "scan":          "scan 3s linear infinite",
      },
      keyframes: {
        carouselSpin: {
          "0%":   { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(360deg)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          "0%":   { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        scan: {
          "0%":   { top: "0%" },
          "100%": { top: "100%" },
        },
      },
    },
  },
  plugins: [],
};
