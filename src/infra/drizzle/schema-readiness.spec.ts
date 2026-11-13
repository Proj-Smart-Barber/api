import { describe, expect, it, vi } from "vitest";
import { createSchemaReadinessCheck } from "./schema-readiness";

describe("schema readiness", () => {
  it("recovers after a failed cold-start check without bypassing the guard", async () => {
    let time = 0;
    const check = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue(true);
    const ready = createSchemaReadinessCheck(check, 2000, () => time);
    expect(await ready()).toBe(false);
    expect(await ready()).toBe(false);
    expect(check).toHaveBeenCalledTimes(1);
    time = 2000;
    expect(await ready()).toBe(true);
    expect(await ready()).toBe(true);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("shares concurrent probes and continues blocking an incompatible schema", async () => {
    const check = vi.fn().mockResolvedValue(false);
    const ready = createSchemaReadinessCheck(check);
    expect(await Promise.all([ready(), ready(), ready()])).toEqual([
      false,
      false,
      false,
    ]);
    expect(check).toHaveBeenCalledTimes(1);
  });
});
