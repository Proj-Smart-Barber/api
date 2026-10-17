/**
 * ============================================================================
 * SMART BARBER — Runner de Homologação E2E Isolada (Issue #29 / TEC-14 a TEC-19)
 * ============================================================================
 *
 * Comandos de execução suportados (Portabilidade Linux / macOS / Windows):
 *
 * 1. Via NPM Script (Multiplataforma — Linux, macOS, Windows CMD/PowerShell):
 *    npm run test:e2e:availability
 *
 * 2. Execução direta no Linux / macOS (Bash/Zsh):
 *    NODE_ENV=test npx tsx scripts/verify-e2e-availability.ts
 *
 * 3. Execução direta no Windows (PowerShell):
 *    $env:NODE_ENV='test'; npx tsx scripts/verify-e2e-availability.ts
 * ============================================================================
 */

import { execSync } from "node:child_process";
import type { Server } from "node:http";
import bcryptjs from "bcryptjs";
import dotenv from "dotenv";
import { and, eq, isNull } from "drizzle-orm";
import pg from "pg";
import { z } from "zod";

// ── a) Bootstrap Portátil e Validação Estrita de Segurança (TEC-19) ───
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "test";
}
dotenv.config();

const baseDatabaseUrl = process.env.DATABASE_URL;
let rawTestDbUrl = process.env.TEST_DATABASE_URL;

if (!rawTestDbUrl && baseDatabaseUrl) {
  try {
    const parsedBase = new URL(baseDatabaseUrl);
    parsedBase.pathname = "/smartbarber_test";
    rawTestDbUrl = parsedBase.toString();
  } catch {
    // Falha de parse será capturada pelo Zod
  }
}

const e2eEnvSchema = z.object({
  NODE_ENV: z.literal("test"),
  TEST_DATABASE_URL: z
    .string()
    .url()
    .refine(
      (urlStr) => {
        try {
          const parsed = new URL(urlStr);
          const isLocalHost =
            parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
          const isSmartbarberTest = parsed.pathname === "/smartbarber_test";
          return isLocalHost && isSmartbarberTest;
        } catch {
          return false;
        }
      },
      {
        message:
          "TEST_DATABASE_URL deve apontar para localhost/127.0.0.1 e banco /smartbarber_test",
      },
    ),
});

const parsedEnv = e2eEnvSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  TEST_DATABASE_URL: rawTestDbUrl,
});

if (!parsedEnv.success) {
  console.error(
    "[SEGURANÇA] Operação abortada! O teste E2E deve ser executado exclusivamente com NODE_ENV=test e banco de testes local em 'smartbarber_test'.",
  );
  process.exit(1);
}

const testDbUrl = parsedEnv.data.TEST_DATABASE_URL;
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDbUrl;

// ── Auto-provisionamento Idempotente do Banco de Testes ───────────────
async function ensureTestDatabaseExists(testUrl: string, devUrl?: string) {
  let adminClient: pg.Client | null = null;
  const candidateUrls: string[] = [];

  if (devUrl) {
    try {
      const parsedDev = new URL(devUrl);
      if (
        parsedDev.hostname === "localhost" ||
        parsedDev.hostname === "127.0.0.1"
      ) {
        candidateUrls.push(devUrl);
      }
    } catch {
      // Ignora devUrl se for inválida
    }
  }
  try {
    const defaultAdmin = new URL(testUrl);
    defaultAdmin.pathname = "/postgres";
    candidateUrls.push(defaultAdmin.toString());
  } catch {
    // ignore
  }

  for (const url of candidateUrls) {
    try {
      const client = new pg.Client({ connectionString: url });
      await client.connect();
      adminClient = client;
      break;
    } catch {
      // continua tentando
    }
  }

  if (!adminClient) {
    console.error(
      "[PROVISIONAMENTO] Falha ao conectar ao servidor PostgreSQL local para auto-provisionamento.",
    );
    process.exit(1);
  }

  try {
    const res = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'smartbarber_test';",
    );
    if (res.rowCount === 0) {
      console.log(
        "[PROVISIONAMENTO] Banco 'smartbarber_test' não encontrado. Criando banco...",
      );
      await adminClient.query("CREATE DATABASE smartbarber_test;");
      console.log(
        "[PROVISIONAMENTO] Banco 'smartbarber_test' criado com sucesso.",
      );
    } else {
      console.log("[PROVISIONAMENTO] Banco 'smartbarber_test' já existe.");
    }
  } finally {
    await adminClient.end();
  }
}

async function ensureSchemaExists(testUrl: string) {
  const client = new pg.Client({ connectionString: testUrl });
  await client.connect();
  let usersTableExists = false;

  try {
    const res = await client.query(
      "SELECT to_regclass('public.users') AS table_exists;",
    );
    usersTableExists = Boolean(res.rows[0]?.table_exists);
  } finally {
    await client.end();
  }

  if (!usersTableExists) {
    console.log(
      "[PROVISIONAMENTO] Tabela 'users' não encontrada em smartbarber_test. Executando drizzle-kit push...",
    );
    execSync("npx drizzle-kit push --force", {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: testUrl,
      },
    });
    console.log(
      "[PROVISIONAMENTO] Schema criado com sucesso via drizzle-kit push.",
    );
  } else {
    console.log(
      "[PROVISIONAMENTO] Schema já provisionado em smartbarber_test.",
    );
  }
}

function getNextMonday(): { dateStr: string; dateObj: Date } {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Domingo, 1 = Segunda, ...
  const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
  const monday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysUntilMonday,
      0,
      0,
      0,
      0,
    ),
  );
  const dateStr = monday.toISOString().split("T")[0];
  return { dateStr, dateObj: monday };
}

function randomDigits(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += String(Math.floor(Math.random() * 10));
  }
  return result;
}

async function runE2E() {
  const { default: app } = await import("../src/app");
  const { db } = await import("../src/infra/drizzle");
  const {
    users,
    barbershops,
    membership,
    services,
    serviceItems,
    shoppingCarts,
    barbershopSchedules,
    bookings,
  } = await import("../src/infra/drizzle/schema");

  console.log("==========================================================");
  console.log("SMART BARBER: TESTE E2E ISOLADO — ISSUE #29 (TEC-14..19)");
  console.log("Jornada do Barbeiro, Escopo, Conflitos 409 e Concorrência");
  console.log("==========================================================\n");

  let server: Server | null = null;
  let hasFailed = false;

  // IDs para limpeza posterior no bloco finally
  let createdOwnerId: string | null = null;
  let createdBarbermanId: string | null = null;
  let createdBarberman2Id: string | null = null;
  let createdOutsiderBarberId: string | null = null;
  let createdBarbershopId: string | null = null;
  let createdBarbershop2Id: string | null = null;
  let createdServiceId: string | null = null;
  let createdServiceItemId: string | null = null;
  let createdCartId: string | null = null;
  let createdBookingId: string | null = null;

  try {
    // ── b) Fixtures Isoladas no banco de teste (TEC-15.1) ──────
    console.log("[ETAPA 1] Criando fixtures isoladas no banco de testes...");
    const timestamp = Date.now();
    const hashedPassword = await bcryptjs.hash("123456", 8);

    const ownerEmail = `owner_${timestamp}@e2e-test.com`;
    const [owner] = await db
      .insert(users)
      .values({
        name: "Proprietário E2E",
        email: ownerEmail,
        password: hashedPassword,
        cpf: randomDigits(11),
        emailVerifiedAt: new Date(),
      })
      .returning();
    createdOwnerId = owner.id;

    const barberEmail = `barber1_${timestamp}@e2e-test.com`;
    const [barberman] = await db
      .insert(users)
      .values({
        name: "Barbeiro 1 E2E",
        email: barberEmail,
        password: hashedPassword,
        cpf: randomDigits(11),
        emailVerifiedAt: new Date(),
      })
      .returning();
    createdBarbermanId = barberman.id;

    const barber2Email = `barber2_${timestamp}@e2e-test.com`;
    const [barberman2] = await db
      .insert(users)
      .values({
        name: "Barbeiro 2 E2E",
        email: barber2Email,
        password: hashedPassword,
        cpf: randomDigits(11),
        emailVerifiedAt: new Date(),
      })
      .returning();
    createdBarberman2Id = barberman2.id;

    const outsiderEmail = `outsider_${timestamp}@e2e-test.com`;
    const [outsiderBarber] = await db
      .insert(users)
      .values({
        name: "Barbeiro Sem Vínculo E2E",
        email: outsiderEmail,
        password: hashedPassword,
        cpf: randomDigits(11),
        emailVerifiedAt: new Date(),
      })
      .returning();
    createdOutsiderBarberId = outsiderBarber.id;

    const [barbershop] = await db
      .insert(barbershops)
      .values({
        name: `Barbearia 1 E2E ${timestamp}`,
        ownerId: owner.id,
        slug: `barbearia-1-e2e-${timestamp}`,
        cnpj: randomDigits(14),
        location: "Rua das Barbas, 123",
        timezone: "America/Sao_Paulo",
        status: "ACTIVE",
      })
      .returning();
    createdBarbershopId = barbershop.id;

    const [barbershop2] = await db
      .insert(barbershops)
      .values({
        name: `Barbearia 2 E2E ${timestamp}`,
        ownerId: owner.id,
        slug: `barbearia-2-e2e-${timestamp}`,
        cnpj: randomDigits(14),
        location: "Avenida das Navalhas, 456",
        timezone: "America/Sao_Paulo",
        status: "ACTIVE",
      })
      .returning();
    createdBarbershop2Id = barbershop2.id;

    // Memberships
    await db.insert(membership).values([
      {
        barbershopId: barbershop.id,
        userId: owner.id,
        role: "OWNER",
      },
      {
        barbershopId: barbershop.id,
        userId: barberman.id,
        role: "BARBERMAN",
      },
      {
        barbershopId: barbershop.id,
        userId: barberman2.id,
        role: "BARBERMAN",
      },
      {
        barbershopId: barbershop2.id,
        userId: owner.id,
        role: "OWNER",
      },
    ]);

    // Service ativo de 30 minutos na Barbearia 1
    const [service] = await db
      .insert(services)
      .values({
        barbershopId: barbershop.id,
        title: "Corte Masculino E2E",
        priceInCents: 5000,
        durationInMinutes: 30,
        isActive: true,
      })
      .returning();
    createdServiceId = service.id;

    // ServiceItem e ShoppingCart associados
    const [serviceItem] = await db
      .insert(serviceItems)
      .values({
        serviceId: service.id,
        titleSnapshot: service.title,
        priceInCentsSnapshot: service.priceInCents,
        durationInMinutesSnapshot: service.durationInMinutes,
      })
      .returning();
    createdServiceItemId = serviceItem.id;

    const [cart] = await db
      .insert(shoppingCarts)
      .values({
        serviceItemId: serviceItem.id,
        userId: owner.id,
        totalPriceInCents: 5000,
      })
      .returning();
    createdCartId = cart.id;

    // Jornadas iniciais:
    // 1. Jornada geral da Barbearia 1 (MONDAY 08:00 - 18:00)
    // 2. Jornada individual do Barbeiro 2 na Barbearia 1 (MONDAY 10:00 - 16:00)
    // 3. Jornada geral da Barbearia 2 (MONDAY 08:00 - 18:00)
    await db.insert(barbershopSchedules).values([
      {
        barbershopId: barbershop.id,
        barbermanId: null,
        createdBy: owner.id,
        dayOfWeek: "MONDAY",
        openTime: "08:00",
        closeTime: "18:00",
      },
      {
        barbershopId: barbershop.id,
        barbermanId: barberman2.id,
        createdBy: barberman2.id,
        dayOfWeek: "MONDAY",
        openTime: "10:00",
        closeTime: "16:00",
      },
      {
        barbershopId: barbershop2.id,
        barbermanId: null,
        createdBy: owner.id,
        dayOfWeek: "MONDAY",
        openTime: "08:00",
        closeTime: "18:00",
      },
    ]);

    console.log(
      "  -> Fixtures (Owner, 3 Barbeiros, 2 Barbearias, Serviços e Jornadas) criadas com sucesso.",
    );

    // ── c) Servidor HTTP e Autenticação Real (TEC-15.1) ────────
    console.log("[ETAPA 2] Inicializando servidor HTTP dinâmico...");
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}/api`;
    console.log(`  -> Servidor ativo na porta ${port}.`);

    console.log(
      "[ETAPA 3] Autenticando Owner, Barbeiro 1 e Outsider via POST /api/staffs/sessions/auth...",
    );
    async function authenticateStaff(
      email: string,
      label: string,
    ): Promise<string> {
      const res = await fetch(`${baseUrl}/staffs/sessions/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: "123456" }),
      });
      if (!res.ok) {
        throw new Error(
          `Falha na autenticação de ${label} (Status ${res.status}): ${await res.text()}`,
        );
      }
      const data = await res.json();
      if (!data.access_token) {
        throw new Error(`Token JWT não retornado para ${label}.`);
      }
      return data.access_token as string;
    }

    const ownerToken = await authenticateStaff(ownerEmail, "Owner");
    const barbermanToken = await authenticateStaff(barberEmail, "Barbeiro 1");
    const outsiderToken = await authenticateStaff(outsiderEmail, "Outsider");
    console.log(
      "  -> Tokens JWT reais obtidos para Owner, Barbeiro 1 e Outsider.",
    );

    // ── d) Fluxo Canônico do Frontend (BARBERMAN + query) e Leitura Pública (TEC-15.2a / TEC-17.2) ──
    console.log(
      "[ETAPA 4] Validando fluxo canônico do Frontend (BARBERMAN + ?barbermanId na query sem barbermanId no body)...",
    );
    const canonicalPutRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${barbermanToken}`,
        },
        body: JSON.stringify({
          schedules: [
            {
              dayOfWeek: "MONDAY",
              openTime: "09:00",
              closeTime: "17:00",
            },
          ],
        }),
      },
    );

    if (canonicalPutRes.status !== 200) {
      throw new Error(
        `Falha no PUT canônico do BARBERMAN (Status ${canonicalPutRes.status}): ${await canonicalPutRes.text()}`,
      );
    }
    console.log(
      "  -> [OK] HTTP 200 recebido no PUT autenticado como BARBERMAN com ?barbermanId na query.",
    );

    // Leitura pública filtrada (sem token JWT)
    const publicFilteredGetRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
    );
    if (publicFilteredGetRes.status !== 200) {
      throw new Error(
        `Falha no GET público filtrado (Status ${publicFilteredGetRes.status})`,
      );
    }
    const filteredGetData = await publicFilteredGetRes.json();
    if (
      !Array.isArray(filteredGetData.schedules) ||
      filteredGetData.schedules.length !== 1 ||
      filteredGetData.schedules[0].barbermanId !== barberman.id ||
      filteredGetData.schedules[0].openTime !== "09:00" ||
      filteredGetData.schedules[0].closeTime !== "17:00"
    ) {
      throw new Error(
        "O GET público filtrado com ?barbermanId não retornou exatamente a jornada persistida do barbeiro.",
      );
    }
    console.log(
      "  -> [OK] GET público com ?barbermanId retornou exatamente a jornada persistida (sem exigir JWT).",
    );

    // Leitura pública sem filtro (retorna jornada geral + individuais da unidade)
    const publicUnfilteredGetRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules`,
    );
    if (publicUnfilteredGetRes.status !== 200) {
      throw new Error(
        `Falha no GET público sem filtro (Status ${publicUnfilteredGetRes.status})`,
      );
    }
    const unfilteredGetData = await publicUnfilteredGetRes.json();
    const allUnitSchedules: Array<{ barbermanId: string | null }> =
      unfilteredGetData.schedules || [];
    const hasGeneralSchedule = allUnitSchedules.some(
      (s) => s.barbermanId === null,
    );
    const hasBarber1Schedule = allUnitSchedules.some(
      (s) => s.barbermanId === barberman.id,
    );
    const hasBarber2Schedule = allUnitSchedules.some(
      (s) => s.barbermanId === barberman2.id,
    );
    if (!hasGeneralSchedule || !hasBarber1Schedule || !hasBarber2Schedule) {
      throw new Error(
        "O GET público sem filtro não retornou conjuntamente a grade geral e as grades individuais da unidade.",
      );
    }
    console.log(
      "  -> [OK] GET público sem filtro retornou a grade geral (barbermanId: null) e as grades individuais (TEC-17).",
    );

    // ── d.2) Bloqueios de Autorização (403) e Autenticação (401) (TEC-15.2b-e) ──
    console.log(
      "[ETAPA 4B] Validando bloqueios de autorização (403) e autenticação (401)...",
    );

    // (b) BARBERMAN tenta alterar barberman2
    const editOtherBarberRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman2.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${barbermanToken}`,
        },
        body: JSON.stringify({
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "08:00", closeTime: "12:00" },
          ],
        }),
      },
    );
    if (editOtherBarberRes.status !== 403) {
      throw new Error(
        `Esperava 403 ao BARBERMAN tentar editar outro barbeiro, mas recebeu ${editOtherBarberRes.status}`,
      );
    }

    // (c) BARBERMAN omite barbermanId tentando alterar a jornada geral
    const editGeneralByBarberRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${barbermanToken}`,
        },
        body: JSON.stringify({
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "10:00", closeTime: "14:00" },
          ],
        }),
      },
    );
    if (editGeneralByBarberRes.status !== 403) {
      throw new Error(
        `Esperava 403 ao BARBERMAN tentar editar jornada geral, mas recebeu ${editGeneralByBarberRes.status}`,
      );
    }

    // (d) outsiderBarber tenta salvar jornada na barbershop1 (sem vínculo)
    const outsiderPutRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${outsiderBarber.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${outsiderToken}`,
        },
        body: JSON.stringify({
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
          ],
        }),
      },
    );
    if (outsiderPutRes.status !== 403) {
      throw new Error(
        `Esperava 403 para barbeiro sem vínculo na barbearia, mas recebeu ${outsiderPutRes.status}`,
      );
    }

    // (e) PUT sem token e com token inválido -> 401
    const noTokenPutRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedules: [] }),
      },
    );
    if (noTokenPutRes.status !== 401) {
      throw new Error(
        `Esperava 401 para PUT sem token, mas recebeu ${noTokenPutRes.status}`,
      );
    }

    const invalidTokenPutRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token.jwt.invalido",
        },
        body: JSON.stringify({ schedules: [] }),
      },
    );
    if (invalidTokenPutRes.status !== 401) {
      throw new Error(
        `Esperava 401 para PUT com token inválido, mas recebeu ${invalidTokenPutRes.status}`,
      );
    }

    // Confirma no PostgreSQL que nenhuma tentativa 401/403 alterou o banco
    const barber2SchedulesCheck = await db
      .select()
      .from(barbershopSchedules)
      .where(
        and(
          eq(barbershopSchedules.barbershopId, barbershop.id),
          eq(barbershopSchedules.barbermanId, barberman2.id),
        ),
      );
    const generalSchedulesCheck = await db
      .select()
      .from(barbershopSchedules)
      .where(
        and(
          eq(barbershopSchedules.barbershopId, barbershop.id),
          isNull(barbershopSchedules.barbermanId),
        ),
      );
    if (
      barber2SchedulesCheck.length !== 1 ||
      barber2SchedulesCheck[0].openTime !== "10:00" ||
      generalSchedulesCheck.length !== 1 ||
      generalSchedulesCheck[0].openTime !== "08:00"
    ) {
      throw new Error(
        "Mutação indevida detectada no banco após tentativas bloqueadas com 401/403!",
      );
    }
    console.log(
      "  -> [OK] Bloqueios 403 e 401 validados com zero mutação no PostgreSQL.",
    );

    // ── d.3) Precedência de Escopo e Anti-Spoofing (TEC-16) ────
    console.log(
      "[ETAPA 4C] Validando precedência de escopo e anti-spoofing (TEC-16)...",
    );

    // Divergência entre query.barbermanId e body.barbermanId -> 400
    const divergentBarberRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          barbermanId: barberman2.id,
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
          ],
        }),
      },
    );
    if (divergentBarberRes.status !== 400) {
      throw new Error(
        `Esperava 400 para barbermanId divergente entre body e query, mas recebeu ${divergentBarberRes.status}`,
      );
    }

    // Divergência entre params.shopId e query.shopId -> 400
    const divergentQueryShopRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?shopId=${barbershop2.id}&barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
          ],
        }),
      },
    );
    if (divergentQueryShopRes.status !== 400) {
      throw new Error(
        `Esperava 400 para query.shopId divergente de params.shopId, mas recebeu ${divergentQueryShopRes.status}`,
      );
    }

    // Divergência entre params.shopId e body.shopId -> 400
    const divergentBodyShopRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          shopId: barbershop2.id,
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
          ],
        }),
      },
    );
    if (divergentBodyShopRes.status !== 400) {
      throw new Error(
        `Esperava 400 para body.shopId divergente de params.shopId, mas recebeu ${divergentBodyShopRes.status}`,
      );
    }

    // Anti-spoofing: BARBERMAN envia userId e createdBy do OWNER na query e no body tentando alterar a grade geral -> continua barrado com 403
    const spoofedOwnerRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?userId=${owner.id}&createdBy=${owner.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${barbermanToken}`,
        },
        body: JSON.stringify({
          userId: owner.id,
          createdBy: owner.id,
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
          ],
        }),
      },
    );
    if (spoofedOwnerRes.status !== 403) {
      throw new Error(
        `Falha de segurança anti-spoofing! Esperava 403 quando BARBERMAN injeta userId/createdBy do Owner, mas recebeu ${spoofedOwnerRes.status}`,
      );
    }
    console.log(
      "  -> [OK] Precedência de escopo (400) e proteção anti-spoofing de JWT (403) comprovadas.",
    );

    // ── d.4) Validação 400 e Períodos Gerais Contíguos (TEC-15.4) ──
    console.log(
      "[ETAPA 4D] Validando rejeição 400 para horários malformados/invertidos e períodos gerais contíguos...",
    );

    // Horário invertido (18:00 - 09:00) -> 400
    const invertedHoursRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${barbermanToken}`,
        },
        body: JSON.stringify({
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "18:00", closeTime: "09:00" },
          ],
        }),
      },
    );
    if (invertedHoursRes.status !== 400) {
      throw new Error(
        `Esperava 400 para horário invertido (18:00-09:00), mas recebeu ${invertedHoursRes.status}`,
      );
    }
    const invertedBody = await invertedHoursRes.json();
    if (!invertedBody.error) {
      throw new Error(
        "Resposta 400 de horário invertido não trouxe campo 'error'.",
      );
    }

    // Horário malformado (Zod regex) -> 400 com error e errors
    const malformedHoursRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${barbermanToken}`,
        },
        body: JSON.stringify({
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "25:99", closeTime: "17:00" },
          ],
        }),
      },
    );
    if (malformedHoursRes.status !== 400) {
      throw new Error(
        `Esperava 400 para horário malformado, mas recebeu ${malformedHoursRes.status}`,
      );
    }
    const malformedBody = await malformedHoursRes.json();
    if (!malformedBody.error || !Array.isArray(malformedBody.errors)) {
      throw new Error(
        "Resposta 400 do Zod não preservou o envelope { error, errors } (TEC-12).",
      );
    }

    // OWNER configura dois períodos gerais contíguos na segunda-feira (08:00-12:00 e 12:00-18:00)
    const contiguousGeneralRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "08:00", closeTime: "12:00" },
            { dayOfWeek: "MONDAY", openTime: "12:00", closeTime: "18:00" },
          ],
        }),
      },
    );
    if (contiguousGeneralRes.status !== 200) {
      throw new Error(
        `Falha ao configurar períodos gerais contíguos pelo OWNER (Status ${contiguousGeneralRes.status})`,
      );
    }

    // BARBERMAN tenta turno único atravessando ambos os períodos gerais contíguos (09:00-17:00) -> 400
    const spanningShiftRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${barbermanToken}`,
        },
        body: JSON.stringify({
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
          ],
        }),
      },
    );
    if (spanningShiftRes.status !== 400) {
      throw new Error(
        `Esperava 400 ao enviar turno único atravessando dois períodos gerais contíguos, mas recebeu ${spanningShiftRes.status}`,
      );
    }

    // BARBERMAN envia dois turnos separados (09:00-12:00 e 12:00-17:00) -> 200 OK
    const splitShiftsRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${barbermanToken}`,
        },
        body: JSON.stringify({
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "12:00" },
            { dayOfWeek: "MONDAY", openTime: "12:00", closeTime: "17:00" },
          ],
        }),
      },
    );
    if (splitShiftsRes.status !== 200) {
      throw new Error(
        `Esperava 200 ao enviar dois turnos separados respeitando os períodos gerais contíguos, mas recebeu ${splitShiftsRes.status}`,
      );
    }

    // Restaura a grade geral contínua (08:00-18:00) e individual contínua (09:00-17:00) para os testes seguintes
    await fetch(`${baseUrl}/barbershops/${barbershop.id}/schedules`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        schedules: [
          { dayOfWeek: "MONDAY", openTime: "08:00", closeTime: "18:00" },
        ],
      }),
    });
    await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${barbermanToken}`,
        },
        body: JSON.stringify({
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
          ],
        }),
      },
    );
    console.log(
      "  -> [OK] Validação 400 e regra de períodos gerais contíguos validadas com sucesso.",
    );

    // ── e) Semeadura de Booking Conflitante no Banco ───────────
    console.log(
      "[ETAPA 5] Inserindo agendamento conflitante no banco de dados...",
    );
    const nextMonday = getNextMonday();
    console.log(
      `  -> Data da próxima segunda-feira calculada: ${nextMonday.dateStr}`,
    );

    const [createdBooking] = await db
      .insert(bookings)
      .values({
        barbershopId: barbershop.id,
        barbermanId: barberman.id,
        shoppingCartId: cart.id,
        date: nextMonday.dateObj, // meia-noite UTC
        startTime: "10:00",
        endTime: "10:30",
      })
      .returning();
    createdBookingId = createdBooking.id;
    console.log(
      `  -> Reserva inserida para ${nextMonday.dateStr} das 10:00 às 10:30 [ID: ${createdBooking.id}].`,
    );

    // ── f) Validação de Disponibilidade via HTTP GET ───────────
    console.log(
      "[ETAPA 6] Consultando disponibilidade via GET /api/barbershops/:shopId/availability...",
    );
    const availabilityUrl = `${baseUrl}/barbershops/${barbershop.id}/availability?date=${nextMonday.dateStr}&serviceIds=${service.id}&barbermanId=${barberman.id}`;
    const getRes = await fetch(availabilityUrl);

    if (getRes.status !== 200) {
      throw new Error(
        `Falha ao calcular disponibilidade (Status ${getRes.status}): ${await getRes.text()}`,
      );
    }

    const availabilityData = await getRes.json();
    const slots: Array<{ start: string; end: string }> =
      availabilityData.slots || [];

    console.log(`  -> Total de slots disponíveis retornados: ${slots.length}`);
    const slotStarts = slots.map((s) => s.start);

    // Confirmar que o slot das 10:00 foi excluído
    const hasConflictSlot = slotStarts.some((s) => s.includes("T10:00:"));
    if (hasConflictSlot) {
      throw new Error(
        "ERRO: O slot das 10:00 deveria ter sido excluído devido ao booking persistido, mas foi retornado!",
      );
    }
    console.log(
      "  -> [OK] Slot das 10:00 foi corretamente excluído pelo motor.",
    );

    // Confirmar que slots livres adjacentes existem
    const has0900 = slotStarts.some((s) => s.includes("T09:00:"));
    const has0930 = slotStarts.some((s) => s.includes("T09:30:"));
    const has1030 = slotStarts.some((s) => s.includes("T10:30:"));

    if (!has0900 || !has0930 || !has1030) {
      throw new Error(
        "ERRO: Slots livres esperados (09:00, 09:30, 10:30) não foram retornados na grade!",
      );
    }
    console.log(
      "  -> [OK] Slots livres (09:00, 09:30, 10:30) mantidos com sucesso.",
    );

    // ── g) Proteção de Reservas Futuras 409 (Individual, Vazio e Geral) + Limpeza Isolada (TEC-14 / TEC-15.3) ──
    console.log(
      "[ETAPA 7] Validando proteção 409 (individual, limpeza vazia com reserva e geral) e limpeza isolada...",
    );

    // 7.1 Redução de jornada individual conflitando com booking 10:00-10:30 -> 409
    const conflictingPutRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${barbermanToken}`,
        },
        body: JSON.stringify({
          schedules: [
            {
              dayOfWeek: "MONDAY",
              openTime: "11:00",
              closeTime: "17:00",
            },
          ],
        }),
      },
    );

    if (conflictingPutRes.status !== 409) {
      throw new Error(
        `Esperava HTTP 409 ao encurtar jornada individual com reserva futura, mas recebeu Status ${conflictingPutRes.status}`,
      );
    }

    const conflictData = await conflictingPutRes.json();
    if (
      conflictData.code !== "SCHEDULE_BOOKING_CONFLICT" ||
      !Array.isArray(conflictData.conflicts) ||
      !conflictData.conflicts.some(
        (c: { bookingId: string }) => c.bookingId === createdBooking.id,
      )
    ) {
      throw new Error(
        "Payload 409 inválido ao encurtar jornada individual com reserva ativa.",
      );
    }

    // 7.2 Limpeza { schedules: [] } com reserva futura ativa -> 409
    const clearWithBookingRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${barbermanToken}`,
        },
        body: JSON.stringify({ schedules: [] }),
      },
    );
    if (clearWithBookingRes.status !== 409) {
      throw new Error(
        `Esperava HTTP 409 ao limpar jornada individual com reserva futura ativa, mas recebeu ${clearWithBookingRes.status}`,
      );
    }

    // 7.3 OWNER tenta encurtar a jornada geral (11:00-18:00) deixando a reserva das 10:00 descoberta -> 409
    const conflictingGeneralPutRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          schedules: [
            {
              dayOfWeek: "MONDAY",
              openTime: "11:00",
              closeTime: "18:00",
            },
          ],
        }),
      },
    );
    if (conflictingGeneralPutRes.status !== 409) {
      throw new Error(
        `Esperava HTTP 409 ao OWNER encurtar jornada geral conflitando com reserva futura, mas recebeu ${conflictingGeneralPutRes.status}`,
      );
    }
    const generalConflictData = await conflictingGeneralPutRes.json();
    if (
      generalConflictData.code !== "SCHEDULE_BOOKING_CONFLICT" ||
      !Array.isArray(generalConflictData.conflicts) ||
      !generalConflictData.conflicts.some(
        (c: { bookingId: string }) => c.bookingId === createdBooking.id,
      )
    ) {
      throw new Error(
        "Payload 409 inválido ao encurtar jornada geral com reserva ativa.",
      );
    }

    // Validar que tanto a jornada individual quanto a geral permaneceram intactas no banco após os três 409
    const schedulesAfterRollback = await db
      .select()
      .from(barbershopSchedules)
      .where(
        and(
          eq(barbershopSchedules.barbershopId, barbershop.id),
          eq(barbershopSchedules.barbermanId, barberman.id),
        ),
      );
    const generalAfterRollback = await db
      .select()
      .from(barbershopSchedules)
      .where(
        and(
          eq(barbershopSchedules.barbershopId, barbershop.id),
          isNull(barbershopSchedules.barbermanId),
        ),
      );
    if (
      schedulesAfterRollback.length !== 1 ||
      schedulesAfterRollback[0].openTime !== "09:00" ||
      generalAfterRollback.length !== 1 ||
      generalAfterRollback[0].openTime !== "08:00"
    ) {
      throw new Error(
        "A jornada individual ou geral foi alterada indevidamente no banco após colisão 409!",
      );
    }
    console.log(
      "  -> [OK] HTTP 409 (individual, vazio e geral) e preservação no PostgreSQL comprovados.",
    );

    // 7.4 Remove a reserva conflitante e testa limpeza isolada { schedules: [] } pelo BARBERMAN
    await db.delete(bookings).where(eq(bookings.id, createdBooking.id));
    createdBookingId = null;

    const clearEmptyRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${barbermanToken}`,
        },
        body: JSON.stringify({ schedules: [] }),
      },
    );
    if (clearEmptyRes.status !== 200) {
      throw new Error(
        `Esperava 200 ao limpar semana sem reservas futuras conflitantes, mas recebeu ${clearEmptyRes.status}`,
      );
    }

    const getAfterClearRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
    );
    const getAfterClearData = await getAfterClearRes.json();
    if (
      !Array.isArray(getAfterClearData.schedules) ||
      getAfterClearData.schedules.length !== 0
    ) {
      throw new Error(
        "GET do barbeiro após limpeza { schedules: [] } deveria retornar array vazio [].",
      );
    }

    // Verifica isolamento no PostgreSQL: geral da barbershop1, barberman2 e barbershop2 intactos
    const generalStillIntact = await db
      .select()
      .from(barbershopSchedules)
      .where(
        and(
          eq(barbershopSchedules.barbershopId, barbershop.id),
          isNull(barbershopSchedules.barbermanId),
        ),
      );
    const barber2StillIntact = await db
      .select()
      .from(barbershopSchedules)
      .where(
        and(
          eq(barbershopSchedules.barbershopId, barbershop.id),
          eq(barbershopSchedules.barbermanId, barberman2.id),
        ),
      );
    const shop2StillIntact = await db
      .select()
      .from(barbershopSchedules)
      .where(eq(barbershopSchedules.barbershopId, barbershop2.id));

    if (
      generalStillIntact.length !== 1 ||
      barber2StillIntact.length !== 1 ||
      shop2StillIntact.length !== 1
    ) {
      throw new Error(
        "A limpeza da semana do Barbeiro 1 afetou indevidamente a jornada geral, outro barbeiro ou outra unidade!",
      );
    }
    console.log(
      "  -> [OK] Limpeza { schedules: [] } concluída com isolamento total de escopo no PostgreSQL.",
    );

    // ── h) Concorrência Real no PostgreSQL (TEC-18) ────────────
    console.log(
      "[ETAPA 8] Validando concorrência real no PostgreSQL com Promise.all (TEC-18)...",
    );

    // (a) Dois PUT simultâneos para o mesmo barbermanId (1 turno vs 2 turnos)
    const [concurrentRes1, concurrentRes2] = await Promise.all([
      fetch(
        `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${barbermanToken}`,
          },
          body: JSON.stringify({
            schedules: [
              { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "12:00" },
            ],
          }),
        },
      ),
      fetch(
        `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${barbermanToken}`,
          },
          body: JSON.stringify({
            schedules: [
              { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "11:00" },
              { dayOfWeek: "MONDAY", openTime: "13:00", closeTime: "16:00" },
            ],
          }),
        },
      ),
    ]);

    if (concurrentRes1.status !== 200 || concurrentRes2.status !== 200) {
      throw new Error(
        `Falha nos PUTs concorrentes do mesmo barbeiro: Status ${concurrentRes1.status} e ${concurrentRes2.status}`,
      );
    }

    const rowsAfterConcurrentSameBarber = await db
      .select()
      .from(barbershopSchedules)
      .where(
        and(
          eq(barbershopSchedules.barbershopId, barbershop.id),
          eq(barbershopSchedules.barbermanId, barberman.id),
        ),
      );

    const sortedSameBarber = [...rowsAfterConcurrentSameBarber]
      .sort((a, b) => a.openTime.localeCompare(b.openTime))
      .map((r) => ({
        dayOfWeek: r.dayOfWeek,
        openTime: r.openTime,
        closeTime: r.closeTime,
        isOpen: true,
        barbermanId: r.barbermanId,
      }));

    const expectedPayloadA = [
      {
        dayOfWeek: "MONDAY",
        openTime: "09:00",
        closeTime: "12:00",
        isOpen: true,
        barbermanId: barberman.id,
      },
    ];
    const expectedPayloadB = [
      {
        dayOfWeek: "MONDAY",
        openTime: "09:00",
        closeTime: "11:00",
        isOpen: true,
        barbermanId: barberman.id,
      },
      {
        dayOfWeek: "MONDAY",
        openTime: "13:00",
        closeTime: "16:00",
        isOpen: true,
        barbermanId: barberman.id,
      },
    ];

    const matchesPayloadA =
      JSON.stringify(sortedSameBarber) === JSON.stringify(expectedPayloadA);
    const matchesPayloadB =
      JSON.stringify(sortedSameBarber) === JSON.stringify(expectedPayloadB);

    if (!matchesPayloadA && !matchesPayloadB) {
      throw new Error(
        `Corrupção de concorrência na Etapa 8.1! Estado final no banco não corresponde exatamente nem ao payload A nem ao payload B: ${JSON.stringify(sortedSameBarber)}`,
      );
    }
    console.log(
      `  -> [OK] PUTs simultâneos no mesmo barbeiro serializados pelo advisory lock (corresponde exatamente ao payload ${matchesPayloadA ? "A (1 turno)" : "B (2 turnos)"}, sem mistura).`,
    );

    // (b) PUT geral e PUT individual simultâneos na mesma barbearia
    const [concurrentGeneralRes, concurrentIndividualRes] = await Promise.all([
      fetch(`${baseUrl}/barbershops/${barbershop.id}/schedules`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "08:00", closeTime: "18:00" },
            { dayOfWeek: "WEDNESDAY", openTime: "08:00", closeTime: "18:00" },
          ],
        }),
      }),
      fetch(
        `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${barbermanToken}`,
          },
          body: JSON.stringify({
            schedules: [
              { dayOfWeek: "MONDAY", openTime: "09:00", closeTime: "17:00" },
            ],
          }),
        },
      ),
    ]);

    if (
      concurrentGeneralRes.status !== 200 ||
      concurrentIndividualRes.status !== 200
    ) {
      throw new Error(
        `Falha nos PUTs concorrentes geral vs individual: Status ${concurrentGeneralRes.status} e ${concurrentIndividualRes.status}`,
      );
    }

    // Valida no PostgreSQL os dois escopos separadamente após o Promise.all (Etapa 8.2)
    const generalRowsAfterConcurrent = await db
      .select()
      .from(barbershopSchedules)
      .where(
        and(
          eq(barbershopSchedules.barbershopId, barbershop.id),
          isNull(barbershopSchedules.barbermanId),
        ),
      );
    const individualRowsAfterConcurrent = await db
      .select()
      .from(barbershopSchedules)
      .where(
        and(
          eq(barbershopSchedules.barbershopId, barbershop.id),
          eq(barbershopSchedules.barbermanId, barberman.id),
        ),
      );

    const sortedGeneralAfterConcurrent = [...generalRowsAfterConcurrent]
      .sort(
        (a, b) =>
          a.dayOfWeek.localeCompare(b.dayOfWeek) ||
          a.openTime.localeCompare(b.openTime),
      )
      .map((r) => ({
        dayOfWeek: r.dayOfWeek,
        openTime: r.openTime,
        closeTime: r.closeTime,
        isOpen: true,
        barbermanId: r.barbermanId,
      }));

    const expectedGeneralConcurrent = [
      {
        dayOfWeek: "MONDAY",
        openTime: "08:00",
        closeTime: "18:00",
        isOpen: true,
        barbermanId: null,
      },
      {
        dayOfWeek: "WEDNESDAY",
        openTime: "08:00",
        closeTime: "18:00",
        isOpen: true,
        barbermanId: null,
      },
    ];

    if (
      JSON.stringify(sortedGeneralAfterConcurrent) !==
      JSON.stringify(expectedGeneralConcurrent)
    ) {
      throw new Error(
        `Corrupção na Etapa 8.2 (Escopo Geral)! Estado no banco diverge do esperado: ${JSON.stringify(sortedGeneralAfterConcurrent)}`,
      );
    }

    const sortedIndividualAfterConcurrent = [...individualRowsAfterConcurrent]
      .sort(
        (a, b) =>
          a.dayOfWeek.localeCompare(b.dayOfWeek) ||
          a.openTime.localeCompare(b.openTime),
      )
      .map((r) => ({
        dayOfWeek: r.dayOfWeek,
        openTime: r.openTime,
        closeTime: r.closeTime,
        isOpen: true,
        barbermanId: r.barbermanId,
      }));

    const expectedIndividualConcurrent = [
      {
        dayOfWeek: "MONDAY",
        openTime: "09:00",
        closeTime: "17:00",
        isOpen: true,
        barbermanId: barberman.id,
      },
    ];

    if (
      JSON.stringify(sortedIndividualAfterConcurrent) !==
      JSON.stringify(expectedIndividualConcurrent)
    ) {
      throw new Error(
        `Corrupção na Etapa 8.2 (Escopo Individual)! Estado no banco diverge do esperado: ${JSON.stringify(sortedIndividualAfterConcurrent)}`,
      );
    }
    console.log(
      "  -> [OK] PUTs simultâneos Geral vs Individual validados no PostgreSQL sem vazamento ou sobrescrita entre escopos.",
    );

    // (c) PUT simultâneos na barbershop1 e na barbershop2 (Etapa 8.3)
    const [concurrentShop1Res, concurrentShop2Res] = await Promise.all([
      fetch(
        `${baseUrl}/barbershops/${barbershop.id}/schedules?barbermanId=${barberman.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${barbermanToken}`,
          },
          body: JSON.stringify({
            schedules: [
              { dayOfWeek: "MONDAY", openTime: "10:00", closeTime: "16:00" },
            ],
          }),
        },
      ),
      fetch(`${baseUrl}/barbershops/${barbershop2.id}/schedules`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          schedules: [
            { dayOfWeek: "MONDAY", openTime: "07:00", closeTime: "19:00" },
          ],
        }),
      }),
    ]);

    if (
      concurrentShop1Res.status !== 200 ||
      concurrentShop2Res.status !== 200
    ) {
      throw new Error(
        `Falha nos PUTs simultâneos multi-barbearia: Status ${concurrentShop1Res.status} e ${concurrentShop2Res.status}`,
      );
    }

    // 1. Valida no PostgreSQL a jornada individual do barberman.id na barbershop1 (Etapa 8.3)
    const shop1BarberSchedulesFinal = await db
      .select()
      .from(barbershopSchedules)
      .where(
        and(
          eq(barbershopSchedules.barbershopId, barbershop.id),
          eq(barbershopSchedules.barbermanId, barberman.id),
        ),
      );

    const normalizedShop1BarberFinal = [...shop1BarberSchedulesFinal]
      .sort(
        (a, b) =>
          a.dayOfWeek.localeCompare(b.dayOfWeek) ||
          a.openTime.localeCompare(b.openTime),
      )
      .map((r) => ({
        dayOfWeek: r.dayOfWeek,
        openTime: r.openTime,
        closeTime: r.closeTime,
        isOpen: true,
        barbermanId: r.barbermanId,
      }));

    const expectedShop1BarberFinal = [
      {
        dayOfWeek: "MONDAY",
        openTime: "10:00",
        closeTime: "16:00",
        isOpen: true,
        barbermanId: barberman.id,
      },
    ];

    if (
      JSON.stringify(normalizedShop1BarberFinal) !==
      JSON.stringify(expectedShop1BarberFinal)
    ) {
      throw new Error(
        `Corrupção na Etapa 8.3 (Barbearia 1 - Individual)! Estado no banco diverge do esperado: ${JSON.stringify(normalizedShop1BarberFinal)}`,
      );
    }

    // Confere também que a grade geral (barbermanId IS NULL) da barbershop1 permaneceu intacta
    const shop1GeneralSchedulesFinal = await db
      .select()
      .from(barbershopSchedules)
      .where(
        and(
          eq(barbershopSchedules.barbershopId, barbershop.id),
          isNull(barbershopSchedules.barbermanId),
        ),
      );

    const normalizedShop1GeneralFinal = [...shop1GeneralSchedulesFinal]
      .sort(
        (a, b) =>
          a.dayOfWeek.localeCompare(b.dayOfWeek) ||
          a.openTime.localeCompare(b.openTime),
      )
      .map((r) => ({
        dayOfWeek: r.dayOfWeek,
        openTime: r.openTime,
        closeTime: r.closeTime,
        isOpen: true,
        barbermanId: r.barbermanId,
      }));

    if (
      JSON.stringify(normalizedShop1GeneralFinal) !==
      JSON.stringify(expectedGeneralConcurrent)
    ) {
      throw new Error(
        `Corrupção na Etapa 8.3 (Barbearia 1 - Geral)! A grade geral da Barbearia 1 foi afetada: ${JSON.stringify(normalizedShop1GeneralFinal)}`,
      );
    }

    // 2. Valida no PostgreSQL os campos exatos da barbershop2 (Etapa 8.3)
    const shop2SchedulesFinal = await db
      .select()
      .from(barbershopSchedules)
      .where(eq(barbershopSchedules.barbershopId, barbershop2.id));

    const normalizedShop2Final = [...shop2SchedulesFinal]
      .sort(
        (a, b) =>
          a.dayOfWeek.localeCompare(b.dayOfWeek) ||
          a.openTime.localeCompare(b.openTime),
      )
      .map((r) => ({
        dayOfWeek: r.dayOfWeek,
        openTime: r.openTime,
        closeTime: r.closeTime,
        isOpen: true,
        barbermanId: r.barbermanId,
      }));

    const expectedShop2Final = [
      {
        dayOfWeek: "MONDAY",
        openTime: "07:00",
        closeTime: "19:00",
        isOpen: true,
        barbermanId: null,
      },
    ];

    if (
      shop2SchedulesFinal.length !== 1 ||
      JSON.stringify(normalizedShop2Final) !==
        JSON.stringify(expectedShop2Final)
    ) {
      throw new Error(
        `A atualização concorrente da Barbearia 2 não persistiu os dados exatos esperados: ${JSON.stringify(normalizedShop2Final)}`,
      );
    }
    console.log(
      "  -> [OK] PUTs simultâneos entre barbearias distintas executados e validados campo a campo no PostgreSQL sem interferência.",
    );

    console.log("\n==========================================================");
    console.log(
      "TESTE E2E (ISSUE #29 + TEC-14..19) FINALIZADO COM 100% DE SUCESSO!",
    );
    console.log("==========================================================\n");
  } catch (error) {
    console.error("\n[FALHA NO TESTE E2E]:", error);
    hasFailed = true;
    process.exitCode = 1;
  } finally {
    // ── i) Limpeza Completa (Cleanup) no bloco finally ─────────
    console.log(
      "[CLEANUP] Limpando todas as fixtures do banco de teste e encerrando servidor...",
    );

    try {
      if (createdBookingId) {
        await db.delete(bookings).where(eq(bookings.id, createdBookingId));
      }
      if (createdCartId) {
        await db
          .delete(shoppingCarts)
          .where(eq(shoppingCarts.id, createdCartId));
      }
      if (createdServiceItemId) {
        await db
          .delete(serviceItems)
          .where(eq(serviceItems.id, createdServiceItemId));
      }
      if (createdServiceId) {
        await db.delete(services).where(eq(services.id, createdServiceId));
      }
      if (createdBarbershopId) {
        await db
          .delete(bookings)
          .where(eq(bookings.barbershopId, createdBarbershopId));
        await db
          .delete(barbershopSchedules)
          .where(eq(barbershopSchedules.barbershopId, createdBarbershopId));
        await db
          .delete(membership)
          .where(eq(membership.barbershopId, createdBarbershopId));
        await db
          .delete(barbershops)
          .where(eq(barbershops.id, createdBarbershopId));
      }
      if (createdBarbershop2Id) {
        await db
          .delete(bookings)
          .where(eq(bookings.barbershopId, createdBarbershop2Id));
        await db
          .delete(barbershopSchedules)
          .where(eq(barbershopSchedules.barbershopId, createdBarbershop2Id));
        await db
          .delete(membership)
          .where(eq(membership.barbershopId, createdBarbershop2Id));
        await db
          .delete(barbershops)
          .where(eq(barbershops.id, createdBarbershop2Id));
      }
      if (createdBarbermanId) {
        await db.delete(users).where(eq(users.id, createdBarbermanId));
      }
      if (createdBarberman2Id) {
        await db.delete(users).where(eq(users.id, createdBarberman2Id));
      }
      if (createdOutsiderBarberId) {
        await db.delete(users).where(eq(users.id, createdOutsiderBarberId));
      }
      if (createdOwnerId) {
        await db.delete(users).where(eq(users.id, createdOwnerId));
      }
      console.log("  -> Dados de teste removidos do banco com sucesso.");
    } catch (cleanupError) {
      console.error("[CLEANUP ERROR] Falha ao limpar fixtures:", cleanupError);
      hasFailed = true;
      process.exitCode = 1;
    }

    if (server) {
      try {
        server.closeAllConnections?.();
        await new Promise<void>((resolve, reject) => {
          server?.close((err) => (err ? reject(err) : resolve()));
        });
        console.log("  -> Servidor HTTP encerrado.");
      } catch (closeError) {
        console.error(
          "[CLEANUP ERROR] Falha ao encerrar servidor HTTP:",
          closeError,
        );
        hasFailed = true;
        process.exitCode = 1;
      }
    }

    if (hasFailed || process.exitCode === 1) {
      process.exit(1);
    }
  }
}

async function bootstrap() {
  await ensureTestDatabaseExists(testDbUrl, baseDatabaseUrl);
  await ensureSchemaExists(testDbUrl);
  await runE2E();
}

bootstrap().catch((error) => {
  console.error("\n[FALHA NO BOOTSTRAP E2E]:", error);
  process.exit(1);
});
