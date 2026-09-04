// @ts-check
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

// https://astro.build/config
export default defineConfig({
  server: {
    host: "127.0.0.1",
  },
  env: {
    schema: {
      PUBLIC_SERVER_URL: envField.string({
        access: "public",
        context: "client",
        default: "http://localhost:3000",
      }),
    },
  },
  output: "server",
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["alchemy", "@alchemy.run/frontend-frameworks"],
    },
    environments: {
      ssr: {
        optimizeDeps: {
          exclude: ["alchemy", "@alchemy.run/frontend-frameworks"],
        },
      },
    },
  },
});
