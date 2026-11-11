import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { KINDS } from "./src/vectors.mjs";

// The footer of the Challenge page shows the commit the site was built from.
const GIT_SHA = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const PAGES = ["index.html", "replay.html", "editor.html", "challenge.html", "season.html"];

/** `vite build --mode preview-pages`, which pages.yml runs for a pull request's preview (plan
 *  M3.12), adds the vectors and probe pages, and the vectors they replay at dist/vectors/.
 *  Every other build, production's included, carries neither: Vite takes any mode, so pages.yml
 *  checks each build for the files with web/scripts/preview-files.mjs. */
const PREVIEW_MODE = "preview-pages";
const PREVIEW_PAGES = ["vectors.html", "probe.html"];
const VECTORS = new URL("../vectors/", import.meta.url);

/** Emits the files of vectors/'s kinds at vectors/<kind>/, and vectors/index.json, which lists
 *  each kind's .json files for the vectors page. */
function previewVectors(): Plugin {
  return {
    name: "preview-vectors",
    apply: "build",
    generateBundle() {
      const index: Record<string, string[]> = {};
      for (const kind of KINDS) {
        const names = readdirSync(new URL(`${kind}/`, VECTORS)).sort();
        index[kind] = names.filter((name) => name.endsWith(".json"));
        for (const name of names) {
          this.emitFile({ type: "asset", fileName: `vectors/${kind}/${name}`, source: readFileSync(new URL(`${kind}/${name}`, VECTORS)) });
        }
      }
      this.emitFile({ type: "asset", fileName: "vectors/index.json", source: JSON.stringify(index) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const preview = mode === PREVIEW_MODE;
  return {
    // The wasm module, the vectors and the deployment records live outside web/, in the repository.
    server: { fs: { allow: [".."] } },
    define: { __GIT_SHA__: JSON.stringify(GIT_SHA) },
    plugins: preview ? [previewVectors()] : [],
    build: { rolldownOptions: { input: preview ? [...PAGES, ...PREVIEW_PAGES] : PAGES } },
    test: {
      include: ["test/**/*.test.ts"],
    },
  };
});
