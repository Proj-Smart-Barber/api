import { type Either, left, right } from "../../../../../core/logic/either";
import { Role } from "../../../../enterprise/entities/membership";
import type { BarbershopsRepository } from "../../../repositories/barbershops-repository";
import type { MembershipsRepository } from "../../../repositories/memberships-repository";

export interface UpdateBarbershopGoogleUrlDTO {
  userId: string;
  barbershopId: string;
  googleMapsUrl?: string | null;
}

export class UpdateBarbershopGoogleUrlUseCase {
  private readonly ALLOWED_GOOGLE_HOSTS = [
    "maps.google.com",
    "google.com",
    "www.google.com",
    "goo.gl",
    "maps.app.goo.gl",
  ];

  constructor(
    private barbershopsRepository: BarbershopsRepository,
    private membershipsRepository: MembershipsRepository
  ) {}

  private async verifyOwner(userId: string, barbershopId: string): Promise<boolean> {
    const shop = await this.barbershopsRepository.findById(barbershopId);
    if (!shop) return false;

    const members = await this.membershipsRepository.findManyByBarbershopId(barbershopId);
    const activeOwner = members.find(
      (m) => m.userId.toString() === userId && m.role === Role.OWNER && m.state === "ACTIVE"
    );
    return !!activeOwner;
  }

  async execute(dto: UpdateBarbershopGoogleUrlDTO): Promise<Either<Error, { googleMapsUrl?: string }>> {
    const isOwner = await this.verifyOwner(dto.userId, dto.barbershopId);
    if (!isOwner) {
      return left(new Error("Apenas o proprietário ativo da unidade pode configurar o link do Google."));
    }

    const shop = await this.barbershopsRepository.findById(dto.barbershopId);
    if (!shop) {
      return left(new Error("Barbearia não encontrada."));
    }

    // Se fornecida, valida a URL
    if (dto.googleMapsUrl && dto.googleMapsUrl.trim().length > 0) {
      const trimmedUrl = dto.googleMapsUrl.trim();

      let parsed: URL;
      try {
        parsed = new URL(trimmedUrl);
      } catch {
        return left(new Error("URL do Google Maps inválida."));
      }

      // Rejeita esquema diferente de https
      if (parsed.protocol !== "https:") {
        return left(new Error("A URL do Google Maps deve utilizar obrigatoriamente o protocolo HTTPS."));
      }

      // Rejeita credenciais embutidas (ex: https://user:pass@google.com)
      if (parsed.username || parsed.password) {
        return left(new Error("A URL não pode conter credenciais de autenticação embutidas."));
      }

      // Valida domínio Google permitido
      const hostname = parsed.hostname.toLowerCase();
      const isAllowedHost = this.ALLOWED_GOOGLE_HOSTS.some(
        (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
      );

      if (!isAllowedHost) {
        return left(
          new Error(
            "O link deve ser um endereço oficial válido do Google ou Google Maps (ex.: maps.google.com ou maps.app.goo.gl)."
          )
        );
      }

      shop.googleMapsUrl = parsed.toString();
    } else {
      shop.googleMapsUrl = undefined;
    }

    await this.barbershopsRepository.save(shop);

    return right({ googleMapsUrl: shop.googleMapsUrl });
  }
}
