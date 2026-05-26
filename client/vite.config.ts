import { defineConfig } from "vite";

export default defineConfig({
  server: {
    allowedHosts: [".loca.lt", ".ngrok-free.dev", "localhost"],
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
