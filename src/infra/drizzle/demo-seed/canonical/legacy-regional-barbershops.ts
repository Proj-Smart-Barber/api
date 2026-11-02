import type { DemoBarbershopFixture } from "./types";

/** Previous local regional fixtures, preserved as reference; not the active seed set. */
export const LEGACY_REGIONAL_BARBERSHOPS: DemoBarbershopFixture[] = [
  // ── Centro ───────────────────────────────────────────────
  {
    logicalKey: "horizonte:barbershop",
    name: "Barbearia Horizonte — Demonstração",
    ownerLogicalKey: "horizonte:staff:wellington",
    slug: "barbearia-horizonte-demo",
    cnpj: "11222333000144",
    location: "Rua 24 de Maio, 109 - República, São Paulo - SP, 01041-001",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },

  // ── Região Leste de São Paulo ────────────────────────────
  {
    logicalKey: "estacao:barbershop",
    name: "Barbearia Estação Mooca — Demonstração",
    ownerLogicalKey: "estacao:staff:alvaro",
    slug: "barbearia-estacao-demo",
    cnpj: "55666777000188",
    location:
      "Rua Visconde de Parnaíba, 1316 - Mooca, São Paulo - SP, 03164-300",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },
  {
    logicalKey: "juventus:barbershop",
    name: "Barbearia Juventus Mooca — Demonstração",
    ownerLogicalKey: "estacao:staff:alvaro",
    slug: "barbearia-juventus-mooca-demo",
    cnpj: "55666777000269",
    location: "Rua Juventus, 600 - Parque da Mooca, São Paulo - SP, 03124-020",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },
  {
    logicalKey: "tatuape:barbershop",
    name: "Barbearia Tatuapé Prime — Demonstração",
    ownerLogicalKey: "estacao:staff:alvaro",
    slug: "barbearia-tatuape-prime-demo",
    cnpj: "55666777000340",
    location: "Praça Sílvio Romero, 150 - Tatuapé, São Paulo - SP, 03323-000",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },
  {
    logicalKey: "belem:barbershop",
    name: "Barbearia Sesc Belenzinho — Demonstração",
    ownerLogicalKey: "estacao:staff:alvaro",
    slug: "barbearia-sesc-belenzinho-demo",
    cnpj: "55666777000420",
    location: "Rua Padre Adelino, 1000 - Belenzinho, São Paulo - SP, 03303-000",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },
  {
    logicalKey: "analiafranco:barbershop",
    name: "Barbearia Jardim Anália Franco — Demonstração",
    ownerLogicalKey: "estacao:staff:alvaro",
    slug: "barbearia-analia-franco-demo",
    cnpj: "55666777000501",
    location:
      "Avenida Regente Feijó, 1739 - Tatuapé, São Paulo - SP, 03342-000",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },
  {
    logicalKey: "penha:barbershop",
    name: "Barbearia Penha Tradicional — Demonstração",
    ownerLogicalKey: "estacao:staff:alvaro",
    slug: "barbearia-penha-tradicional-demo",
    cnpj: "55666777000692",
    location:
      "Praça Nossa Senhora da Penha, 100 - Penha de França, São Paulo - SP, 03632-010",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },
  {
    logicalKey: "vilaprudente:barbershop",
    name: "Barbearia Vila Prudente — Demonstração",
    ownerLogicalKey: "estacao:staff:alvaro",
    slug: "barbearia-vila-prudente-demo",
    cnpj: "55666777000773",
    location: "Rua do Orfanato, 500 - Vila Prudente, São Paulo - SP, 03131-010",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },
  {
    logicalKey: "itaquera:barbershop",
    name: "Barbearia Arena Itaquera — Demonstração",
    ownerLogicalKey: "estacao:staff:alvaro",
    slug: "barbearia-arena-itaquera-demo",
    cnpj: "55666777000854",
    location:
      "Avenida Miguel Ignácio Curi, 111 - Itaquera, São Paulo - SP, 08295-005",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },
  {
    logicalKey: "saomiguel:barbershop",
    name: "Barbearia São Miguel Arcanjo — Demonstração",
    ownerLogicalKey: "estacao:staff:alvaro",
    slug: "barbearia-sao-miguel-demo",
    cnpj: "55666777000935",
    location:
      "Praça Padre Aleixo Monteiro Mafra, 1 - São Miguel Paulista, São Paulo - SP, 08011-010",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },

  // ── Demais Regiões de São Paulo ───────────────────────────
  {
    logicalKey: "norte:barbershop",
    name: "Barbearia Santana — Demonstração",
    ownerLogicalKey: "horizonte:staff:wellington",
    slug: "barbearia-santana-demo",
    cnpj: "11222333000225",
    location:
      "Avenida Luiz Dumont Villares, 579 - Santana, São Paulo - SP, 02085-100",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },
  {
    logicalKey: "sul:barbershop",
    name: "Barbearia Santo Amaro — Demonstração",
    ownerLogicalKey: "horizonte:staff:wellington",
    slug: "barbearia-santo-amaro-demo",
    cnpj: "11222333000306",
    location: "Rua Amador Bueno, 505 - Santo Amaro, São Paulo - SP, 04752-005",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },
  {
    logicalKey: "oeste:barbershop",
    name: "Barbearia Pompeia — Demonstração",
    ownerLogicalKey: "horizonte:staff:wellington",
    slug: "barbearia-pompeia-demo",
    cnpj: "11222333000497",
    location: "Rua Clélia, 93 - Pompeia, São Paulo - SP, 05042-000",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },
];
