import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/react-fiber-xray/",
  plugins: [react()],
  build: { minify: false },
});
