import app from "../src/app";
import { db } from "../src/infra/drizzle";
import {
  serviceItems,
  services,
  barbershops,
  staffs,
} from "../src/infra/drizzle/schema";
import { eq } from "drizzle-orm";
import type { Server } from "node:http";

async function runE2E() {
  console.log("==========================================================");
  console.log("SMART BARBER: VALIDAÇÃO INTEGRADA E2E PONTA A PONTA (C6)");
  console.log("==========================================================\n");

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 3335;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  console.log(`[INFO] Servidor HTTP de teste ativo em ${baseUrl}\n`);

  try {
    // 1. Autenticação do Proprietário
    console.log(
      "[ETAPA 1] Autenticando Proprietário (owner@smartbarber.com)...",
    );
    const loginRes = await fetch(`${baseUrl}/staffs/sessions/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "owner@smartbarber.com",
        password: "123456",
      }),
    });
    if (!loginRes.ok) throw new Error(`Falha no login: ${loginRes.status}`);
    const { access_token } = await loginRes.json();
    console.log("  -> Token JWT obtido com sucesso.");

    // 2. Consulta de Perfil e Barbearias do Staff
    console.log("[ETAPA 2] Consultando perfil e barbearias vinculadas...");
    const meRes = await fetch(`${baseUrl}/staffs/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!meRes.ok) throw new Error("Falha no /me");
    const meData = await meRes.json();
    console.log(`  -> Perfil: ${meData.staff.name} (${meData.staff.role})`);

    const shopsRes = await fetch(`${baseUrl}/staffs/me/barbershops`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!shopsRes.ok) throw new Error("Falha no /me/barbershops");
    const { barbershops: staffShops } = await shopsRes.json();
    if (!staffShops || staffShops.length === 0)
      throw new Error("Nenhuma barbearia encontrada");
    const activeShop = staffShops[0];
    const shopId = activeShop.id;
    console.log(
      `  -> Barbearia vinculada: "${activeShop.name}" [ID: ${shopId}, Papel: ${activeShop.role}]`,
    );

    // 3. Consulta de Catálogo Inicial
    console.log("[ETAPA 3] Consultando catálogo público inicial...");
    const initialListRes = await fetch(
      `${baseUrl}/barbershops/${shopId}/services`,
    );
    const initialList = await initialListRes.json();
    console.log(`  -> Serviços ativos iniciais: ${initialList.total}`);

    // 4. Criação de Serviços pelo Proprietário
    console.log(
      "[ETAPA 4] Proprietário criando serviço 'Corte Degradê + Barba'...",
    );
    const createRes1 = await fetch(
      `${baseUrl}/barbershops/${shopId}/services`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          title: "Corte Degradê + Barba",
          description: "Degradê navalhado e barba desenhada com toalha quente",
          priceInCents: 6500,
          durationInMinutes: 50,
        }),
      },
    );
    if (!createRes1.ok)
      throw new Error(`Falha ao criar serviço 1: ${await createRes1.text()}`);
    const { service: service1 } = await createRes1.json();
    console.log(
      `  -> Serviço criado com sucesso: [ID: ${service1.id}, Título: "${service1.title}", Preço: R$ ${(service1.priceInCents / 100).toFixed(2)}, Duração: ${service1.durationInMinutes}m]`,
    );

    console.log(
      "[ETAPA 5] Proprietário criando segundo serviço 'Sobrancelha Navalhada'...",
    );
    const createRes2 = await fetch(
      `${baseUrl}/barbershops/${shopId}/services`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          title: "Sobrancelha Navalhada",
          priceInCents: 1500,
          durationInMinutes: 15,
        }),
      },
    );
    if (!createRes2.ok)
      throw new Error(`Falha ao criar serviço 2: ${await createRes2.text()}`);
    const { service: service2 } = await createRes2.json();
    console.log(
      `  -> Segundo serviço criado: [ID: ${service2.id}, Título: "${service2.title}"]`,
    );

    // 5. Atualização de Serviço
    console.log(
      "[ETAPA 6] Proprietário atualizando preço e duração do serviço 1...",
    );
    const updateRes = await fetch(
      `${baseUrl}/barbershops/${shopId}/services/${service1.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({
          priceInCents: 7000,
          durationInMinutes: 55,
        }),
      },
    );
    if (!updateRes.ok) throw new Error("Falha na atualização");
    const { service: updatedService1 } = await updateRes.json();
    console.log(
      `  -> Serviço atualizado: Novo Preço = R$ ${(updatedService1.priceInCents / 100).toFixed(2)}, Duração = ${updatedService1.durationInMinutes}m`,
    );

    // 6. Desativação de Serviço
    console.log("[ETAPA 7] Desativando serviço 2 (Sobrancelha)...");
    const deactRes = await fetch(
      `${baseUrl}/barbershops/${shopId}/services/${service2.id}/activation`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify({ isActive: false }),
      },
    );
    if (!deactRes.ok) throw new Error("Falha na desativação");
    const { service: deactService2 } = await deactRes.json();
    console.log(
      `  -> Status do serviço 2 atualizado: isActive = ${deactService2.isActive}`,
    );

    // 7. Validação de Isolamento Público vs Proprietário
    console.log(
      "[ETAPA 8] Validando visibilidade pública (visitante sem token)...",
    );
    const publicListRes = await fetch(
      `${baseUrl}/barbershops/${shopId}/services`,
    );
    const publicList = await publicListRes.json();
    const publicContainsDeactivated = publicList.items.some(
      (s: any) => s.id === service2.id,
    );
    if (publicContainsDeactivated)
      throw new Error(
        "VIOLAÇÃO: Serviço inativo apareceu na listagem pública!",
      );
    console.log(
      `  -> Listagem pública segura: ${publicList.total} serviços ativos visíveis (inativo oculto com sucesso).`,
    );

    console.log(
      "[ETAPA 9] Validando visibilidade do proprietário (com includeInactive=true)...",
    );
    const ownerListRes = await fetch(
      `${baseUrl}/barbershops/${shopId}/services?includeInactive=true`,
      {
        headers: { Authorization: `Bearer ${access_token}` },
      },
    );
    const ownerList = await ownerListRes.json();
    const ownerContainsDeactivated = ownerList.items.some(
      (s: any) => s.id === service2.id && !s.isActive,
    );
    if (!ownerContainsDeactivated)
      throw new Error(
        "FALHA: Proprietário não conseguiu ver o serviço inativo!",
      );
    console.log(
      `  -> Listagem do proprietário correta: ${ownerList.total} serviços totais exibidos (ativos + inativos).`,
    );

    // 8. Teste de Cálculo de Disponibilidade
    console.log(
      "[ETAPA 10] Testando cálculo de disponibilidade com serviços ativos...",
    );
    // Próxima segunda-feira
    const nextDate = new Date();
    nextDate.setDate(
      nextDate.getDate() + ((1 + 7 - nextDate.getDay()) % 7 || 7),
    );
    const dateStr = nextDate.toISOString().split("T")[0];

    const availUrl = `${baseUrl}/barbershops/${shopId}/availability?date=${dateStr}&serviceIds=${service1.id}`;
    const availRes = await fetch(availUrl);
    if (!availRes.ok)
      throw new Error(
        `Falha ao calcular disponibilidade: ${await availRes.text()}`,
      );
    const availData = await availRes.json();
    console.log(
      `  -> Disponibilidade calculada para ${dateStr} com serviço "${service1.title}" (${updatedService1.durationInMinutes} min):`,
    );
    console.log(
      `     Barbeiros disponíveis: ${availData.barbermans?.length || 0}`,
    );

    // 9. Rejeição de Serviço Inativo no Cálculo
    console.log(
      "[ETAPA 11] Testando rejeição de serviço inativo no cálculo de disponibilidade...",
    );
    const invalidAvailUrl = `${baseUrl}/barbershops/${shopId}/availability?date=${dateStr}&serviceIds=${service2.id}`;
    const invalidAvailRes = await fetch(invalidAvailUrl);
    if (invalidAvailRes.status !== 400 && invalidAvailRes.status !== 404) {
      throw new Error(
        `Esperava rejeição do serviço inativo, recebeu status ${invalidAvailRes.status}`,
      );
    }
    console.log(
      `  -> Rejeição correta de serviço inativo na disponibilidade (Status: ${invalidAvailRes.status}).`,
    );

    // 10. Verificação Direta no Banco PostgreSQL
    console.log(
      "[ETAPA 12] Auditando registros diretamente no banco PostgreSQL...",
    );
    const dbServices = await db
      .select()
      .from(services)
      .where(eq(services.barbershopId, shopId));
    console.log(
      `  -> Linhas na tabela 'services' para a barbearia: ${dbServices.length}`,
    );
    const dbActive = dbServices.filter((s) => s.isActive);
    const dbInactive = dbServices.filter((s) => !s.isActive);
    console.log(
      `     Ativos no banco: ${dbActive.length}, Inativos no banco: ${dbInactive.length}`,
    );

    console.log("\n==========================================================");
    console.log("SUCESSO TOTAL: TODOS OS TESTES E2E REAIS FORAM APROVADOS!");
    console.log("==========================================================");
  } finally {
    server.close();
  }
}

runE2E().catch((err) => {
  console.error("\n[ERRO E2E]:", err);
  process.exit(1);
});
