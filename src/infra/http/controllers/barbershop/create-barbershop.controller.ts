import type { Controller } from "@/core/infra/controller";
import {
  clientError,
  conflict,
  created,
  fail,
  type HttpResponse,
  notFound,
} from "@/core/infra/http-response";
import { BarbershopAlreadyExistsError } from "@/domain/application/use-cases/_errors/barbershop-already-exists-error";
import type { CreateBarbershopUseCase } from "@/domain/application/use-cases/barbershop/create-barbershop/create-barbershop";
import { z, ZodError } from "zod";

const cnpjSchema = z
  .string()
  .transform((value) => value.replace(/[./\s-]/g, ""))
  .pipe(z.string().regex(/^\d{14}$/, "CNPJ deve conter 14 dígitos."));

const timezoneSchema = z.string().refine((timezone) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}, "Timezone inválido.");

const createBarbershopControllerRequest = z
  .object({
    userId: z.uuid(),
    name: z.string().trim().min(1),
    cnpj: cnpjSchema,
    location: z.string().trim().min(1),
    timezone: timezoneSchema.optional(),
    avatarUrl: z.url().optional(),
  })
  .strict();

type CreateBarbershopControllerRequest = z.infer<
  typeof createBarbershopControllerRequest
>;

export class CreateBarbershopController implements Controller {
  constructor(private createBarbershopUseCase: CreateBarbershopUseCase) {}

  async handle(
    request: CreateBarbershopControllerRequest,
  ): Promise<HttpResponse> {
    try {
      const { userId, name, cnpj, location, timezone, avatarUrl } =
        createBarbershopControllerRequest.parse(request);

      const result = await this.createBarbershopUseCase.execute({
        name,
        ownerId: userId,
        cnpj,
        location,
        timezone,
        avatarUrl,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof BarbershopAlreadyExistsError) {
          return conflict(error.message);
        }

        return notFound(error.message);
      }

      return created(result.value);
    } catch (error) {
      if (error instanceof ZodError) {
        return clientError(z.prettifyError(error));
      }

      return fail(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
