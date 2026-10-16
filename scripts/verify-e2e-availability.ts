import "dotenv/config";
import { execSync } from "node:child_process";
import type { Server } from "node:http";
import bcryptjs from "bcryptjs";
import { and, eq } from "drizzle-orm";
import pg from "pg";
import { z } from "zod";

// ── a) Validação Estrita de Segurança e Variáveis de Ambiente ────────
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
  console.log("SMART BARBER: TESTE E2E ISOLADO — ISSUE #29");
  console.log("Jornada Individual do Barbeiro & Disponibilidade Conflitante");
  console.log("==========================================================\n");

  let server: Server | null = null;

  // IDs para limpeza posterior
  let createdOwnerId: string | null = null;
  let createdBarbermanId: string | null = null;
  let createdBarbershopId: string | null = null;
  let createdServiceId: string | null = null;
  let createdServiceItemId: string | null = null;
  let createdCartId: string | null = null;
  let createdBookingId: string | null = null;

  try {
    // ── b) Fixtures Isoladas no banco de teste ─────────────────
    console.log("[ETAPA 1] Criando fixtures isoladas no banco de testes...");
    const timestamp = Date.now();
    const hashedPassword = await bcryptjs.hash("123456", 8);

    const ownerEmail = `owner_${timestamp}@e2e-test.com`;
    const ownerCpf = String(
      Math.floor(10000000000 + Math.random() * 89999999999),
    );
    const [owner] = await db
      .insert(users)
      .values({
        name: "Proprietário E2E",
        email: ownerEmail,
        password: hashedPassword,
        cpf: ownerCpf,
        emailVerifiedAt: new Date(),
      })
      .returning();
    createdOwnerId = owner.id;

    const barberEmail = `barber_${timestamp}@e2e-test.com`;
    const barberCpf = String(
      Math.floor(10000000000 + Math.random() * 89999999999),
    );
    const [barberman] = await db
      .insert(users)
      .values({
        name: "Barbeiro E2E",
        email: barberEmail,
        password: hashedPassword,
        cpf: barberCpf,
        emailVerifiedAt: new Date(),
      })
      .returning();
    createdBarbermanId = barberman.id;

    const [barbershop] = await db
      .insert(barbershops)
      .values({
        name: `Barbearia E2E ${timestamp}`,
        ownerId: owner.id,
        slug: `barbearia-e2e-${timestamp}`,
        cnpj: String(
          Math.floor(10000000000000 + Math.random() * 89999999999999),
        ),
        location: "Rua das Barbas, 123",
        timezone: "America/Sao_Paulo",
        status: "ACTIVE",
      })
      .returning();
    createdBarbershopId = barbershop.id;

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
    ]);

    // Service ativo de 30 minutos
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

    // Jornada geral da barbearia (MONDAY 08:00 - 18:00, sem barbermanId)
    await db.insert(barbershopSchedules).values({
      barbershopId: barbershop.id,
      barbermanId: null,
      createdBy: owner.id,
      dayOfWeek: "MONDAY",
      openTime: "08:00",
      closeTime: "18:00",
    });

    console.log("  -> Fixtures criadas com sucesso.");

    // ── c) Servidor HTTP e Autenticação ────────────────────────
    console.log("[ETAPA 2] Inicializando servidor HTTP dinâmico...");
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}/api`;
    console.log(`  -> Servidor ativo na porta ${port}.`);

    console.log(
      "[ETAPA 3] Autenticando Owner via POST /api/staffs/sessions/auth...",
    );
    const loginRes = await fetch(`${baseUrl}/staffs/sessions/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: ownerEmail,
        password: "123456",
      }),
    });

    if (!loginRes.ok) {
      throw new Error(
        `Falha na autenticação do Owner (Status ${loginRes.status}): ${await loginRes.text()}`,
      );
    }

    const { access_token } = await loginRes.json();
    if (!access_token) {
      throw new Error("Token de acesso JWT não retornado.");
    }
    console.log("  -> Token JWT obtido com sucesso.");

    // ── d) Atualização de Jornada Individual via HTTP PUT ──────
    console.log(
      "[ETAPA 4] Atualizando jornada individual do barbeiro via PUT /api/barbershops/:shopId/schedules...",
    );
    const putRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          barbermanId: barberman.id,
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

    if (putRes.status !== 200) {
      throw new Error(
        `Falha ao atualizar jornada do barbeiro (Status ${putRes.status}): ${await putRes.text()}`,
      );
    }
    console.log("  -> HTTP 200 recebido na atualização da jornada.");

    // Validar no banco de dados se a jornada individual foi gravada
    const dbSchedules = await db
      .select()
      .from(barbershopSchedules)
      .where(
        and(
          eq(barbershopSchedules.barbershopId, barbershop.id),
          eq(barbershopSchedules.barbermanId, barberman.id),
        ),
      );

    if (
      dbSchedules.length !== 1 ||
      dbSchedules[0].openTime !== "09:00" ||
      dbSchedules[0].closeTime !== "17:00"
    ) {
      throw new Error(
        "A jornada individual do barbeiro não foi persistida corretamente no banco de dados.",
      );
    }
    console.log("  -> Jornada individual persistida validada no PostgreSQL.");

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
        `ERRO: O slot das 10:00 deveria ter sido excluído devido ao booking persistido, mas foi retornado!`,
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
        `ERRO: Slots livres esperados (09:00, 09:30, 10:30) não foram retornados na grade!`,
      );
    }
    console.log(
      "  -> [OK] Slots livres (09:00, 09:30, 10:30) mantidos com sucesso.",
    );

    // ── g) Proteção de Reservas Futuras (TEC-14) ───────────────
    console.log(
      "[ETAPA 7] Validando proteção de reservas futuras (TEC-14) via PUT conflitante...",
    );
    const conflictingPutRes = await fetch(
      `${baseUrl}/barbershops/${barbershop.id}/schedules`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          barbermanId: barberman.id,
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
        `Esperava HTTP 409 ao tentar atualizar jornada com agendamento futuro conflitante, mas recebeu Status ${conflictingPutRes.status}: ${await conflictingPutRes.text()}`,
      );
    }

    const conflictData = await conflictingPutRes.json();
    if (conflictData.code !== "SCHEDULE_BOOKING_CONFLICT") {
      throw new Error(
        `Código de erro inesperado: esperado 'SCHEDULE_BOOKING_CONFLICT', recebido '${conflictData.code}'`,
      );
    }

    if (
      !Array.isArray(conflictData.conflicts) ||
      conflictData.conflicts.length === 0
    ) {
      throw new Error(
        "Array 'conflicts' ausente ou vazio na resposta de erro 409.",
      );
    }

    const hasBookingConflict = conflictData.conflicts.some(
      (c: { bookingId: string }) => c.bookingId === createdBooking.id,
    );
    if (!hasBookingConflict) {
      throw new Error(
        `O agendamento conflitante ${createdBooking.id} não foi listado no array 'conflicts'.`,
      );
    }
    console.log(
      "  -> [OK] HTTP 409 com SCHEDULE_BOOKING_CONFLICT e lista de conflitos retornado com sucesso.",
    );

    // Validar que os horários no banco permaneceram inalterados (rollback/abort)
    const schedulesAfterRollback = await db
      .select()
      .from(barbershopSchedules)
      .where(
        and(
          eq(barbershopSchedules.barbershopId, barbershop.id),
          eq(barbershopSchedules.barbermanId, barberman.id),
        ),
      );

    if (
      schedulesAfterRollback.length !== 1 ||
      schedulesAfterRollback[0].openTime !== "09:00" ||
      schedulesAfterRollback[0].closeTime !== "17:00"
    ) {
      throw new Error(
        "A jornada foi alterada indevidamente no banco de dados mesmo após colisão com reserva futura!",
      );
    }
    console.log(
      "  -> [OK] Integridade mantida: os horários no banco permaneceram inalterados (09:00 - 17:00).",
    );

    console.log("\n==========================================================");
    console.log(
      "TESTE E2E (ISSUE #29 + TEC-14) FINALIZADO COM 100% DE SUCESSO!",
    );
    console.log("==========================================================\n");
  } catch (error) {
    console.error("\n[FALHA NO TESTE E2E]:", error);
    process.exitCode = 1;
  } finally {
    // ── g) Limpeza (Cleanup) no bloco finally ───────────────────
    console.log(
      "[CLEANUP] Limpando fixtures do banco de teste e encerrando servidor...",
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
          .delete(barbershopSchedules)
          .where(eq(barbershopSchedules.barbershopId, createdBarbershopId));
        await db
          .delete(membership)
          .where(eq(membership.barbershopId, createdBarbershopId));
        await db
          .delete(barbershops)
          .where(eq(barbershops.id, createdBarbershopId));
      }
      if (createdBarbermanId) {
        await db.delete(users).where(eq(users.id, createdBarbermanId));
      }
      if (createdOwnerId) {
        await db.delete(users).where(eq(users.id, createdOwnerId));
      }
      console.log("  -> Dados de teste removidos do banco com sucesso.");
    } catch (cleanupError) {
      console.error("[CLEANUP ERROR] Falha ao limpar fixtures:", cleanupError);
    }

    if (server) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => {
        server?.close(() => resolve());
      });
      console.log("  -> Servidor HTTP encerrado.");
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
