import type { DemoRegionalLocation } from "./types";

// Public reference points for fictional demo shops; these venues are not barbershops.
// Coordinates: Wikidata (CC0), checked 2026-10-21. Address sources are recorded per fixture.
export const DEMO_REGIONAL_LOCATIONS = {
  horizonte: {
    region: "CENTRO",
    location: "Rua 24 de Maio, 109 - República, São Paulo - SP, 01041-001",
    point: { latitude: -23.54422222222222, longitude: -46.640055555555556 },
    referenceName: "Sesc 24 de Maio",
    addressSourceUrl:
      "https://portal.sescsp.org.br/unidades/36_24%2BDE%2BMAIO/",
    coordinateSourceUrl: "https://www.wikidata.org/wiki/Q55154350",
  },
  estacao: {
    region: "LESTE",
    location:
      "Rua Visconde de Parnaíba, 1316 - Mooca, São Paulo - SP, 03164-300",
    point: { latitude: -23.549166666667, longitude: -46.613055555556 },
    referenceName: "Museu da Imigração do Estado de São Paulo",
    addressSourceUrl: "https://museudaimigracao.org.br/",
    coordinateSourceUrl: "https://www.wikidata.org/wiki/Q3854482",
  },
  norte: {
    region: "NORTE",
    location:
      "Avenida Luiz Dumont Villares, 579 - Santana, São Paulo - SP, 02085-100",
    point: { latitude: -23.496583333333, longitude: -46.612722222222 },
    referenceName: "Sesc Santana",
    addressSourceUrl: "https://www.sescsp.org.br/editorial/servicos-santana/",
    coordinateSourceUrl: "https://www.wikidata.org/wiki/Q10366512",
  },
  sul: {
    region: "SUL",
    location: "Rua Amador Bueno, 505 - Santo Amaro, São Paulo - SP, 04752-005",
    point: { latitude: -23.653111111111112, longitude: -46.712833333333336 },
    referenceName: "Sesc Santo Amaro",
    addressSourceUrl: "https://www.sescsp.org.br/unidades/santo-amaro/servicos",
    coordinateSourceUrl: "https://www.wikidata.org/wiki/Q28680384",
  },
  oeste: {
    region: "OESTE",
    location: "Rua Clélia, 93 - Pompeia, São Paulo - SP, 05042-000",
    point: { latitude: -23.52580556, longitude: -46.68299167 },
    referenceName: "Sesc Pompeia",
    addressSourceUrl: "https://anexa.sescsp.org.br/contato/",
    coordinateSourceUrl: "https://www.wikidata.org/wiki/Q645190",
  },
} satisfies Record<string, DemoRegionalLocation>;
