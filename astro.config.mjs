// @ts-check
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "astro/config";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  site: "https://ui-dict.pages.dev", // TODO: 换独立域名
  alias: { "@": "./src" },
  vite: {
    plugins: [tailwind()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
  },
});
