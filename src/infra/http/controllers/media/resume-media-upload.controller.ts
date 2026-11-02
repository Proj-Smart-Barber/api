import { z } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import type { HttpResponse } from "../../../../core/infra/http-response";
import { DrizzleMediaRepository } from "../../../drizzle/repositories/drizzle-media-repository";
import { DrizzleMembershipsRepository } from "../../../drizzle/repositories/drizzle-memberships-repository";
import { getStorageService } from "../../../storage/storage-service-factory";
const schema = z.object({
  userId: z.string().uuid(),
  mediaId: z.string().uuid(),
});
export class ResumeMediaUploadController implements Controller {
  async handle(request: unknown): Promise<HttpResponse> {
    const parsed = schema.safeParse(request);
    if (!parsed.success)
      return { statusCode: 400, body: { error: "IDs inválidos." } };
    const item = await new DrizzleMediaRepository().findById(
      parsed.data.mediaId,
    );
    if (!item || item.ownerId.toString() !== parsed.data.userId)
      return { statusCode: 403, body: { error: "Upload não autorizado." } };
    if (
      item.status !== "PENDING" ||
      Date.now() - item.createdAt.getTime() > 15 * 60 * 1000
    )
      return {
        statusCode: 409,
        body: { error: "Intenção de upload encerrada ou expirada." },
      };
    if (item.ownerType === "BARBERSHOP") {
      if (!item.ownerEntityId)
        return {
          statusCode: 403,
          body: { error: "Escopo da unidade ausente." },
        };
      const members =
        await new DrizzleMembershipsRepository().findManyByBarbershopId(
          item.ownerEntityId.toString(),
        );
      if (
        !members.some(
          (member) =>
            member.userId.toString() === parsed.data.userId &&
            member.role === "OWNER" &&
            member.state === "ACTIVE",
        )
      )
        return { statusCode: 403, body: { error: "Owner não está ativo." } };
    }
    try {
      const result = await getStorageService().generateUploadUrl({
        objectKey: item.objectKey,
        mimeType: item.mimeType,
        fileSize: item.fileSize,
        expiresInSeconds: 300,
      });
      return { statusCode: 200, body: { uploadUrl: result.uploadUrl } };
    } catch {
      return {
        statusCode: 503,
        body: { error: "Armazenamento indisponível." },
      };
    }
  }
}
