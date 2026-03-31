import { defineConfig } from "vite-plus";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";
import { zapkitPlugin } from "@dngbuilds/zapkit-react/vite";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mixed plugin sources cause recursive type comparison
const plugins: any[] = [
  tanstackRouter({
    target: "react",
    autoCodeSplitting: true,
  }),
  tailwindcss(),
  zapkitPlugin(),
  react(),
  babel({ presets: [reactCompilerPreset()] }),
];

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins,
});
