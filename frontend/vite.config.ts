import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the export works under an IPFS gateway subpath or an ENS name.
// Routing is hash-based (#/...), so no server rewrite is needed.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true, sourcemap: false, chunkSizeWarningLimit: 1200 },
});
