import "dotenv/config";
import { compare } from "bcryptjs";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { Client } from "pg";
import { buildFullDemoSeedFixtures } from "../src/infra/drizzle/demo-seed/canonical/full-profile-fixtures";
import { env } from "../src/infra/env";
import { inspectDatabaseTarget } from "../src/infra/drizzle/demo-seed/canonical/security";

type Credential = {
  name: string;
  email: string;
  role: string;
  unit: string;
  plainPassword: string;
  passwordHash: string;
};

type ShopRow = {
  id: string;
  name: string;
  location: string;
  status: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  accountType: string;
  seedLogicalKey: string | null;
  serviceCount: number;
};

const themes: Record<string, { direction: string; palette: string }> = {
  CENTRO: {
    direction: "editorial urbana e histórica",
    palette: "grafite, marfim e cobre",
  },
  LESTE: {
    direction: "industrial contemporânea e acolhedora",
    palette: "azul petróleo, areia e cobre",
  },
  NORTE: {
    direction: "urbana comunitária e contemporânea",
    palette: "verde profundo, creme e madeira",
  },
  SUL: {
    direction: "contemporânea natural e descontraída",
    palette: "terracota, carvão e marfim",
  },
  OESTE: { direction: "minimalista urbana", palette: "preto, oliva e creme" },
};

const imageSubjects = [
  "fachada real de barbearia",
  "interior amplo com estações de corte",
  "cadeira e bancada de barbeiro",
  "corte degradê em atendimento real",
  "barba e toalha quente em atendimento real",
  "ferramentas profissionais em uso",
  "recepção e área de espera",
  "barbeiro trabalhando com cliente, com autorização de imagem",
  "materiais, letreiro e iluminação do espaço",
  "referência de composição para logo e identidade, sem copiar marca existente",
];

function parseCredentialFile(path: string): Credential[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<
    string,
    Credential
  >;
  return Object.values(parsed);
}

function initials(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(
      (word) =>
        word && !["barbearia", "demonstracao"].includes(word.toLowerCase()),
    );
  return (
    words
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("") || "SB"
  );
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (prefix: string) =>
    args.find((arg) => arg.startsWith(`${prefix}=`))?.slice(prefix.length + 1);
  const outputDirectory = getArg("--out");
  const fullCredentialsPath = getArg("--full-credentials");
  const legacyCredentialsPath = getArg("--legacy-credentials");
  if (!outputDirectory || !fullCredentialsPath || !legacyCredentialsPath) {
    throw new Error(
      "Pass absolute --out, --full-credentials, and --legacy-credentials paths.",
    );
  }
  for (const path of [
    outputDirectory,
    fullCredentialsPath,
    legacyCredentialsPath,
  ]) {
    if (!isAbsolute(path))
      throw new Error("All export paths must be absolute.");
  }

  const target = inspectDatabaseTarget(env.DATABASE_URL);
  if (target.database !== "smartbarber-dev-2" || target.isLocal) {
    throw new Error(
      "Exporter is restricted to the confirmed remote smartbarber-dev-2 target.",
    );
  }

  const allCredentials = [
    ...parseCredentialFile(fullCredentialsPath),
    ...parseCredentialFile(legacyCredentialsPath),
  ];
  const credentialsByEmail = new Map<string, Credential[]>();
  for (const credential of allCredentials) {
    const key = credential.email.trim().toLowerCase();
    credentialsByEmail.set(key, [
      ...(credentialsByEmail.get(key) ?? []),
      credential,
    ]);
  }

  const fixtures = buildFullDemoSeedFixtures();
  const fixtureByKey = new Map(
    fixtures.barbershops.map((shop) => [shop.logicalKey, shop]),
  );
  const client = new Client({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  try {
    const result = await client.query<ShopRow>(`
      SELECT b.id, b.name, b.location, b.status, b.slug,
        u.name AS "ownerName", u.email AS "ownerEmail", u.account_type AS "accountType",
        r.logical_key AS "seedLogicalKey",
        (SELECT COUNT(*)::int FROM services s WHERE s.barbershop_id = b.id) AS "serviceCount"
      FROM barbershops b
      JOIN users u ON u.id = b.owner_id
      LEFT JOIN demo_seed_registry r
        ON r.record_id = b.id AND r.namespace = 'demo-smart-barber-v1' AND r.table_name = 'barbershops'
      ORDER BY b.name, b.id
    `);
    const shops = result.rows;
    if (shops.length !== 102)
      throw new Error(`Expected 102 shops; found ${shops.length}.`);

    const credentialRows: Array<Record<string, string | null>> = [];
    const verifiedByEmail = new Map<string, Credential | null>();
    for (const shop of shops) {
      const key = shop.ownerEmail.trim().toLowerCase();
      let credential = verifiedByEmail.get(key);
      if (credential === undefined) {
        const candidates = credentialsByEmail.get(key) ?? [];
        credential = null;
        for (const candidate of candidates) {
          if (
            await compare(
              candidate.plainPassword,
              (
                await client.query<{ password: string }>(
                  "SELECT password FROM users WHERE email=$1",
                  [shop.ownerEmail],
                )
              ).rows[0].password,
            )
          ) {
            credential = candidate;
            break;
          }
        }
        verifiedByEmail.set(key, credential);
      }
      credentialRows.push({
        barbershop: shop.name,
        barbershopId: shop.id,
        status: shop.status,
        ownerName: shop.ownerName,
        ownerEmail: shop.ownerEmail,
        accountType: shop.accountType,
        seedLogicalKey: shop.seedLogicalKey,
        password: credential?.plainPassword ?? null,
        credentialStatus: credential
          ? "bcrypt_match_with_database"
          : shop.seedLogicalKey
            ? "seeded_owner_password_not_found_or_not_matching"
            : "non_seed_owner_password_not_recoverable_use_password_reset",
      });
    }

    const markdown: string[] = [
      "# Guia de pesquisa visual das barbearias de São Paulo",
      "",
      `Gerado em ${new Date().toISOString()}. Total: ${shops.length} barbearias; ${shops.filter((s) => s.seedLogicalKey).length} no namespace de demonstração.`,
      "",
      "As propostas abaixo são direcionamentos iniciais para pesquisa, não identidades aprovadas. Endereços e pinos do seed são referências sintéticas; não os anuncie como endereços de lojas reais. Pesquise fotografias reais com licença compatível, guarde fonte, autor, licença e URL original. Não reutilize a mesma imagem entre lojas.",
      "",
      "Cada barbearia precisa de cerca de 10 imagens únicas: fachada, interior amplo, estação de corte, corte, barba, ferramentas em uso, recepção, equipe/atendimento autorizado, materiais e iluminação, referência de composição para logo.",
      "",
    ];

    for (const shop of shops) {
      const fixture = shop.seedLogicalKey
        ? fixtureByKey.get(shop.seedLogicalKey)
        : undefined;
      const region = fixture?.region;
      const theme = region ? themes[region] : undefined;
      const initialsText = initials(shop.name);
      const district = fixture?.location.split(",")[0] ?? shop.location;
      const concept = theme
        ? `${theme.direction}; paleta ${theme.palette}; wordmark tipográfico e monograma ${initialsText}, com detalhe abstrato inspirado em ${district}. Validar com o owner antes de aplicar.`
        : `Extrair direção visual da marca atual e validar com ${shop.ownerName}; pesquisar elementos do bairro sem presumir estilo, história ou perfil de clientes.`;
      const searchQueries = imageSubjects
        .map(
          (subject) =>
            `- ${subject}; busca: “${shop.name.replace(" — Demonstração", "")} ${district} São Paulo ${subject} Unsplash Pexels Wikimedia”`,
        )
        .join("\n");
      markdown.push(
        `## ${shops.indexOf(shop) + 1}. ${shop.name}`,
        "",
        `- Endereço registrado: ${shop.location}`,
        `- Região/distrito para pesquisa: ${region ?? "classificação pendente"} / ${district}`,
        `- Estado: ${shop.status}; serviços cadastrados: ${shop.serviceCount}`,
        `- Owner: ${shop.ownerName}`,
        `- Direção visual proposta: ${concept}`,
        "- Pesquisas de imagens:",
        searchQueries,
        "",
      );
    }

    mkdirSync(outputDirectory, { recursive: true });
    const researchPath = resolve(
      outputDirectory,
      "barbearias-pesquisa-imagens.md",
    );
    const credentialsPath = resolve(
      outputDirectory,
      "owners-logins.private.json",
    );
    writeFileSync(researchPath, markdown.join("\n"), {
      flag: "wx",
      mode: 0o600,
    });
    writeFileSync(
      credentialsPath,
      JSON.stringify(
        {
          targetDatabase: target.database,
          generatedAt: new Date().toISOString(),
          note: "Privado. Senhas incluídas apenas quando bcrypt confere com o usuário atual do banco.",
          accounts: credentialRows,
        },
        null,
        2,
      ),
      { flag: "wx", mode: 0o600 },
    );

    console.log(
      JSON.stringify(
        {
          totalBarbershops: shops.length,
          seededBarbershops: shops.filter((shop) => shop.seedLogicalKey).length,
          externalBarbershops: shops.filter((shop) => !shop.seedLogicalKey)
            .length,
          ownersWithVerifiedPassword: credentialRows.filter(
            (row) => row.credentialStatus === "bcrypt_match_with_database",
          ).length,
          ownersWithoutRecoverableSeedPassword: credentialRows.filter(
            (row) => row.password === null,
          ).length,
          researchBrief: researchPath,
          privateOwnerCredentials: credentialsPath,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
