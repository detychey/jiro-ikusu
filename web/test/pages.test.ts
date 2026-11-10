// The five pages, written by hand (docs/STYLE_GUIDE.md §8, §16): the header bar marks the page's
// own nav link current, each page carries the head tags of the identity and a region labeled by
// its h1, and Training's h1 is the banner.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The pages in the order of the header bar's nav: their file, their link and its name. */
const PAGES = [
  ["index.html", "/", "Training"],
  ["challenge.html", "challenge.html", "Challenge"],
  ["season.html", "season.html", "Season"],
  ["replay.html", "replay.html", "Replay"],
  ["editor.html", "editor.html", "Editor"],
] as const;

/** Each page's head, in order, but for its <title> and og:title (docs/STYLE_GUIDE.md §16). */
const SHARED_HEAD = [
  '<meta charset="utf-8" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1" />',
  '<link rel="icon" href="/favicon.ico" sizes="48x48" />',
  '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
  '<link rel="stylesheet" href="/src/style.css" />',
  '<link rel="preload" href="/fonts/jiro-pixel-12.woff2" as="font" type="font/woff2" crossorigin />',
  '<meta name="theme-color" content="#000000" />',
  '<meta name="description" content="Draw the line. Claim the field. A territory-capture arcade game in the browser, where every ranked Challenge run is verified onchain." />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  '<link rel="manifest" href="/site.webmanifest" />',
  '<meta property="og:type" content="website" />',
  '<meta property="og:description" content="Draw the line. Claim the field. A territory-capture arcade game in the browser, where every ranked Challenge run is verified onchain." />',
  '<meta property="og:image" content="https://jiro-ikusu.win/brand/social-card-1200x630.png" />',
  '<meta property="og:image:width" content="1200" />',
  '<meta property="og:image:height" content="630" />',
  '<meta property="og:image:alt" content="Jiro-ikusu (ジロイクス, 极络益克司): a red cut about to close around the name. Cut. Claim. Commit." />',
  '<meta name="twitter:card" content="summary_large_image" />',
];

const source = (page: string) => readFileSync(new URL(`../${page}`, import.meta.url), "utf8");

/** The header bar's nav links, as [href, name, current]. */
function navLinks(html: string): [string, string, boolean][] {
  const nav = /<header class="bar">[\s\S]*?<nav>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? "";
  return Array.from(nav.matchAll(/<a href="([^"]*)"( aria-current="page")?>([^<]*)<\/a>/g), ([, href, current, name]) => [
    href ?? "",
    name ?? "",
    current !== undefined,
  ]);
}

describe("each page", () => {
  it.each(PAGES)("%s marks its own nav link current, and no other", (page) => {
    expect(navLinks(source(page))).toEqual(PAGES.map(([file, href, name]) => [href, name, file === page]));
  });

  it.each(PAGES)("%s gives og:title the text of its <title>", (page) => {
    const html = source(page);
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
    expect(html).toContain(`<meta property="og:title" content="${title}" />`);
  });

  it.each(PAGES)("%s carries the shared head, in order", (page) => {
    const head = /<head>([\s\S]*)<\/head>/.exec(source(page))?.[1] ?? "";
    const lines = head.split("\n").map((line) => line.trim());
    expect(lines.filter((line) => line !== "" && !/^<title>|^<meta property="og:title" /.test(line))).toEqual(SHARED_HEAD);
  });

  it.each(PAGES)("%s opens its body with the header bar, the wordmark linked to Training", (page) => {
    expect(source(page)).toContain(
      '<body>\n    <header class="bar">\n      <a href="/"><img src="/brand/wordmark.svg" width="368" height="44" alt="Jiro-ikusu" /></a>\n      <nav>',
    );
  });

  it.each(PAGES)("%s opens its intro region with the h1 that labels it", (page) => {
    expect(source(page)).toMatch(/<section class="intro" aria-labelledby="page-title">\s*<h1 id="page-title"[ >]/);
  });
});

describe("Training", () => {
  it("has the banner as its h1: the stacked lockup below 512 px, and the name in three scripts as its text", () => {
    expect(source("index.html")).toContain(
      [
        '<h1 id="page-title" class="banner">',
        "        <picture>",
        '          <source media="(min-width: 512px)" srcset="/brand/banner.svg" />',
        '          <img src="/brand/lockup-stacked.svg" width="196" height="220" alt="" />',
        "        </picture>",
        '        <span class="visually-hidden">Jiro-ikusu <span lang="ja">ジロイクス</span> <span lang="zh-Hans">极络益克司</span></span>',
        "      </h1>",
      ].join("\n"),
    );
  });
});
