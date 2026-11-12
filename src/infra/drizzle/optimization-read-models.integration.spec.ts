import {sql} from 'drizzle-orm';
import {runSchemaMigrations,isSchemaReady} from './migrator';
import { instrumentPool } from "./index";
import {
  runWithRequestMetrics,
  getRequestMetrics,
} from "../observability/request-metrics";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { createPhase1TestDatabase } from "../../../test/helpers/isolated-phase1-db";
import { DrizzleBookingsRepository } from "./repositories/drizzle-bookings-repository";
import { FinanceRepository } from "../http/controllers/finance/finance-repository";
import { projectFinanceRange } from "../../domain/application/services/finance/finance";
import { financeMigration } from "./finance-migration";

const owner = randomUUID(),
  barber = randomUUID(),
  customer = randomUUID(),
  shop = randomUUID();
let fixture: Awaited<ReturnType<typeof createPhase1TestDatabase>>;
let repository: DrizzleBookingsRepository;
let count = 0;
const date = "2026-11-20";
describe("optimization SQL read models on an owned disposable database", () => {
  beforeAll(async () => {
    fixture = await createPhase1TestDatabase(
      process.env.PHASE1_TEST_DATABASE_URL!,
    );
    const pool = fixture.pool!;
    await pool.query(financeMigration);
    for (const [id, name] of [
      [owner, "Owner"],
      [barber, "Professional"],
      [customer, "Customer"],
    ]) {
      await pool.query(
        `INSERT INTO users(id,name,email,password,cpf) VALUES($1,$2,$3,'synthetic', $4)`,
        [id, name, id + "@example.invalid", id],
      );
    }
    await pool.query(
      `INSERT INTO barbershops(id,name,owner_id,slug,cnpj,location,timezone) VALUES($1,'Synthetic shop',$2,$3,$4,'Synthetic location','America/Los_Angeles')`,
      [shop, owner, shop, shop],
    );
    await pool.query(
      `INSERT INTO membership(barbershop_id,user_id,role,state) VALUES($1,$2,'OWNER','ACTIVE')`,
      [shop, owner],
    );
    await pool.query(
      `INSERT INTO bookings(barbershop_id,barberman_id,customer_id,date,start_time,end_time,starts_at,ends_at,timezone,status,total_price_in_cents)
      SELECT $1,$2,$3,'2026-11-20','09:00','09:30','2026-11-20T17:00:00Z'::timestamptz+(n * INTERVAL '1 second'),
      '2026-11-20T17:30:00Z'::timestamptz+(n * INTERVAL '1 second'),'America/Los_Angeles','CONFIRMED',1000 FROM generate_series(1,200) n`,
      [shop, barber, customer],
    );
    await pool.query(
      `INSERT INTO booking_service_items(booking_id,title,price_in_cents,duration_in_minutes)
      SELECT id,'Historical title',1000,30 FROM bookings WHERE barbershop_id=$1`,
      [shop],
    );
    const database = drizzle({
      client: pool,
      logger: {
        logQuery() {
          count++;
        },
      },
    });
    repository = new DrizzleBookingsRepository(database);
  }, 40000);
  afterAll(async () => {
    await fixture?.close();
  });
  it("keeps query count constant while page size grows and never multiplies bookings by items", async () => {
    const counts = [];
    for (const limit of [1, 20, 100]) {
      count = 0;
      const result = await repository.findUnitBookings({
        barbershopId: shop,
        date,
        limit,
      });
      counts.push(count);
      expect(result.items).toHaveLength(limit);
      expect(result.total).toBe(200);
      expect(result.summary.totalAmountInCents).toBe(200000);
    }
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBeLessThanOrEqual(6);
  });
  it("counts each SQL command exactly once in request metrics", async () => {
    instrumentPool(fixture.pool!);
    await runWithRequestMetrics(async () => {
      await fixture.pool!.query("SELECT 1");
      expect(getRequestMetrics()?.sqlCount).toBe(1);
    });
  });
  it("bootstraps without reading bookings", async () => {
    count = 0;
    const result = await repository.findUnitBookings({
      barbershopId: shop,
      bootstrapOnly: true,
    });
    expect(result.items).toEqual([]);
    expect(count).toBe(0);
  });
  it("includes late local-day and legacy bookings and excludes the next local day", async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    await fixture.pool!.query(
      `INSERT INTO bookings(id,barbershop_id,barberman_id,customer_id,date,start_time,end_time,starts_at,status,total_price_in_cents)
      VALUES($4,$1,$2,$3,'2026-11-20','20:00','20:30','2026-11-21T04:00:00Z','CONFIRMED',1000),
      ($5,$1,$2,$3,'2026-11-20','21:00','21:30',NULL,'CONFIRMED',1000),
      ($6,$1,$2,$3,'2026-11-21','00:00','00:30','2026-11-21T08:00:00Z','CONFIRMED',1000)`,
      [shop, barber, customer, ...ids],
    );
    const first = await repository.findUnitBookings({
      barbershopId: shop,
      date,
      limit: 100,
      page: 1,
    });
    const last = await repository.findUnitBookings({
      barbershopId: shop,
      date,
      limit: 100,
      page: 3,
    });
    const visible = last.items.map((item) => item.bookingId.toString());
    expect(first.total).toBe(202);
    expect(visible).toEqual(expect.arrayContaining(ids.slice(0, 2)));
    expect(visible).not.toContain(ids[2]);
  });
  it("uses bigint sums without overflowing a 32-bit integer", async () => {
    await fixture.pool!.query(
      `UPDATE bookings SET total_price_in_cents=2000000000 WHERE barbershop_id=$1`,
      [shop],
    );
    const result = await repository.findUnitBookings({
      barbershopId: shop,
      date,
      limit: 1,
    });
    expect(result.summary.totalAmountInCents).toBe(404000000000);
  });
  it("financial aggregate matches the reference and section pagination does not change totals", async () => {
    const finance = new FinanceRepository(fixture.db);
    const all = (await finance.execute(shop, owner, "period", {
      month: "2026-11",
    })) as any;
    const summary = (await finance.execute(shop, owner, "period", {
      month: "2026-11",
      view: "summary",
    })) as any;
    expect(summary.summary).toEqual(
      projectFinanceRange(
        "2026-11-01",
        "2026-11-30",
        all.entries,
        all.bookings,
      ),
    );
    expect(summary.bookings).toHaveLength(0);
    expect(summary.entries).toHaveLength(0);
    const page1 = (await finance.execute(shop, owner, "period", {
      month: "2026-11",
      view: "bookings",
      bookingsLimit: 20,
    })) as any;
    const page2 = (await finance.execute(shop, owner, "period", {
      month: "2026-11",
      view: "bookings",
      bookingsLimit: 20,
      bookingsPage: 2,
    })) as any;
    expect(page1.bookings).toHaveLength(20);
    expect(page2.bookings).toHaveLength(20);
    expect(page2.summary).toEqual(page1.summary);
    const seen = new Set(page1.bookings.map((booking: any) => booking.id));
    expect(page2.bookings.some((booking: any) => seen.has(booking.id))).toBe(
      false,
    );
  });
 it('rolls back DDL on failure and serializes concurrent release runners',async () => {
  const failing={transaction:(work:(tx:any) => Promise<unknown>) => fixture.db.transaction(async tx => {
   await tx.execute(sql`CREATE TABLE migration_rollback_probe(id integer)`);
   const broken=new Proxy(tx,{get(target,key) {
    if(key === 'execute') return async () => {throw new Error('Synthetic migration failure');};
    const value=Reflect.get(target,key);return typeof value === 'function' ? value.bind(target) : value;
   }});
   return work(broken);
  })};
  expect((await runSchemaMigrations(failing,{force:true})).success).toBe(false);
  const probe=await fixture.pool!.query("SELECT to_regclass('migration_rollback_probe') AS name");
  expect(probe.rows[0].name).toBeNull();
  const [first,second]=await Promise.all([runSchemaMigrations(fixture.db),runSchemaMigrations(fixture.db)]);
  expect(first.success).toBe(true);expect(second.success).toBe(true);
  expect(await isSchemaReady(fixture.db)).toBe(true);
  const ledger=await fixture.pool!.query('SELECT COUNT(*) FROM schema_release_history');
  expect(Number(ledger.rows[0].count)).toBe(1);
 });

});
