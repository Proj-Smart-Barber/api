export const DEMO_SEED_NAMESPACE = "demo-smart-barber-v1";

export type Role = "OWNER" | "BARBERMAN";

export interface DemoStaffFixture {
  logicalKey: string;
  githubUser: string;
  name: string;
  email: string;
  cpf: string;
  role: Role;
  unitKey: "horizonte" | "estacao";
  defaultPasswordHash?: string;
}

export interface DemoBarbershopFixture {
  logicalKey: string;
  name: string;
  ownerLogicalKey: string;
  slug: string;
  cnpj: string;
  location: string;
  timezone: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface DemoScheduleFixture {
  logicalKey: string;
  barbershopLogicalKey: string;
  barbermanLogicalKey?: string; // se undefined, jornada geral da barbearia
  createdByLogicalKey: string;
  dayOfWeek:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
    | "SUNDAY";
  openTime: string;
  closeTime: string;
}

export interface DemoServiceFixture {
  logicalKey: string;
  barbershopLogicalKey: string;
  title: string;
  description: string;
  priceInCents: number;
  durationInMinutes: number;
  isActive: boolean;
}

export interface DemoCustomerFixture {
  logicalKey: string;
  name: string;
  email: string;
  cpf: string;
  phoneNumber: string;
}

export interface DemoScheduleExceptionFixture {
  logicalKey: string;
  barbershopLogicalKey: string;
  barbermanLogicalKey?: string; // se undefined, exceção geral
  dateOffsetDays: number; // offset a partir da data-base
  startTime?: string;
  endTime?: string;
  reason: string;
}

export interface DemoBookingFixture {
  logicalKey: string;
  barbershopLogicalKey: string;
  barbermanLogicalKey: string;
  customerLogicalKey: string;
  serviceLogicalKey: string;
  dateOffsetDays: number; // 0 = hoje, <0 = passado, >0 = futuro
  startTime: string;
  endTime: string;
  isDisposable?: boolean; // reserva de teste para cancelamento
}

export interface SeedRegistryRecord {
  id: string;
  namespace: string;
  logicalKey: string;
  tableName: string;
  recordId: string;
  createdAt: Date;
}

export interface DemoSeedExecutionSummary {
  namespace: string;
  baseDateSP: string;
  targetDatabase: {
    host: string;
    database: string;
    port: number;
    isLocal: boolean;
  };
  dryRun: boolean;
  counts: Record<string, { planned: number; created: number; reused: number }>;
  createdIds: Record<string, string>; // logicalKey -> UUID
}
