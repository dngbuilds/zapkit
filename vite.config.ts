import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  // Resolve @/ alias used by @zapkit/ui so `vp test` from root works.
  resolve: {},
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
  },
});
