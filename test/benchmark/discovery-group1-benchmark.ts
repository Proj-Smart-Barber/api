import type { Server } from "node:http";
import express from "express";
import { PgDialect } from "drizzle-orm/pg-core";
import assert from "node:assert/strict";
import type { DiscoveryPage } from "../../src/domain/application/services/discovery-contract";
import {
  meetsBenchmarkBudget,
  readBenchmarkResponse,
  type BenchmarkTimingSample,
} from "./benchmark-policy";
import { adaptRoute } from "../../src/core/infra/adapters/express-route-adapter";
import { SearchBarbershopsUseCase } from "../../src/domain/application/use-cases/barbershop/search-barbershops/search-barbershops";
import { runSchemaMigrations } from "../../src/infra/drizzle/migrator";
import { DrizzleDiscoveryRepository } from "../../src/infra/drizzle/repositories/drizzle-discovery-repository";
import { SearchNearbyBarbershopsController } from "../../src/infra/http/controllers/barbershop/search-barbershops.controller";
import {
  createDiscoveryTestDatabase,
  type IsolatedDiscoveryDatabase,
} from "../helpers/isolated-discovery-db";

// Minimal LCG generator for deterministic synthetic data seeding
class DeterministicRng {
  private state: number;
  constructor(seed = 42) {
    this.state = seed >>> 0;
  }
  next(): number {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
}

export async function runProximityBenchmark() {
  const testDbUrl = process.env.DISCOVERY_TEST_DATABASE_URL;
  if (!testDbUrl) {
    console.warn(
      "[Benchmark] DISCOVERY_TEST_DATABASE_URL not provided. Skipping benchmark execution.",
    );
    return null;
  }

  console.log(
    "[Benchmark] Setting up isolated disposable schema on PostgreSQL...",
  );
  const isolated: IsolatedDiscoveryDatabase =
    await createDiscoveryTestDatabase(testDbUrl);

  let server: Server | undefined;

  try {
    const environment = await isolated.pool.query<{ postgres_version: string }>(
      "SELECT version() AS postgres_version",
    );
    const migrationResult = await runSchemaMigrations(isolated.db);
    if (!migrationResult.success) {
      throw new Error("Failed to run schema migrations for benchmark.");
    }

    const refLat = -23.55052;
    const refLon = -46.633308;
    const bulkOwnerId = "10000000-0000-0000-0000-000000000099";

    console.log(
      "[Benchmark] Generating 10.000 deterministic synthetic barbershop records (Seed: 42)...",
    );

    await isolated.pool.query(`
      INSERT INTO users (id, name, email, password, cpf)
      VALUES ('${bulkOwnerId}', 'Benchmark Owner', 'benchmark.owner@example.com', 'pwd_hash', '99988877711')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO location_maintenance_health (component, is_healthy, last_heartbeat_at, details)
      VALUES ('google_maps_cache', true, now(), 'Benchmark Healthy State')
      ON CONFLICT (component) DO UPDATE
      SET is_healthy = true, last_heartbeat_at = now();
    `);

    // Deterministic batch population
    const rng = new DeterministicRng(42);
    const totalUnits = 10000;
    const batchSize = 1000;

    for (let batch = 0; batch < totalUnits / batchSize; batch++) {
      const shopValues: string[] = [];
      const locationValues: string[] = [];

      for (let i = 0; i < batchSize; i++) {
        const index = batch * batchSize + i + 1;
        const id = `88000000-0000-0000-0000-${String(index).padStart(12, "0")}`;
        const name = `Barbearia Sintetica ${index}`;
        const slug = `barbearia-sintetica-${index}`;
        const cnpj = `99${String(index).padStart(12, "0")}`;
        const address = `Rua Sintetica, ${index} - SP`;

        // Deterministic status & source distribution:
        // 9500 active confirmed manual
        // 300 inactive
        // 100 expired google
        // 100 unconfirmed
        let shopStatus = "ACTIVE";
        let locStatus = "CONFIRMED";
        let source = "MANUAL";
        let validUntilSql = "now() + interval '20 days'";
        let acquiredAtSql = "now() - interval '2 days'";
        let googlePlaceIdSql = "NULL";
        let latVal = String(refLat + (rng.next() - 0.5) * 1.5);
        let lonVal = String(refLon + (rng.next() - 0.5) * 1.5);

        if (index > 9500 && index <= 9800) {
          shopStatus = "INACTIVE";
        } else if (index > 9800 && index <= 9900) {
          source = "GOOGLE";
          googlePlaceIdSql = `'ChIJ_synthetic_place_${index}'`;
          acquiredAtSql = "now() - interval '30 days'";
          validUntilSql = "now() - interval '5 days'"; // Expired Google point
        } else if (index > 9900) {
          locStatus = "UNCONFIRMED";
          latVal = "NULL";
          lonVal = "NULL";
        }

        shopValues.push(
          `('${id}', '${name}', '${bulkOwnerId}', '${slug}', '${cnpj}', '${address}', '${shopStatus}')`,
        );
        locationValues.push(
          `('${id}', '${locStatus}', ${latVal}, ${lonVal}, '${source}', ${validUntilSql}, ${acquiredAtSql}, ${googlePlaceIdSql}, 1)`,
        );
      }

      await isolated.pool.query(`
        INSERT INTO barbershops (id, name, owner_id, slug, cnpj, location, status)
        VALUES ${shopValues.join(",\n")}
        ON CONFLICT (id) DO NOTHING;
      `);

      await isolated.pool.query(`
        INSERT INTO barbershop_locations (barbershop_id, status, latitude, longitude, source, valid_until, acquired_at, google_place_id, version)
        VALUES ${locationValues.join(",\n")}
        ON CONFLICT (barbershop_id) DO NOTHING;
      `);
    }

    console.log(
      "[Benchmark] 10.000 records inserted. Capturing real SQL queries from repository...",
    );
    const volume = await isolated.pool.query<{ total: number }>(
      "SELECT COUNT(*)::int AS total FROM barbershops",
    );
    const actualUnits = volume.rows[0].total;
    assert.equal(actualUnits, totalUnits);

    const dialect = new PgDialect();
    let countSqlPlan = "";
    let itemsSqlPlan = "";
    let lastCountTimeMs = 0;
    let lastItemsTimeMs = 0;
    let countQuery: { sql: string; params: unknown[] } | undefined;
    let itemsQuery: { sql: string; params: unknown[] } | undefined;

    // Instrument execute to intercept queries and measure timing + EXPLAIN
    const originalExecute = isolated.db.execute.bind(isolated.db);
    // biome-ignore lint/suspicious/noExplicitAny: instrumented query wrapper
    isolated.db.execute = (async (query: any) => {
      const compiled = dialect.sqlToQuery(query);
      const isCount = compiled.sql.includes("COUNT(");
      const isItems = compiled.sql.includes("AS distance_meters");
      const start = performance.now();
      const res = await originalExecute(query);
      const duration = performance.now() - start;

      if (isCount) {
        lastCountTimeMs = duration;
      } else if (isItems) {
        lastItemsTimeMs = duration;
      }

      // If we haven't captured EXPLAIN ANALYZE yet, run it on pool
      if (isCount && !countSqlPlan) {
        countQuery = { sql: compiled.sql, params: compiled.params };
        const explainRes = await isolated.pool.query(
          `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT) ${compiled.sql}`,
          compiled.params,
        );
        countSqlPlan = explainRes.rows
          .map((r: any) => r["QUERY PLAN"])
          .join("\n");
      } else if (isItems && !itemsSqlPlan) {
        itemsQuery = { sql: compiled.sql, params: compiled.params };
        const explainRes = await isolated.pool.query(
          `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT) ${compiled.sql}`,
          compiled.params,
        );
        itemsSqlPlan = explainRes.rows
          .map((r: any) => r["QUERY PLAN"])
          .join("\n");
      }

      return res;
    }) as any;

    const repo = new DrizzleDiscoveryRepository(isolated.db);

    // Warmup SQL (3 iterations)
    console.log("[Benchmark] Executing 3 SQL warmup iterations...");
    for (let w = 0; w < 3; w++) {
      await repo.search({
        mode: "NEARBY",
        point: { latitude: refLat, longitude: refLon },
        radiusKm: 10,
        page: 1,
        limit: 20,
      });
    }

    // Measure SQL series (10 samples)
    console.log("[Benchmark] Measuring 10 SQL execution samples...");
    const samples: BenchmarkTimingSample[] = [];
    let expectedPage: DiscoveryPage | undefined;

    for (let iter = 1; iter <= 10; iter++) {
      const searchStart = performance.now();
      const page = await repo.search({
        mode: "NEARBY",
        point: { latitude: refLat, longitude: refLon },
        radiusKm: 10,
        page: 1,
        limit: 20,
      });
      const repositoryTotal = performance.now() - searchStart;
      assert.equal(page.items.length, 20);
      assert.ok(page.total >= 20);
      expectedPage = page;

      samples.push({
        iteration: iter,
        sqlCountMs: lastCountTimeMs,
        sqlItemsMs: lastItemsTimeMs,
        sqlTotalMs: lastCountTimeMs + lastItemsTimeMs,
        repositoryTotalMs: repositoryTotal,
        httpTotalMs: 0,
      });
    }

    // Setup HTTP Express server for E2E timing measurement
    console.log(
      "[Benchmark] Launching ephemeral Express server for HTTP measurement...",
    );
    const benchmarkApp = express();
    benchmarkApp.use(express.json());
    const useCase = new SearchBarbershopsUseCase(repo);
    const controller = new SearchNearbyBarbershopsController(useCase);
    benchmarkApp.post("/api/barbershops/nearby", adaptRoute(controller));

    server = benchmarkApp.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const addr = server.address();
    assert.ok(addr && typeof addr !== "string");
    const port = addr.port;
    assert.ok(expectedPage);
    const baseUrl = `http://127.0.0.1:${port}`;

    // Warmup HTTP (3 iterations)
    for (let w = 0; w < 3; w++) {
      const response = await fetch(`${baseUrl}/api/barbershops/nearby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: refLat,
          longitude: refLon,
          radiusKm: 10,
          limit: 20,
        }),
      });
      await readBenchmarkResponse(response, expectedPage);
    }

    // Measure HTTP series (10 samples)
    console.log("[Benchmark] Measuring 10 HTTP End-to-End samples...");
    for (let iter = 0; iter < 10; iter++) {
      const httpStart = performance.now();
      const res = await fetch(`${baseUrl}/api/barbershops/nearby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: refLat,
          longitude: refLon,
          radiusKm: 10,
          limit: 20,
        }),
      });
      await readBenchmarkResponse(res, expectedPage);
      const httpDuration = performance.now() - httpStart;
      samples[iter].httpTotalMs = httpDuration;
    }

    // Statistical aggregation helper
    const calcStats = (vals: number[]) => {
      const sorted = [...vals].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const sum = sorted.reduce((acc, v) => acc + v, 0);
      const mean = sum / sorted.length;
      const median =
        sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
      return { min, max, median, mean };
    };

    const sqlTotals = samples.map((s) => s.sqlTotalMs);
    const sqlCounts = samples.map((s) => s.sqlCountMs);
    const sqlItems = samples.map((s) => s.sqlItemsMs);
    const httpTotals = samples.map((s) => s.httpTotalMs);

    const sqlTotalStats = calcStats(sqlTotals);
    const sqlCountStats = calcStats(sqlCounts);
    const sqlItemsStats = calcStats(sqlItems);
    const httpStats = calcStats(httpTotals);
    const repositoryStats = calcStats(
      samples.map((sample) => sample.repositoryTotalMs),
    );

    return {
      totalUnits: actualUnits,
      environment: {
        postgres: environment.rows[0].postgres_version,
        platform: process.platform,
        arch: process.arch,
        node: process.version,
      },
      passed: meetsBenchmarkBudget(samples, actualUnits),
      queries: { count: countQuery, items: itemsQuery },
      samples,
      sqlCountPlan: countSqlPlan,
      sqlItemsPlan: itemsSqlPlan,
      sqlTotalStats,
      sqlCountStats,
      sqlItemsStats,
      httpStats,
      repositoryStats,
    };
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
    }
    await isolated.close();
  }
}
