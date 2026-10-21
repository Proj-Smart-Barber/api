import { describe, expect, it } from "vitest";
import {
  DEMO_BARBERSHOPS,
  DEMO_SERVICES,
  DEMO_STAFFS,
  buildDemoMemberships,
  buildDemoSchedules,
} from "./fixtures";

describe("São Paulo regional demo fixtures", () => {
  it("covers Centro, Norte, Sul, Leste and Oeste with complete public reference addresses", () => {
    expect(DEMO_BARBERSHOPS).toHaveLength(5);
    expect(new Set(DEMO_BARBERSHOPS.map((shop) => shop.region))).toEqual(
      new Set(["CENTRO", "NORTE", "SUL", "LESTE", "OESTE"]),
    );
    for (const shop of DEMO_BARBERSHOPS) {
      expect(shop.location).toMatch(/, \d+ - .+, São Paulo - SP, \d{5}-\d{3}$/);
      expect(shop.name).toContain("Demonstração");
      expect(shop.referenceName).toBeTruthy();
      expect(shop.coordinateSourceUrl).toMatch(
        /^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/,
      );
      expect(shop.point.latitude).toBeGreaterThan(-23.9);
      expect(shop.point.latitude).toBeLessThan(-23.3);
      expect(shop.point.longitude).toBeGreaterThan(-46.9);
      expect(shop.point.longitude).toBeLessThan(-46.3);
    }
    expect(new Set(DEMO_BARBERSHOPS.map((shop) => shop.cnpj)).size).toBe(5);
    expect(
      new Set(DEMO_BARBERSHOPS.map((shop) => JSON.stringify(shop.point))).size,
    ).toBe(5);
  });

  it("keeps the original identities and provides membership, service and schedule for every region", () => {
    expect(DEMO_STAFFS).toHaveLength(8);
    const memberships = buildDemoMemberships();
    expect(memberships).toHaveLength(11);
    expect(new Set(memberships.map((member) => member.logicalKey)).size).toBe(
      11,
    );
    const schedules = buildDemoSchedules();
    for (const shop of DEMO_BARBERSHOPS) {
      expect(
        memberships.some(
          (member) =>
            member.barbershopLogicalKey === shop.logicalKey &&
            member.staffLogicalKey === shop.ownerLogicalKey &&
            member.role === "OWNER",
        ),
      ).toBe(true);
      expect(
        DEMO_SERVICES.some(
          (service) =>
            service.barbershopLogicalKey === shop.logicalKey &&
            service.isActive,
        ),
      ).toBe(true);
      expect(
        schedules.some(
          (schedule) =>
            schedule.barbershopLogicalKey === shop.logicalKey &&
            !schedule.barbermanLogicalKey,
        ),
      ).toBe(true);
    }
  });
});
