import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import express from "express";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  type FinanceEntry,
  type FinanceBooking,
  projectFinance,
} from "../../../domain/application/services/finance/finance";
import { financeMigration } from "../../drizzle/finance-migration";
import { FinanceRepository } from "../controllers/finance/finance-repository";
import { createFinanceRouter } from "./finance.routes";

vi.mock("../middlewares/ensure-user-is-authenticated", () => ({
  ensureUserIsAuthenticated: (
    request: any,
    response: any,
    next: () => void,
  ) => {
    if (!request.headers["x-test-user"]) return response.sendStatus(401);
    request.user = { sub: request.headers["x-test-user"] };
    next();
  },
}));

const connectionString =
  process.env.FINANCE_TEST_DATABASE_URL ??
  "postgresql://postgres@127.0.0.1:55479/smartbarber_finance_test";
const scope = "finance_test_" + randomUUID().replaceAll("-", "");
const pool = new Pool({ connectionString, options: "-c search_path=" + scope });
const owner = randomUUID(),
  barber = randomUUID(),
  inactive = randomUUID(),
  otherOwner = randomUUID();
const shop = randomUUID(),
  otherShop = randomUUID();
const completed = randomUUID(),
  scheduled = randomUUID(),
  missing = randomUUID();
let server: ReturnType<express.Express["listen"]>;
let base: string;
type TestResponse = FinanceEntry & {
  summary: ReturnType<typeof projectFinance>;
  bookings: FinanceBooking[];
  error: string;
};
const request = async (
  method: string,
  suffix = "",
  body?: unknown,
  user = owner,
  shopId = shop,
) => {
  const result = await fetch(
    base + "/api/barbershops/" + shopId + "/finance" + suffix,
    {
      method,
      headers: { "content-type": "application/json", "x-test-user": user },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  return { status: result.status, body: (await result.json()) as TestResponse };
};
const expense = () => ({
  requestId: randomUUID(),
  description: "Aluguel",
  category: "FIXED",
  amountInCents: 1000,
  dueOn: "2026-11-15",
  payee: "Locador",
});

describe.skipIf(!process.env.FINANCE_TEST_DATABASE_URL)(
  "Financeiro HTTP com PostgreSQL isolado",
  () => {
    beforeAll(async () => {
      const target = new URL(connectionString);
      if (
        !["127.0.0.1", "localhost"].includes(target.hostname) ||
        !target.pathname.endsWith("_test")
      )
        throw new Error("Banco de teste não isolado.");
      const admin = new Pool({ connectionString });
      await admin.query('CREATE SCHEMA "' + scope + '"');
      await admin.end();
      await pool.query(`
    CREATE TABLE users(id uuid PRIMARY KEY,name text);
    CREATE TABLE barbershops(id uuid PRIMARY KEY,timezone text);
    CREATE TABLE membership(user_id uuid REFERENCES users(id),barbershop_id uuid REFERENCES barbershops(id),role text,state text);
    CREATE TABLE bookings(id uuid PRIMARY KEY,barbershop_id uuid REFERENCES barbershops(id),barberman_id uuid REFERENCES users(id),starts_at timestamptz,date timestamp,total_price_in_cents integer,status text);
    CREATE TABLE booking_service_items(id uuid PRIMARY KEY,booking_id uuid REFERENCES bookings(id),title text,price_in_cents integer);
  `);
      await pool.query(financeMigration);
      await pool.query(financeMigration);
      for (const user of [owner, barber, inactive, otherOwner])
        await pool.query("INSERT INTO users VALUES ($1,'Fixture')", [user]);
      for (const id of [shop, otherShop])
        await pool.query(
          "INSERT INTO barbershops VALUES ($1,'America/Sao_Paulo')",
          [id],
        );
      for (const [user, id, role, state] of [
        [owner, shop, "OWNER", "ACTIVE"],
        [barber, shop, "BARBERMAN", "ACTIVE"],
        [inactive, shop, "OWNER", "INACTIVE"],
        [otherOwner, otherShop, "OWNER", "ACTIVE"],
      ]) {
        await pool.query("INSERT INTO membership VALUES ($1,$2,$3,$4)", [
          user,
          id,
          role,
          state,
        ]);
      }
      for (const [id, amount, status] of [
        [completed, 8000, "COMPLETED"],
        [scheduled, 3000, "CONFIRMED"],
        [missing, null, "COMPLETED"],
      ]) {
        await pool.query(
          "INSERT INTO bookings VALUES ($1,$2,$3,'2026-11-15T16:00:00Z','2026-11-15',$4,$5)",
          [id, shop, barber, amount, status],
        );
      }
      const app = express().use(express.json());
      app.use(
        "/api/barbershops/:shopId/finance",
        createFinanceRouter(new FinanceRepository(drizzle({ client: pool }))),
      );
      server = app.listen(0, "127.0.0.1");
      await new Promise<void>((resolve) => server.once("listening", resolve));
      base = "http://127.0.0.1:" + (server.address() as any).port;
    });
    beforeEach(async () => {
      await pool.query("TRUNCATE finance_entries");
    });
    afterAll(async () => {
      if (server)
        await new Promise<void>((resolve) => server.close(() => resolve()));
      await pool.end();
      const admin = new Pool({ connectionString });
      await admin.query('DROP SCHEMA IF EXISTS "' + scope + '" CASCADE');
      await admin.end();
    });

    it("recusa barbeiro, proprietário inativo e acesso a outra unidade", async () => {
      for (const actor of [barber, inactive, otherOwner])
        expect(
          (await request("GET", "?month=2026-11", undefined, actor)).status,
        ).toBe(403);
      expect(
        (await request("GET", "?month=2026-11", undefined, owner, otherShop))
          .status,
      ).toBe(403);
    });
    it("calcula concluídos e agendados sem presumir recebimento nem preço ausente", async () => {
      const result = await request("GET", "?month=2026-11");
      expect(result.status).toBe(200);
      expect(result.body.summary).toMatchObject({
        completedInCents: 8000,
        forecastInCents: 3000,
        receivedInCents: 0,
        balanceInCents: 0,
        unknownPrices: 1,
      });
    });
    it("filtra datas específicas e intervalos entre meses sem alterar os valores apurados", async () => {
    const outside = await request("GET", "?from=2026-11-01&to=2026-11-14");
    expect(outside.status).toBe(200);
    expect(outside.body.summary.completedInCents).toBe(0);
    const included = await request("GET", "?from=2026-10-30&to=2026-11-15");
    expect(included.status).toBe(200);
    expect(included.body.summary.completedInCents).toBe(8000);
    expect(included.body.summary.daily.find(day => day.date === "2026-11-15")?.completedInCents).toBe(8000);
    expect((await request("GET", "?from=2026-11-15&to=2026-11-01")).status).toBe(400);
    expect((await request("GET", "?month=2026-11&from=2026-11-01&to=2026-11-15")).status).toBe(400);
  });

  it("cria uma despesa uma única vez e rejeita reutilização com outro valor", async () => {
      const values = expense();
      const first = await request("POST", "/entries", values);
      const repeated = await request("POST", "/entries", values);
      expect(first.status).toBe(200);
      expect(repeated.body.id).toBe(first.body.id);
      expect(
        (await request("POST", "/entries", { ...values, amountInCents: 2000 }))
          .status,
      ).toBe(409);
      expect(
        (await pool.query("SELECT * FROM finance_entries")).rows,
      ).toHaveLength(1);
    });
    it("paga com controle de versão e mantém caixa pela data do pagamento", async () => {
      const created = await request("POST", "/entries", expense());
      const paid = await request("PATCH", "/entries/" + created.body.id, {
        action: "PAY",
        expectedVersion: 1,
        paidOn: "2026-12-01",
      });
      expect(paid.status).toBe(200);
      expect(paid.body.version).toBe(2);
      const november = await request("GET", "?month=2026-11");
      const december = await request("GET", "?month=2026-12");
      expect(november.body.summary.paidInCents).toBe(0);
      expect(december.body.summary.paidInCents).toBe(1000);
    });
    it("serializa duas alterações concorrentes sem perder o estado", async () => {
      const created = await request("POST", "/entries", expense());
      const results = await Promise.all([
        request("PATCH", "/entries/" + created.body.id, {
          action: "PAY",
          expectedVersion: 1,
          paidOn: "2026-11-15",
        }),
        request("PATCH", "/entries/" + created.body.id, {
          action: "CANCEL",
          expectedVersion: 1,
        }),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    });
    it("impede alteração de lançamento de outra unidade", async () => {
      const created = await request(
        "POST",
        "/entries",
        expense(),
        otherOwner,
        otherShop,
      );
      expect(
        (
          await request("PATCH", "/entries/" + created.body.id, {
            action: "CANCEL",
            expectedVersion: 1,
          })
        ).status,
      ).toBe(404);
    });
    it("registra recebimento integral uma única vez", async () => {
      const values = {
        requestId: randomUUID(),
        bookingId: completed,
        paidOn: "2026-11-15",
      };
      const first = await request("POST", "/receipts", values);
      const retry = await request("POST", "/receipts", {
        ...values,
        requestId: randomUUID(),
      });
      expect(first.status).toBe(200);
      expect(retry.body.id).toBe(first.body.id);
      const result = await request("GET", "?month=2026-11");
      expect(result.body.summary.receivedInCents).toBe(8000);
      expect(
        result.body.bookings.find((b) => b.id === completed)?.receiptId,
      ).toBe(first.body.id);
    });
    it("recusa recebimento de previsão e de reserva sem preço", async () => {
      for (const bookingId of [scheduled, missing]) {
        expect(
          (
            await request("POST", "/receipts", {
              requestId: randomUUID(),
              bookingId,
              paidOn: "2026-11-15",
            })
          ).status,
        ).toBe(409);
      }
    });
    it("copia despesa fixa para fevereiro e impede cópia duplicada", async () => {
      const created = await request("POST", "/entries", {
        ...expense(),
        dueOn: "2027-01-31",
      });
      const first = await request(
        "POST",
        "/entries/" + created.body.id + "/copy",
        { requestId: randomUUID() },
      );
      const repeated = await request(
        "POST",
        "/entries/" + created.body.id + "/copy",
        { requestId: randomUUID() },
      );
      expect(first.status).toBe(200);
      expect(first.body.dueOn).toBe("2027-02-28");
      expect(repeated.body.id).toBe(first.body.id);
    });
    it("valida valor monetário e data civil", async () => {
      expect(
        (await request("POST", "/entries", { ...expense(), amountInCents: 0 }))
          .status,
      ).toBe(400);
      expect(
        (
          await request("POST", "/entries", {
            ...expense(),
            dueOn: "2026-02-30",
          })
        ).status,
      ).toBe(400);
      expect((await request("GET", "?month=2026-13")).status).toBe(400);
    });
  },
);
