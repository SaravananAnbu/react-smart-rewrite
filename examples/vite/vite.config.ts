import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const src = fileURLToPath(new URL("../../src", import.meta.url));

// The example runs the library straight from ../../src, so it always matches this repository.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "react-smart-rewrite/styles.css", replacement: `${src}/styles.css` },
      { find: "react-smart-rewrite", replacement: `${src}/index.ts` },
    ],
    dedupe: ["react", "react-dom"],
  },
  server: { port: 5189, strictPort: true, fs: { allow: ["../.."] } },
});
