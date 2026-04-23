import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  // base: "/2025-p2a-web-volny-projekt-misalibaytb/",
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
});
