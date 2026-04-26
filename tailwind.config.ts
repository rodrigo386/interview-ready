import type { Config } from "tailwindcss";

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
        // PrepaVAGA Opção A spec tokens — usados pelos componentes em src/components/prep/*
        orange: {
          DEFAULT: "#F15A24",
          500: "#F15A24",
          700: "#D94818",
          soft: "#FFE7DC",
        },
        green: {
          DEFAULT: "#2DB87F",
          500: "#2DB87F",
          700: "#1F7A56",
          soft: "#E0F5EB",
        },
        yellow: {
          DEFAULT: "#F5B800",
          500: "#F5B800",
          700: "#B08600",
          soft: "#FFF4D1",
        },
        red: {
          DEFAULT: "#E54848",
          500: "#E54848",
          soft: "#FDE3E3",
        },
        ink: {
          DEFAULT: "#1A1A1A",
          2: "#4A4A4A",
          3: "#8A8A8A",
        },
        line: "#E8E8E8",
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
  plugins: [],
};

export default config;
