import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../../../drizzle";
import {
  FinanceError,
  createExpense,
  nextDueDate,
  projectFinanceRange,
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

  async execute(
    shopId: string,
    userId: string,
    operation: string,
    input: unknown,
  ) {
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

      if (operation === "period") {
        const bounds = resolveFinancePeriod(input, today);
        const month = bounds.month;
        const values =
          await tx.execute(sql`SELECT ${columns} FROM finance_entries WHERE barbershop_id=${shopId}::uuid
          AND (due_on BETWEEN ${bounds.from}::date AND ${bounds.to}::date
            OR paid_on BETWEEN ${bounds.from}::date AND ${bounds.to}::date)
          ORDER BY due_on,id`);
        const rows = await tx.execute(sql`SELECT b.id,b.status,
          COALESCE((b.starts_at AT TIME ZONE ${timezone})::date,b.date::date)::text AS date,
          ${bookingPrice} AS amount,
          COALESCE(u.name,'Profissional') AS professional,
          COALESCE((SELECT string_agg(title,', ' ORDER BY id) FROM booking_service_items WHERE booking_id=b.id),'Atendimento') AS services,
          f.id AS receipt_id
          FROM bookings b LEFT JOIN users u ON u.id=b.barberman_id
          LEFT JOIN finance_entries f ON f.booking_id=b.id AND f.kind='RECEIPT'
          WHERE b.barbershop_id=${shopId}::uuid
          AND COALESCE((b.starts_at AT TIME ZONE ${timezone})::date,b.date::date) BETWEEN ${bounds.from}::date AND ${bounds.to}::date
          ORDER BY b.starts_at,b.id`);
        const bookings: FinanceBooking[] = rows.rows.map((row) => ({
          id: String(row.id),
          date: String(row.date),
          status: String(row.status),
          amountInCents: row.amount === null ? null : Number(row.amount),
          professional: String(row.professional),
          services: String(row.services),
          receiptId: row.receipt_id ? String(row.receipt_id) : null,
        }));
        const entries = values.rows.map(entry);
        return {
          month,
          from: bounds.from,
          to: bounds.to,
          today,
          timezone,
          serverTime: now.toISOString(),
          entries,
          bookings,
          summary: projectFinanceRange(
            bounds.from,
            bounds.to,
            entries,
            bookings,
          ),
        };
      }

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
