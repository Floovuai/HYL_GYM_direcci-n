import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort = env.PORT || "4310";
  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      proxy: {
        "/api": `http://localhost:${apiPort}`
      }
    },
    build: {
      outDir: "dist/client",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name]-[hash]-asesores-diario.js",
          chunkFileNames: "assets/[name]-[hash]-asesores-diario.js",
          assetFileNames: "assets/[name]-[hash]-asesores-diario[extname]",
          manualChunks(id: string) {
            if (id.includes("node_modules")) {
              if (id.includes("recharts")) return "vendor-charts";
              if (id.includes("react-dom") || id.includes("/react/")) return "vendor-react";
            }
            return undefined;
          }
        }
      }
    }
  };
});
