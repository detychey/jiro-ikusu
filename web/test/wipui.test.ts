// The wipui preview build (docs/STYLE_GUIDE.md §16): the plugin's transformation of the five
// pages, run on their sources: the header bar with the current page, the head tags, the Training
// banner and script, and a build that fails, naming the page, when a page lacks what it expects;
// and the font's license, which the plugin emits.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { wipui, wipuiPage } from "../src/wipui/plugin";

const PAGES = [
  ["index.html", "Training"],
  ["challenge.html", "Challenge"],
  ["season.html", "Season"],
  ["replay.html", "Replay"],
  ["editor.html", "Editor"],
] as const;

const source = (page: string) => readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
const built = (page: string) => wipuiPage(source(page), page);

/** The nav's links, as [href, name, current]. */
function navLinks(html: string): [string, string, boolean][] {
  const nav = /<nav>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? "";
  return [...nav.matchAll(/<a href="([^"]*)"( aria-current="page")?>([^<]*)<\/a>/g)].map(([, href, current, name]) => [
    href ?? "",
    name ?? "",
    current !== undefined,
  ]);
}

describe("the wipui build of each page", () => {
  it.each(PAGES)("%s opens its body with the header bar, the wordmark linked to Training", (page) => {
    expect(built(page)).toContain(
      '<body>\n    <header class="bar">\n      <a href="./"><img src="/brand/wordmark.svg" width="368" height="44" alt="Jiro-ikusu" /></a>\n      <nav>',
    );
  });

  it.each(PAGES)("%s lists the five pages as relative links, %s alone current", (page, name) => {
    expect(navLinks(built(page))).toEqual(
      PAGES.map(([file, label]) => [file === "index.html" ? "./" : file, label, label === name]),
    );
  });

  it.each(PAGES)("%s keeps one header, the bar, its own header becoming a div", (page) => {
    const html = built(page);
    expect([html.match(/<header/g)?.length, html.includes('<div class="intro">')]).toEqual([1, true]);
  });

  it.each(PAGES)("%s loads the wipui stylesheet after style.css, then the head tags of the identity", (page) => {
    const html = built(page);
    const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
    const tags = [
      '<link rel="stylesheet" href="/src/style.css" />',
      '<link rel="stylesheet" href="/src/wipui/style.css" />',
      '<link rel="preload" href="/src/wipui/fonts/jiro-pixel-12.woff2" as="font" type="font/woff2" crossorigin />',
      '<meta name="theme-color" content="#000000" />',
      '<meta name="description" content="Draw the line. Claim the field. A territory-capture arcade game in the browser, where every ranked Challenge run is verified onchain." />',
      '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
      `<meta property="og:title" content="${title}" />`,
      '<meta property="og:image" content="https://jiro-ikusu.win/wipui/brand/social-card-1200x630.png" />',
      '<meta property="og:image:alt" content="Jiro-ikusu (ジロイクス, 极络益克司): a red cut about to close around the name. Cut. Claim. Commit." />',
      '<meta name="twitter:card" content="summary_large_image" />',
      "</head>",
    ];
    const positions = tags.map((tag) => html.indexOf(tag));
    expect(positions.every((position, i) => position > (positions[i - 1] ?? -1))).toBe(true);
  });

  it.each(PAGES)("%s loads the Play scroll script only on Training", (page) => {
    expect(built(page).includes('<script type="module" src="/src/wipui/play.ts"></script>')).toBe(page === "index.html");
  });
});

describe("the head tags", () => {
  it("escape a double quote of the page's title in og:title", () => {
    const html = source("challenge.html").replace("<title>Jiro-ikusu Challenge</title>", '<title>Jiro-ikusu "Challenge"</title>');
    expect(wipuiPage(html, "challenge.html")).toContain('<meta property="og:title" content="Jiro-ikusu &quot;Challenge&quot;" />');
  });
});

describe("the Training banner", () => {
  it("replaces the h1 with the banner, the stacked lockup below 512 px and the name in three scripts as its text", () => {
    expect(built("index.html")).toContain(
      [
        '<h1 class="banner">',
        "        <picture>",
        '          <source media="(min-width: 512px)" srcset="/brand/banner.svg" />',
        '          <img src="/brand/lockup-stacked.svg" width="196" height="220" alt="" />',
        "        </picture>",
        '        <span class="visually-hidden">Jiro-ikusu <span lang="ja">ジロイクス</span> <span lang="zh-Hans">极络益克司</span></span>',
        "      </h1>",
      ].join("\n"),
    );
  });

  it("leaves the h1s of the other pages as they are", () => {
    expect(built("challenge.html")).toContain("<h1>Jiro-ikusu Challenge</h1>");
  });
});

describe("a page the plugin cannot transform", () => {
  it.each([
    ["challenge.html", "</head>", "wipui: challenge.html holds </head> 0 times, not once"],
    ["season.html", "<body>", "wipui: season.html holds <body> 0 times, not once"],
    ["replay.html", "<header>", "wipui: replay.html holds <header> 0 times, not once"],
    ["index.html", "<h1>Jiro-ikusu</h1>", "wipui: index.html holds <h1>Jiro-ikusu</h1> 0 times, not once"],
    ["editor.html", "<title>Jiro-ikusu level editor</title>", "wipui: editor.html has no <title>"],
  ])("fails the build when %s lacks %s", (page, anchor, message) => {
    expect(() => wipuiPage(source(page).replace(anchor, ""), page)).toThrow(message);
  });

  it("fails the build on a page the header bar does not list", () => {
    expect(() => wipuiPage(source("index.html"), "about.html")).toThrow("wipui: about.html is not a page of the header bar's nav");
  });
});

describe("the plugin", () => {
  it("transforms each page before Vite processes it, by the page's file name", async () => {
    const hook = wipui().transformIndexHtml;
    if (typeof hook !== "object" || hook === null) throw new Error("the hook has no order");
    const html = source("season.html");
    const context = { path: "/season.html", filename: "/repo/web/season.html" };
    expect([hook.order, await hook.handler.call({} as never, html, context)]).toEqual(["pre", built("season.html")]);
  });

  it("emits the font's license next to the font, as no page references it", async () => {
    const hook = wipui().generateBundle;
    if (typeof hook !== "function") throw new Error("the plugin has no generateBundle hook");
    const emitted: unknown[] = [];
    await hook.call({ emitFile: (file: unknown) => emitted.push(file) } as never, {} as never, {}, true);
    const license = readFileSync(new URL("../src/wipui/fonts/LICENSE-fusion-pixel.txt", import.meta.url));
    expect(emitted).toEqual([{ type: "asset", fileName: "assets/LICENSE-fusion-pixel.txt", source: license }]);
  });
});
