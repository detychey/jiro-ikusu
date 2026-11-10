import { execFileSync } from "node:child_process";
import { defineConfig } from "vitest/config";
import { wipui, WIPUI_MODE } from "./src/wipui/plugin.ts";

// The footer of the Challenge page shows the commit the site was built from.
const GIT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

export default defineConfig(({ mode }) => ({
  // The wasm module, the vectors and the deployment records live outside web/, in the repository.
  server: { fs: { allow: [".."] } },
  define: { __GIT_SHA__: JSON.stringify(GIT_SHA) },
  // The preview of the new visual identity, built into dist/wipui (src/wipui/plugin.ts).
  plugins: mode === WIPUI_MODE ? [wipui()] : [],
  build: { rolldownOptions: { input: ["index.html", "replay.html", "editor.html", "challenge.html", "season.html"] } },
  test: {
    include: ["test/**/*.test.ts"],
  },
}));
