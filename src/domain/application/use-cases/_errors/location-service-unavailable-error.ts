import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class LocationServiceUnavailableError
  extends Error
  implements UseCaseError
{
  constructor(message?: string) {
    super(
      message ??
        "Serviço de busca por proximidade temporariamente indisponível. Utilize a busca por nome ou endereço.",
    );
    this.name = "LocationServiceUnavailableError";
  }
}
