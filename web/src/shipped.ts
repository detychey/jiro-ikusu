// The 16 levels the site ships, levels/*.bin, by name in index order: the levels Training scores
// and a season's draw slots name (README §5, §8.2).

const SHIPPED_LEVELS: Record<string, string> = import.meta.glob("../../levels/*.bin", {
  query: "?url",
  import: "default",
  eager: true,
});

async function fetchLevel(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`could not load the level ${url} (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

export function shippedLevels(): Promise<[string, Uint8Array][]> {
  return Promise.all(
    Object.entries(SHIPPED_LEVELS)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([path, url]): Promise<[string, Uint8Array]> => [path.replace(/^.*\//, "").replace(/\.bin$/, ""), await fetchLevel(url)]),
  );
}
