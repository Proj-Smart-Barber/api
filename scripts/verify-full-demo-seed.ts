import "dotenv/config";
import { compare } from "bcryptjs";
import {
  DEFAULT_DEMO_PASSWORD,
  inspectDatabaseTarget,
} from "../src/infra/drizzle/demo-seed/canonical/security";

const expectedRegistryCounts: Record<string, number> = {
  users: 1_478,
  barbershops: 100,
  barbershop_locations: 95,
  membership: 474,
  barbershop_schedules: 2_845,
  services: 962,
  schedule_exceptions: 186,
  service_items: 22_520,
  shopping_carts: 22_520,
  bookings: 22_520,
  booking_service_items: 22_520,
  booking_events: 22_520,
};

async function main() {
  process.env.NODE_ENV = "test";
  const { env } = await import("../src/infra/env");
  const target = inspectDatabaseTarget(env.DATABASE_URL);
  if (
    !target.isLocal ||
    !target.database.toLowerCase().includes("test") ||
    target.port < 55433
  ) {
    throw new Error(
      "Verification refused: use a disposable local database with a test name on port 55433 or higher.",
    );
  }
  const { pool } = await import("../src/infra/drizzle");
  const { default: app } = await import("../src/app");
  closePool = () => pool.end();

  const countsResult = await pool.query<{
    table_name: string;
    count: string;
  }>(
    `SELECT table_name, COUNT(*)::text AS count
     FROM demo_seed_registry
     WHERE namespace = 'demo-smart-barber-v1'
     GROUP BY table_name`,
  );
  const actualCounts = Object.fromEntries(
    countsResult.rows.map((row) => [row.table_name, Number(row.count)]),
  );
  for (const [table, expected] of Object.entries(expectedRegistryCounts)) {
    if (actualCounts[table] !== expected) {
      throw new Error(
        `Registry count mismatch for ${table}: expected ${expected}, got ${actualCounts[table] ?? 0}.`,
      );
    }
  }

  const qaAccounts = [
    { email: "qa.owner@demo.smartbarber.test", accountType: "OWNER" },
    { email: "qa.barber@demo.smartbarber.test", accountType: "BARBER" },
    { email: "qa.client@demo.smartbarber.test", accountType: "CLIENT" },
  ] as const;
  for (const expected of qaAccounts) {
    const result = await pool.query<{
      id: string;
      account_type: string;
      password: string;
    }>("SELECT id, account_type, password FROM users WHERE email = $1", [
      expected.email,
    ]);
    const user = result.rows[0];
    if (
      !user ||
      user.account_type !== expected.accountType ||
      !(await compare(DEFAULT_DEMO_PASSWORD, user.password))
    ) {
      throw new Error(
        `QA account verification failed for role ${expected.accountType}.`,
      );
    }
  }

  const relationChecks = await pool.query<{
    mismatched_booking_services: string;
    bookings_without_snapshot: string;
    bookings_without_event: string;
    generated_districts: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM bookings b
       JOIN shopping_carts c ON c.id = b.shopping_cart_id
       JOIN service_items si ON si.id = c.service_item_id
       JOIN services s ON s.id = si.service_id
       WHERE s.barbershop_id <> b.barbershop_id)::text AS mismatched_booking_services,
      (SELECT COUNT(*) FROM bookings b
       LEFT JOIN booking_service_items i ON i.booking_id = b.id
       WHERE i.id IS NULL)::text AS bookings_without_snapshot,
      (SELECT COUNT(*) FROM bookings b
       LEFT JOIN booking_events e ON e.booking_id = b.id
       WHERE e.id IS NULL)::text AS bookings_without_event,
      (SELECT COUNT(DISTINCT split_part(b.location, ',', 1))
       FROM demo_seed_registry r JOIN barbershops b ON b.id = r.record_id
       WHERE r.namespace = 'demo-smart-barber-v1'
         AND r.table_name = 'barbershops'
         AND r.logical_key LIKE 'scale-%:barbershop')::text AS generated_districts
  `);
  const relations = relationChecks.rows[0];
  if (
    !relations ||
    Number(relations.mismatched_booking_services) !== 0 ||
    Number(relations.bookings_without_snapshot) !== 0 ||
    Number(relations.bookings_without_event) !== 0 ||
    Number(relations.generated_districts) !== 88
  ) {
    throw new Error(
      "Seed relationship, booking snapshot, event, or district coverage check failed.",
    );
  }

  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Could not get the local API test port.");
    }
    const apiBase = `http://127.0.0.1:${address.port}/api/users/sessions`;
    const qaUserIds: string[] = [];
    for (const expected of qaAccounts) {
      const response = await fetch(`${apiBase}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: expected.email,
          password: DEFAULT_DEMO_PASSWORD,
        }),
      });
      if (response.status !== 201) {
        throw new Error(
          `Local API login failed for role ${expected.accountType}.`,
        );
      }
      const tokens = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
      };
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error(
          `Local API returned incomplete session for ${expected.accountType}.`,
        );
      }
      const signOut = await fetch(`${apiBase}/sign-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: tokens.refresh_token }),
      });
      if (signOut.status !== 204) {
        throw new Error(
          `Local API sign-out failed for role ${expected.accountType}.`,
        );
      }
      const user = await pool.query<{ id: string }>(
        "SELECT id FROM users WHERE email = $1",
        [expected.email],
      );
      if (!user.rows[0]) throw new Error("QA account disappeared after login.");
      qaUserIds.push(user.rows[0].id);
    }
    const activeSessions = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM refresh_tokens
       WHERE user_id = ANY($1::uuid[]) AND revoked_at IS NULL`,
      [qaUserIds],
    );
    if (Number(activeSessions.rows[0]?.count ?? -1) !== 0) {
      throw new Error(
        "QA login left active refresh sessions in the test database.",
      );
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  console.log(
    JSON.stringify(
      {
        database: target.database,
        port: target.port,
        registryCounts: actualCounts,
        qaAccounts: qaAccounts.map(({ accountType }) => ({
          accountType,
          passwordHashVerified: true,
          apiLoginVerified: true,
          sessionRevoked: true,
        })),
        relationChecks: {
          ...Object.fromEntries(
            Object.entries(relations).map(([key, value]) => [
              key,
              Number(value),
            ]),
          ),
        },
      },
      null,
      2,
    ),
  );
}

let closePool: (() => Promise<void>) | undefined;

void main()
  .catch((error) => {
    console.error((error as Error).message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool?.();
  });
