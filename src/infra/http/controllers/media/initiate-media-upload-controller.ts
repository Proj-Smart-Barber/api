import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  created,
  fail,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { InitiateMediaUploadUseCase } from "../../../../domain/application/use-cases/media/initiate-upload/initiate-upload";
import { StorageUnavailableError } from "../../../../domain/application/services/storage-service";

const initiateMediaUploadSchema = z.object({
  userId: z.string().uuid(),
  purpose: z
    .enum([
      "USER_AVATAR",
      "AVATAR",
      "BARBERSHOP_LOGO",
      "BARBERSHOP_COVER",
      "BARBERSHOP_GALLERY",
    ])
    .transform((val) => (val === "AVATAR" ? "USER_AVATAR" : val)),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.coerce.number().positive(),
  barbershopId: z.string().uuid().optional(),
});

type InitiateMediaUploadRequest = z.infer<typeof initiateMediaUploadSchema>;

export class InitiateMediaUploadController implements Controller {
  constructor(private initiateUploadUseCase: InitiateMediaUploadUseCase) {}

  async handle(request: InitiateMediaUploadRequest): Promise<HttpResponse> {
    try {
      const parsed = initiateMediaUploadSchema.parse(request);

      const result = await this.initiateUploadUseCase.execute({
        userId: parsed.userId,
        purpose: parsed.purpose,
        fileName: parsed.fileName,
        mimeType: parsed.contentType,
        fileSize: parsed.fileSize,
        barbershopId: parsed.barbershopId,
      });

      if (result.isLeft()) {
        const error = result.value;
        if (error.name === "StorageUnavailableError") {
          return {
            statusCode: 503,
            body: { message: error.message },
          };
        }
        return clientError({ message: error.message });
      }

      return created(result.value);
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
