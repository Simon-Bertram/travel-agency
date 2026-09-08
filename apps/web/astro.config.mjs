// @ts-check
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";

// https://astro.build/config
export default defineConfig({
  env: {
    schema: {
      PUBLIC_SERVER_URL: envField.string({
        access: "public",
        context: "client",
        default: "http://localhost:3000",
      }),
    },
  },
  fonts: [
    {
      cssVariable: "--font-playfair-display",
      name: "Playfair Display",
      options: {
        variants: [
          {
            src: [
              "./src/assets/fonts/Playfair_Display/PlayfairDisplay-VariableFont_wght.ttf",
            ],
            style: "normal",
            weight: "400 900",
          },
          {
            src: [
              "./src/assets/fonts/Playfair_Display/PlayfairDisplay-Italic-VariableFont_wght.ttf",
            ],
            style: "italic",
            weight: "400 900",
          },
        ],
      },
      provider: fontProviders.local(),
    },
  ],
  output: "server",
  server: {
    host: "127.0.0.1",
  },
  vite: {
    environments: {
      ssr: {
        optimizeDeps: {
          exclude: ["alchemy", "@alchemy.run/frontend-frameworks"],
        },
      },
    },
    optimizeDeps: {
      exclude: ["alchemy", "@alchemy.run/frontend-frameworks"],
    },
    plugins: [tailwindcss()],
  },
});
