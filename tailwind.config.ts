import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"], display: ["var(--font-display)", "Georgia", "serif"] },
      colors: {
        ink: { DEFAULT: "#0e0c0a", 900: "#0e0c0a", 800: "#171410", 700: "#221d17", 600: "#2e2820" },
        gold: { DEFAULT: "#c9a35c", 300: "#e6cf9b", 400: "#d8b877", 500: "#c9a35c", 600: "#a9843f", 700: "#86672e" },
        cream: { DEFAULT: "#f7f3ec", 100: "#fbf8f3", 200: "#f1ebe0", 300: "#e5dccb" },
        border: "hsl(var(--border))", ring: "hsl(var(--ring))", background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(0 0% 100%)" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      boxShadow: { soft: "0 1px 2px rgba(20,16,10,.04), 0 4px 16px rgba(20,16,10,.06)" },
    },
  },
  plugins: [],
} satisfies Config;
