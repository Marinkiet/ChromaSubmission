/** Best-effort heap reading: Chrome/Quest browser exposes performance.memory, Node has process. */
export function readHeapBytes(): number | null {
  const perf = globalThis.performance as unknown as { memory?: { usedJSHeapSize: number } };
  if (perf?.memory) return perf.memory.usedJSHeapSize;
  const proc = (globalThis as unknown as { process?: { memoryUsage?: () => { heapUsed: number } } })
    .process;
  return proc?.memoryUsage ? proc.memoryUsage().heapUsed : null;
}

export const toMB = (bytes: number | null): string =>
  bytes === null ? 'n/a' : `${(bytes / 1048576).toFixed(1)}MB`;
