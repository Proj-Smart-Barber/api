import { DEMO_REGIONAL_LOCATIONS } from "../regional-locations";
import type { DemoBarbershopFixture } from "./types";
import { LEGACY_REGIONAL_BARBERSHOPS } from "./legacy-regional-barbershops";
const retainedKeys = new Set([
  "horizonte:barbershop",
  "estacao:barbershop",
  "norte:barbershop",
  "sul:barbershop",
  "oeste:barbershop",
]);
const additions = [
  {
    key: "aurora",
    name: "Aurora",
    reference: "tatuape:barbershop",
    cnpj: "99000004000137",
  },
  {
    key: "vertice",
    name: "Vértice",
    reference: "vilaprudente:barbershop",
    cnpj: "99000005000181",
  },
  {
    key: "raiz",
    name: "Raiz",
    reference: "penha:barbershop",
    cnpj: "99000006000126",
  },
  {
    key: "orbita",
    name: "Órbita",
    reference: "analiafranco:barbershop",
    cnpj: "99000007000170",
  },
  {
    key: "nexo",
    name: "Nexo",
    reference: "juventus:barbershop",
    cnpj: "99000008000115",
  },
] as const;
/** Keep stable identities for the five existing brands; new brands receive new keys and tax fixtures. */
const regionalPoints: Record<string, { latitude: number; longitude: number }> =
  {
    "horizonte:barbershop": DEMO_REGIONAL_LOCATIONS.horizonte.point,
    "estacao:barbershop": DEMO_REGIONAL_LOCATIONS.estacao.point,
    "norte:barbershop": DEMO_REGIONAL_LOCATIONS.norte.point,
    "sul:barbershop": DEMO_REGIONAL_LOCATIONS.sul.point,
    "oeste:barbershop": DEMO_REGIONAL_LOCATIONS.oeste.point,
  };
const regionalZones: Record<string, DemoBarbershopFixture["region"]> = {
  "horizonte:barbershop": "CENTRO",
  "estacao:barbershop": "LESTE",
  "norte:barbershop": "NORTE",
  "sul:barbershop": "SUL",
  "oeste:barbershop": "OESTE",
};

export const DEMO_BARBERSHOPS: DemoBarbershopFixture[] = [
  ...LEGACY_REGIONAL_BARBERSHOPS.filter((shop) =>
    retainedKeys.has(shop.logicalKey),
  ).map((shop) => ({
    ...shop,
    point: regionalPoints[shop.logicalKey],
    region: regionalZones[shop.logicalKey],
  })),
  ...additions.map((brand) => {
    const reference = LEGACY_REGIONAL_BARBERSHOPS.find(
      (shop) => shop.logicalKey === brand.reference,
    );
    if (!reference)
      throw new Error(`Missing regional demo reference: ${brand.reference}`);
    return {
      ...reference,
      logicalKey: `${brand.key}:barbershop`,
      name: `Barbearia ${brand.name} — Demonstração`,
      slug: `barbearia-${brand.key}-demo`,
      cnpj: brand.cnpj,
      region: "LESTE" as const,
    };
  }),
];
export const DEMO_MEDIA_BRANDS = [
  { mediaKey: "horizonte", barbershopLogicalKey: "horizonte:barbershop" },
  { mediaKey: "estacao", barbershopLogicalKey: "estacao:barbershop" },
  { mediaKey: "santana", barbershopLogicalKey: "norte:barbershop" },
  { mediaKey: "santo-amaro", barbershopLogicalKey: "sul:barbershop" },
  { mediaKey: "pompeia", barbershopLogicalKey: "oeste:barbershop" },
  ...additions.map((brand) => ({
    mediaKey: brand.key,
    barbershopLogicalKey: `${brand.key}:barbershop`,
  })),
] as const;
