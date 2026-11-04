import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  conflict,
  created,
  fail,
  type HttpResponse,
  notFound,
  unauthorized,
} from "../../../../core/infra/http-response";
import { BarbershopAlreadyExistsError } from "../../../../domain/application/use-cases/_errors/barbershop-already-exists-error";
import type { CreateBarbershopUseCase } from "../../../../domain/application/use-cases/barbershop/create-barbershop/create-barbershop";
import { z, ZodError } from "zod";

const cnpjSchema = z
  .string({ required_error: "CNPJ é obrigatório." })
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

export const createBarbershopBodySchema = z
  .object({
    name: z
      .string({ required_error: "Nome é obrigatório." })
      .trim()
      .min(1, "Nome é obrigatório."),
    cnpj: cnpjSchema,
    location: z
      .string({ required_error: "Localização é obrigatória." })
      .trim()
      .min(1, "Localização é obrigatória."),
    timezone: timezoneSchema.optional(),
    avatarUrl: z.url("URL do avatar inválida.").optional(),
  })
  .strict();

export const authenticatedActorSchema = z
  .string({ required_error: "Usuário não autenticado." })
  .uuid("Usuário não autenticado.");

export interface CreateBarbershopControllerRequest {
  userId?: unknown;
  _body?: unknown;
  _query?: unknown;
  headers?: unknown;
  [key: string]: unknown;
}

export class CreateBarbershopController implements Controller {
  constructor(private createBarbershopUseCase: CreateBarbershopUseCase) {}

  async handle(
    request: CreateBarbershopControllerRequest,
  ): Promise<HttpResponse> {
    try {
      // 1. Obter e validar o ator exclusivamente do contexto autenticado fornecido pelo adapter
      const actorResult = authenticatedActorSchema.safeParse(request?.userId);
      if (!actorResult.success) {
        return unauthorized({
          error: "Usuário não autenticado.",
          message: "Usuário não autenticado.",
        });
      }
      const actorUserId = actorResult.data;

      // 2. Extrair estritamente o body original (_body) da requisição
      const rawBody =
        request && typeof request === "object" && "_body" in request
          ? request._body
          : undefined;

      const { name, cnpj, location, timezone, avatarUrl } =
        createBarbershopBodySchema.parse(rawBody);

      // 3. Executar o caso de uso vinculando o proprietário estritamente ao ator autenticado
      const result = await this.createBarbershopUseCase.execute({
        name,
        ownerId: actorUserId,
        cnpj,
        location,
        timezone,
        avatarUrl,
      });

      if (result.isLeft()) {
        const error = result.value;

        if (error instanceof BarbershopAlreadyExistsError) {
          return conflict({
            error: error.message,
            message: error.message,
          });
        }

        return notFound({
          error: error.message,
          message: error.message,
        });
      }

      return created(result.value);
    } catch (error) {
      if (error instanceof ZodError) {
        return clientError({
          error: z.prettifyError(error),
          message: z.prettifyError(error),
        });
      }

      console.error("[CreateBarbershopController] Internal error:", error);
      return fail(
        new Error("Erro interno ao processar cadastro da barbearia."),
      );
    }
  }
}
