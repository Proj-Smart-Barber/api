import { describe, expect, it } from "vitest";
import {
  meetsBenchmarkBudget,
  readBenchmarkResponse,
  type BenchmarkTimingSample,
} from "./benchmark-policy";

const samples = (): BenchmarkTimingSample[] =>
  Array.from({ length: 10 }, (_, index) => ({
    iteration: index + 1,
    sqlCountMs: 100,
    sqlItemsMs: 100,
    sqlTotalMs: 200,
    repositoryTotalMs: 201,
    httpTotalMs: 210,
  }));

describe("Benchmark acceptance and complete HTTP response", () => {
  it("accepts the inclusive SQL budget and rejects an over-budget sample", () => {
    const measured = samples();
    expect(meetsBenchmarkBudget(measured, 10000)).toBe(true);
    measured[9].sqlCountMs += 0.01;
    measured[9].sqlTotalMs = measured[9].sqlCountMs + measured[9].sqlItemsMs;
    expect(meetsBenchmarkBudget(measured, 10000)).toBe(false);
  });
  it("rejects insufficient volume, missing samples and invalid measurements", () => {
    expect(meetsBenchmarkBudget(samples(), 0)).toBe(false);
    expect(meetsBenchmarkBudget(samples().slice(1), 10000)).toBe(false);
    const measured = samples();
    measured[0].sqlTotalMs = Number.NaN;
    expect(meetsBenchmarkBudget(measured, 10000)).toBe(false);
  });
  it("reads and validates the JSON body, not only the response headers", async () => {
    const expected = {
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      hasNext: false,
      serverTime: new Date().toISOString(),
    };
    const response = new Response(JSON.stringify(expected), {
      headers: { "Cache-Control": "no-store" },
    });
    await readBenchmarkResponse(response, expected);
    expect(response.bodyUsed).toBe(true);
    await expect(
      readBenchmarkResponse(new Response("{}"), expected),
    ).rejects.toThrow();
    await expect(
      readBenchmarkResponse(
        new Response(JSON.stringify({ ...expected, total: 1 }), {
          headers: { "Cache-Control": "no-store" },
        }),
        expected,
      ),
    ).rejects.toThrow();
  });
});
