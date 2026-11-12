import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../../../drizzle";
import {
  FinanceError,
  createExpense,
  nextDueDate,
  resolveFinancePeriod,
  receiptInput,
  updateEntry,
  type FinanceEntry,
  type FinanceBooking,
} from "../../../../domain/application/services/finance/finance";

const columns = sql.raw(
  "id,kind,category,description,amount_in_cents,due_on::text,paid_on::text,payee,status,version,booking_id",
);
type Row = Record<string, unknown>;
function entry(row: Row): FinanceEntry {
  return {
    id: String(row.id),
    kind: row.kind as FinanceEntry["kind"],
    category: String(row.category),
    description: String(row.description),
    amountInCents: Number(row.amount_in_cents),
    dueOn: String(row.due_on),
    paidOn: row.paid_on ? String(row.paid_on) : null,
    payee: String(row.payee),
    status: row.status as FinanceEntry["status"],
    version: Number(row.version),
    bookingId: row.booking_id ? String(row.booking_id) : null,
  };
}
function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
const bookingPrice = sql.raw(`COALESCE(b.total_price_in_cents,
 (SELECT CASE WHEN COUNT(*)>0 AND COUNT(price_in_cents)=COUNT(*) THEN SUM(price_in_cents) ELSE NULL END
 FROM booking_service_items WHERE booking_id=b.id))`);

export class FinanceRepository {
  constructor(private database = db) {}

  private async readPeriod(shopId: string, userId: string, input: unknown) {
    return this.database.transaction(
      async (tx) => {
        // Lock authority first, then keep summary and pages in the same short snapshot.
        const owner =
          await tx.execute(sql`SELECT m.user_id,s.timezone FROM membership m
        JOIN barbershops s ON s.id=m.barbershop_id
        WHERE m.user_id=${userId}::uuid AND m.barbershop_id=${shopId}::uuid
          AND m.role='OWNER' AND m.state='ACTIVE' FOR SHARE OF m`);
        if (!owner.rows.length)
          throw new FinanceError(
            403,
            "Acesso financeiro reservado ao proprietário ativo da unidade.",
          );
        const timezone = String(owner.rows[0].timezone);
        const now = new Date();
        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(now);
        const bounds = resolveFinancePeriod(input, today);
        const view = bounds.view ?? "all";
        const bookingWindow = sql`b.barbershop_id=${shopId}::uuid AND (
        (b.starts_at IS NOT NULL AND b.starts_at >= (${bounds.from}::date::timestamp AT TIME ZONE ${timezone})
          AND b.starts_at < ((${bounds.to}::date + INTERVAL '1 day')::timestamp AT TIME ZONE ${timezone}))
        OR (b.starts_at IS NULL AND b.date >= ${bounds.from}::date
          AND b.date < ${bounds.to}::date + INTERVAL '1 day'))`;
        const entriesWindow = sql`barbershop_id=${shopId}::uuid AND
        (due_on BETWEEN ${bounds.from}::date AND ${bounds.to}::date
          OR paid_on BETWEEN ${bounds.from}::date AND ${bounds.to}::date)`;
        // Aggregates, not individual bookings/entries, cross the database boundary.
        const aggregate = await tx.execute(sql`
        WITH relevant_bookings AS (
          SELECT COALESCE((b.starts_at AT TIME ZONE ${timezone})::date,b.date::date) AS day,
            b.status, ${bookingPrice} AS amount FROM bookings b WHERE ${bookingWindow}
        ), booking_days AS (
          SELECT day,
            COALESCE(SUM(amount) FILTER (WHERE status='COMPLETED' AND amount>=0),0) AS completed,
            COALESCE(SUM(amount) FILTER (WHERE status IN ('WAITING','CONFIRMED','IN_SERVICE') AND amount>=0),0) AS forecast,
            COUNT(*) FILTER (WHERE status IN ('WAITING','CONFIRMED','IN_SERVICE','COMPLETED') AND (amount IS NULL OR amount<0)) AS unknown
          FROM relevant_bookings GROUP BY day
        ), relevant_entries AS (SELECT * FROM finance_entries WHERE ${entriesWindow}),
        entry_days AS (
          SELECT paid_on AS day,
            COALESCE(SUM(amount_in_cents) FILTER (WHERE kind='RECEIPT'),0) AS received,
            COALESCE(SUM(amount_in_cents) FILTER (WHERE kind='EXPENSE'),0) AS paid
          FROM relevant_entries WHERE status='PAID' AND paid_on BETWEEN ${bounds.from}::date AND ${bounds.to}::date GROUP BY paid_on
        )
        SELECT days.day::date::text AS date, COALESCE(b.completed,0)::text AS completed,
          COALESCE(b.forecast,0)::text AS forecast, COALESCE(b.unknown,0)::text AS unknown,
          COALESCE(e.received,0)::text AS received, COALESCE(e.paid,0)::text AS paid,
          (SELECT COALESCE(SUM(amount_in_cents),0)::text FROM relevant_entries
            WHERE kind='EXPENSE' AND status='PLANNED' AND due_on BETWEEN ${bounds.from}::date AND ${bounds.to}::date) AS payable,
          (SELECT COUNT(*)::text FROM relevant_entries WHERE ${view === "entries" ? sql`kind='EXPENSE'` : sql`TRUE`}) AS entries_total,
          (SELECT COUNT(*)::text FROM relevant_bookings) AS bookings_total
        FROM generate_series(${bounds.from}::date::timestamp, ${bounds.to}::date::timestamp, INTERVAL '1 day') AS days(day)
        LEFT JOIN booking_days b ON b.day=days.day::date
        LEFT JOIN entry_days e ON e.day=days.day::date ORDER BY days.day`);
        const numeric = (value: unknown): number => {
          const n = Number(value ?? 0);
          if (!Number.isSafeInteger(n))
            throw new FinanceError(422, "O total excedeu o limite de cálculo.");
          return n;
        };
        const sum = (field: string) =>
          numeric(
            aggregate.rows
              .reduce((acc, row) => acc + BigInt(String(row[field] ?? 0)), 0n)
              .toString(),
          );
        const completed = sum("completed"),
          forecast = sum("forecast");
        const received = sum("received"),
          paid = sum("paid");
        const summary = {
          completedInCents: completed,
          forecastInCents: forecast,
          receivedInCents: received,
          paidInCents: paid,
          payableInCents: numeric(aggregate.rows[0]?.payable),
          balanceInCents: numeric(received - paid),
          unknownPrices: sum("unknown"),
          daily: aggregate.rows.map((row) => ({
            date: String(row.date),
            completedInCents: numeric(row.completed),
            forecastInCents: numeric(row.forecast),
            paidInCents: numeric(row.paid),
          })),
        };
        const entriesPage = bounds.entriesPage ?? 1,
          bookingsPage = bounds.bookingsPage ?? 1;
        // Legacy view remains compatible. New screens request only one bounded section.
        const entriesLimit =
          bounds.entriesLimit ?? (view === "entries" ? 30 : undefined);
        const bookingsLimit =
          bounds.bookingsLimit ?? (view === "bookings" ? 30 : undefined);
        let entries: FinanceEntry[] = [],
          bookings: FinanceBooking[] = [];
        if (view === "all" || view === "entries") {
          const values =
            await tx.execute(sql`SELECT ${columns} FROM finance_entries WHERE ${entriesWindow}
          AND ${view === "entries" ? sql`kind='EXPENSE'` : sql`TRUE`} ORDER BY due_on,id
          ${entriesLimit ? sql`LIMIT ${entriesLimit} OFFSET ${(entriesPage - 1) * entriesLimit}` : sql``}`);
          entries = values.rows.map(entry);
        }
        if (view === "all" || view === "bookings") {
          const rows = await tx.execute(sql`WITH page AS (
          SELECT b.* FROM bookings b WHERE ${bookingWindow} ORDER BY b.starts_at,b.id
          ${bookingsLimit ? sql`LIMIT ${bookingsLimit} OFFSET ${(bookingsPage - 1) * bookingsLimit}` : sql``}
        ) SELECT b.id,b.status,COALESCE((b.starts_at AT TIME ZONE ${timezone})::date,b.date::date)::text AS date,
          ${bookingPrice} AS amount,COALESCE(u.name,'Profissional') AS professional,
          COALESCE((SELECT string_agg(title,', ' ORDER BY id) FROM booking_service_items WHERE booking_id=b.id),'Atendimento') AS services,
          f.id AS receipt_id FROM page b LEFT JOIN users u ON u.id=b.barberman_id
          LEFT JOIN finance_entries f ON f.booking_id=b.id AND f.kind='RECEIPT' ORDER BY b.starts_at,b.id`);
          bookings = rows.rows.map((row) => ({
            id: String(row.id),
            date: String(row.date),
            status: String(row.status),
            professional: String(row.professional),
            services: String(row.services),
            amountInCents: row.amount === null ? null : numeric(row.amount),
            receiptId: row.receipt_id ? String(row.receipt_id) : null,
          }));
        }
        return {
          month: bounds.month,
          from: bounds.from,
          to: bounds.to,
          today,
          timezone,
          serverTime: now.toISOString(),
          entries,
          bookings,
          entriesTotal: numeric(aggregate.rows[0]?.entries_total),
          bookingsTotal: numeric(aggregate.rows[0]?.bookings_total),
          entriesPage,
          bookingsPage,
          entriesLimit: entriesLimit ?? entries.length,
          bookingsLimit: bookingsLimit ?? bookings.length,
          summary,
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }

  async execute(
    shopId: string,
    userId: string,
    operation: string,
    input: unknown,
  ) {
    if (operation === "period") {
      return this.readPeriod(shopId, userId, input);
    }

    return this.database.transaction(async (tx) => {
      const owner =
        await tx.execute(sql`SELECT m.user_id,s.timezone FROM membership m
        JOIN barbershops s ON s.id=m.barbershop_id
        WHERE m.user_id=${userId}::uuid AND m.barbershop_id=${shopId}::uuid
        AND m.role='OWNER' AND m.state='ACTIVE' FOR SHARE OF m`);
      if (!owner.rows.length)
        throw new FinanceError(
          403,
          "Acesso financeiro reservado ao proprietário ativo da unidade.",
        );
      const timezone = String(owner.rows[0].timezone);
      const now = new Date();
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);

      if (operation === "create" || operation === "copy") {
        let sourceId: string | null = null;
        let values: ReturnType<typeof createExpense.parse>;
        if (operation === "copy") {
          const body = input as { entryId: string; requestId: string };
          const source = await tx.execute(
            sql`SELECT ${columns} FROM finance_entries WHERE id=${body.entryId}::uuid AND barbershop_id=${shopId}::uuid FOR UPDATE`,
          );
          if (!source.rows[0])
            throw new FinanceError(404, "Lançamento não encontrado.");
          const original = entry(source.rows[0]);
          if (original.kind !== "EXPENSE" || original.status === "CANCELLED")
            throw new FinanceError(
              409,
              "Somente despesas válidas podem ser copiadas.",
            );
          sourceId = original.id;
          values = createExpense.parse({
            requestId: body.requestId,
            description: original.description,
            category: original.category,
            amountInCents: original.amountInCents,
            dueOn: nextDueDate(original.dueOn),
            payee: original.payee,
          });
        } else values = createExpense.parse(input);
        const hash = fingerprint({ ...values, requestId: undefined, sourceId });
        const inserted = await tx.execute(sql`INSERT INTO finance_entries
          (id,barbershop_id,created_by,request_id,request_hash,kind,category,description,amount_in_cents,due_on,payee,status,source_id)
          VALUES (${randomUUID()}::uuid,${shopId}::uuid,${userId}::uuid,${values.requestId}::uuid,${hash},'EXPENSE',
            ${values.category},${values.description},${values.amountInCents},${values.dueOn}::date,${values.payee},'PLANNED',${sourceId}::uuid)
          ON CONFLICT DO NOTHING RETURNING ${columns}`);
        if (inserted.rows[0]) return entry(inserted.rows[0]);
        const previous =
          await tx.execute(sql`SELECT ${columns},request_hash FROM finance_entries WHERE barbershop_id=${shopId}::uuid
          AND (request_id=${values.requestId}::uuid OR (source_id=${sourceId}::uuid AND due_on=${values.dueOn}::date))`);
        const found = previous.rows[0];
        if (!found || found.request_hash !== hash)
          throw new FinanceError(
            409,
            "Solicitação já utilizada com outros dados. Atualize a tela.",
          );
        return entry(found);
      }

      if (operation === "receipt") {
        const values = receiptInput.parse(input);
        const booking =
          await tx.execute(sql`SELECT b.id,b.status,${bookingPrice} AS amount
          FROM bookings b WHERE b.id=${values.bookingId}::uuid AND b.barbershop_id=${shopId}::uuid FOR UPDATE OF b`);
        const found = booking.rows[0];
        if (!found) throw new FinanceError(404, "Atendimento não encontrado.");
        if (found.status !== "COMPLETED")
          throw new FinanceError(
            409,
            "Registre o recebimento após a conclusão do atendimento.",
          );
        const amount = Number(found.amount);
        if (
          found.amount === null ||
          !Number.isSafeInteger(amount) ||
          amount <= 0 ||
          amount > 2_000_000_000
        )
          throw new FinanceError(
            409,
            "O atendimento não possui valor financeiro válido para recebimento.",
          );
        const hash = fingerprint(values);
        const inserted = await tx.execute(sql`INSERT INTO finance_entries
          (id,barbershop_id,created_by,request_id,request_hash,kind,category,description,amount_in_cents,due_on,paid_on,status,booking_id)
          VALUES (${randomUUID()}::uuid,${shopId}::uuid,${userId}::uuid,${values.requestId}::uuid,${hash},'RECEIPT','BOOKING','Recebimento de atendimento',
            ${amount},${values.paidOn}::date,${values.paidOn}::date,'PAID',${values.bookingId}::uuid)
          ON CONFLICT DO NOTHING RETURNING ${columns}`);
        if (inserted.rows[0]) return entry(inserted.rows[0]);
        const previous = await tx.execute(
          sql`SELECT ${columns} FROM finance_entries WHERE barbershop_id=${shopId}::uuid AND booking_id=${values.bookingId}::uuid`,
        );
        if (
          !previous.rows[0] ||
          String(previous.rows[0].paid_on) !== values.paidOn
        )
          throw new FinanceError(
            409,
            "Solicitação ou recebimento já registrado. Atualize a tela.",
          );
        return entry(previous.rows[0]);
      }

      if (operation === "update") {
        const { entryId, ...body } = input as Record<string, unknown>;
        const values = updateEntry.parse(body);
        const current = await tx.execute(
          sql`SELECT ${columns} FROM finance_entries WHERE id=${entryId}::uuid AND barbershop_id=${shopId}::uuid FOR UPDATE`,
        );
        if (!current.rows[0])
          throw new FinanceError(404, "Lançamento não encontrado.");
        const original = entry(current.rows[0]);
        if (original.kind !== "EXPENSE")
          throw new FinanceError(
            409,
            "Recebimentos preservam seu registro original.",
          );
        const target = values.action === "PAY" ? "PAID" : "CANCELLED";
        if (
          original.status === target &&
          (target === "CANCELLED" || original.paidOn === values.paidOn)
        )
          return original;
        if (
          original.version !== values.expectedVersion ||
          original.status !== "PLANNED"
        )
          throw new FinanceError(
            409,
            "Este lançamento foi alterado. Atualize a tela.",
          );
        const updated =
          await tx.execute(sql`UPDATE finance_entries SET status=${target},paid_on=${values.action === "PAY" ? values.paidOn : null}::date,
          version=version+1,updated_at=now() WHERE id=${original.id}::uuid AND barbershop_id=${shopId}::uuid RETURNING ${columns}`);
        return entry(updated.rows[0]);
      }
      throw new FinanceError(400, "Operação financeira inválida.");
    });
  }
}
