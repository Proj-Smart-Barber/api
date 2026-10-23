import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { ConfirmMediaUploadUseCase } from "../../../../domain/application/use-cases/media/confirm-upload/confirm-upload";
import { StorageUnavailableError } from "../../../../domain/application/services/storage-service";

const confirmMediaUploadSchema = z.object({
  userId: z.string().uuid(),
  mediaId: z.string().uuid(),
});

type ConfirmMediaUploadRequest = z.infer<typeof confirmMediaUploadSchema>;

export class ConfirmMediaUploadController implements Controller {
  constructor(private confirmUploadUseCase: ConfirmMediaUploadUseCase) {}

  async handle(request: ConfirmMediaUploadRequest): Promise<HttpResponse> {
    try {
      const parsed = confirmMediaUploadSchema.parse(request);

      const result = await this.confirmUploadUseCase.execute({
        mediaId: parsed.mediaId,
        userId: parsed.userId,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error.name === "StorageUnavailableError" || (error as any) instanceof StorageUnavailableError) {
          return {
            statusCode: 503,
            body: { message: error.message },
          };
        }
        return clientError({ message: error.message });
      }

      const media = result.value.media;

      return ok({
        media: {
          id: media.id.toString(),
          purpose: media.purpose,
          status: media.status,
          publicUrl: media.publicUrl,
          width: media.width,
          height: media.height,
          mimeType: media.mimeType,
          fileSize: media.fileSize,
        },
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      if (err instanceof StorageUnavailableError || err?.name === "StorageUnavailableError") {
        return {
          statusCode: 503,
          body: { message: err.message },
        };
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
