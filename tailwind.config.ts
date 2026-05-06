import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#EA580C",
          50: "#FFF7ED",
          100: "#FFEDD5",
          200: "#FED7AA",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
          700: "#C2410C",
          900: "#7C2D12",
          hover: "#C2410C",
        },
        // PrepaVaga Opção A spec tokens — usados pelos componentes em src/components/prep/*
        orange: {
          DEFAULT: "rgb(var(--color-orange-500) / <alpha-value>)",
          500: "rgb(var(--color-orange-500) / <alpha-value>)",
          700: "rgb(var(--color-orange-700) / <alpha-value>)",
          soft: "rgb(var(--color-orange-soft) / <alpha-value>)",
        },
        green: {
          DEFAULT: "rgb(var(--color-green-500) / <alpha-value>)",
          500: "rgb(var(--color-green-500) / <alpha-value>)",
          700: "rgb(var(--color-green-700) / <alpha-value>)",
          soft: "rgb(var(--color-green-soft) / <alpha-value>)",
        },
        yellow: {
          DEFAULT: "rgb(var(--color-yellow-500) / <alpha-value>)",
          500: "rgb(var(--color-yellow-500) / <alpha-value>)",
          700: "rgb(var(--color-yellow-700) / <alpha-value>)",
          soft: "rgb(var(--color-yellow-soft) / <alpha-value>)",
        },
        red: {
          DEFAULT: "rgb(var(--color-red-500) / <alpha-value>)",
          500: "rgb(var(--color-red-500) / <alpha-value>)",
          soft: "rgb(var(--color-red-soft) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          2: "rgb(var(--color-ink-2) / <alpha-value>)",
          3: "rgb(var(--color-ink-3) / <alpha-value>)",
        },
        line: "rgb(var(--color-line) / <alpha-value>)",
        // Semantic surface/text tokens (mantidos)
        surface: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
          muted: "rgb(var(--color-surface-2) / <alpha-value>)",
        },
        bg: {
          DEFAULT: "rgb(var(--color-bg) / <alpha-value>)",
        },
        text: {
          primary: "rgb(var(--color-text-primary) / <alpha-value>)",
          secondary: "rgb(var(--color-text-secondary) / <alpha-value>)",
          tertiary: "rgb(var(--color-text-tertiary) / <alpha-value>)",
          muted: "rgb(var(--color-text-muted) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--color-border) / <alpha-value>)",
          strong: "rgb(var(--color-border-strong) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "20px",
        pill: "999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.04)",
        md: "0 4px 12px rgba(0,0,0,0.06)",
        lg: "0 12px 32px rgba(0,0,0,0.08)",
        prep: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [typography],
};

export default config;
