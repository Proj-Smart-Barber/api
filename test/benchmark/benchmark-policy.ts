import assert from "node:assert/strict";
import type { DiscoveryPage } from "../../src/domain/application/services/discovery-contract";

export interface BenchmarkTimingSample {
  iteration: number;
  sqlCountMs: number;
  sqlItemsMs: number;
  sqlTotalMs: number;
  repositoryTotalMs: number;
  httpTotalMs: number;
}

export function meetsBenchmarkBudget(
  samples: BenchmarkTimingSample[],
  units: number,
): boolean {
  return (
    units === 10000 &&
    samples.length === 10 &&
    samples.every(
      (sample) =>
        [
          sample.sqlCountMs,
          sample.sqlItemsMs,
          sample.sqlTotalMs,
          sample.repositoryTotalMs,
          sample.httpTotalMs,
        ].every((value) => Number.isFinite(value) && value > 0) &&
        sample.sqlTotalMs === sample.sqlCountMs + sample.sqlItemsMs &&
        sample.sqlTotalMs <= 200,
    )
  );
}

export async function readBenchmarkResponse(
  response: Response,
  expected: DiscoveryPage,
): Promise<void> {
  const body: unknown = await response.json();
  assert.equal(response.status, 200, "HTTP benchmark must succeed");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.ok(body && typeof body === "object", "Expected a discovery page");
  const page = body as DiscoveryPage;
  assert.equal(page.total, expected.total);
  assert.equal(page.page, expected.page);
  assert.equal(page.limit, expected.limit);
  assert.equal(page.hasNext, expected.hasNext);
  assert.deepEqual(page.items, expected.items);
  assert.ok(
    Number.isFinite(Date.parse(page.serverTime)),
    "Missing server timestamp",
  );
}
