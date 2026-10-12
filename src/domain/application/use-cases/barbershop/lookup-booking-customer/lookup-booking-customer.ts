import { type Either, left, right } from "../../../../../core/logic/either";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";
import type { UsersRepository } from "../../../repositories/users-repository";
import { NotAllowedError } from "../../_errors/not-allowed-error";
import { ResourceNotFoundError } from "../../_errors/resource-not-found-error";
import { Cpf } from "../../../../enterprise/entities/value-objects/cpf";

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}***@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  const last4 = digits.slice(-4);
  return `(***) *****-${last4}`;
}

export interface LookupBookingCustomerDTO {
  shopId: string;
  actorId: string;
  email?: string;
  cpf?: string;
}

export interface CustomerLookupResult {
  id: string;
  name: string;
  maskedEmail: string;
  maskedPhone: string | null;
  isEligible: boolean;
  unconfirmedEmail: boolean;
}

export type LookupBookingCustomerResponse = Either<
  NotAllowedError | ResourceNotFoundError | Error,
  CustomerLookupResult
>;

export class LookupBookingCustomerUseCase {
  constructor(
    private membershipsRepository: MembershipsRepository,
    private usersRepository: UsersRepository,
  ) {}

  async execute({
    shopId,
    actorId,
    email,
    cpf,
  }: LookupBookingCustomerDTO): Promise<LookupBookingCustomerResponse> {
    const actorMembership =
      await this.membershipsRepository.findByBarbershopAndUser(shopId, actorId);

    if (!actorMembership || actorMembership.state !== "ACTIVE") {
      return left(
        new NotAllowedError(
          "Apenas profissionais com vínculo ativo na unidade podem buscar clientes.",
        ),
      );
    }

    const hasEmail = typeof email === "string" && email.trim() !== "";
    const hasCpf = typeof cpf === "string" && cpf.trim() !== "";

    if ((hasEmail && hasCpf) || (!hasEmail && !hasCpf)) {
      return left(
        new Error(
          "Informe exatamente um critério de busca: e-mail exato ou CPF completo.",
        ),
      );
    }

    let foundUser = null;

    if (hasEmail) {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail.includes("@") || cleanEmail.length < 5) {
        return left(new Error("E-mail inválido para busca."));
      }
      foundUser = await this.usersRepository.findByEmail(cleanEmail);
    } else if (hasCpf) {
      const cleanCpf = cpf.trim();
      const digitsOnly = cleanCpf.replace(/\D/g, "");
      if (digitsOnly.length !== 11 || !Cpf.isValid(digitsOnly)) {
        return left(
          new Error("CPF completo e válido é obrigatório para busca."),
        );
      }
      foundUser = await this.usersRepository.findByCpf(cleanCpf);
    }

    if (!foundUser) {
      return left(new ResourceNotFoundError("Cliente não encontrado."));
    }

    const isEligible = foundUser.isEmailVerified;

    return right({
      id: foundUser.id.toString(),
      name: foundUser.name,
      maskedEmail: maskEmail(foundUser.email),
      maskedPhone: maskPhone(foundUser.phoneNumber),
      isEligible,
      unconfirmedEmail: !isEligible,
    });
  }
}
