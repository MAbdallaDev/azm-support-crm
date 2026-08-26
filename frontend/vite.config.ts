import path from "node:path";
import react from "@vitejs/plugin-react";
// vitest/config re-exports Vite's defineConfig with the `test` block typed.
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // usePolling: hot reload does not fire through a Docker bind mount on Linux without it.
  server: { host: "0.0.0.0", port: 5173, watch: { usePolling: true } },
  test: { environment: "jsdom", globals: true, setupFiles: "./src/test/setup.ts" },
});
