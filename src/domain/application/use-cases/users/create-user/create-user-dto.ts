export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  cpf: string;
  onboardingIntent?: "OWNER" | "CLIENT" | null;
}
