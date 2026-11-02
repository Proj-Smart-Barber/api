import type { DemoBarbershopFixture, SeedRegistryRecord } from "./types";

export interface RegisteredBarbershop {
  id: string;
  ownerId: string;
  slug: string;
  cnpj: string;
  status: "ACTIVE" | "INACTIVE";
}

/** Only an exact namespace, identity and ownership match can become a retirement candidate. */
export function planRetiredBarbershops(input: {
  namespace: string;
  previous: DemoBarbershopFixture[];
  current: DemoBarbershopFixture[];
  registry: Map<string, SeedRegistryRecord>;
  rows: Map<string, RegisteredBarbershop>;
}): RegisteredBarbershop[] {
  const currentKeys = new Set(input.current.map((shop) => shop.logicalKey));
  const planned: RegisteredBarbershop[] = [];
  for (const fixture of input.previous) {
    if (currentKeys.has(fixture.logicalKey)) continue;
    const registration = input.registry.get(fixture.logicalKey);
    if (!registration) continue;
    const owner = input.registry.get(fixture.ownerLogicalKey);
    const row = input.rows.get(registration.recordId);
    if (
      registration.namespace !== input.namespace ||
      registration.tableName !== "barbershops" ||
      !owner ||
      owner.namespace !== input.namespace ||
      owner.tableName !== "users" ||
      !row ||
      row.id !== registration.recordId ||
      row.ownerId !== owner.recordId ||
      row.slug !== fixture.slug ||
      row.cnpj !== fixture.cnpj
    ) {
      throw new Error(
        `Conflicting legacy demo identity: ${fixture.logicalKey}`,
      );
    }
    if (row.status === "ACTIVE") planned.push(row);
  }
  return planned;
}
