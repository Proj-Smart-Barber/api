import { describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({ pool: vi.fn() }));
vi.mock("pg", () => ({ Pool: guard.pool, default: { Pool: guard.pool } }));

import {
  createPhase1TestDatabase,
  validatePhase1TestUrl,
} from "./isolated-phase1-db";

describe("Phase 1 database guard", () => {
  it("accepts an explicit dedicated local target", () => {
    expect(
      validatePhase1TestUrl(
        "postgresql://test:test@127.0.0.1:5433/sb_phase1_test_example",
      ).pathname,
    ).toBe("/sb_phase1_test_example");
  });

  it.each([
    "postgresql://test:test@remote.example.test/sb_phase1_test_example",
    "postgresql://test:test@127.0.0.1:5433/smartbarber",
    "postgresql://test:test@127.0.0.1:5433/postgres",
    "postgresql://test:test@127.0.0.1:5433/sb_phase1_test_example?options=unsafe",
    "postgresql://test:test@127.0.0.1:5433/sb_phase1_test_example#unsafe",
  ])("rejects an unsafe target before creating a connection", async (value) => {
    guard.pool.mockClear();
    await expect(createPhase1TestDatabase(value)).rejects.toThrow();
    expect(guard.pool).not.toHaveBeenCalled();
  });
});
