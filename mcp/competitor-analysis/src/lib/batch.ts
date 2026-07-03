import { BATCH_CONCURRENCY } from "./types.js";
import { extractPage } from "./extract.js";
import type { CompetitorPageResult } from "./types.js";

export interface BatchUrlInput {
  url: string;
  rank_position?: number;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

export async function analyzeBatch(
  urls: BatchUrlInput[]
): Promise<CompetitorPageResult[]> {
  return runWithConcurrency(urls, BATCH_CONCURRENCY, (item) =>
    extractPage(item.url, item.rank_position)
  );
}
