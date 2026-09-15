import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    exclude: [
      "@jsquash/jpeg",
      "@jsquash/oxipng",
      "@jsquash/webp",
      "@jsquash/avif",
    ],
  },
  worker: {
    format: "es",
  },
});
