import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const lib = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

// The landing page runs the library straight from ../src, so the demo always matches this repository.
export default defineConfig({
  // Relative asset paths, so the built page works at any URL, including a GitHub Pages sub-path.
  base: "./",
  plugins: [react()],
  resolve: {
    alias: [
      { find: "react-smart-rewrite/styles.css", replacement: lib("styles.css") },
      { find: "react-smart-rewrite", replacement: lib("index.ts") },
    ],
    // One copy of React, even though ../src sits outside this project.
    dedupe: ["react", "react-dom"],
  },
  server: { port: 5191, strictPort: true, fs: { allow: [".."] } },
});
