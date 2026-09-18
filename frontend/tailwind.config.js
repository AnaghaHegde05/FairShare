/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#EEEBE2",
        card: "#FBF9F4",
        ink: "#22303B",
        muted: "#5C6B72",
        line: "#D8D2C2",
        pine: {
          DEFAULT: "#2F6F5E",
          dark: "#20493D",
          light: "#E4EFEA",
        },
        brick: {
          DEFAULT: "#A63D2F",
          dark: "#7C2C21",
          light: "#F5E4E0",
        },
        gold: {
          DEFAULT: "#B9860A",
          light: "#F6EAC7",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        card: "10px",
      },
    },
  },
  plugins: [],
};
