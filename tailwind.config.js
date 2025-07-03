/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        kyndryl: {
          orange: "#FF462D",
          black: "#000000",
          gray: "#F5F5F5",
          darkGray: "#2D2D2D",
          lightGray: "#FAFAFA",
          blue: "#0F62FE",
          green: "#198038",
          red: "#DA1E28"
        }
      }
    }
  },
  plugins: []
};
