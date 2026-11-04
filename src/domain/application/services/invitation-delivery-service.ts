import type { InvitationDeliveriesRepository } from "../repositories/invitation-deliveries-repository";
import type { InvitationsRepository } from "../repositories/invitations-repository";
import type { EmailService } from "./email-service";

export interface DeliveryResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface ProcessPendingResult {
  processed: number;
  succeeded: number;
  failed: number;
}

export class InvitationDeliveryService {
  constructor(
    private deliveriesRepository: InvitationDeliveriesRepository,
    private invitationsRepository: InvitationsRepository,
    private emailService: EmailService,
  ) {}

  async deliverSingle(
    deliveryId: string,
    options: { timeoutMs?: number } = {},
  ): Promise<DeliveryResult> {
    const delivery = await this.deliveriesRepository.findById(deliveryId);
    if (!delivery) {
      return { success: false, error: "DELIVERY_NOT_FOUND" };
    }

    if (delivery.status === "ACCEPTED") {
      return {
        success: true,
        providerMessageId: delivery.providerMessageId ?? undefined,
      };
    }

    if (delivery.status === "REVOKED" || delivery.status === "EXPIRED") {
      return {
        success: false,
        error: `INVITATION_${delivery.status}`,
      };
    }

    // 1. Checar revogação e expiração do convite antes do envio
    const invitation = await this.invitationsRepository.findById(
      delivery.invitationId,
    );

    const now = new Date();
    if (!invitation || invitation.status === "REVOKED") {
      delivery.status = "REVOKED";
      delivery.invitationUrl = null; // Higienização de token/link sensível
      delivery.lastError = "Convite revogado ou inexistente antes da entrega.";
      await this.deliveriesRepository.update(delivery);
      return { success: false, error: "INVITATION_REVOKED" };
    }

    if (invitation.expiresAt <= now) {
      delivery.status = "EXPIRED";
      delivery.invitationUrl = null; // Higienização de token/link sensível
      delivery.lastError = "Convite expirado antes da entrega.";
      await this.deliveriesRepository.update(delivery);
      return { success: false, error: "INVITATION_EXPIRED" };
    }

    if (!delivery.invitationUrl) {
      delivery.status = "FAILED";
      delivery.lastError = "Payload de entrega sem URL de convite.";
      await this.deliveriesRepository.update(delivery);
      return { success: false, error: "MISSING_INVITATION_URL" };
    }

    // 2. Disparar e-mail com timeout estrito
    const timeoutMs = options.timeoutMs ?? 5000;
    try {
      const sendPromise = this.emailService.sendInvitationEmail({
        to: delivery.recipientEmail,
        ownerName: delivery.ownerName,
        barbershopName: delivery.barbershopName,
        invitationUrl: delivery.invitationUrl,
        expiresInDays: 7,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("EMAIL_PROVIDER_NETWORK_TIMEOUT")),
          timeoutMs,
        ),
      );

      await Promise.race([sendPromise, timeoutPromise]);

      // 3. Sucesso aceito pelo provedor
      const providerId = `resend_${delivery.id.slice(0, 8)}`;
      delivery.status = "ACCEPTED";
      delivery.processedAt = new Date();
      delivery.providerMessageId = providerId;
      delivery.invitationUrl = null; // Higieniza URL/token sensível após aceitação
      delivery.lastError = null;

      await this.deliveriesRepository.update(delivery);

      return {
        success: true,
        providerMessageId: providerId,
      };
    } catch (err: unknown) {
      // 4. Falha ou timeout no provedor
      const rawMsg = err instanceof Error ? err.message : String(err);
      const sanitizedError = rawMsg.replace(/token=[^&\s]+/gi, "token=***");

      delivery.attempts += 1;
      delivery.lastError = sanitizedError;

      if (delivery.attempts >= delivery.maxAttempts) {
        delivery.status = "FAILED";
      } else {
        delivery.status = "PENDING";
        const backoffSeconds = Math.pow(2, delivery.attempts) * 30;
        delivery.nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);
      }

      await this.deliveriesRepository.update(delivery);

      return {
        success: false,
        error: sanitizedError,
      };
    }
  }

  async processPending(
    options: {
      limit?: number;
      workerId?: string;
      timeoutMs?: number;
    } = {},
  ): Promise<ProcessPendingResult> {
    const limit = options.limit ?? 10;
    const workerId =
      options.workerId ?? `worker_${Math.random().toString(36).slice(2, 8)}`;

    const lockedDeliveries =
      await this.deliveriesRepository.lockPendingForProcessing(limit, workerId);

    let succeeded = 0;
    let failed = 0;

    for (const delivery of lockedDeliveries) {
      const res = await this.deliverSingle(delivery.id, {
        timeoutMs: options.timeoutMs ?? 5000,
      });
      if (res.success) {
        succeeded += 1;
      } else {
        failed += 1;
      }
    }

    return {
      processed: lockedDeliveries.length,
      succeeded,
      failed,
    };
  }
}
