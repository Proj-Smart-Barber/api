import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { DrizzleBarbershopsRepository } from "./drizzle-barbershops-repository";
import { DrizzleUsersRepository } from "./drizzle-users-repository";
import { CreateBarbershopUseCase } from "../../../domain/application/use-cases/barbershop/create-barbershop/create-barbershop";

type Database = ReturnType<typeof drizzle>;
const fixture = vi.hoisted(() => ({ db: null as unknown as Database }));
vi.mock("../index", () => ({
  get db() {
    return fixture.db;
  },
}));

// Never use DATABASE_URL: this suite requires an explicit disposable local DB.
const testUrl = process.env.OWNER_PROMOTION_TEST_URL;

describe.skipIf(!testUrl)(
  "Owner promotion preserves concurrent account changes",
  () => {
    let admin: Pool;
    let scoped: Pool;
    let schemaName: string;
    let repository: DrizzleBarbershopsRepository;
    let ownerId: string;

    beforeAll(async () => {
      if (!testUrl) throw new Error("OWNER_PROMOTION_TEST_URL is required.");
      const target = new URL(testUrl);
      if (
        !["postgres:", "postgresql:"].includes(target.protocol) ||
        !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
        !/^\/sb_owner_promotion_test_[a-z0-9_]+$/.test(target.pathname)
      ) {
        throw new Error(
          "Owner promotion tests require an explicitly named disposable local database.",
        );
      }
      admin = new Pool({ connectionString: testUrl });
      const identity = await admin.query<{ database: string }>(
        "SELECT current_database() AS database",
      );
      expect(identity.rows[0].database).toBe(
        decodeURIComponent(target.pathname.slice(1)),
      );
    });

    beforeEach(async () => {
      schemaName = `owner_promotion_${randomUUID().replaceAll("-", "")}`;
      await admin.query(`CREATE SCHEMA "${schemaName}"`);
      scoped = new Pool({
        connectionString: testUrl,
        options: `-c search_path=${schemaName}`,
      });
      fixture.db = drizzle({ client: scoped });
      await scoped.query(`
      CREATE TYPE account_type AS ENUM ('CLIENT', 'BARBER', 'OWNER', 'PLATFORM_ADMIN');
      CREATE TYPE role AS ENUM ('OWNER', 'BARBERMAN');
      CREATE TABLE users (
        id uuid PRIMARY KEY, name text NOT NULL, avatar_url text,
        email text NOT NULL UNIQUE, password text NOT NULL, cpf text NOT NULL UNIQUE,
        phone_number text, email_verified_at timestamp, account_type account_type NOT NULL,
        credential_version integer NOT NULL DEFAULT 1, onboarding_intent text,
        created_at timestamp DEFAULT now()
      );
      CREATE TABLE barbershops (
        id uuid PRIMARY KEY, name text NOT NULL, avatar_url text, owner_id uuid NOT NULL REFERENCES users(id),
        slug text NOT NULL UNIQUE, cnpj text NOT NULL UNIQUE, location text NOT NULL,
        timezone text NOT NULL, status text NOT NULL, created_at timestamp DEFAULT now()
      );
      CREATE TABLE membership (
        id uuid PRIMARY KEY, role role NOT NULL, barbershop_id uuid NOT NULL REFERENCES barbershops(id),
        user_id uuid NOT NULL REFERENCES users(id), state text NOT NULL DEFAULT 'ACTIVE',
        version integer NOT NULL DEFAULT 1, ended_at timestamptz, created_at timestamp DEFAULT now(),
        UNIQUE (barbershop_id, user_id)
      );
    `);
      ownerId = randomUUID();
      await scoped.query(
        `INSERT INTO users
      (id, name, email, password, cpf, account_type, credential_version, onboarding_intent)
      VALUES ($1, 'Original profile', 'synthetic@example.com', 'original-hash', '11144477735', 'CLIENT', 1, 'OWNER')`,
        [ownerId],
      );
      repository = new DrizzleBarbershopsRepository();
    });

    afterEach(async () => {
      await scoped?.end();
      if (schemaName && /^owner_promotion_[a-f0-9]{32}$/.test(schemaName)) {
        await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
      }
    });

    afterAll(async () => {
      await admin?.end();
    });

    function command(suffix = "one") {
      return {
        name: `Synthetic shop ${suffix}`,
        ownerId,
        cnpj: suffix === "one" ? "12345678000190" : "98765432000199",
        location: "Synthetic address",
      };
    }

    async function counts() {
      const result = await scoped.query(`SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM barbershops) AS shops,
      (SELECT count(*)::int FROM membership) AS memberships`);
      return result.rows[0];
    }

    it("preserves a password reset and profile edits committed after the use-case read", async () => {
      const users = new DrizzleUsersRepository();
      const read = users.findById.bind(users);
      vi.spyOn(users, "findById").mockImplementationOnce(async (id) => {
        const staleSnapshot = await read(id);
        // A separate connection commits while the use-case holds an older user snapshot.
        const concurrent = await scoped.connect();
        try {
          await concurrent.query(
            `UPDATE users SET password='new-hash', credential_version=2,
          name='Latest profile', email='latest@example.com', avatar_url='latest-avatar',
          phone_number='11999990000', email_verified_at='2026-10-14T12:00:00' WHERE id=$1`,
            [id],
          );
        } finally {
          concurrent.release();
        }
        return staleSnapshot;
      });
      const result = await new CreateBarbershopUseCase(
        repository,
        users,
      ).execute(command());
      expect(result.isRight()).toBe(true);
      const account = (
        await scoped.query("SELECT * FROM users WHERE id=$1", [ownerId])
      ).rows[0];
      expect(account).toMatchObject({
        id: ownerId,
        name: "Latest profile",
        email: "latest@example.com",
        password: "new-hash",
        credential_version: 2,
        avatar_url: "latest-avatar",
        phone_number: "11999990000",
        account_type: "OWNER",
        onboarding_intent: null,
      });
      expect(account.email_verified_at).not.toBeNull();
      expect(await counts()).toEqual({ users: 1, shops: 1, memberships: 1 });
    });

    it("preserves an admin promotion committed after the use-case read", async () => {
      const users = new DrizzleUsersRepository();
      const read = users.findById.bind(users);
      vi.spyOn(users, "findById").mockImplementationOnce(async (id) => {
        const staleSnapshot = await read(id);
        await scoped.query(
          "UPDATE users SET account_type='PLATFORM_ADMIN', credential_version=3 WHERE id=$1",
          [id],
        );
        return staleSnapshot;
      });
      expect(
        (
          await new CreateBarbershopUseCase(repository, users).execute(
            command(),
          )
        ).isRight(),
      ).toBe(true);
      const account = (
        await scoped.query(
          "SELECT account_type, credential_version FROM users WHERE id=$1",
          [ownerId],
        )
      ).rows[0];
      expect(account).toEqual({
        account_type: "PLATFORM_ADMIN",
        credential_version: 3,
      });
    });

    it("rolls back the real adapter when promotion fails, then permits retry", async () => {
      await scoped.query(`CREATE FUNCTION fail_promotion() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'SYNTHETIC_PROMOTION_FAILURE'; END $$;
      CREATE TRIGGER fail_promotion BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fail_promotion();`);
      const useCase = new CreateBarbershopUseCase(
        repository,
        new DrizzleUsersRepository(),
      );
      await expect(useCase.execute(command())).rejects.toMatchObject({
        cause: { message: "SYNTHETIC_PROMOTION_FAILURE" },
      });
      expect(await counts()).toEqual({ users: 1, shops: 0, memberships: 0 });
      expect(
        (
          await scoped.query("SELECT account_type FROM users WHERE id=$1", [
            ownerId,
          ])
        ).rows[0].account_type,
      ).toBe("CLIENT");
      await scoped.query("DROP TRIGGER fail_promotion ON users");
      expect((await useCase.execute(command())).isRight()).toBe(true);
      expect(await counts()).toEqual({ users: 1, shops: 1, memberships: 1 });
    });

    it("rolls back the real adapter when owner membership fails", async () => {
      await scoped.query(`CREATE FUNCTION fail_membership() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'SYNTHETIC_MEMBERSHIP_FAILURE'; END $$;
      CREATE TRIGGER fail_membership BEFORE INSERT ON membership FOR EACH ROW EXECUTE FUNCTION fail_membership();`);
      await expect(
        new CreateBarbershopUseCase(
          repository,
          new DrizzleUsersRepository(),
        ).execute(command()),
      ).rejects.toMatchObject({
        cause: { message: "SYNTHETIC_MEMBERSHIP_FAILURE" },
      });
      expect(await counts()).toEqual({ users: 1, shops: 0, memberships: 0 });
      expect(
        (
          await scoped.query("SELECT account_type FROM users WHERE id=$1", [
            ownerId,
          ])
        ).rows[0].account_type,
      ).toBe("CLIENT");
    });

    it("keeps the same account when an existing owner creates another unit", async () => {
      const useCase = new CreateBarbershopUseCase(
        repository,
        new DrizzleUsersRepository(),
      );
      expect((await useCase.execute(command())).isRight()).toBe(true);
      expect((await useCase.execute(command("two"))).isRight()).toBe(true);
      expect(await counts()).toEqual({ users: 1, shops: 2, memberships: 2 });
    });
  },
);
