import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://syncresume.io",
  srcDir: "./marketing",
  output: "static",
  integrations: [react(), sitemap()],
});
