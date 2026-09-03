import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  deps: {
    alwaysBundle: [/@travel-agency\/.*/],
    neverBundle: ["cloudflare:workers"],
  },
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
});
