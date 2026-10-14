import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClientAuthTestDatabase } from "../../../test/helpers/isolated-client-auth-db";

const fixture = vi.hoisted(() => ({
  db: null as unknown,
  messages: [] as Array<{ to: string; verificationUrl: string }>,
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
    }) {
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
    const password = "synthetic-password-123";
    const email = "synthetic.client@example.com";

    beforeEach(async () => {
      isolated = await createClientAuthTestDatabase(target ?? "");
      fixture.db = isolated.db;
      fixture.messages = [];
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
      expect((await register()).status).toBe(201);
      expect(
        (await post("/users/sessions/auth", { email, password })).status,
      ).toBe(403);
      expect((await post("/users/verification-email", { email })).status).toBe(
        200,
      );
      expect(fixture.messages).toHaveLength(1);
      const link = new URL(fixture.messages[0].verificationUrl);
      expect(link.origin).toBe("http://localhost:8081");
      expect(link.pathname).toBe("/verify-email");
      const confirmed = await post("/users/verification-email/confirm", {
        token: link.searchParams.get("token"),
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
      const token = new URL(
        fixture.messages[0].verificationUrl,
      ).searchParams.get("token");
      await isolated.pool.query(
        "UPDATE email_verifications SET expires_at = now() - interval '1 minute'",
      );
      expect(
        (await post("/users/verification-email/confirm", { token })).status,
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
      expect(fixture.messages).toHaveLength(3);
      await isolated.pool.query(
        "ALTER TABLE customer_lookup_rate_limits RENAME TO unavailable_limits",
      );
      const unavailable = await post("/users/verification-email", { email });
      expect(unavailable.status).toBe(503);
      expect(fixture.messages).toHaveLength(3);
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
  },
);
