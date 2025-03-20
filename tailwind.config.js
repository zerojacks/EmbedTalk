/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      backgroundColor: {
        'splize': 'var(--fallback-bc, oklch(var(--bc)/0.2))',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'bounce-slow': 'bounce-slow 3s infinite ease-in-out',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(to right, rgba(var(--color-primary-rgb, 59, 130, 246), 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(var(--color-primary-rgb, 59, 130, 246), 0.05) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '20px 20px',
      },
      keyframes: {
        'bounce-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      treetableview: {
        minHeight: '3rem /* 48px */',
        flexShrink: 1,
        paddingLeft: '0rem /* 16px */',
        paddingRight: '0rem /* 16px */',
        paddingTop: '0rem /* 8px */',
        paddingBottom: '0.5rem /* 8px */',
        fontSize: '0.875rem /* 14px */',
        lineHeight: '1.25rem /* 20px */',
        lineHeight: '2',
        borderRadius: 'var(--rounded-btn, 0.5rem /* 8px */)',
        borderWidth: '1px',
        bgOpacity: '1',
        backgroundColor: 'var(--fallback-b1,oklch(var(--b1)/var(--tw-bg-opacity)))',
      }
    },
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
