import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class LocationServiceUnavailableError
  extends Error
  implements UseCaseError
{
  readonly code = "LOCATION_SERVICE_UNAVAILABLE";

  constructor(message?: string) {
    super(
      message ??
        "Serviço de busca por proximidade temporariamente indisponível. Utilize a busca por nome ou endereço.",
    );
    this.name = "LocationServiceUnavailableError";
  }
}
