import { left, right, type Either } from "../../../../../core/logic/either";
import { ValidationError } from "../../_errors/validation-error";

const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;
const CIVIL_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function resolveSafeTimezone(tz?: string | null): string {
  const candidate = tz?.trim() || "America/Sao_Paulo";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: candidate });
    return candidate;
  } catch {
    return "America/Sao_Paulo";
  }
}

function getTimezoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = Number(part.value);
    }
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour === 24 ? 0 : map.hour,
    minute: map.minute,
    second: map.second,
  };
}

export function getCivilDateStringInTimezone(date: Date, timeZone: string): string {
  const p = getTimezoneParts(date, timeZone);
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function isValidCivilDateString(value: string): boolean {
  if (!CIVIL_DATE_REGEX.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return (
    utc.getUTCFullYear() === y &&
    utc.getUTCMonth() === m - 1 &&
    utc.getUTCDate() === d
  );
}

export function addDaysToCivilDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return `${utc.getUTCFullYear()}-${String(utc.getUTCMonth() + 1).padStart(2, "0")}-${String(utc.getUTCDate()).padStart(2, "0")}`;
}

export function civilDateToUtcStart(dateStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const parts = getTimezoneParts(new Date(utcGuess), timeZone);
  const renderedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const offsetMs = renderedAsUtc - utcGuess;
  const firstPass = new Date(utcGuess - offsetMs);
  // Second pass handles DST transition edge cases
  const parts2 = getTimezoneParts(firstPass, timeZone);
  const rendered2 = Date.UTC(
    parts2.year,
    parts2.month - 1,
    parts2.day,
    parts2.hour,
    parts2.minute,
    parts2.second,
  );
  const diff2 = utcGuess - rendered2;
  return new Date(firstPass.getTime() + diff2);
}

function parseBoundary(
  value: string | Date,
  role: "start" | "end",
  timeZone: string,
): Either<ValidationError, Date> {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return left(new ValidationError("Data informada é inválida."));
    }
    return right(value);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return left(new ValidationError("Data informada não pode ser vazia."));
  }

  if (CIVIL_DATE_REGEX.test(trimmed)) {
    if (!isValidCivilDateString(trimmed)) {
      return left(
        new ValidationError(`Data civil inválida: ${trimmed}.`),
      );
    }
    const effectiveDate =
      role === "end" ? addDaysToCivilDate(trimmed, 1) : trimmed;
    return right(civilDateToUtcStart(effectiveDate, timeZone));
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return left(
      new ValidationError(`Formato de data inválido: ${trimmed}.`),
    );
  }
  return right(parsed);
}

export interface ResolvedPeriod {
  startDate: Date;
  endDate: Date;
  timezone: string;
}

export function resolveRequiredPeriod(params: {
  startDate?: string | Date;
  endDate?: string | Date;
  timezone?: string | null;
  defaultDays?: number;
}): Either<ValidationError, ResolvedPeriod> {
  const tz = resolveSafeTimezone(params.timezone);
  const defaultDays = params.defaultDays ?? 30;
  const todayCivil = getCivilDateStringInTimezone(new Date(), tz);

  let resolvedEnd: Date;
  if (params.endDate !== undefined) {
    const parsedEnd = parseBoundary(params.endDate, "end", tz);
    if (parsedEnd.isLeft()) return left(parsedEnd.value);
    resolvedEnd = parsedEnd.value;
  } else {
    resolvedEnd = civilDateToUtcStart(addDaysToCivilDate(todayCivil, 1), tz);
  }

  let resolvedStart: Date;
  if (params.startDate !== undefined) {
    const parsedStart = parseBoundary(params.startDate, "start", tz);
    if (parsedStart.isLeft()) return left(parsedStart.value);
    resolvedStart = parsedStart.value;
  } else {
    const endCivil = getCivilDateStringInTimezone(
      new Date(resolvedEnd.getTime() - 1),
      tz,
    );
    resolvedStart = civilDateToUtcStart(
      addDaysToCivilDate(endCivil, -(defaultDays - 1)),
      tz,
    );
  }

  if (resolvedStart.getTime() >= resolvedEnd.getTime()) {
    return left(
      new ValidationError(
        "A data inicial deve ser estritamente anterior à data final.",
      ),
    );
  }

  if (resolvedEnd.getTime() - resolvedStart.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    return left(
      new ValidationError(
        `O intervalo máximo permitido para consulta é de ${MAX_RANGE_DAYS} dias.`,
      ),
    );
  }

  return right({
    startDate: resolvedStart,
    endDate: resolvedEnd,
    timezone: tz,
  });
}

export function resolveOptionalPeriod(params: {
  startDate?: string | Date;
  endDate?: string | Date;
  timezone?: string | null;
  defaultDays?: number;
}): Either<
  ValidationError,
  { startDate?: Date; endDate?: Date; timezone: string }
> {
  const tz = resolveSafeTimezone(params.timezone);
  if (params.startDate === undefined && params.endDate === undefined) {
    return right({ startDate: undefined, endDate: undefined, timezone: tz });
  }
  const resolved = resolveRequiredPeriod(params);
  if (resolved.isLeft()) return left(resolved.value);
  return right(resolved.value);
}
