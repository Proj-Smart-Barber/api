import { z } from "zod";

export const civilDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.getUTCFullYear() > 0 &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Data inválida.");
export const competence = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .refine((value) => !value.startsWith("0000-"));
export const expenseCategory = z.enum([
  "FIXED",
  "VARIABLE",
  "BARBER_PAYOUT",
  "PAYROLL",
  "OTHER",
]);
export const createExpense = z
  .object({
    requestId: z.string().uuid(),
    description: z.string().trim().min(2).max(160),
    category: expenseCategory,
    amountInCents: z.number().int().positive().max(2_000_000_000),
    dueOn: civilDate,
    payee: z.string().trim().max(120).default(""),
  })
  .strict();
export const updateEntry = z
  .object({
    action: z.enum(["PAY", "CANCEL"]),
    expectedVersion: z.number().int().positive(),
    paidOn: civilDate.optional(),
  })
  .strict()
  .refine(
    (value) => value.action !== "PAY" || Boolean(value.paidOn),
    "Informe a data do pagamento.",
  );
export const receiptInput = z
  .object({
    requestId: z.string().uuid(),
    bookingId: z.string().uuid(),
    paidOn: civilDate,
  })
  .strict();

export class FinanceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export interface FinanceEntry {
  id: string;
  kind: "EXPENSE" | "RECEIPT";
  category: string;
  description: string;
  amountInCents: number;
  dueOn: string;
  paidOn: string | null;
  payee: string;
  status: "PLANNED" | "PAID" | "CANCELLED";
  version: number;
  bookingId: string | null;
}
export interface FinanceBooking {
  id: string;
  date: string;
  status: string;
  professional: string;
  services: string;
  amountInCents: number | null;
  receiptId: string | null;
}

export function periodBounds(month: string) {
  const valid = competence.parse(month);
  const last = new Date(`${valid}-01T12:00:00Z`);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  return {
    month: valid,
    from: `${valid}-01`,
    to: last.toISOString().slice(0, 10),
  };
}
export interface FinancePeriodBounds {
  month: string;
  from: string;
  to: string;
  view?: "all" | "summary" | "entries" | "bookings";
  entriesPage?: number;
  entriesLimit?: number;
  bookingsPage?: number;
  bookingsLimit?: number;
}
export function resolveFinancePeriod(
  input: unknown,
  today: string,
): FinancePeriodBounds {
  if (typeof input === "string" || input === undefined)
    return periodBounds(typeof input === "string" ? input : today.slice(0, 7));
  const values = z
    .object({
      month: competence.optional(),
      from: civilDate.optional(),
      to: civilDate.optional(),
      view: z.enum(["all", "summary", "entries", "bookings"]).optional(),
      entriesPage: z.coerce.number().int().min(1).optional(),
      entriesLimit: z.coerce.number().int().min(1).max(200).optional(),
      bookingsPage: z.coerce.number().int().min(1).optional(),
      bookingsLimit: z.coerce.number().int().min(1).max(200).optional(),
    })
    .strict()
    .parse(input);
  if (values.from || values.to) {
    if (!values.from || !values.to || values.month || values.from > values.to)
      throw new FinanceError(
        400,
        "Informe um período válido, com início e fim.",
      );
    const days =
      Math.round(
        (Date.parse(`${values.to}T12:00:00Z`) -
          Date.parse(`${values.from}T12:00:00Z`)) /
          86400000,
      ) + 1;
    if (days > 366) {
      throw new FinanceError(
        400,
        "O período consultado não pode exceder 366 dias.",
      );
    }
    return {
      month: values.from.slice(0, 7),
      from: values.from,
      to: values.to,
      view: values.view,
      entriesPage: values.entriesPage,
      entriesLimit: values.entriesLimit,
      bookingsPage: values.bookingsPage,
      bookingsLimit: values.bookingsLimit,
    };
  }
  return {
    ...periodBounds(values.month ?? today.slice(0, 7)),
    view: values.view,
    entriesPage: values.entriesPage,
    entriesLimit: values.entriesLimit,
    bookingsPage: values.bookingsPage,
    bookingsLimit: values.bookingsLimit,
  };
}
export function nextDueDate(date: string) {
  civilDate.parse(date);
  const next = new Date(`${date}T12:00:00Z`);
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + 1);
  if (next.getUTCFullYear() > 9999)
    throw new FinanceError(422, "O vencimento excede o calendário suportado.");
  const last = new Date(next);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  next.setUTCDate(Math.min(day, last.getUTCDate()));
  return next.toISOString().slice(0, 10);
}
function add(a: number, b: number) {
  const value = a + b;
  if (!Number.isSafeInteger(value))
    throw new FinanceError(422, "O total excedeu o limite de cálculo.");
  return value;
}
export function projectFinance(
  month: string,
  entries: FinanceEntry[],
  bookings: FinanceBooking[],
) {
  const { from, to } = periodBounds(month);
  return projectFinanceRange(from, to, entries, bookings);
}
export function projectFinanceRange(
  from: string,
  to: string,
  entries: FinanceEntry[],
  bookings: FinanceBooking[],
) {
  resolveFinancePeriod({ from, to }, from);
  const inside = (date: string | null) =>
    Boolean(date && date >= from && date <= to);
  let completed = 0,
    forecast = 0,
    received = 0,
    paid = 0,
    payable = 0,
    unknownPrices = 0;
  const startMs = Date.parse(`${from}T12:00:00Z`);
  const days =
    Math.round((Date.parse(`${to}T12:00:00Z`) - startMs) / 86400000) + 1;
  const daily = Array.from({ length: days <= 366 ? days : 0 }, (_, index) => ({
    date: new Date(startMs + index * 86400000).toISOString().slice(0, 10),
    completedInCents: 0,
    forecastInCents: 0,
    paidInCents: 0,
  }));
  const byDate = new Map(daily.map((day) => [day.date, day]));
  for (const booking of bookings) {
    if (!inside(booking.date)) continue;
    const isCompleted = booking.status === "COMPLETED";
    const scheduled = ["WAITING", "CONFIRMED", "IN_SERVICE"].includes(
      booking.status,
    );
    if (!isCompleted && !scheduled) continue;
    if (
      booking.amountInCents === null ||
      !Number.isSafeInteger(booking.amountInCents) ||
      booking.amountInCents < 0
    ) {
      unknownPrices++;
      continue;
    }
    const day = byDate.get(booking.date);
    if (isCompleted) {
      completed = add(completed, booking.amountInCents);
      if (day)
        day.completedInCents = add(day.completedInCents, booking.amountInCents);
    } else {
      forecast = add(forecast, booking.amountInCents);
      if (day)
        day.forecastInCents = add(day.forecastInCents, booking.amountInCents);
    }
  }
  for (const entry of entries) {
    if (entry.status === "CANCELLED") continue;
    if (entry.status === "PAID" && entry.paidOn && inside(entry.paidOn)) {
      if (entry.kind === "RECEIPT")
        received = add(received, entry.amountInCents);
      else {
        paid = add(paid, entry.amountInCents);
        const day = byDate.get(entry.paidOn);
        if (day) day.paidInCents = add(day.paidInCents, entry.amountInCents);
      }
    } else if (
      entry.kind === "EXPENSE" &&
      entry.status === "PLANNED" &&
      inside(entry.dueOn)
    ) {
      payable = add(payable, entry.amountInCents);
    }
  }
  return {
    completedInCents: completed,
    forecastInCents: forecast,
    receivedInCents: received,
    paidInCents: paid,
    payableInCents: payable,
    balanceInCents: received - paid,
    unknownPrices,
    daily,
  };
}
