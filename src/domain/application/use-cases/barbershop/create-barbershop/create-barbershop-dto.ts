export interface CreateBarbershopDTO {
  name: string;
  ownerId: string;
  cnpj: string;
  location: string;
  timezone?: string;
  avatarUrl?: string;
}
