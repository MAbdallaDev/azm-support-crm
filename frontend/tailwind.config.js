/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "IBM Plex Sans Arabic", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },

        // --- Design-system names Tailwind's default palette does not have ----
        // The artboards' own token names, so a class reads like the design does.
        ink: { DEFAULT: "#14171f", 2: "#3d434f" },
        faint: "#9aa1ad",
        line: { DEFAULT: "#e4e7ec", 2: "#eef0f4" },
        surface: { 2: "#f7f8fa", 3: "#f1f3f7" },
        brand: { DEFAULT: "#4f46e5", soft: "#eef0fe", strong: "#3730b8" },

        /*
         * The badge families. Each is a {DEFAULT, bg} pair straight from
         * DesignSystem.dc.html, so <PriorityBadge> is two utility classes
         * (`bg-priority-urgent-bg text-priority-urgent`) rather than a
         * per-component style sheet re-stating the same hexes.
         */
        priority: {
          urgent: { DEFAULT: "#c62828", bg: "#fdecec" },
          high: { DEFAULT: "#b45309", bg: "#fdf3e0" },
          normal: { DEFAULT: "#4a5567", bg: "#eef1f5" },
          low: { DEFAULT: "#0f7a52", bg: "#e3f5ec" },
        },
        channel: {
          web: { DEFAULT: "#4a5567", bg: "#eef1f5" },
          email: { DEFAULT: "#3730b8", bg: "#eef0fe" },
          whatsapp: { DEFAULT: "#0f7a52", bg: "#e3f5ec" },
          sms: { DEFAULT: "#0b6a9e", bg: "#e4f3fb" },
          chat: { DEFAULT: "#6b3fc4", bg: "#f0eafd" },
        },
        // The status swatch row. `new` reuses brand-soft, `resolved` its own
        // blue, and the rest borrow the priority families the artboard reuses.
        status: {
          new: { DEFAULT: "#3730b8", bg: "#eef0fe" },
          open: { DEFAULT: "#0f7a52", bg: "#e3f5ec" },
          pending: { DEFAULT: "#4a5567", bg: "#eef1f5" },
          on_hold: { DEFAULT: "#4a5567", bg: "#eef1f5" },
          escalated: { DEFAULT: "#c62828", bg: "#fdecec" },
          resolved: { DEFAULT: "#1d5fa8", bg: "#e7f0fb" },
          closed: { DEFAULT: "#4a5567", bg: "#eef1f5" },
          reopened: { DEFAULT: "#b45309", bg: "#fdf3e0" },
        },
        // SLA. `fill` is the progress-bar colour, which the artboard draws a
        // shade brighter than the text so the bar reads at 5px tall.
        sla: {
          ok: { DEFAULT: "#0f7a52", fill: "#22a06b" },
          approaching: { DEFAULT: "#b45309", fill: "#e0a33a" },
          breached: { DEFAULT: "#c62828", fill: "#c62828" },
        },
        tier: { DEFAULT: "#8a6100", bg: "#fdf0d5" },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
