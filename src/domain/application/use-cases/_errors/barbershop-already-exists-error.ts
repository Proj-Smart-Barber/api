import type { UseCaseError } from "../../../../core/errors/use-case-error";

export class BarbershopAlreadyExistsError
  extends Error
  implements UseCaseError
{
  constructor() {
    super("Já existe uma barbearia com este CNPJ ou nome.");
    this.name = "BarbershopAlreadyExistsError";
  }
}
