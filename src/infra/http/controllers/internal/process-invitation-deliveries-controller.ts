import type { Controller } from "../../../../core/infra/controller";
import {
  type HttpResponse,
  clientError,
  ok,
  unauthorized,
  fail,
} from "../../../../core/infra/http-response";
import type { InvitationDeliveryService } from "../../../../domain/application/services/invitation-delivery-service";

export class ProcessInvitationDeliveriesController implements Controller {
  constructor(private invitationDeliveryService: InvitationDeliveryService) {}

  async handle(request: any): Promise<HttpResponse> {
    try {
      const cronSecret = process.env.CRON_SECRET;
      const authHeader =
        request.headers?.authorization || request.headers?.Authorization;

      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return unauthorized({
          code: "UNAUTHORIZED",
          message:
            "Acesso não autorizado ao endpoint interno de processamento de convites.",
          error: {
            code: "UNAUTHORIZED",
            message:
              "Acesso não autorizado ao endpoint interno de processamento de convites.",
          },
        });
      }

      const limit = Number(request.query?.limit ?? request.body?.limit ?? 10);
      const timeoutMs = Number(
        request.query?.timeoutMs ?? request.body?.timeoutMs ?? 5000,
      );
      const workerId =
        request.query?.workerId ??
        request.body?.workerId ??
        `cron_${Date.now()}`;

      const result = await this.invitationDeliveryService.processPending({
        limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
        timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000,
        workerId: String(workerId),
      });

      return ok({
        message: "Processamento de entregas de convite executado com sucesso.",
        ...result,
      });
    } catch (err: unknown) {
      return fail(err as Error);
    }
  }
}
