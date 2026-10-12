import type { UseCaseError } from "../../../../core/errors/use-case-error";

export interface AuthoritativeQuote {
  serviceItems: Array<{
    serviceId: string | null;
    title: string;
    priceInCents: number;
    durationInMinutes: number;
    legacyAggregate?: boolean;
  }>;
  totalPriceInCents: number;
  totalDurationInMinutes: number;
}

export class SlotUnavailableError extends Error implements UseCaseError {
  readonly code = "SLOT_UNAVAILABLE";
  constructor(
    message = "Horário indisponível devido a um conflito na agenda.",
  ) {
    super(message);
    this.name = "SlotUnavailableError";
  }
}

export class QuoteChangedError extends Error implements UseCaseError {
  readonly code = "QUOTE_CHANGED";
  readonly operationState = "NOT_APPLIED";

  constructor(
    public readonly quote: AuthoritativeQuote,
    public readonly serverTime: string,
    public readonly requestId?: string,
    message = "O orçamento ou duração dos serviços foi alterado. Revise para confirmar.",
  ) {
    super(message);
    this.name = "QuoteChangedError";
  }
}

export class BookingVersionConflictError extends Error implements UseCaseError {
  readonly code = "BOOKING_VERSION_CONFLICT";
  constructor(
    message = "Conflito de versão no agendamento. O recurso foi alterado concorrentemente.",
    public readonly currentVersion?: number,
  ) {
    super(message);
    this.name = "BookingVersionConflictError";
  }
}

export class ActionDeadlinePassedError extends Error implements UseCaseError {
  readonly code = "ACTION_DEADLINE_PASSED";
  constructor(
    message = "O prazo limite para executar esta ação no agendamento expirou.",
  ) {
    super(message);
    this.name = "ActionDeadlinePassedError";
  }
}

export class MembershipInactiveError extends Error implements UseCaseError {
  readonly code = "MEMBERSHIP_INACTIVE";
  constructor(
    message = "O profissional ou ator não possui vínculo ativo na unidade.",
  ) {
    super(message);
    this.name = "MembershipInactiveError";
  }
}

export class CustomerNotEligibleError extends Error implements UseCaseError {
  readonly code = "CUSTOMER_NOT_ELIGIBLE";
  constructor(
    message = "O cliente informado não é elegível (conta inexistente ou e-mail não confirmado).",
  ) {
    super(message);
    this.name = "CustomerNotEligibleError";
  }
}

export class TerminalBookingStateError extends Error implements UseCaseError {
  readonly code = "TERMINAL_BOOKING_STATE";
  constructor(
    message = "O agendamento já se encontra em estado terminal e não permite alterações.",
  ) {
    super(message);
    this.name = "TerminalBookingStateError";
  }
}
