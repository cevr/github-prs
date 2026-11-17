import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "path"

export default defineConfig({
  root: "src",
  plugins: [solid(), tailwindcss()],
  base: "",
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(import.meta.dirname, "src/sidepanel/sidepanel.html"),
        options: resolve(import.meta.dirname, "src/options/options.html"),
        background: resolve(import.meta.dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background") return "background.js"
          return "assets/[name]-[hash].js"
        },
      },
    },
  },
})
