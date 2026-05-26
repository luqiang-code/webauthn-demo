import { defineConfig } from "vite";

export default defineConfig({
  server: {
    allowedHosts: [".loca.lt", "localhost"],
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
