import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: process.env.SYNCRESUME_APP_BUILD === "1" ? false : "public",
});
