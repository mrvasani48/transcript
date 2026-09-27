/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#101314",
        panel: "#171b1c",
        line: "#262b2c",
        ink: "#e9ecec",
        muted: "#8b9596",
        accent: "#7fd6c2",
        error: "#e2836f",
      },
    },
  },
  plugins: [],
};
