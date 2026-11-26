// Checks the build in web/dist for the files built only for pull-request previews (plan M3.12):
// the vectors and probe pages, and the files of vectors/.
// - present, for a pull request's build: both pages and dist/vectors/index.json are there, or the
//   end-to-end tests of the pages would skip.
// - absent, for any other build, production's included: no file or directory is named after either
//   page or vectors/, and no file has the content of a vector file, whatever its name.
// Vite takes any --mode without complaint, so this checks what a mode actually built.
// Usage: node web/scripts/preview-files.mjs present|absent
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { KINDS } from "../src/vectors.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DIST = join(REPO_ROOT, "web", "dist");
const VECTORS = join(REPO_ROOT, "vectors");
const PREVIEW_FILES = ["vectors.html", "probe.html", "vectors/index.json"];
const PREVIEW_NAME = /^(vectors|probe)/;

const expected = process.argv[2];
if (expected !== "present" && expected !== "absent") {
  console.error("usage: node web/scripts/preview-files.mjs present|absent");
  process.exit(2);
}
if (!existsSync(DIST)) throw new Error(`${DIST} not found: build the site first`);

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

/** The preview files missing from the build. */
function missing() {
  return PREVIEW_FILES.filter((file) => !existsSync(join(DIST, file))).map((file) => `${file} is missing`);
}

/** The build's paths named like a preview file, and its files with a vector file's content. */
function carried() {
  const vectorHashes = new Set(KINDS.flatMap((kind) => readdirSync(join(VECTORS, kind)).map((name) => sha256(join(VECTORS, kind, name)))));
  return readdirSync(DIST, { recursive: true, withFileTypes: true }).flatMap((entry) => {
    const path = join(entry.parentPath, entry.name);
    const name = relative(DIST, path);
    if (PREVIEW_NAME.test(entry.name)) return [`${name} is named like a preview file`];
    if (entry.isFile() && statSync(path).size > 0 && vectorHashes.has(sha256(path))) return [`${name} has a vector file's content`];
    return [];
  });
}

const problems = expected === "present" ? missing() : carried();
for (const problem of problems) console.error(`web/dist: ${problem}`);
if (problems.length > 0) {
  console.error(`web/dist: the preview files must be ${expected}`);
  process.exit(1);
}
console.log(`web/dist: the preview files are ${expected}`);
