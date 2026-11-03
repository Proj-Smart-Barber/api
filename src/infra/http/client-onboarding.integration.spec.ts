import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClientAuthTestDatabase } from "../../../test/helpers/isolated-client-auth-db";

const fixture = vi.hoisted(() => ({
  db: null as unknown,
  messages: [] as Array<{
    to: string;
    verificationUrl: string;
    verificationCode?: string;
  }>,
  failNextSend: false,
}));
vi.mock("../drizzle/index", () => ({
  get db() {
    return fixture.db;
  },
}));
vi.mock("../email/resend-email-service", () => ({
  ResendEmailService: class {
    async sendVerificationEmail(message: {
      to: string;
      verificationUrl: string;
      verificationCode?: string;
    }) {
      if (fixture.failNextSend) {
        fixture.failNextSend = false;
        throw new Error("Synthetic mail failure");
      }
      fixture.messages.push(message);
    }
    async sendPasswordRecoveryEmail() {
      throw new Error("External mail disabled in onboarding test");
    }
    async sendInvitationEmail() {
      throw new Error("External mail disabled in onboarding test");
    }
  },
}));
import app from "../../app";
import { env } from "../env";

const target = process.env.SMARTBARBER_TEST_DATABASE_URL;
describe.skipIf(!target)(
  "Client onboarding over real HTTP and isolated PostgreSQL",
  () => {
    let isolated: Awaited<ReturnType<typeof createClientAuthTestDatabase>>;
    let server: Server;
    let base: string;
    const password = "senha123";
    const email = "synthetic.client@example.com";

    beforeEach(async () => {
      isolated = await createClientAuthTestDatabase(target ?? "");
      fixture.db = isolated.db;
      fixture.messages = [];
      fixture.failNextSend = false;
      env.FRONTEND_URL = "http://localhost:8081";
      env.EMAIL_VERIFICATION_URL = undefined;
      server = app.listen(0, "127.0.0.1");
      await new Promise<void>((resolve) => server.once("listening", resolve));
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing test HTTP address");
      base = `http://127.0.0.1:${address.port}`;
    });
    afterEach(async () => {
      if (server)
        await new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve())),
        );
      await isolated?.close();
    });
    function post(path: string, body: unknown) {
      return fetch(`${base}/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    function register(intent = "CLIENT") {
      return post("/users", {
        name: "Synthetic Client",
        email,
        password,
        cpf: "11144477735",
        onboardingIntent: intent,
      });
    }

    it("creates, sends, confirms and authenticates a new client without automatic login", async () => {
      // Signup is public; identity remains protected and verification is still required.
      expect((await fetch(`${base}/api/users/me`)).status).toBe(401);
      expect((await register()).status).toBe(201);
      expect(
        (await post("/users/sessions/auth", { email, password })).status,
      ).toBe(403);
      expect((await post("/users/verification-email", { email })).status).toBe(
        200,
      );
      expect(fixture.messages).toHaveLength(1);
      expect(fixture.messages[0].verificationUrl).toBe("");
      expect(fixture.messages[0].verificationCode).toMatch(/^\d{6}$/);
      const confirmed = await post("/users/verification-email/confirm", {
        email,
        code: fixture.messages[0].verificationCode,
      });
      expect(confirmed.status).toBe(200);
      expect(((await confirmed.json()) as { verified: boolean }).verified).toBe(
        true,
      );
      expect(
        (
          await isolated.pool.query(
            "SELECT count(*)::int AS count FROM refresh_tokens",
          )
        ).rows[0].count,
      ).toBe(0);
      const login = await post("/users/sessions/auth", { email, password });
      expect(login.status).toBe(201);
      const session = (await login.json()) as { access_token: string };
      const me = await fetch(`${base}/api/users/me`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      expect(me.status).toBe(200);
      expect(
        ((await me.json()) as { user: Record<string, unknown> }).user,
      ).toMatchObject({
        accountType: "CLIENT",
        onboardingIntent: "CLIENT",
      });
      expect(
        (await isolated.pool.query("SELECT count(*)::int AS count FROM users"))
          .rows[0].count,
      ).toBe(1);
    });

    it("preserves OWNER intent without granting an operational role during signup", async () => {
      expect((await register("OWNER")).status).toBe(201);
      const user = (
        await isolated.pool.query(
          "SELECT account_type, onboarding_intent FROM users",
        )
      ).rows[0];
      expect(user).toEqual({
        account_type: "CLIENT",
        onboarding_intent: "OWNER",
      });
      expect(
        (
          await isolated.pool.query(
            "SELECT count(*)::int AS count FROM membership",
          )
        ).rows[0].count,
      ).toBe(0);
    });

    it("rejects duplicates, invalid passwords and expired tokens", async () => {
      expect(
        (
          await post("/users", {
            name: "Synthetic",
            email,
            password: "short",
            cpf: "11144477735",
          })
        ).status,
      ).toBe(400);
      expect((await register()).status).toBe(201);
      expect((await register()).status).toBe(409);
      expect((await post("/users/verification-email", { email })).status).toBe(
        200,
      );
      const code = fixture.messages[0].verificationCode;
      await isolated.pool.query(
        "UPDATE email_verification_codes SET expires_at=now()-interval '1 minute'",
      );
      expect(
        (await post("/users/verification-email/confirm", { email, code }))
          .status,
      ).toBe(400);
      expect(
        (await post("/users/sessions/auth", { email, password })).status,
      ).toBe(403);
    });

    it("limits requests and does not send mail when limiter storage fails", async () => {
      expect((await register()).status).toBe(201);
      for (let i = 0; i < 3; i++)
        expect(
          (await post("/users/verification-email", { email })).status,
        ).toBe(200);
      const limited = await post("/users/verification-email", { email });
      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
      expect(fixture.messages).toHaveLength(1);
      await isolated.pool.query(
        "ALTER TABLE customer_lookup_rate_limits RENAME TO unavailable_limits",
      );
      const unavailable = await post("/users/verification-email", { email });
      expect(unavailable.status).toBe(503);
      expect(fixture.messages).toHaveLength(1);
    });

    it("returns uniform responses for unknown and already verified addresses", async () => {
      expect((await post("/users/verification-email", { email })).status).toBe(
        200,
      );
      expect(fixture.messages).toHaveLength(0);
      expect((await register()).status).toBe(201);
      await isolated.pool.query("UPDATE users SET email_verified_at=now()");
      expect((await post("/users/verification-email", { email })).status).toBe(
        200,
      );
      expect(fixture.messages).toHaveLength(0);
    });

    it("consumes a code once under concurrent HTTP confirmations", async () => {
      await register();
      await post("/users/verification-email", { email });
      const code = fixture.messages[0].verificationCode;
      const responses = await Promise.all([
        post("/users/verification-email/confirm", { email, code }),
        post("/users/verification-email/confirm", { email, code }),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([200, 400]);
      expect(
        (
          await isolated.pool.query(
            "SELECT count(*)::int count FROM email_verification_codes WHERE used_at IS NOT NULL",
          )
        ).rows[0].count,
      ).toBe(1);
      expect(
        (
          await isolated.pool.query(
            "SELECT count(*)::int count FROM refresh_tokens",
          )
        ).rows[0].count,
      ).toBe(0);
    });

    it("blocks the correct code after five incorrect attempts", async () => {
      await register();
      await post("/users/verification-email", { email });
      const code = fixture.messages[0].verificationCode;
      const wrong = code === "000000" ? "111111" : "000000";
      for (let i = 0; i < 5; i++)
        expect(
          (
            await post("/users/verification-email/confirm", {
              email,
              code: wrong,
            })
          ).status,
        ).toBe(400);
      expect(
        (await post("/users/verification-email/confirm", { email, code }))
          .status,
      ).toBe(400);
      expect(
        (
          await isolated.pool.query(
            "SELECT attempts FROM email_verification_codes",
          )
        ).rows[0].attempts,
      ).toBe(5);
      expect(
        (await isolated.pool.query("SELECT email_verified_at FROM users"))
          .rows[0].email_verified_at,
      ).toBeNull();
    });

    it("suppresses early resend and replaces a code after cooldown", async () => {
      await register();
      await post("/users/verification-email", { email });
      const first = fixture.messages[0].verificationCode;
      expect((await post("/users/verification-email", { email })).status).toBe(
        200,
      );
      expect(fixture.messages).toHaveLength(1);
      await isolated.pool.query(
        "UPDATE email_verification_codes SET created_at=created_at-interval '61 seconds'",
      );
      expect((await post("/users/verification-email", { email })).status).toBe(
        200,
      );
      expect(fixture.messages).toHaveLength(2);
      const second = fixture.messages[1].verificationCode;
      expect(second).not.toBe(first);
      expect(
        (
          await post("/users/verification-email/confirm", {
            email,
            code: first,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await post("/users/verification-email/confirm", {
            email,
            code: second,
          })
        ).status,
      ).toBe(200);
    });

    it("does not apply the same code to another account or disclose code storage errors", async () => {
      await register();
      await post("/users/verification-email", { email });
      const code = fixture.messages[0].verificationCode;
      expect(
        (
          await post("/users/verification-email/confirm", {
            email: "unknown@example.com",
            code,
          })
        ).status,
      ).toBe(400);
      await isolated.pool.query(
        "ALTER TABLE email_verification_codes RENAME TO unavailable_email_codes",
      );
      const failed = await post("/users/verification-email/confirm", {
        email,
        code,
      });
      expect(failed.status).toBe(500);
      const body = await failed.text();
      expect(body).not.toContain("SELECT");
      expect(body).not.toContain("email_verification_codes");
    });

    it("revokes the generated code if delivery fails", async () => {
      await register();
      fixture.failNextSend = true;
      expect((await post("/users/verification-email", { email })).status).toBe(
        500,
      );
      expect(fixture.messages).toHaveLength(0);
      expect(
        (
          await isolated.pool.query(
            "SELECT count(*)::int count FROM email_verification_codes WHERE used_at IS NULL",
          )
        ).rows[0].count,
      ).toBe(0);
    });

    it("limits sends to five per hour independently of the request limiter", async () => {
      await register();
      for (let i = 0; i < 6; i++) {
        await isolated.pool.query("DELETE FROM customer_lookup_rate_limits");
        await isolated.pool.query(
          "UPDATE email_verification_codes SET created_at=created_at-interval '61 seconds'",
        );
        expect(
          (await post("/users/verification-email", { email })).status,
        ).toBe(200);
      }
      expect(fixture.messages).toHaveLength(5);
      expect(
        (
          await isolated.pool.query(
            "SELECT count(*)::int count FROM email_verification_codes",
          )
        ).rows[0].count,
      ).toBe(5);
    });

    it("keeps old high-entropy links working but invalidates them when issuing a code", async () => {
      await register();
      const { hashToken } = await import("../../core/crypto/token.js");
      const id = (await isolated.pool.query("SELECT id FROM users")).rows[0].id;
      await isolated.pool.query(
        "INSERT INTO email_verifications(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",
        [id, hashToken("synthetic-legacy-token")],
      );
      expect(
        (
          await post("/users/verification-email/confirm", {
            token: "synthetic-legacy-token",
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await isolated.pool.query(
            "SELECT count(*)::int count FROM email_verification_codes",
          )
        ).rows[0].count,
      ).toBe(0);
    });

    it("rejects codes in GET query parameters", async () => {
      const response = await fetch(
        base +
          "/api/users/verification-email/confirm?email=" +
          encodeURIComponent(email) +
          "&code=123456",
      );
      expect(response.status).toBe(405);
      expect(response.headers.get("cache-control")).toBe("no-store");
    });

    it("invalidates an old link when the user requests a new numeric code", async () => {
      await register();
      const { hashToken } = await import("../../core/crypto/token.js");
      const id = (await isolated.pool.query("SELECT id FROM users")).rows[0].id;
      await isolated.pool.query(
        "INSERT INTO email_verifications(user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '1 hour')",
        [id, hashToken("old-link-to-replace")],
      );
      await post("/users/verification-email", { email });
      expect(
        (
          await post("/users/verification-email/confirm", {
            token: "old-link-to-replace",
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await post("/users/verification-email/confirm", {
            email,
            code: fixture.messages[0].verificationCode,
          })
        ).status,
      ).toBe(200);
    });

    it("rolls back code consumption when account activation fails", async () => {
      await register();
      await post("/users/verification-email", { email });
      const code = fixture.messages[0].verificationCode;
      await isolated.pool.query(
        "CREATE FUNCTION fail_activation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic activation failure'; END $$; CREATE TRIGGER fail_activation BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fail_activation()",
      );
      expect(
        (await post("/users/verification-email/confirm", { email, code }))
          .status,
      ).toBe(500);
      expect(
        (
          await isolated.pool.query(
            "SELECT used_at FROM email_verification_codes",
          )
        ).rows[0].used_at,
      ).toBeNull();
      expect(
        (await isolated.pool.query("SELECT email_verified_at FROM users"))
          .rows[0].email_verified_at,
      ).toBeNull();
      await isolated.pool.query("DROP TRIGGER fail_activation ON users");
      expect(
        (await post("/users/verification-email/confirm", { email, code }))
          .status,
      ).toBe(200);
    });

    it("applies the additive code migration repeatedly without changing existing records", async () => {
      await register();
      await post("/users/verification-email", { email });
      const { emailVerificationCodesMigration } = await import(
        "../drizzle/email-verification-codes-migration.js"
      );
      await isolated.pool.query(emailVerificationCodesMigration);
      await isolated.pool.query(emailVerificationCodesMigration);
      expect(
        (
          await isolated.pool.query(
            "SELECT count(*)::int count FROM email_verification_codes",
          )
        ).rows[0].count,
      ).toBe(1);
    });
  },
);
