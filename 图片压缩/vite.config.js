import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: [
      "@jsquash/jpeg",
      "@jsquash/oxipng",
      "@jsquash/webp",
      "@jsquash/avif",
      "ktx2-encoder",
    ],
  },
  worker: {
    format: "es",
  },
});
