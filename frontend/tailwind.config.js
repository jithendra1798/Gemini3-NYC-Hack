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
        "carousel-spin":      "carouselSpin 18s linear infinite",
        "shimmer":            "shimmer 2s linear infinite",
        "pulse-slow":         "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in":            "fadeIn 0.4s ease-out",
        "fade-out":           "fadeOut 0.35s cubic-bezier(0.4, 0, 1, 1) forwards",
        "scan":               "scan 3s linear infinite",
        "shutter-drop":       "shutterDrop 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "curtain-lift":       "curtainLift 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both",
        "film-burn":          "filmBurn 0.9s ease-out forwards",
        "border-pulse-once":  "borderPulseOnce 0.8s ease-out forwards",
        "bar-flash":          "barFlash 0.6s ease-out forwards",
        "float-up":           "floatUp 12s linear infinite",
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
        fadeOut: {
          "0%":   { opacity: "1", transform: "translateY(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateY(-20px) scale(0.97)" },
        },
        scan: {
          "0%":   { top: "0%" },
          "100%": { top: "100%" },
        },
        shutterDrop: {
          "0%":   { opacity: "0", transform: "translateY(-12px)", clipPath: "inset(0 0 100% 0)" },
          "40%":  { opacity: "1", clipPath: "inset(0 0 0% 0)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        curtainLift: {
          "0%":   { opacity: "0", transform: "translateY(18px) scaleY(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scaleY(1)" },
        },
        filmBurn: {
          "0%":   { opacity: "0", filter: "brightness(4) blur(1px)" },
          "15%":  { opacity: "1", filter: "brightness(2)" },
          "30%":  { opacity: "0.6", filter: "brightness(1)" },
          "60%":  { opacity: "1", filter: "brightness(1.2)" },
          "100%": { opacity: "0.85", filter: "brightness(1)" },
        },
        borderPulseOnce: {
          "0%":   { boxShadow: "0 0 0 0 rgba(255,255,255,0.4)" },
          "50%":  { boxShadow: "0 0 0 8px rgba(255,255,255,0.0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(255,255,255,0)" },
        },
        barFlash: {
          "0%":   { filter: "brightness(1)" },
          "40%":  { filter: "brightness(2.5)" },
          "100%": { filter: "brightness(1)" },
        },
        floatUp: {
          "0%":   { transform: "translateY(0) scale(1)", opacity: "0" },
          "10%":  { opacity: "0.6" },
          "90%":  { opacity: "0.6" },
          "100%": { transform: "translateY(-100vh) scale(0.5)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
