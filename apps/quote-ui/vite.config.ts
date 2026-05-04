import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {
    port: 5173,
    host: "127.0.0.1"
  },
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER
  }
});
