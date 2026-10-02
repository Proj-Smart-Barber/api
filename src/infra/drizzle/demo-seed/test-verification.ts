import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../index";
import {
  barbershopSchedules,
  barbershops,
  bookings,
  users,
  membership,
  scheduleExceptions,
  serviceItems,
  services,
  shoppingCarts,
} from "../schema";
import app from "../../../app";
import { DemoSeedEngine } from "./engine";

interface TestReport {
  passed: number;
  failed: number;
  errors: string[];
}

const report: TestReport = { passed: 0, failed: 0, errors: [] };

function assert(condition: boolean, message: string) {
  if (condition) {
    report.passed++;
    console.log(`  ✓ ${message}`);
  } else {
    report.failed++;
    report.errors.push(message);
    console.error(`  ✗ FALHA: ${message}`);
  }
}

async function runVerification() {
  console.log(
    "===============================================================",
  );
  console.log(
    "    VERIFICAÇÃO FUNCIONAL COMPLETA DO SEED DE DEMONSTRAÇÃO     ",
  );
  console.log(
    "===============================================================",
  );

  // ── 1. Registros e FKs no Banco ──────────────────────────────
  console.log(
    "\n[1/5] Validando integridade de dados e restrições no banco...",
  );

  const allUsers = await db.select().from(users);
  const allShops = await db.select().from(barbershops);
  const allMemberships = await db.select().from(membership);
  const allSchedules = await db.select().from(barbershopSchedules);
  const allServices = await db.select().from(services);
  const allExceptions = await db.select().from(scheduleExceptions);
  const allBookings = await db.select().from(bookings);
  const allCarts = await db.select().from(shoppingCarts);
  const allItems = await db.select().from(serviceItems);

  const staffIds = new Set(allMemberships.map((m) => m.userId));
  const allStaffs = allUsers.filter((u) => staffIds.has(u.id));
  const allCustomers = allUsers.filter((u) => !staffIds.has(u.id));

  assert(
    allShops.length >= 2,
    `Mínimo de 2 barbearias encontradas (atual: ${allShops.length})`,
  );
  assert(
    allStaffs.length >= 8,
    `Mínimo de 8 contas de staff encontradas (atual: ${allStaffs.length})`,
  );
  assert(
    allServices.length >= 14,
    `Mínimo de 14 serviços cadastrados (atual: ${allServices.length})`,
  );
  assert(
    allSchedules.length >= 40,
    `Mínimo de 40 jornadas cadastradas (atual: ${allSchedules.length})`,
  );
  assert(
    allCustomers.length >= 12,
    `Mínimo de 12 clientes cadastrados (atual: ${allCustomers.length})`,
  );
  assert(
    allExceptions.length >= 6,
    `Mínimo de 6 exceções cadastradas (atual: ${allExceptions.length})`,
  );
  assert(
    allBookings.length >= 20,
    `Mínimo de 20 reservas cadastradas (atual: ${allBookings.length})`,
  );

  // Encontrar barbearias pelo slug
  const shopHorizonte = allShops.find(
    (s) => s.slug === "barbearia-horizonte-demo",
  );
  const shopEstacao = allShops.find((s) => s.slug === "barbearia-estacao-demo");

  assert(!!shopHorizonte, "Barbearia Horizonte encontrada por slug");
  assert(!!shopEstacao, "Barbearia Estação encontrada por slug");

  if (!shopHorizonte || !shopEstacao) {
    throw new Error("Barbearias demo não encontradas.");
  }

  // Validar owners
  const wellington = allStaffs.find(
    (s) => s.email === "demo.wellingtonspdev@example.com",
  );
  const alvaro = allStaffs.find(
    (s) => s.email === "demo.alvarosena@example.com",
  );

  assert(
    !!wellington && shopHorizonte.ownerId === wellington.id,
    "Wellington é OWNER da Barbearia Horizonte",
  );
  assert(
    !!alvaro && shopEstacao.ownerId === alvaro.id,
    "Alvaro é OWNER da Barbearia Estação",
  );

  // Validar isolamento de memberships
  const horizonteMembers = allMemberships.filter(
    (m) => m.barbershopId === shopHorizonte.id,
  );
  const estacaoMembers = allMemberships.filter(
    (m) => m.barbershopId === shopEstacao.id,
  );

  assert(
    horizonteMembers.length === 4,
    `Horizonte tem exatamente 4 membros (atual: ${horizonteMembers.length})`,
  );
  assert(
    estacaoMembers.length === 4,
    `Estação tem exatamente 4 membros (atual: ${estacaoMembers.length})`,
  );

  // Validar catálogo (6 ativos e 1 inativo por unidade)
  const horizonteServices = allServices.filter(
    (s) => s.barbershopId === shopHorizonte.id,
  );
  const estacaoServices = allServices.filter(
    (s) => s.barbershopId === shopEstacao.id,
  );

  assert(
    horizonteServices.length === 7 &&
      horizonteServices.filter((s) => s.isActive).length === 6 &&
      horizonteServices.filter((s) => !s.isActive).length === 1,
    "Horizonte possui 7 serviços: 6 ativos e 1 inativo",
  );

  assert(
    estacaoServices.length === 7 &&
      estacaoServices.filter((s) => s.isActive).length === 6 &&
      estacaoServices.filter((s) => !s.isActive).length === 1,
    "Estação possui 7 serviços: 6 ativos e 1 inativo",
  );

  // Validar consistência de preço nos carrinhos e service items
  let cartsValid = true;
  for (const cart of allCarts) {
    const item = allItems.find((i) => i.id === cart.serviceItemId);
    if (!item || item.priceInCentsSnapshot !== cart.totalPriceInCents) {
      cartsValid = false;
      break;
    }
  }
  assert(
    cartsValid,
    "Todos os carrinhos possuem total_price_in_cents igual ao snapshot do item",
  );

  // ── 2. Autenticação HTTP com as 8 Contas ─────────────────────
  console.log("\n[2/5] Testando autenticação HTTP (login) das 8 contas...");

  const credentialsRaw = readFileSync(
    resolve(process.cwd(), ".demo-seed-credentials.json"),
    "utf-8",
  );
  const credentialsMap = JSON.parse(credentialsRaw);

  const authTokens: Record<string, string> = {};

  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 3333;
  const baseUrl = `http://127.0.0.1:${port}`;

  interface CredentialItem {
    name: string;
    email: string;
    plainPassword: string;
    unit: string;
    role: string;
  }

  interface BarbershopItemResponse {
    id: string;
    name: string;
  }

  interface ServiceItemResponse {
    id: string;
    title: string;
  }

  interface DisposableBookingItem {
    logicalKey: string;
    bookingId: string;
  }

  try {
    for (const [_key, cred] of Object.entries(
      credentialsMap as Record<string, CredentialItem>,
    )) {
      const res = await fetch(`${baseUrl}/api/users/sessions/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cred.email,
          password: cred.plainPassword,
        }),
      });

      const body = (await res.json()) as { access_token?: string };
      assert(
        res.status === 201 && !!body.access_token,
        `Login bem-sucedido para ${cred.name} (${cred.email})`,
      );
      if (body.access_token) {
        authTokens[cred.email] = body.access_token;
      }
    }

    // ── 3. Perfis e Descoberta de Barbearia ───────────────────────
    console.log(
      "\n[3/5] Testando /api/users/me/barbershops e isolamento de tenant...",
    );

    for (const [_key, cred] of Object.entries(
      credentialsMap as Record<string, CredentialItem>,
    )) {
      const token = authTokens[cred.email];
      if (!token) continue;

      const res = await fetch(`${baseUrl}/api/users/me/barbershops`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json()) as {
        barbershops?: BarbershopItemResponse[];
      };

      assert(
        res.status === 200,
        `Retorno 200 em /me/barbershops para ${cred.email}`,
      );
      const expectedShopId =
        cred.unit === "horizonte" ? shopHorizonte.id : shopEstacao.id;
      const otherShopId =
        cred.unit === "horizonte" ? shopEstacao.id : shopHorizonte.id;

      const hasUnit = body.barbershops?.some(
        (b: BarbershopItemResponse) => b.id === expectedShopId,
      );
      const hasOtherUnit = body.barbershops?.some(
        (b: BarbershopItemResponse) => b.id === otherShopId,
      );

      assert(
        Boolean(hasUnit && !hasOtherUnit),
        `Isolamento correto: ${cred.name} pertence apenas a ${cred.unit}`,
      );
    }

    // ── 4. Catálogo Público e Gestão de Serviços ─────────────────
    console.log(
      "\n[4/5] Testando catálogo público (ativos) e filtro de inativos...",
    );

    const resHorizontePub = await fetch(
      `${baseUrl}/api/barbershops/${shopHorizonte.id}/services`,
    );
    const bodyHorizontePub = (await resHorizontePub.json()) as {
      items?: ServiceItemResponse[];
    };
    assert(
      resHorizontePub.status === 200 && bodyHorizontePub.items?.length === 6,
      `Catálogo público de Horizonte retorna exatamente os 6 serviços ativos (atual: ${bodyHorizontePub.items?.length})`,
    );

    const hasInactiveHz = bodyHorizontePub.items?.some(
      (s: ServiceItemResponse) => s.title.includes("Pigmentação"),
    );
    assert(
      !hasInactiveHz,
      "Serviço inativo de Horizonte ('Pigmentação') NÃO aparece no catálogo público",
    );

    const resEstacaoPub = await fetch(
      `${baseUrl}/api/barbershops/${shopEstacao.id}/services`,
    );
    const bodyEstacaoPub = (await resEstacaoPub.json()) as {
      items?: ServiceItemResponse[];
    };
    assert(
      resEstacaoPub.status === 200 && bodyEstacaoPub.items?.length === 6,
      `Catálogo público de Estação retorna exatamente os 6 serviços ativos (atual: ${bodyEstacaoPub.items?.length})`,
    );

    // ── 5. Agenda e Cancelamento de Reserva Descartável ───────────
    console.log(
      "\n[5/5] Testando cancelamento de reserva descartável e idempotência...",
    );

    const manifestRaw = readFileSync(
      resolve(process.cwd(), ".demo-seed-manifest.json"),
      "utf-8",
    );
    const manifest = JSON.parse(manifestRaw);

    const arthurToken = authTokens["demo.arthuranjo@example.com"];
    const disposableHorizonte = manifest.disposableBookings.find(
      (d: DisposableBookingItem) =>
        d.logicalKey === "horizonte:booking:descartavel-cancelamento",
    );

    assert(
      !!disposableHorizonte,
      "Reserva descartável de Horizonte localizada no manifesto",
    );

    if (disposableHorizonte && arthurToken) {
      // Se a reserva descartável já foi consumida em execução prévia, repõe antes do teste
      let bookingIdToCancel = disposableHorizonte.bookingId;
      const [existingBooking] = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.id, disposableHorizonte.bookingId));

      if (!existingBooking) {
        const engine = new DemoSeedEngine();
        await engine.run({ forceReplenishDisposables: true });

        const updatedManifestRaw = readFileSync(
          resolve(process.cwd(), ".demo-seed-manifest.json"),
          "utf-8",
        );
        const updatedManifest = JSON.parse(updatedManifestRaw);
        const updatedDisp = updatedManifest.disposableBookings.find(
          (d: DisposableBookingItem) =>
            d.logicalKey === "horizonte:booking:descartavel-cancelamento",
        );
        if (updatedDisp) {
          bookingIdToCancel = updatedDisp.bookingId;
        }
      }

      // 1º Cancelamento: deve ser 200 OK
      const resCancel1 = await fetch(
        `${baseUrl}/api/bookings/${bookingIdToCancel}/cancel`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${arthurToken}` },
        },
      );

      assert(
        resCancel1.status === 200,
        "1º Cancelamento da reserva descartável retornou 200 OK",
      );

      // 2º Cancelamento: deve retornar 404 (já cancelada)
      const resCancel2 = await fetch(
        `${baseUrl}/api/bookings/${bookingIdToCancel}/cancel`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${arthurToken}` },
        },
      );

      assert(
        resCancel2.status === 404,
        "2º Cancelamento da mesma reserva retornou 404 Not Found",
      );
    }
  } finally {
    server.close();
  }

  console.log(
    "\n===============================================================",
  );
  console.log(
    `TESTES CONCLUÍDOS: ${report.passed} passaram, ${report.failed} falharam.`,
  );
  if (report.failed > 0) {
    console.error("FALHAS ENCONTRADAS:", report.errors);
    process.exit(1);
  } else {
    console.log("TODAS AS VALIDAÇÕES FUNCIONAIS PASSARAM COM SUCESSO!");
    console.log(
      "===============================================================",
    );
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error("Erro inesperado na verificação:", err);
  process.exit(1);
});
