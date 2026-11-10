// The wipui preview build (docs/STYLE_GUIDE.md §16): `vite build --mode wipui` gives every page the
// head tags of the identity and the header bar of §8, and Training the banner of §6, before Vite
// processes the page, so that Vite bundles and rebases the URLs they reference. The page's own
// header becomes a plain div, so that the header bar is the page's one banner landmark. Only the
// wipui mode registers this plugin, and the font lives in fonts/, not in public/, so that the root
// build stays as it is.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { Plugin } from "vite";

export const WIPUI_MODE = "wipui";

/** The pages in the order of the header bar's nav: their file and their name. */
const PAGES: readonly (readonly [file: string, name: string])[] = [
  ["index.html", "Training"],
  ["challenge.html", "Challenge"],
  ["season.html", "Season"],
  ["replay.html", "Replay"],
  ["editor.html", "Editor"],
];

const TRAINING = "index.html";
const DESCRIPTION =
  "Draw the line. Claim the field. A territory-capture arcade game in the browser, where every ranked Challenge run is verified onchain.";
const SOCIAL_CARD = "https://jiro-ikusu.win/wipui/brand/social-card-1200x630.png";
const SOCIAL_CARD_ALT = "Jiro-ikusu (ジロイクス, 极络益克司): a red cut about to close around the name. Cut. Claim. Commit.";
/** The license of the Jiro Pixel 12 font, which no page references. */
const FONT_LICENSE = new URL("./fonts/LICENSE-fusion-pixel.txt", import.meta.url);

/** A link that stays within the build's base, wherever it is served. */
const relativeLink = (file: string) => (file === TRAINING ? "./" : file);

function headTags(page: string, title: string): string[] {
  return [
    '<link rel="stylesheet" href="/src/wipui/style.css" />',
    '<link rel="preload" href="/src/wipui/fonts/jiro-pixel-12.woff2" as="font" type="font/woff2" crossorigin />',
    '<meta name="theme-color" content="#000000" />',
    `<meta name="description" content="${DESCRIPTION}" />`,
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${title.replaceAll('"', "&quot;")}" />`,
    `<meta property="og:description" content="${DESCRIPTION}" />`,
    `<meta property="og:image" content="${SOCIAL_CARD}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:image:alt" content="${SOCIAL_CARD_ALT}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    ...(page === TRAINING ? ['<script type="module" src="/src/wipui/play.ts"></script>'] : []),
  ];
}

function headerBar(page: string): string[] {
  return [
    '<header class="bar">',
    '  <a href="./"><img src="/brand/wordmark.svg" width="368" height="44" alt="Jiro-ikusu" /></a>',
    "  <nav>",
    ...PAGES.map(([file, name]) => `    <a href="${relativeLink(file)}"${file === page ? ' aria-current="page"' : ""}>${name}</a>`),
    "  </nav>",
    "</header>",
  ];
}

const BANNER = [
  '<h1 class="banner">',
  "  <picture>",
  '    <source media="(min-width: 512px)" srcset="/brand/banner.svg" />',
  '    <img src="/brand/lockup-stacked.svg" width="196" height="220" alt="" />',
  "  </picture>",
  '  <span class="visually-hidden">Jiro-ikusu <span lang="ja">ジロイクス</span> <span lang="zh-Hans">极络益克司</span></span>',
  "</h1>",
];

/** `html` with its one `anchor` replaced by `replacement`: a page without it, or with several, fails the build. */
function replaceOnce(html: string, page: string, anchor: string, replacement: string): string {
  const parts = html.split(anchor);
  if (parts.length !== 2) throw new Error(`wipui: ${page} holds ${anchor} ${parts.length - 1} times, not once`);
  return parts.join(replacement);
}

/** The page `page` (a file name, such as index.html) of the wipui build, from its source `html`. */
export function wipuiPage(html: string, page: string): string {
  if (!PAGES.some(([file]) => file === page)) throw new Error(`wipui: ${page} is not a page of the header bar's nav`);
  const title = /<title>([^<]+)<\/title>/.exec(html)?.[1];
  if (title === undefined) throw new Error(`wipui: ${page} has no <title>`);
  let built = replaceOnce(html, page, "</head>", `  ${headTags(page, title).join("\n    ")}\n  </head>`);
  built = replaceOnce(built, page, "<header>", '<div class="intro">');
  built = replaceOnce(built, page, "</header>", "</div>");
  built = replaceOnce(built, page, "<body>", `<body>\n    ${headerBar(page).join("\n    ")}`);
  return page === TRAINING ? replaceOnce(built, page, "<h1>Jiro-ikusu</h1>", BANNER.join("\n      ")) : built;
}

/** The plugin of the wipui mode: each page goes through `wipuiPage` before Vite processes it. Vite
 *  emits the font into assets/, from the stylesheet and the preload, and the plugin its license next
 *  to it, which Vite would leave out, as no page references it. */
export function wipui(): Plugin {
  return {
    name: "jiro-ikusu-wipui",
    transformIndexHtml: { order: "pre", handler: (html, { filename }) => wipuiPage(html, basename(filename)) },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "assets/LICENSE-fusion-pixel.txt", source: readFileSync(FONT_LICENSE) });
    },
  };
}
