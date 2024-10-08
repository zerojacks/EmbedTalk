/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  daisyui: {
    themes: [
      "light",
      "dark"
    ],
    base: true,
    utils: true,
    themeRoot: ":root",
  },
  darkMode: ['class', '[data-theme="light"]'],
  plugins: [require("@tailwindcss/typography"), require("daisyui","heroicons")],
};
