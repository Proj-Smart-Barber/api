import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  fail,
  ok,
  notFound,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { GetMediaStatusUseCase } from "../../../../domain/application/use-cases/media/get-media-status/get-media-status";

const getMediaStatusSchema = z.object({
  userId: z.string().uuid(),
  mediaId: z.string().uuid(),
});

type GetMediaStatusRequest = z.infer<typeof getMediaStatusSchema>;

export class GetMediaStatusController implements Controller {
  constructor(private getMediaStatusUseCase: GetMediaStatusUseCase) {}

  async handle(request: GetMediaStatusRequest): Promise<HttpResponse> {
    try {
      const parsed = getMediaStatusSchema.parse(request);

      const result = await this.getMediaStatusUseCase.execute({
        mediaId: parsed.mediaId,
        userId: parsed.userId,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error.message.includes("não encontrada")) {
          return notFound({ message: error.message });
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
          generation: media.generation,
          variants: media.variants,
          createdAt: media.createdAt,
          updatedAt: media.updatedAt,
        },
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
