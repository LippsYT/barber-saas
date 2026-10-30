import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Impact", "sans-serif"],
      },
      colors: {
        ink: { DEFAULT: "#070B14", 900: "#070B14", 800: "#10182A", 700: "#182238", 600: "#243049" },
        gold: { DEFAULT: "#2F5BFF", 300: "#D6FF4A", 400: "#6D8BFF", 500: "#2F5BFF", 600: "#1E3FCC", 700: "#162E99" },
        cream: { DEFAULT: "#F4F6FB", 100: "#F7F4EC", 200: "#E7E3D8", 300: "#D9D3C5" },
        border: "hsl(var(--border))", ring: "hsl(var(--ring))", background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(0 0% 100%)" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
      boxShadow: { soft: "0 1px 2px rgba(7,11,20,.05), 0 10px 30px rgba(7,11,20,.06)" },
    },
  },
  plugins: [],
} satisfies Config;
