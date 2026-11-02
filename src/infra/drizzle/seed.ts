import { Password } from "../../domain/enterprise/entities/value-objects/password";
import { db } from "./index";
import {
  barbershopSchedules,
  barbershops,
  bookings,
  users,
  membership,
  notifications,
  scheduleExceptions,
  serviceItems,
  services,
  shoppingCarts,
} from "./schema";
import { eq, inArray } from "drizzle-orm";

interface CanonicalShopData {
  slug: string;
  name: string;
  cnpj: string;
  location: string;
  avatarUrl: string;
  coverUrl: string;
  latitude: number;
  longitude: number;
  ownerLogical: "centro" | "leste";
  featuredServices: Array<{
    title: string;
    description: string;
    priceInCents: number;
    durationInMinutes: number;
    imageUrl: string;
    featuredOrder: number;
  }>;
}

const STATIC_URL_BASE = "http://192.168.18.56:3333/static-media";

const CANONICAL_SHOPS: CanonicalShopData[] = [
  {
    slug: "barbearia-horizonte-demo",
    name: "Barbearia Horizonte — Demonstração",
    cnpj: "11222333000144",
    location: "Rua 24 de Maio, 109 - República, São Paulo - SP, 01041-001",
    avatarUrl: `${STATIC_URL_BASE}/barbearias/horizonte/logos/horizonte-symbol-original.png`,
    coverUrl: `${STATIC_URL_BASE}/barbearias/horizonte/fotos-propostas/ambiente/PXS-7518728.jpg`,
    latitude: -23.544222222222,
    longitude: -46.640055555555,
    ownerLogical: "centro",
    featuredServices: [
      {
        title: "Degradê na Máquina",
        description: "Degradê moderno e suave com finalização na lâmina.",
        priceInCents: 5000,
        durationInMinutes: 35,
        imageUrl: `${STATIC_URL_BASE}/barbearias/horizonte/fotos-propostas/servicos/PXS-19050581.jpg`,
        featuredOrder: 1,
      },
      {
        title: "Corte Clássico na Tesoura",
        description: "Corte elegante na tesoura para visual refinado.",
        priceInCents: 4500,
        durationInMinutes: 30,
        imageUrl: `${STATIC_URL_BASE}/barbearias/horizonte/fotos-propostas/servicos/PXS-8867540.jpg`,
        featuredOrder: 2,
      },
      {
        title: "Barba Completa Alinhada",
        description: "Desenho e alinhamento de barba com óleo hidratante.",
        priceInCents: 4000,
        durationInMinutes: 25,
        imageUrl: `${STATIC_URL_BASE}/barbearias/horizonte/fotos-propostas/servicos/PXS-11139534.jpg`,
        featuredOrder: 3,
      },
      {
        title: "Acabamento e Pezinho",
        description: "Alinhamento preciso de nuca, costeletas e testa.",
        priceInCents: 2500,
        durationInMinutes: 15,
        imageUrl: `${STATIC_URL_BASE}/barbearias/horizonte/fotos-propostas/servicos/PXS-7697380.jpg`,
        featuredOrder: 4,
      },
    ],
  },
  {
    slug: "barbearia-estacao-demo",
    name: "Barbearia Estação — Demonstração",
    cnpj: "55666777000188",
    location: "Rua Visconde de Parnaíba, 1316 - Mooca, São Paulo - SP, 03164-300",
    avatarUrl: `${STATIC_URL_BASE}/barbearias/estacao/logos/estacao-symbol-original.png`,
    coverUrl: `${STATIC_URL_BASE}/barbearias/estacao/fotos-propostas/ambiente/PXS-2061820.jpg`,
    latitude: -23.549166666667,
    longitude: -46.613055555556,
    ownerLogical: "leste",
    featuredServices: [
      {
        title: "Degradê Navalhado",
        description: "Degradê sombreado com acabamento navalhado de alta precisão.",
        priceInCents: 6000,
        durationInMinutes: 45,
        imageUrl: `${STATIC_URL_BASE}/barbearias/estacao/fotos-propostas/servicos/PXS-11139533.jpg`,
        featuredOrder: 1,
      },
      {
        title: "Barba Express Alinhada",
        description: "Aparo rápido e contorno higiênico da barba.",
        priceInCents: 3500,
        durationInMinutes: 20,
        imageUrl: `${STATIC_URL_BASE}/barbearias/estacao/fotos-propostas/servicos/PXS-7447138.jpg`,
        featuredOrder: 2,
      },
      {
        title: "Corte Social Mooca",
        description: "Corte limpo e alinhado para o dia a dia executivo.",
        priceInCents: 5000,
        durationInMinutes: 35,
        imageUrl: `${STATIC_URL_BASE}/barbearias/estacao/fotos-propostas/servicos/PXS-5853392.jpg`,
        featuredOrder: 3,
      },
      {
        title: "Corte + Barba Completo",
        description: "Atendimento completo com corte social e barba alinhada.",
        priceInCents: 8500,
        durationInMinutes: 60,
        imageUrl: `${STATIC_URL_BASE}/barbearias/estacao/fotos-propostas/servicos/PXS-7518731.jpg`,
        featuredOrder: 4,
      },
    ],
  },
  {
    slug: "barbearia-norte-demo",
    name: "Barbearia Santana — Demonstração",
    cnpj: "99000001000101",
    location: "Avenida Luiz Dumont Villares, 579 - Santana, São Paulo - SP, 02085-100",
    avatarUrl: `${STATIC_URL_BASE}/barbearias/santana/logos/santana-symbol-original.png`,
    coverUrl: `${STATIC_URL_BASE}/barbearias/santana/fotos-propostas/ambiente/PXS-17665771.jpg`,
    latitude: -23.496583333333,
    longitude: -46.612722222222,
    ownerLogical: "centro",
    featuredServices: [
      {
        title: "Corte Executivo Santana",
        description: "Corte sofisticado com tesoura e modelagem refinada.",
        priceInCents: 5000,
        durationInMinutes: 35,
        imageUrl: `${STATIC_URL_BASE}/barbearias/santana/fotos-propostas/servicos/PXS-7697383.jpg`,
        featuredOrder: 1,
      },
      {
        title: "Degradê na Zero Alta",
        description: "Transição suave com lâmina e pente zero alto.",
        priceInCents: 5500,
        durationInMinutes: 40,
        imageUrl: `${STATIC_URL_BASE}/barbearias/santana/fotos-propostas/servicos/PXS-7447146.jpg`,
        featuredOrder: 2,
      },
      {
        title: "Corte Moderno com Textura",
        description: "Texturização em camadas para visual moderno.",
        priceInCents: 6000,
        durationInMinutes: 45,
        imageUrl: `${STATIC_URL_BASE}/barbearias/santana/fotos-propostas/servicos/PXS-33448215.jpg`,
        featuredOrder: 3,
      },
      {
        title: "Barba com Toalha Quente",
        description: "Relaxamento térmico, massagem facial e navalha afiada.",
        priceInCents: 4000,
        durationInMinutes: 30,
        imageUrl: `${STATIC_URL_BASE}/barbearias/santana/fotos-propostas/servicos/PXS-35157699.jpg`,
        featuredOrder: 4,
      },
    ],
  },
  {
    slug: "barbearia-sul-demo",
    name: "Barbearia Santo Amaro — Demonstração",
    cnpj: "99000002000148",
    location: "Rua Amador Bueno, 505 - Santo Amaro, São Paulo - SP, 04752-005",
    avatarUrl: `${STATIC_URL_BASE}/barbearias/santo-amaro/logos/santo-amaro-symbol-original.png`,
    coverUrl: `${STATIC_URL_BASE}/barbearias/santo-amaro/fotos-propostas/ambiente/PXS-30691717.jpg`,
    latitude: -23.653111111111,
    longitude: -46.712833333333,
    ownerLogical: "leste",
    featuredServices: [
      {
        title: "Degradê Sombreado",
        description: "Sombreado gradual de alta definição com nuca limpa.",
        priceInCents: 5500,
        durationInMinutes: 40,
        imageUrl: `${STATIC_URL_BASE}/barbearias/santo-amaro/fotos-propostas/servicos/PXS-35157692.jpg`,
        featuredOrder: 1,
      },
      {
        title: "Corte Tesoura e Pente Corrido",
        description: "Técnica tradicional de barbearia com caimento impecável.",
        priceInCents: 5000,
        durationInMinutes: 35,
        imageUrl: `${STATIC_URL_BASE}/barbearias/santo-amaro/fotos-propostas/servicos/PXS-13138522.jpg`,
        featuredOrder: 2,
      },
      {
        title: "Barba Tradicional Sul",
        description: "Aparo de volume, linha de mandíbula e toalha quente.",
        priceInCents: 4000,
        durationInMinutes: 30,
        imageUrl: `${STATIC_URL_BASE}/barbearias/santo-amaro/fotos-propostas/servicos/PXS-7447126.jpg`,
        featuredOrder: 3,
      },
      {
        title: "Corte Infantil Estilizado",
        description: "Atendimento paciente e cuidadoso para os pequenos.",
        priceInCents: 4500,
        durationInMinutes: 30,
        imageUrl: `${STATIC_URL_BASE}/barbearias/santo-amaro/fotos-propostas/servicos/PXS-35157694.jpg`,
        featuredOrder: 4,
      },
    ],
  },
  {
    slug: "barbearia-oeste-demo",
    name: "Barbearia Pompéia — Demonstração",
    cnpj: "99000003000192",
    location: "Avenida Pompéia, 900 - Vila Pompéia, São Paulo - SP, 05022-000",
    avatarUrl: `${STATIC_URL_BASE}/barbearias/pompeia/logos/pompeia-symbol-original.png`,
    coverUrl: `${STATIC_URL_BASE}/barbearias/pompeia/fotos-propostas/ambiente/PXS-2061821.jpg`,
    latitude: -23.535805555555,
    longitude: -46.689611111111,
    ownerLogical: "centro",
    featuredServices: [
      {
        title: "Corte Pompadour / Clássico",
        description: "Volume superior estruturado com finalização com brilho.",
        priceInCents: 6000,
        durationInMinutes: 45,
        imageUrl: `${STATIC_URL_BASE}/barbearias/pompeia/fotos-propostas/servicos/PXS-8867543.jpg`,
        featuredOrder: 1,
      },
      {
        title: "Barba Modelada Pompéia",
        description: "Contorno limpo e hidratação com pomada especializada.",
        priceInCents: 4200,
        durationInMinutes: 30,
        imageUrl: `${STATIC_URL_BASE}/barbearias/pompeia/fotos-propostas/servicos/PXS-1808691.jpg`,
        featuredOrder: 2,
      },
      {
        title: "Degradê Americano",
        description: "Low fade com transição elegante e discreta.",
        priceInCents: 5500,
        durationInMinutes: 40,
        imageUrl: `${STATIC_URL_BASE}/barbearias/pompeia/fotos-propostas/servicos/PXS-19050580.jpg`,
        featuredOrder: 3,
      },
      {
        title: "Finalização Pomada Matte",
        description: "Modelagem profissional com efeito natural sem brilho.",
        priceInCents: 2500,
        durationInMinutes: 15,
        imageUrl: `${STATIC_URL_BASE}/barbearias/pompeia/fotos-propostas/servicos/PXS-7697381.jpg`,
        featuredOrder: 4,
      },
    ],
  },
  {
    slug: "barbearia-aurora-demo",
    name: "Barbearia Aurora — Demonstração",
    cnpj: "99000004000137",
    location: "Rua Tuiuti, 1200 - Tatuapé, São Paulo - SP, 03307-005",
    avatarUrl: `${STATIC_URL_BASE}/barbearias/aurora/logos/aurora-symbol-dark.png`,
    coverUrl: `${STATIC_URL_BASE}/barbearias/aurora/fotos-propostas/ambiente/PXS-1813272.jpg`,
    latitude: -23.541000,
    longitude: -46.575000,
    ownerLogical: "leste",
    featuredServices: [
      {
        title: "Barboterapia Aurora",
        description: "Tratamento profundo dos fios e da pele com óleos essenciais.",
        priceInCents: 5000,
        durationInMinutes: 35,
        imageUrl: `${STATIC_URL_BASE}/barbearias/aurora/fotos-propostas/servicos/PXS-8867538.jpg`,
        featuredOrder: 1,
      },
      {
        title: "Barba Desenhada na Navalha",
        description: "Design geométrico e retirada de excessos com precisão.",
        priceInCents: 4200,
        durationInMinutes: 30,
        imageUrl: `${STATIC_URL_BASE}/barbearias/aurora/fotos-propostas/servicos/PXS-8867551.jpg`,
        featuredOrder: 2,
      },
      {
        title: "Corte Moderno Degradê",
        description: "Estilo contemporâneo adaptado ao formato do rosto.",
        priceInCents: 5500,
        durationInMinutes: 40,
        imageUrl: `${STATIC_URL_BASE}/barbearias/aurora/fotos-propostas/servicos/PXS-5853391.jpg`,
        featuredOrder: 3,
      },
      {
        title: "Aparo e Modelagem com Balm",
        description: "Alinhamento e perfumação com bálsamo calmante.",
        priceInCents: 3500,
        durationInMinutes: 20,
        imageUrl: `${STATIC_URL_BASE}/barbearias/aurora/fotos-propostas/servicos/PXS-3998412.jpg`,
        featuredOrder: 4,
      },
    ],
  },
  {
    slug: "barbearia-vertice-demo",
    name: "Barbearia Vértice — Demonstração",
    cnpj: "99000005000181",
    location: "Avenida Zelina, 800 - Vila Prudente, São Paulo - SP, 03143-001",
    avatarUrl: `${STATIC_URL_BASE}/barbearias/vertice/logos/vertice-symbol-dark.png`,
    coverUrl: `${STATIC_URL_BASE}/barbearias/vertice/fotos-propostas/ambiente/PXS-2061823.jpg`,
    latitude: -23.585000,
    longitude: -46.582000,
    ownerLogical: "leste",
    featuredServices: [
      {
        title: "Barba Vértice na Navalha",
        description: "Barbear clássico com toalha morna e espuma hidratante.",
        priceInCents: 4500,
        durationInMinutes: 30,
        imageUrl: `${STATIC_URL_BASE}/barbearias/vertice/fotos-propostas/servicos/PXS-2014809.jpg`,
        featuredOrder: 1,
      },
      {
        title: "Alinhamento com Toalha Fria",
        description: "Fechamento de poros e acabamento anti-irritação.",
        priceInCents: 4000,
        durationInMinutes: 25,
        imageUrl: `${STATIC_URL_BASE}/barbearias/vertice/fotos-propostas/servicos/PXS-8867546.jpg`,
        featuredOrder: 2,
      },
      {
        title: "Corte Desfiado na Tesoura",
        description: "Técnica que confere leveza e movimento ao penteado.",
        priceInCents: 5800,
        durationInMinutes: 45,
        imageUrl: `${STATIC_URL_BASE}/barbearias/vertice/fotos-propostas/servicos/PXS-5568412.jpg`,
        featuredOrder: 3,
      },
      {
        title: "Aparo de Bigode e Costeleta",
        description: "Refinamento rápido para manter a apresentação impecável.",
        priceInCents: 3000,
        durationInMinutes: 20,
        imageUrl: `${STATIC_URL_BASE}/barbearias/vertice/fotos-propostas/servicos/PXS-6188363.jpg`,
        featuredOrder: 4,
      },
    ],
  },
  {
    slug: "barbearia-raiz-demo",
    name: "Barbearia Raiz — Demonstração",
    cnpj: "99000006000126",
    location: "Avenida Penha de França, 450 - Penha, São Paulo - SP, 03606-010",
    avatarUrl: `${STATIC_URL_BASE}/barbearias/raiz/logos/raiz-symbol-dark.png`,
    coverUrl: `${STATIC_URL_BASE}/barbearias/raiz/fotos-propostas/ambiente/PXS-30691715.jpg`,
    latitude: -23.525000,
    longitude: -46.549000,
    ownerLogical: "leste",
    featuredServices: [
      {
        title: "Corte Raiz Tradicional",
        description: "Corte atemporal com tesoura e pente de madeira.",
        priceInCents: 4200,
        durationInMinutes: 30,
        imageUrl: `${STATIC_URL_BASE}/barbearias/raiz/fotos-propostas/servicos/PXS-7697382.jpg`,
        featuredOrder: 1,
      },
      {
        title: "Barba Lenhador com Óleo",
        description: "Tratamento para barbas densas e volumosas com óleo artesanal.",
        priceInCents: 4500,
        durationInMinutes: 30,
        imageUrl: `${STATIC_URL_BASE}/barbearias/raiz/fotos-propostas/servicos/PXS-7447141.jpg`,
        featuredOrder: 2,
      },
      {
        title: "Raspar na Máquina Zero",
        description: "Raspagem completa uniforme e aplicação de loção pós-barba.",
        priceInCents: 3200,
        durationInMinutes: 20,
        imageUrl: `${STATIC_URL_BASE}/barbearias/raiz/fotos-propostas/servicos/PXS-7447144.jpg`,
        featuredOrder: 3,
      },
      {
        title: "Selagem e Hidratação de Barba",
        description: "Hidratação de choque para fios rebeldes ou ressecados.",
        priceInCents: 3800,
        durationInMinutes: 25,
        imageUrl: `${STATIC_URL_BASE}/barbearias/raiz/fotos-propostas/servicos/PXS-2061822.jpg`,
        featuredOrder: 4,
      },
    ],
  },
  {
    slug: "barbearia-orbita-demo",
    name: "Barbearia Órbita — Demonstração",
    cnpj: "99000007000170",
    location: "Rua Emília Marengo, 300 - Anália Franco, São Paulo - SP, 03336-000",
    avatarUrl: `${STATIC_URL_BASE}/barbearias/orbita/logos/orbita-symbol-dark.png`,
    coverUrl: `${STATIC_URL_BASE}/barbearias/orbita/fotos-propostas/ambiente/PXS-3998413.jpg`,
    latitude: -23.551000,
    longitude: -46.568000,
    ownerLogical: "leste",
    featuredServices: [
      {
        title: "Corte Futurista Degradê",
        description: "Linhas arrojadas e degradê ultra preciso.",
        priceInCents: 6500,
        durationInMinutes: 45,
        imageUrl: `${STATIC_URL_BASE}/barbearias/orbita/fotos-propostas/servicos/PXS-33448214.jpg`,
        featuredOrder: 1,
      },
      {
        title: "Barba Terapia Vapor de Ozônio",
        description: "Vaporização revitalizante de ozônio e navalhamento suave.",
        priceInCents: 5500,
        durationInMinutes: 35,
        imageUrl: `${STATIC_URL_BASE}/barbearias/orbita/fotos-propostas/servicos/PXS-35157691.jpg`,
        featuredOrder: 2,
      },
      {
        title: "Pigmentação de Barba",
        description: "Uniformização de cor e disfarce de falhas com pigmento.",
        priceInCents: 5000,
        durationInMinutes: 30,
        imageUrl: `${STATIC_URL_BASE}/barbearias/orbita/fotos-propostas/servicos/PXS-7447137.jpg`,
        featuredOrder: 3,
      },
      {
        title: "Alinhamento de Fios Órbita",
        description: "Finalização com escova modeladora e spray fixador.",
        priceInCents: 3500,
        durationInMinutes: 20,
        imageUrl: `${STATIC_URL_BASE}/barbearias/orbita/fotos-propostas/servicos/PXS-8867544.jpg`,
        featuredOrder: 4,
      },
    ],
  },
  {
    slug: "barbearia-nexo-demo",
    name: "Barbearia Nexo — Demonstração",
    cnpj: "99000008000115",
    location: "Rua Taquari, 400 - Mooca, São Paulo - SP, 03166-000",
    avatarUrl: `${STATIC_URL_BASE}/barbearias/nexo/logos/nexo-symbol-dark.png`,
    coverUrl: `${STATIC_URL_BASE}/barbearias/nexo/fotos-propostas/ambiente/PXS-2061824.jpg`,
    latitude: -23.547000,
    longitude: -46.602000,
    ownerLogical: "leste",
    featuredServices: [
      {
        title: "Corte Nexo Minimalista",
        description: "Design limpo e prático, ideal para a rotina diária.",
        priceInCents: 5200,
        durationInMinutes: 35,
        imageUrl: `${STATIC_URL_BASE}/barbearias/nexo/fotos-propostas/servicos/PXS-5853390.jpg`,
        featuredOrder: 1,
      },
      {
        title: "Barba Rápida Alinhada",
        description: "Aparo de precisão na navalha em 20 minutos.",
        priceInCents: 3500,
        durationInMinutes: 20,
        imageUrl: `${STATIC_URL_BASE}/barbearias/nexo/fotos-propostas/servicos/PXS-8867542.jpg`,
        featuredOrder: 2,
      },
      {
        title: "Corte Tesoura e Acabamento",
        description: "Acabamento de pontas e contorno sutil.",
        priceInCents: 4800,
        durationInMinutes: 30,
        imageUrl: `${STATIC_URL_BASE}/barbearias/nexo/fotos-propostas/servicos/PXS-1813271.jpg`,
        featuredOrder: 3,
      },
      {
        title: "Pezinho e Sobrancelha",
        description: "Limpeza de contornos e sobrancelha com navalha.",
        priceInCents: 2800,
        durationInMinutes: 20,
        imageUrl: `${STATIC_URL_BASE}/barbearias/nexo/fotos-propostas/servicos/PXS-3998414.jpg`,
        featuredOrder: 4,
      },
    ],
  },
];

const RETIRED_LEGACY_SLUGS = [
  "barbearia-arena-itaquera-demo",
  "barbearia-analia-franco-demo",
  "barbearia-penha-tradicional-demo",
  "barbearia-vila-prudente-demo",
  "barbearia-sao-miguel-demo",
  "barbearia-tatuape-prime-demo",
  "barbearia-sesc-belenzinho-demo",
  "barbearia-juventus-mooca-demo",
  "barbearia-do-carlos",
];

async function main() {
  const refuseLegacySeed=():boolean=>true;
  if(refuseLegacySeed())throw new Error("Seed legado desativado. Use o motor canônico em modo dry-run; aplicação exige ambiente isolado validado.");
  console.log("Iniciando seed canônico das 10 barbearias e serviços com fotos...");

  const defaultPasswordHash = await Password.generateHashFromPlainText("123456", 10);

  // 1. Assegura existência dos proprietários Centro e Leste
  let [ownerCentro] = await db
    .select()
    .from(users)
    .where(eq(users.email, "dono.centro@smartbarber.com"))
    .limit(1);

  if (!ownerCentro) {
    [ownerCentro] = await db
      .insert(users)
      .values({
        name: "Wellington Siqueira Porto",
        email: "dono.centro@smartbarber.com",
        password: defaultPasswordHash.value,
        cpf: "10111122210",
        emailVerifiedAt: new Date(),
      })
      .returning();
  }

  let [ownerLeste] = await db
    .select()
    .from(users)
    .where(eq(users.email, "dono.leste@smartbarber.com"))
    .limit(1);

  if (!ownerLeste) {
    [ownerLeste] = await db
      .insert(users)
      .values({
        name: "Alvaro Fernando",
        email: "dono.leste@smartbarber.com",
        password: defaultPasswordHash.value,
        cpf: "10222233303",
        emailVerifiedAt: new Date(),
      })
      .returning();
  }

  // 2. Desativa unidades legadas para que não poluam a Home nem o Explorar
  for (const legacySlug of RETIRED_LEGACY_SLUGS) {
    await db
      .update(barbershops)
      .set({ status: "INACTIVE" })
      .where(eq(barbershops.slug, legacySlug));
  }

  // 3. Insere ou atualiza as 10 barbearias canônicas com suas logos e capas oficiais
  for (const shopData of CANONICAL_SHOPS) {
    const ownerId = shopData.ownerLogical === "centro" ? ownerCentro.id : ownerLeste.id;

    const [existing] = await db
      .select()
      .from(barbershops)
      .where(eq(barbershops.slug, shopData.slug))
      .limit(1);

    let currentShopId: string;

    if (existing) {
      currentShopId = existing.id;
      await db
        .update(barbershops)
        .set({
          name: shopData.name,
          location: shopData.location,
          cnpj: shopData.cnpj,
          avatarUrl: shopData.avatarUrl,
          coverUrl: shopData.coverUrl,
          status: "ACTIVE",
          rating: "4.80",
          reviewCount: 12,
        })
        .where(eq(barbershops.id, currentShopId));
    } else {
      const [inserted] = await db
        .insert(barbershops)
        .values({
          name: shopData.name,
          slug: shopData.slug,
          ownerId,
          cnpj: shopData.cnpj,
          location: shopData.location,
          timezone: "America/Sao_Paulo",
          status: "ACTIVE",
          avatarUrl: shopData.avatarUrl,
          coverUrl: shopData.coverUrl,
          rating: "4.80",
          reviewCount: 12,
        })
        .returning();
      currentShopId = inserted.id;
    }

    // 4. Insere ou atualiza os serviços de destaque com suas fotos oficiais de serviço
    for (const srvData of shopData.featuredServices) {
      const matchedSrv = (
        await db
          .select()
          .from(services)
          .where(eq(services.barbershopId, currentShopId))
      ).find((s) => s.title.toLowerCase().trim() === srvData.title.toLowerCase().trim());

      if (matchedSrv) {
        await db
          .update(services)
          .set({
            imageUrl: srvData.imageUrl,
            isFeatured: true,
            featuredOrder: srvData.featuredOrder,
            priceInCents: srvData.priceInCents,
            durationInMinutes: srvData.durationInMinutes,
            description: srvData.description,
            isActive: true,
          })
          .where(eq(services.id, matchedSrv.id));
      } else {
        await db.insert(services).values({
          barbershopId: currentShopId,
          title: srvData.title,
          description: srvData.description,
          priceInCents: srvData.priceInCents,
          durationInMinutes: srvData.durationInMinutes,
          imageUrl: srvData.imageUrl,
          isFeatured: true,
          featuredOrder: srvData.featuredOrder,
          isActive: true,
        });
      }
    }
  }

  console.log("Seed canônico das 10 barbearias e serviços com fotos concluído com sucesso!");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Falha no seed canônico:", error);
    process.exit(1);
  });
