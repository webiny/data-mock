import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "~": resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    port: Number(process.env.UI_PORT ?? 4001),
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.API_PORT ?? 4000}`,
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "@mantine/core",
      "@mantine/hooks",
      "mobx",
      "mobx-react-lite",
      "@webiny/di",
      "@webiny/stdlib",
      "zod",
    ],
  },
  build: {
    outDir: "dist/ui",
  },
});
