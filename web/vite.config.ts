import { defineConfig } from "vitest/config";

export default defineConfig({
  // The wasm module and the vectors live outside web/, in the repository.
  server: { fs: { allow: [".."] } },
  build: { rolldownOptions: { input: ["index.html", "replay.html"] } },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
