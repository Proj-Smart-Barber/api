import { InvitationDeliveryService } from "../../../domain/application/services/invitation-delivery-service";
import { DrizzleInvitationDeliveriesRepository } from "../../drizzle/repositories/drizzle-invitation-deliveries-repository";
import { DrizzleInvitationsRepository } from "../../drizzle/repositories/drizzle-invitations-repository";
import { ResendEmailService } from "../../email/resend-email-service";
import { ProcessInvitationDeliveriesController } from "../controllers/internal/process-invitation-deliveries-controller";

export function makeProcessInvitationDeliveriesController() {
  const deliveriesRepository = new DrizzleInvitationDeliveriesRepository();
  const invitationsRepository = new DrizzleInvitationsRepository();
  const emailService = new ResendEmailService();

  const deliveryService = new InvitationDeliveryService(
    deliveriesRepository,
    invitationsRepository,
    emailService,
  );

  return new ProcessInvitationDeliveriesController(deliveryService);
}
