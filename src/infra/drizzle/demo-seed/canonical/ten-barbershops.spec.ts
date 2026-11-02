import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { DEMO_MEDIA_BRANDS } from "./barbershop-fixtures";
import { describe, expect, it } from "vitest";
import {
  DEMO_BARBERSHOPS,
  DEMO_SERVICES,
  DEMO_STAFFS,
  buildDemoMemberships,
  buildDemoSchedules,
} from "./fixtures";
const brandNames = [
  "Horizonte",
  "Estação",
  "Santana",
  "Santo Amaro",
  "Pompeia",
  "Aurora",
  "Vértice",
  "Raiz",
  "Órbita",
  "Nexo",
];
describe("ten demonstration barbershops", () => {
  it("contains exactly the ten received brands", () => {
    expect(DEMO_BARBERSHOPS).toHaveLength(10);
    for (const name of brandNames)
      expect(DEMO_BARBERSHOPS.some((s) => s.name.includes(name))).toBe(true);
  });
  it("keeps original identity keys and unique new keys", () => {
    for (const key of ["horizonte", "estacao", "norte", "sul", "oeste"])
      expect(
        DEMO_BARBERSHOPS.some((s) => s.logicalKey === `${key}:barbershop`),
      ).toBe(true);
    for (const field of ["logicalKey", "slug", "cnpj"] as const)
      expect(new Set(DEMO_BARBERSHOPS.map((s) => s[field])).size).toBe(10);
  });
  it("provides an existing owner, services and schedules for each shop", () => {
    const owners = new Set(DEMO_STAFFS.map((s) => s.logicalKey));
    const members = buildDemoMemberships();
    const schedules = buildDemoSchedules();
    for (const shop of DEMO_BARBERSHOPS) {
      expect(owners.has(shop.ownerLogicalKey)).toBe(true);
      expect(
        members.some(
          (m) =>
            m.barbershopLogicalKey === shop.logicalKey &&
            m.staffLogicalKey === shop.ownerLogicalKey &&
            m.role === "OWNER",
        ),
      ).toBe(true);
      expect(
        DEMO_SERVICES.some(
          (s) => s.barbershopLogicalKey === shop.logicalKey && s.isActive,
        ),
      ).toBe(true);
      expect(
        schedules.some((s) => s.barbershopLogicalKey === shop.logicalKey),
      ).toBe(true);
    }
  });
  it("does not retain removed regional units in generated relationships", () => {
    const keys = new Set(DEMO_BARBERSHOPS.map((s) => s.logicalKey));
    for (const row of [
      ...DEMO_SERVICES,
      ...buildDemoMemberships(),
      ...buildDemoSchedules(),
    ])
      expect(keys.has(row.barbershopLogicalKey)).toBe(true);
  });
  it("provides a scheduled barber in every unit", () => {
    const members = buildDemoMemberships();
    const schedules = buildDemoSchedules();
    for (const shop of DEMO_BARBERSHOPS) {
      const barbers = members.filter(
        (m) =>
          m.barbershopLogicalKey === shop.logicalKey && m.role === "BARBERMAN",
      );
      expect(barbers.length).toBeGreaterThan(0);
      expect(
        barbers.some((m) =>
          schedules.some(
            (s) =>
              s.barbershopLogicalKey === shop.logicalKey &&
              s.barbermanLogicalKey === m.staffLogicalKey,
          ),
        ),
      ).toBe(true);
    }
  });
  it("maps ten media brands to stable seed identities without activating unapproved media", () => {
    const manifest = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "docs/seed-media/manifesto-10-barbearias.json"),
        "utf8",
      ),
    );
    expect(manifest.status).toBe("LOCAL_REFERENCE_NOT_UPLOAD_OR_DB_IMPORT");
    expect(manifest.barbershops).toHaveLength(10);
    expect(DEMO_MEDIA_BRANDS).toHaveLength(10);
    const keys = new Set(DEMO_BARBERSHOPS.map((shop) => shop.logicalKey));
    for (const brand of manifest.barbershops)
      expect(keys.has(brand.barbershopLogicalKey)).toBe(true);
    const photos = manifest.barbershops.flatMap(
      (shop: { photos: { assetId: string }[] }) => shop.photos,
    );
    expect(photos).toHaveLength(100);
    expect(
      new Set(photos.map((photo: { assetId: string }) => photo.assetId)).size,
    ).toBe(100);
    const nexo = manifest.barbershops.find(
      (shop: { mediaKey: string }) => shop.mediaKey === "nexo",
    );
    expect(
      nexo.photos.some(
        (photo: { assetId: string; rightsStatus: string }) =>
          photo.assetId === "USER-NEXO-003" &&
          photo.rightsStatus === "UNKNOWN_SOURCE_NOT_APPROVED",
      ),
    ).toBe(true);
  });
});
