import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "vercel",
  publicDir: "../public",
  plugins: [react()],
  build: {
    outDir: "../vercel-dist",
    emptyOutDir: true,
  },
});
