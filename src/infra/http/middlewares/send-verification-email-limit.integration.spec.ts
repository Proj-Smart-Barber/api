import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createClientAuthTestDatabase } from "../../../../test/helpers/isolated-client-auth-db";
import { sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { db } from "../../drizzle/index";
const fixture = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../../drizzle/index", () => ({
  get db() {
    return fixture.db;
  },
}));
import {
  checkAndIncrementEmailVerificationRateLimit,
  sendEmailVerificationLimit,
} from "./send-verification-email-limit";

const target = process.env.SMARTBARBER_TEST_DATABASE_URL;
describe.skipIf(!target)(
  "SendEmailVerificationLimit — Integração Real (PostgreSQL Isolado)",
  () => {
    let isolated: Awaited<ReturnType<typeof createClientAuthTestDatabase>>;
    beforeEach(async () => {
      isolated = await createClientAuthTestDatabase(target ?? "");
      fixture.db = isolated.db;
    });
    afterEach(async () => {
      await isolated?.close();
    });

    it("1. Permite até 3 requisições por minuto e bloqueia a 4ª com RATE_LIMITED e Retry-After", async () => {
      const testEmail = "rate.limit.test@exemplo.com";
      const testIp = "192.168.1.50";

      const res1 = await checkAndIncrementEmailVerificationRateLimit(
        testEmail,
        testIp,
        3,
      );
      expect(res1.status).toBe("ALLOWED");

      const res2 = await checkAndIncrementEmailVerificationRateLimit(
        testEmail,
        testIp,
        3,
      );
      expect(res2.status).toBe("ALLOWED");

      const res3 = await checkAndIncrementEmailVerificationRateLimit(
        testEmail,
        testIp,
        3,
      );
      expect(res3.status).toBe("ALLOWED");

      // 4ª requisição deve exceder o limite
      const res4 = await checkAndIncrementEmailVerificationRateLimit(
        testEmail,
        testIp,
        3,
      );
      expect(res4.status).toBe("RATE_LIMITED");
      if (res4.status === "RATE_LIMITED") {
        expect(res4.retryAfterSeconds).toBeGreaterThan(0);
        expect(res4.retryAfterSeconds).toBeLessThanOrEqual(60);
      }

      // Valida persistência atômica no banco de dados
      const rows = await db.execute<{ count: number }>(sql`
      SELECT "count" FROM "customer_lookup_rate_limits"
      WHERE "key" = ${`email_verification:${testEmail}`}
    `);
      const storedRows = (rows as { rows?: Array<{ count: number }> }).rows;
      const countRow = storedRows
        ? storedRows[0]
        : (rows as unknown as Array<{ count: number }>)[0];
      expect(Number(countRow?.count)).toBe(4);
    });

    it("2. Normalização de e-mail: maiúsculas e espaços compartilham o mesmo bucket", async () => {
      const res1 = await checkAndIncrementEmailVerificationRateLimit(
        "CASO@TESTE.COM",
        "10.0.0.1",
        2,
      );
      expect(res1.status).toBe("ALLOWED");

      const res2 = await checkAndIncrementEmailVerificationRateLimit(
        "  caso@teste.com  ",
        "10.0.0.1",
        2,
      );
      expect(res2.status).toBe("ALLOWED");

      // 3ª chamada com formatação mista deve ser bloqueada
      const res3 = await checkAndIncrementEmailVerificationRateLimit(
        "Caso@Teste.com",
        "10.0.0.1",
        2,
      );
      expect(res3.status).toBe("RATE_LIMITED");
    });

    it("3. Concorrência: 10 requisições simultâneas em paralelo respeitam o teto atômico", async () => {
      const concurrentEmail = "concorrencia@teste.com";
      const concurrentIp = "10.0.0.2";

      const promises = Array.from({ length: 10 }).map(() =>
        checkAndIncrementEmailVerificationRateLimit(
          concurrentEmail,
          concurrentIp,
          3,
        ),
      );

      const results = await Promise.all(promises);

      const allowedCount = results.filter((r) => r.status === "ALLOWED").length;
      const rateLimitedCount = results.filter(
        (r) => r.status === "RATE_LIMITED",
      ).length;

      // Exatamente 3 requisições permitidas e 7 bloqueadas
      expect(allowedCount).toBe(3);
      expect(rateLimitedCount).toBe(7);
    });

    it("4. Middleware no Express: bloqueio real responde 429 com Retry-After e não chama next()", async () => {
      const email = "express.middleware@teste.com";

      // Esgota o limite prévio de 3
      await checkAndIncrementEmailVerificationRateLimit(email, "127.0.0.1", 3);
      await checkAndIncrementEmailVerificationRateLimit(email, "127.0.0.1", 3);
      await checkAndIncrementEmailVerificationRateLimit(email, "127.0.0.1", 3);

      const req = {
        body: { email },
        ip: "127.0.0.1",
      } as unknown as Request;

      const headers: Record<string, string> = {};
      let responseStatus: number | undefined;
      let responseBody: { code?: string } | undefined;

      const res = {
        setHeader: vi.fn((k: string, v: string) => {
          headers[k] = v;
        }),
        status: vi.fn((s: number) => {
          responseStatus = s;
          return {
            json: vi.fn((b: { code?: string }) => {
              responseBody = b;
            }),
          };
        }),
      } as unknown as Response;

      const next = vi.fn();

      await sendEmailVerificationLimit(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(responseStatus).toBe(429);
      expect(headers["Retry-After"]).toBeDefined();
      expect(responseBody?.code).toBe("TOO_MANY_REQUESTS");
    });

    it("permits a new request after the window expires", async () => {
      const email = "window@example.com";
      for (let i = 0; i < 3; i++)
        await checkAndIncrementEmailVerificationRateLimit(email, "127.0.0.1");
      expect(
        (await checkAndIncrementEmailVerificationRateLimit(email, "127.0.0.1"))
          .status,
      ).toBe("RATE_LIMITED");
      await isolated.pool.query(
        "UPDATE customer_lookup_rate_limits SET reset_at=now()-interval '1 second'",
      );
      expect(
        (await checkAndIncrementEmailVerificationRateLimit(email, "127.0.0.1"))
          .status,
      ).toBe("ALLOWED");
    });
  },
);
