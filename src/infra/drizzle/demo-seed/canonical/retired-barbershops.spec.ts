import { describe, expect, it } from "vitest";
import { LEGACY_REGIONAL_BARBERSHOPS } from "./legacy-regional-barbershops";
import { DEMO_BARBERSHOPS } from "./barbershop-fixtures";
import {
  planRetiredBarbershops,
  type RegisteredBarbershop,
} from "./retired-barbershops";
import { DEMO_SEED_NAMESPACE, type SeedRegistryRecord } from "./types";

function scenario() {
  const fixture = LEGACY_REGIONAL_BARBERSHOPS.find(
    (shop) => shop.logicalKey === "juventus:barbershop",
  );
  if (!fixture) throw new Error("Missing legacy fixture");
  const entry: SeedRegistryRecord = {
    id: "registry",
    namespace: DEMO_SEED_NAMESPACE,
    logicalKey: fixture.logicalKey,
    tableName: "barbershops",
    recordId: "shop-id",
    createdAt: new Date(),
  };
  const owner: SeedRegistryRecord = {
    ...entry,
    id: "owner-registry",
    logicalKey: fixture.ownerLogicalKey,
    tableName: "users",
    recordId: "owner-id",
  };
  const row: RegisteredBarbershop = {
    id: "shop-id",
    ownerId: "owner-id",
    slug: fixture.slug,
    cnpj: fixture.cnpj,
    status: "ACTIVE",
  };
  return {
    row,
    entry,
    namespace: DEMO_SEED_NAMESPACE,
    previous: [fixture],
    current: DEMO_BARBERSHOPS,
    registry: new Map([
      [fixture.logicalKey, entry],
      [fixture.ownerLogicalKey, owner],
    ]),
    rows: new Map([[row.id, row]]),
  };
}
describe("scoped retirement without deleting history", () => {
  it("plans only registered former units and does not mutate rows", () => {
    const input = scenario();
    expect(planRetiredBarbershops(input).map((row) => row.id)).toEqual([
      "shop-id",
    ]);
    expect(input.rows.get("shop-id")?.status).toBe("ACTIVE");
  });
  it("ignores unregistered units", () => {
    const input = scenario();
    input.registry.clear();
    expect(planRetiredBarbershops(input)).toEqual([]);
  });
  it("ignores units already inactive", () => {
    const input = scenario();
    input.row.status = "INACTIVE";
    expect(planRetiredBarbershops(input)).toEqual([]);
  });
  it("rejects a foreign owner", () => {
    const input = scenario();
    input.row.ownerId = "unrelated";
    expect(() => planRetiredBarbershops(input)).toThrow(
      "Conflicting legacy demo identity",
    );
  });
  it("rejects a foreign namespace", () => {
    const input = scenario();
    input.entry.namespace = "other";
    expect(() => planRetiredBarbershops(input)).toThrow(
      "Conflicting legacy demo identity",
    );
  });
  it("rejects a changed identity", () => {
    const input = scenario();
    input.row.slug = "human-edit";
    expect(() => planRetiredBarbershops(input)).toThrow(
      "Conflicting legacy demo identity",
    );
  });
});
