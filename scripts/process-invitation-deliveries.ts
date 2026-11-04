#!/usr/bin/env node
import { InvitationDeliveryService } from "../src/domain/application/services/invitation-delivery-service";
import { DrizzleInvitationDeliveriesRepository } from "../src/infra/drizzle/repositories/drizzle-invitation-deliveries-repository";
import { DrizzleInvitationsRepository } from "../src/infra/drizzle/repositories/drizzle-invitations-repository";
import { ResendEmailService } from "../src/infra/email/resend-email-service";

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 20;

  const timeoutArg = args.find((a) => a.startsWith("--timeout="));
  const timeoutMs = timeoutArg ? parseInt(timeoutArg.split("=")[1], 10) : 5000;

  const workerId = `cli_worker_${process.pid}_${Date.now()}`;

  console.log(`[Outbox Consumer] Iniciando processamento de entregas de convites...`);
  console.log(`[Outbox Consumer] Limite: ${limit}, Timeout: ${timeoutMs}ms, Worker: ${workerId}`);

  const deliveriesRepository = new DrizzleInvitationDeliveriesRepository();
  const invitationsRepository = new DrizzleInvitationsRepository();
  const emailService = new ResendEmailService();

  const deliveryService = new InvitationDeliveryService(
    deliveriesRepository,
    invitationsRepository,
    emailService,
  );

  const result = await deliveryService.processPending({
    limit,
    timeoutMs,
    workerId,
  });

  console.log(`[Outbox Consumer] Concluído:`);
  console.log(`  - Total processados: ${result.processed}`);
  console.log(`  - Sucessos (aceitos): ${result.succeeded}`);
  console.log(`  - Falhas/retries: ${result.failed}`);
}

main().catch((err) => {
  console.error(`[Outbox Consumer] Erro fatal:`, err);
  process.exit(1);
});
