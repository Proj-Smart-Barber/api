import type {
  DemoBarbershopFixture,
  DemoBookingFixture,
  DemoCustomerFixture,
  DemoScheduleExceptionFixture,
  DemoScheduleFixture,
  DemoServiceFixture,
  DemoStaffFixture,
} from "./types";

export const DEMO_STAFFS: DemoStaffFixture[] = [
  // ── Unidade Horizonte ─────────────────────────────────────
  {
    logicalKey: "horizonte:staff:wellington",
    githubUser: "@wellingtonspdev",
    name: "Wellington Siqueira Porto",
    email: "demo.wellingtonspdev@example.com",
    cpf: "00111122233",
    role: "OWNER",
    unitKey: "horizonte",
    defaultPasswordHash:
      "$2b$12$q2wr2LZxFQJ8u8t7tk/BeObBJrOWWd05I9vYMag/Ze57TbYmiDQo2",
  },
  {
    logicalKey: "horizonte:staff:arthur",
    githubUser: "@Arthuranjo",
    name: "Arthur dos anjos",
    email: "demo.arthuranjo@example.com",
    cpf: "00222233344",
    role: "BARBERMAN",
    unitKey: "horizonte",
    defaultPasswordHash:
      "$2b$12$e8sHvtqx45648Sz3DNPgcO3wLmEQJIFuSqF1toq47BWUdEK0Du2Kq",
  },
  {
    logicalKey: "horizonte:staff:pedro",
    githubUser: "@Bruxx092",
    name: "Pedro Silva",
    email: "demo.bruxx092@example.com",
    cpf: "00333344455",
    role: "BARBERMAN",
    unitKey: "horizonte",
    defaultPasswordHash:
      "$2b$12$rM6OPhSYHnr309BKmTOg.ufTIHWx.z0FIWU4gDuXgqOgg6.Q/zXq2",
  },
  {
    logicalKey: "horizonte:staff:jhon",
    githubUser: "@d-Jhon-b",
    name: "Jhon Deyvid Quispe Mamani",
    email: "demo.d-jhon-b@example.com",
    cpf: "00444455566",
    role: "BARBERMAN",
    unitKey: "horizonte",
    defaultPasswordHash:
      "$2b$12$AXz4d0/dqdnslQDiapD1j.oKW/lKH1RN9AnsyW8OxklE1Vh0HChim",
  },

  // ── Unidade Estação ───────────────────────────────────────
  {
    logicalKey: "estacao:staff:alvaro",
    githubUser: "@AlvaroSena",
    name: "Alvaro Sena",
    email: "demo.alvarosena@example.com",
    cpf: "00555566677",
    role: "OWNER",
    unitKey: "estacao",
    defaultPasswordHash:
      "$2b$12$S54tuSr0SOjfdAuOI7ZKw.WIgvlyahd5DL7AqBVHsc8vVj9kS530q",
  },
  {
    logicalKey: "estacao:staff:carlos",
    githubUser: "@Carlos-Leon3l",
    name: "Carlos Leonel",
    email: "demo.carlos-leon3l@example.com",
    cpf: "00666677788",
    role: "BARBERMAN",
    unitKey: "estacao",
    defaultPasswordHash:
      "$2b$12$nrmMPXLn2vvjx/ucdoyNceX3itwv/yAwsobB66pFW9sH7wmW4C0kC",
  },
  {
    logicalKey: "estacao:staff:felipe",
    githubUser: "@FelipeRCod",
    name: "Felipe Rocha",
    email: "demo.felipercod@example.com",
    cpf: "00777788899",
    role: "BARBERMAN",
    unitKey: "estacao",
    defaultPasswordHash:
      "$2b$12$PwweJKOpNv9FJE0iQQUn.O5vqlAMjdOZLvk9DLyZDCINtIVle3/a6",
  },
  {
    logicalKey: "estacao:staff:kaua",
    githubUser: "@kaua-hiro",
    name: "Kauã Hiro",
    email: "demo.kaua-hiro@example.com",
    cpf: "00888899900",
    role: "BARBERMAN",
    unitKey: "estacao",
    defaultPasswordHash:
      "$2b$12$Plhetfzl..j8RPNeKr/pSuNyFTs8pmetzpVWy9jIZcl9Agw7ZnRoO",
  },
];

export const DEMO_BARBERSHOPS: DemoBarbershopFixture[] = [
  {
    logicalKey: "horizonte:barbershop",
    name: "Barbearia Horizonte — Demonstração",
    ownerLogicalKey: "horizonte:staff:wellington",
    slug: "barbearia-horizonte-demo",
    cnpj: "11222333000144",
    location: "Av. Paulista, 1500 - Bela Vista, São Paulo - SP",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },
  {
    logicalKey: "estacao:barbershop",
    name: "Barbearia Estação — Demonstração",
    ownerLogicalKey: "estacao:staff:alvaro",
    slug: "barbearia-estacao-demo",
    cnpj: "55666777000188",
    location: "Av. Francisco Glicério, 1000 - Centro, Campinas - SP",
    timezone: "America/Sao_Paulo",
    status: "ACTIVE",
  },
];

export const DEMO_SERVICES: DemoServiceFixture[] = [
  // ── Unidade Horizonte (7 serviços: 6 ativos, 1 inativo) ────
  {
    logicalKey: "horizonte:service:corte-classico",
    barbershopLogicalKey: "horizonte:barbershop",
    title: "Corte clássico",
    description:
      "Corte tradicional com tesoura e máquina com acabamento impecável.",
    priceInCents: 4500,
    durationInMinutes: 30,
    isActive: true,
  },
  {
    logicalKey: "horizonte:service:degrade",
    barbershopLogicalKey: "horizonte:barbershop",
    title: "Degradê moderno",
    description: "Fade degradê estilizado nas laterais com transição suave.",
    priceInCents: 5500,
    durationInMinutes: 45,
    isActive: true,
  },
  {
    logicalKey: "horizonte:service:barba-toalha",
    barbershopLogicalKey: "horizonte:barbershop",
    title: "Barba com toalha quente",
    description:
      "Alinhamento e desenho de barba com toalha aquecida e navalha.",
    priceInCents: 4000,
    durationInMinutes: 30,
    isActive: true,
  },
  {
    logicalKey: "horizonte:service:sobrancelha",
    barbershopLogicalKey: "horizonte:barbershop",
    title: "Sobrancelha na navalha",
    description: "Design e limpeza das sobrancelhas com alinhamento preciso.",
    priceInCents: 2000,
    durationInMinutes: 15,
    isActive: true,
  },
  {
    logicalKey: "horizonte:service:acabamento",
    barbershopLogicalKey: "horizonte:barbershop",
    title: "Acabamento do pezinho",
    description: "Refinamento e contorno do pezinho e costeletas.",
    priceInCents: 2500,
    durationInMinutes: 15,
    isActive: true,
  },
  {
    logicalKey: "horizonte:service:combo-corte-barba",
    barbershopLogicalKey: "horizonte:barbershop",
    title: "Corte + barba",
    description:
      "Pacote completo de corte de cabelo e barba com atendimento premium.",
    priceInCents: 8000,
    durationInMinutes: 60,
    isActive: true,
  },
  {
    logicalKey: "horizonte:service:pigmentacao",
    barbershopLogicalKey: "horizonte:barbershop",
    title: "Pigmentação de barba",
    description:
      "Correção e preenchimento de falhas com pigmentação temporária.",
    priceInCents: 6500,
    durationInMinutes: 45,
    isActive: false, // inativo conforme especificação
  },

  // ── Unidade Estação (7 serviços: 6 ativos, 1 inativo) ──────
  {
    logicalKey: "estacao:service:corte-social",
    barbershopLogicalKey: "estacao:barbershop",
    title: "Corte social",
    description: "Corte social limpo e alinhado para o dia a dia executivo.",
    priceInCents: 5000,
    durationInMinutes: 35,
    isActive: true,
  },
  {
    logicalKey: "estacao:service:degrade",
    barbershopLogicalKey: "estacao:barbershop",
    title: "Degradê navalhado",
    description:
      "Degradê com navalhete e sombreamento gradual de alta definição.",
    priceInCents: 6000,
    durationInMinutes: 45,
    isActive: true,
  },
  {
    logicalKey: "estacao:service:barba-express",
    barbershopLogicalKey: "estacao:barbershop",
    title: "Barba express",
    description: "Aparo rápido e contorno higiênico da barba.",
    priceInCents: 3500,
    durationInMinutes: 20,
    isActive: true,
  },
  {
    logicalKey: "estacao:service:sobrancelha",
    barbershopLogicalKey: "estacao:barbershop",
    title: "Design de sobrancelha",
    description: "Alinhamento geométrico e retirada de excessos.",
    priceInCents: 1800,
    durationInMinutes: 15,
    isActive: true,
  },
  {
    logicalKey: "estacao:service:acabamento",
    barbershopLogicalKey: "estacao:barbershop",
    title: "Pezinho e contorno",
    description: "Alinhamento da linha de cabelo e nuca com navalha.",
    priceInCents: 2200,
    durationInMinutes: 15,
    isActive: true,
  },
  {
    logicalKey: "estacao:service:combo-corte-barba",
    barbershopLogicalKey: "estacao:barbershop",
    title: "Corte + barba",
    description: "Atendimento completo com corte social e barba alinhada.",
    priceInCents: 8500,
    durationInMinutes: 60,
    isActive: true,
  },
  {
    logicalKey: "estacao:service:hidratacao",
    barbershopLogicalKey: "estacao:barbershop",
    title: "Hidratação capilar profunda",
    description: "Tratamento de revitalização e maciez dos fios capilares.",
    priceInCents: 4500,
    durationInMinutes: 30,
    isActive: false, // inativo conforme especificação
  },
];

export const DEMO_CUSTOMERS: DemoCustomerFixture[] = [
  // Clientes Horizonte
  {
    logicalKey: "horizonte:customer:lucas",
    name: "Lucas Andrade",
    email: "lucas.andrade.demo@example.com",
    cpf: "11100100111",
    phoneNumber: "11911000001",
  },
  {
    logicalKey: "horizonte:customer:gabriel",
    name: "Gabriel Santos",
    email: "gabriel.santos.demo@example.com",
    cpf: "11100200222",
    phoneNumber: "11911000002",
  },
  {
    logicalKey: "horizonte:customer:matheus",
    name: "Matheus Oliveira",
    email: "matheus.oliveira.demo@example.com",
    cpf: "11100300333",
    phoneNumber: "11911000003",
  },
  {
    logicalKey: "horizonte:customer:rafael",
    name: "Rafael Souza",
    email: "rafael.souza.demo@example.com",
    cpf: "11100400444",
    phoneNumber: "11911000004",
  },
  {
    logicalKey: "horizonte:customer:bruno",
    name: "Bruno Costa",
    email: "bruno.costa.demo@example.com",
    cpf: "11100500555",
    phoneNumber: "11911000005",
  },
  {
    logicalKey: "horizonte:customer:diego",
    name: "Diego Ribeiro",
    email: "diego.ribeiro.demo@example.com",
    cpf: "11100600666",
    phoneNumber: "11911000006",
  },

  // Clientes Estação
  {
    logicalKey: "estacao:customer:rodrigo",
    name: "Rodrigo Ferreira",
    email: "rodrigo.ferreira.demo@example.com",
    cpf: "22200100111",
    phoneNumber: "19922000001",
  },
  {
    logicalKey: "estacao:customer:felipe",
    name: "Felipe Martins",
    email: "felipe.martins.demo@example.com",
    cpf: "22200200222",
    phoneNumber: "19922000002",
  },
  {
    logicalKey: "estacao:customer:gustavo",
    name: "Gustavo Lima",
    email: "gustavo.lima.demo@example.com",
    cpf: "22200300333",
    phoneNumber: "19922000003",
  },
  {
    logicalKey: "estacao:customer:thiago",
    name: "Thiago Barbosa",
    email: "thiago.barbosa.demo@example.com",
    cpf: "22200400444",
    phoneNumber: "19922000004",
  },
  {
    logicalKey: "estacao:customer:leonardo",
    name: "Leonardo Gomes",
    email: "leonardo.gomes.demo@example.com",
    cpf: "22200500555",
    phoneNumber: "19922000005",
  },
  {
    logicalKey: "estacao:customer:andre",
    name: "André Vieira",
    email: "andre.vieira.demo@example.com",
    cpf: "22200600666",
    phoneNumber: "19922000006",
  },
];

export function buildDemoSchedules(): DemoScheduleFixture[] {
  const list: DemoScheduleFixture[] = [];

  // ── 1. Horizonte: Geral (Seg–Sex 09:00–18:00, Sáb 09:00–14:00) ──
  const hzDays: Array<
    "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY"
  > = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
  for (const day of hzDays) {
    list.push({
      logicalKey: `horizonte:schedule:general:${day.toLowerCase()}`,
      barbershopLogicalKey: "horizonte:barbershop",
      createdByLogicalKey: "horizonte:staff:wellington",
      dayOfWeek: day,
      openTime: "09:00",
      closeTime: "18:00",
    });
  }
  list.push({
    logicalKey: "horizonte:schedule:general:saturday",
    barbershopLogicalKey: "horizonte:barbershop",
    createdByLogicalKey: "horizonte:staff:wellington",
    dayOfWeek: "SATURDAY",
    openTime: "09:00",
    closeTime: "14:00",
  });

  // Wellington (OWNER/Barbeiro): Seg–Sex 09:00–18:00, Sáb 09:00–14:00
  for (const day of hzDays) {
    list.push({
      logicalKey: `horizonte:schedule:wellington:${day.toLowerCase()}`,
      barbershopLogicalKey: "horizonte:barbershop",
      barbermanLogicalKey: "horizonte:staff:wellington",
      createdByLogicalKey: "horizonte:staff:wellington",
      dayOfWeek: day,
      openTime: "09:00",
      closeTime: "18:00",
    });
  }
  list.push({
    logicalKey: "horizonte:schedule:wellington:saturday",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:wellington",
    createdByLogicalKey: "horizonte:staff:wellington",
    dayOfWeek: "SATURDAY",
    openTime: "09:00",
    closeTime: "14:00",
  });

  // Arthur (BARBERMAN): Ter–Sex 09:00–18:00, Sáb 09:00–14:00 (folga Segunda)
  const arthurDays: Array<"TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY"> = [
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
  ];
  for (const day of arthurDays) {
    list.push({
      logicalKey: `horizonte:schedule:arthur:${day.toLowerCase()}`,
      barbershopLogicalKey: "horizonte:barbershop",
      barbermanLogicalKey: "horizonte:staff:arthur",
      createdByLogicalKey: "horizonte:staff:wellington",
      dayOfWeek: day,
      openTime: "09:00",
      closeTime: "18:00",
    });
  }
  list.push({
    logicalKey: "horizonte:schedule:arthur:saturday",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:arthur",
    createdByLogicalKey: "horizonte:staff:wellington",
    dayOfWeek: "SATURDAY",
    openTime: "09:00",
    closeTime: "14:00",
  });

  // Pedro (BARBERMAN): Seg, Ter, Qui, Sex 09:00–18:00, Sáb 09:00–14:00 (folga Quarta)
  const pedroDays: Array<"MONDAY" | "TUESDAY" | "THURSDAY" | "FRIDAY"> = [
    "MONDAY",
    "TUESDAY",
    "THURSDAY",
    "FRIDAY",
  ];
  for (const day of pedroDays) {
    list.push({
      logicalKey: `horizonte:schedule:pedro:${day.toLowerCase()}`,
      barbershopLogicalKey: "horizonte:barbershop",
      barbermanLogicalKey: "horizonte:staff:pedro",
      createdByLogicalKey: "horizonte:staff:wellington",
      dayOfWeek: day,
      openTime: "09:00",
      closeTime: "18:00",
    });
  }
  list.push({
    logicalKey: "horizonte:schedule:pedro:saturday",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:pedro",
    createdByLogicalKey: "horizonte:staff:wellington",
    dayOfWeek: "SATURDAY",
    openTime: "09:00",
    closeTime: "14:00",
  });

  // Jhon (BARBERMAN): Seg–Sex 09:00–18:00 (folga Sábado)
  for (const day of hzDays) {
    list.push({
      logicalKey: `horizonte:schedule:jhon:${day.toLowerCase()}`,
      barbershopLogicalKey: "horizonte:barbershop",
      barbermanLogicalKey: "horizonte:staff:jhon",
      createdByLogicalKey: "horizonte:staff:wellington",
      dayOfWeek: day,
      openTime: "09:00",
      closeTime: "18:00",
    });
  }

  // ── 2. Estação: Geral (Ter–Sex 10:00–19:00, Sáb 09:00–16:00) ──
  const estDays: Array<"TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY"> = [
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
  ];
  for (const day of estDays) {
    list.push({
      logicalKey: `estacao:schedule:general:${day.toLowerCase()}`,
      barbershopLogicalKey: "estacao:barbershop",
      createdByLogicalKey: "estacao:staff:alvaro",
      dayOfWeek: day,
      openTime: "10:00",
      closeTime: "19:00",
    });
  }
  list.push({
    logicalKey: "estacao:schedule:general:saturday",
    barbershopLogicalKey: "estacao:barbershop",
    createdByLogicalKey: "estacao:staff:alvaro",
    dayOfWeek: "SATURDAY",
    openTime: "09:00",
    closeTime: "16:00",
  });

  // Alvaro (OWNER/Barbeiro): Ter–Sex 10:00–19:00, Sáb 09:00–16:00
  for (const day of estDays) {
    list.push({
      logicalKey: `estacao:schedule:alvaro:${day.toLowerCase()}`,
      barbershopLogicalKey: "estacao:barbershop",
      barbermanLogicalKey: "estacao:staff:alvaro",
      createdByLogicalKey: "estacao:staff:alvaro",
      dayOfWeek: day,
      openTime: "10:00",
      closeTime: "19:00",
    });
  }
  list.push({
    logicalKey: "estacao:schedule:alvaro:saturday",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:alvaro",
    createdByLogicalKey: "estacao:staff:alvaro",
    dayOfWeek: "SATURDAY",
    openTime: "09:00",
    closeTime: "16:00",
  });

  // Carlos (BARBERMAN): Qua–Sex 10:00–19:00, Sáb 09:00–16:00 (folga Terça)
  const carlosDays: Array<"WEDNESDAY" | "THURSDAY" | "FRIDAY"> = [
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
  ];
  for (const day of carlosDays) {
    list.push({
      logicalKey: `estacao:schedule:carlos:${day.toLowerCase()}`,
      barbershopLogicalKey: "estacao:barbershop",
      barbermanLogicalKey: "estacao:staff:carlos",
      createdByLogicalKey: "estacao:staff:alvaro",
      dayOfWeek: day,
      openTime: "10:00",
      closeTime: "19:00",
    });
  }
  list.push({
    logicalKey: "estacao:schedule:carlos:saturday",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:carlos",
    createdByLogicalKey: "estacao:staff:alvaro",
    dayOfWeek: "SATURDAY",
    openTime: "09:00",
    closeTime: "16:00",
  });

  // Felipe (BARBERMAN): Ter, Qua, Sex 10:00–19:00, Sáb 09:00–16:00 (folga Quinta)
  const felipeDays: Array<"TUESDAY" | "WEDNESDAY" | "FRIDAY"> = [
    "TUESDAY",
    "WEDNESDAY",
    "FRIDAY",
  ];
  for (const day of felipeDays) {
    list.push({
      logicalKey: `estacao:schedule:felipe:${day.toLowerCase()}`,
      barbershopLogicalKey: "estacao:barbershop",
      barbermanLogicalKey: "estacao:staff:felipe",
      createdByLogicalKey: "estacao:staff:alvaro",
      dayOfWeek: day,
      openTime: "10:00",
      closeTime: "19:00",
    });
  }
  list.push({
    logicalKey: "estacao:schedule:felipe:saturday",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:felipe",
    createdByLogicalKey: "estacao:staff:alvaro",
    dayOfWeek: "SATURDAY",
    openTime: "09:00",
    closeTime: "16:00",
  });

  // Kauã (BARBERMAN): Ter–Sex 10:00–19:00 (folga Sábado)
  for (const day of estDays) {
    list.push({
      logicalKey: `estacao:schedule:kaua:${day.toLowerCase()}`,
      barbershopLogicalKey: "estacao:barbershop",
      barbermanLogicalKey: "estacao:staff:kaua",
      createdByLogicalKey: "estacao:staff:alvaro",
      dayOfWeek: day,
      openTime: "10:00",
      closeTime: "19:00",
    });
  }

  return list;
}

export const DEMO_EXCEPTIONS: DemoScheduleExceptionFixture[] = [
  // Horizonte
  {
    logicalKey: "horizonte:exception:manutencao-eletrica",
    barbershopLogicalKey: "horizonte:barbershop",
    dateOffsetDays: 10,
    startTime: "14:00",
    endTime: "16:00",
    reason: "Manutenção programada na rede elétrica",
  },
  {
    logicalKey: "horizonte:exception:arthur-curso",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:arthur",
    dateOffsetDays: 7,
    reason: "Curso de aperfeiçoamento em visagismo",
  },
  {
    logicalKey: "horizonte:exception:pedro-consulta",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:pedro",
    dateOffsetDays: 12,
    startTime: "10:00",
    endTime: "11:30",
    reason: "Consulta odontológica de rotina",
  },

  // Estação
  {
    logicalKey: "estacao:exception:treinamento-equipe",
    barbershopLogicalKey: "estacao:barbershop",
    dateOffsetDays: 11,
    startTime: "10:00",
    endTime: "12:00",
    reason: "Alinhamento e treinamento interno de atendimento",
  },
  {
    logicalKey: "estacao:exception:carlos-folga",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:carlos",
    dateOffsetDays: 8,
    reason: "Folga programada compensatória",
  },
  {
    logicalKey: "estacao:exception:felipe-compromisso",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:felipe",
    dateOffsetDays: 13,
    startTime: "15:00",
    endTime: "16:30",
    reason: "Compromisso pessoal externo",
  },
];

export const DEMO_BOOKINGS: DemoBookingFixture[] = [
  // ── Unidade Horizonte (10 reservas) ───────────────────────
  // Hoje: 4 reservas (uma por profissional)
  {
    logicalKey: "horizonte:booking:hoje-wellington",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:wellington",
    customerLogicalKey: "horizonte:customer:lucas",
    serviceLogicalKey: "horizonte:service:corte-classico",
    dateOffsetDays: 0,
    startTime: "10:00",
    endTime: "10:30",
  },
  {
    logicalKey: "horizonte:booking:hoje-arthur",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:arthur",
    customerLogicalKey: "horizonte:customer:gabriel",
    serviceLogicalKey: "horizonte:service:degrade",
    dateOffsetDays: 0,
    startTime: "11:00",
    endTime: "11:45",
  },
  {
    logicalKey: "horizonte:booking:hoje-pedro",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:pedro",
    customerLogicalKey: "horizonte:customer:matheus",
    serviceLogicalKey: "horizonte:service:barba-toalha",
    dateOffsetDays: 0,
    startTime: "14:00",
    endTime: "14:30",
  },
  {
    logicalKey: "horizonte:booking:hoje-jhon",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:jhon",
    customerLogicalKey: "horizonte:customer:rafael",
    serviceLogicalKey: "horizonte:service:combo-corte-barba",
    dateOffsetDays: 0,
    startTime: "15:00",
    endTime: "16:00",
  },
  // Futuro próximo: 3 reservas
  {
    logicalKey: "horizonte:booking:futuro-1",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:wellington",
    customerLogicalKey: "horizonte:customer:bruno",
    serviceLogicalKey: "horizonte:service:degrade",
    dateOffsetDays: 1,
    startTime: "10:00",
    endTime: "10:45",
  },
  {
    logicalKey: "horizonte:booking:futuro-2",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:pedro",
    customerLogicalKey: "horizonte:customer:diego",
    serviceLogicalKey: "horizonte:service:corte-classico",
    dateOffsetDays: 2,
    startTime: "11:00",
    endTime: "11:30",
  },
  {
    logicalKey: "horizonte:booking:futuro-3",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:jhon",
    customerLogicalKey: "horizonte:customer:lucas",
    serviceLogicalKey: "horizonte:service:barba-toalha",
    dateOffsetDays: 3,
    startTime: "16:00",
    endTime: "16:30",
  },
  // Histórico recente: 2 reservas
  {
    logicalKey: "horizonte:booking:historico-1",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:arthur",
    customerLogicalKey: "horizonte:customer:gabriel",
    serviceLogicalKey: "horizonte:service:corte-classico",
    dateOffsetDays: -1,
    startTime: "14:00",
    endTime: "14:30",
  },
  {
    logicalKey: "horizonte:booking:historico-2",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:wellington",
    customerLogicalKey: "horizonte:customer:matheus",
    serviceLogicalKey: "horizonte:service:acabamento",
    dateOffsetDays: -2,
    startTime: "16:00",
    endTime: "16:15",
  },
  // Reserva descartável para cancelamento
  {
    logicalKey: "horizonte:booking:descartavel-cancelamento",
    barbershopLogicalKey: "horizonte:barbershop",
    barbermanLogicalKey: "horizonte:staff:arthur",
    customerLogicalKey: "horizonte:customer:diego",
    serviceLogicalKey: "horizonte:service:corte-classico",
    dateOffsetDays: 1,
    startTime: "15:00",
    endTime: "15:30",
    isDisposable: true,
  },

  // ── Unidade Estação (10 reservas) ─────────────────────────
  // Hoje: 4 reservas (uma por profissional)
  {
    logicalKey: "estacao:booking:hoje-alvaro",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:alvaro",
    customerLogicalKey: "estacao:customer:rodrigo",
    serviceLogicalKey: "estacao:service:corte-social",
    dateOffsetDays: 0,
    startTime: "10:30",
    endTime: "11:05",
  },
  {
    logicalKey: "estacao:booking:hoje-carlos",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:carlos",
    customerLogicalKey: "estacao:customer:felipe",
    serviceLogicalKey: "estacao:service:degrade",
    dateOffsetDays: 0,
    startTime: "11:30",
    endTime: "12:15",
  },
  {
    logicalKey: "estacao:booking:hoje-felipe",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:felipe",
    customerLogicalKey: "estacao:customer:gustavo",
    serviceLogicalKey: "estacao:service:barba-express",
    dateOffsetDays: 0,
    startTime: "14:00",
    endTime: "14:20",
  },
  {
    logicalKey: "estacao:booking:hoje-kaua",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:kaua",
    customerLogicalKey: "estacao:customer:thiago",
    serviceLogicalKey: "estacao:service:combo-corte-barba",
    dateOffsetDays: 0,
    startTime: "15:00",
    endTime: "16:00",
  },
  // Futuro próximo: 3 reservas
  {
    logicalKey: "estacao:booking:futuro-1",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:alvaro",
    customerLogicalKey: "estacao:customer:leonardo",
    serviceLogicalKey: "estacao:service:degrade",
    dateOffsetDays: 1,
    startTime: "11:00",
    endTime: "11:45",
  },
  {
    logicalKey: "estacao:booking:futuro-2",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:felipe",
    customerLogicalKey: "estacao:customer:andre",
    serviceLogicalKey: "estacao:service:corte-social",
    dateOffsetDays: 2,
    startTime: "14:30",
    endTime: "15:05",
  },
  {
    logicalKey: "estacao:booking:futuro-3",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:kaua",
    customerLogicalKey: "estacao:customer:rodrigo",
    serviceLogicalKey: "estacao:service:barba-express",
    dateOffsetDays: 3,
    startTime: "16:00",
    endTime: "16:20",
  },
  // Histórico recente: 2 reservas
  {
    logicalKey: "estacao:booking:historico-1",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:carlos",
    customerLogicalKey: "estacao:customer:felipe",
    serviceLogicalKey: "estacao:service:corte-social",
    dateOffsetDays: -1,
    startTime: "10:30",
    endTime: "11:05",
  },
  {
    logicalKey: "estacao:booking:historico-2",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:alvaro",
    customerLogicalKey: "estacao:customer:gustavo",
    serviceLogicalKey: "estacao:service:sobrancelha",
    dateOffsetDays: -2,
    startTime: "16:30",
    endTime: "16:45",
  },
  // Reserva descartável para cancelamento
  {
    logicalKey: "estacao:booking:descartavel-cancelamento",
    barbershopLogicalKey: "estacao:barbershop",
    barbermanLogicalKey: "estacao:staff:carlos",
    customerLogicalKey: "estacao:customer:andre",
    serviceLogicalKey: "estacao:service:corte-social",
    dateOffsetDays: 1,
    startTime: "15:30",
    endTime: "16:05",
    isDisposable: true,
  },
];
