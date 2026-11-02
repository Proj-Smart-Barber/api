import { z } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import type { HttpResponse } from "../../../../core/infra/http-response";
import { DrizzleServiceMediaRepository } from "../../../drizzle/repositories/drizzle-service-media-repository";
const schema = z.object({
  userId: z.string().uuid(),
  shopId: z.string().uuid(),
  serviceId: z.string().uuid(),
  mediaId: z.string().uuid(),
  displayOrder: z.number().int().min(0).max(99).default(0),
});
export class AttachServiceMediaController implements Controller {
  constructor(private operation: "attach" | "list" | "detach" = "attach") {}
  async handle(request: unknown): Promise<HttpResponse> {
    if (this.operation === "list") {
      const target = z
        .object({
          shopId: z.string().uuid(),
          serviceId: z.string().uuid(),
          userId: z.string().uuid().optional(),
        })
        .safeParse(request);
      if (!target.success)
        return { statusCode: 400, body: { error: "IDs inválidos." } };
      return {
        statusCode: 200,
        body: {
          items: await new DrizzleServiceMediaRepository().list(
            target.data.shopId,
            target.data.serviceId,
            target.data.userId,
          ),
        },
      };
    }
    const parsed = schema.safeParse(request);
    if (!parsed.success)
      return {
        statusCode: 400,
        body: { error: "Dados de associação inválidos." },
      };
    try {
      if (this.operation === "detach") {
        const success = await new DrizzleServiceMediaRepository().detach(
          parsed.data,
        );
        return { statusCode: success ? 200 : 403, body: { success } };
      }
      const item = await new DrizzleServiceMediaRepository().attach(
        parsed.data,
      );
      return item
        ? { statusCode: 200, body: { item } }
        : {
            statusCode: 403,
            body: {
              error:
                "Mídia não está pronta ou não pertence ao serviço/unidade autorizados.",
            },
          };
    } catch {
      return {
        statusCode: 409,
        body: {
          error:
            "Não foi possível associar a mídia. Verifique o limite e tente novamente.",
        },
      };
    }
  }
}
