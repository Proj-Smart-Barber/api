import { describe, expect, it } from "vitest";
import { SAO_PAULO_DISTRICT_CENTROIDS } from "../district-centroids";
import {
  buildFullDemoSeedFixtures,
  FULL_DEMO_PROFILE_COUNTS,
  standardizeDemoServicePrice,
} from "./full-profile-fixtures";

describe("full regional demo seed profile", () => {
  it.each([
    [5664, 5690],
    [5695, 5699],
    [5601, 5600],
    [5600, 5600],
  ])("rounds %i cents to an allowed price ending in %i", (input, expected) => {
    expect(standardizeDemoServicePrice(input)).toBe(expected);
  });

  it("builds a deterministic tenfold barbershop catalog with all districts", () => {
    const first = buildFullDemoSeedFixtures();
    const second = buildFullDemoSeedFixtures();

    expect(first.barbershops).toHaveLength(100);
    expect(first.barbershops).toEqual(second.barbershops);
    expect(first.bookings).toEqual(second.bookings);
    expect(SAO_PAULO_DISTRICT_CENTROIDS).toHaveLength(96);
    expect(
      new Set(SAO_PAULO_DISTRICT_CENTROIDS.map(({ name }) => name)).size,
    ).toBe(96);
    for (const district of SAO_PAULO_DISTRICT_CENTROIDS) {
      expect(district.point.latitude).toBeGreaterThan(-24);
      expect(district.point.latitude).toBeLessThan(-23.3);
      expect(district.point.longitude).toBeGreaterThan(-46.9);
      expect(district.point.longitude).toBeLessThan(-46.3);
    }

    const coveredDistricts = new Set(
      first.barbershops
        .filter((shop) => shop.logicalKey.startsWith("scale-"))
        .map((shop) => shop.location.split(",")[0]),
    );
    expect(coveredDistricts.size).toBe(88);
  });

  it("hits every zone and creates a large relational workload", () => {
    const fixtures = buildFullDemoSeedFixtures();
    const regionCounts = new Map<string, number>();
    for (const shop of fixtures.barbershops) {
      if (shop.region)
        regionCounts.set(shop.region, (regionCounts.get(shop.region) ?? 0) + 1);
    }

    for (const region of ["CENTRO", "LESTE", "NORTE", "SUL", "OESTE"]) {
      expect(regionCounts.get(region)).toBeGreaterThan(0);
    }
    expect(Object.fromEntries(regionCounts)).toEqual({
      CENTRO: 8,
      LESTE: 36,
      NORTE: 18,
      SUL: 23,
      OESTE: 15,
    });
    expect(fixtures.staffs).toHaveLength(466);
    expect(fixtures.customers).toHaveLength(1_012);
    expect(fixtures.services).toHaveLength(962);
    expect(
      fixtures.services.every((service) =>
        [0, 90, 99].includes(service.priceInCents % 100),
      ),
    ).toBe(true);
    expect(fixtures.memberships).toHaveLength(474);
    expect(fixtures.schedules).toHaveLength(2_845);
    expect(fixtures.exceptions).toHaveLength(186);
    expect(fixtures.bookings).toHaveLength(22_520);
    expect(FULL_DEMO_PROFILE_COUNTS.generatedBookingsPerBarbershop).toBe(250);
  });

  it("offers one owner, barber, and customer login using test-only domains", () => {
    const fixtures = buildFullDemoSeedFixtures();
    expect(fixtures.staffs).toContainEqual(
      expect.objectContaining({
        email: "qa.owner@demo.smartbarber.test",
        role: "OWNER",
      }),
    );
    expect(fixtures.staffs).toContainEqual(
      expect.objectContaining({
        email: "qa.barber@demo.smartbarber.test",
        role: "BARBERMAN",
      }),
    );
    expect(fixtures.customers).toContainEqual(
      expect.objectContaining({ email: "qa.client@demo.smartbarber.test" }),
    );
  });

  it("keeps every booking linked to its shop service, staff, and customer", () => {
    const fixtures = buildFullDemoSeedFixtures();
    const shops = new Set(fixtures.barbershops.map((shop) => shop.logicalKey));
    const staff = new Set(fixtures.staffs.map((person) => person.logicalKey));
    const customers = new Set(
      fixtures.customers.map((person) => person.logicalKey),
    );
    const shopServices = new Map<string, Set<string>>();
    for (const service of fixtures.services) {
      const services =
        shopServices.get(service.barbershopLogicalKey) ?? new Set<string>();
      services.add(service.logicalKey);
      shopServices.set(service.barbershopLogicalKey, services);
    }

    for (const booking of fixtures.bookings) {
      expect(shops.has(booking.barbershopLogicalKey)).toBe(true);
      expect(staff.has(booking.barbermanLogicalKey)).toBe(true);
      expect(customers.has(booking.customerLogicalKey)).toBe(true);
      expect(
        shopServices
          .get(booking.barbershopLogicalKey)
          ?.has(booking.serviceLogicalKey),
      ).toBe(true);
      expect(["CONFIRMED", "CANCELLED", "COMPLETED"]).toContain(
        booking.status ?? "CONFIRMED",
      );
    }
  });
});
