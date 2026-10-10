/**
 * Run `worker` over every item with at most `limit` running at once. A failing item doesn't stop
 * the others: workers are expected to record their own errors, and any throw is swallowed here.
 */
export async function runLimited<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await worker(item);
      } catch {
        // Recorded by the worker.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}
