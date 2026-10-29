import { defineConfig } from "vitest/config";

export default defineConfig({
  // The wasm module and the vectors live outside web/, in the repository.
  server: { fs: { allow: [".."] } },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
