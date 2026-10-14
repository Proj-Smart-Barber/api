import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import {
  createSendEmailVerificationLimit,
  checkAndIncrementEmailVerificationRateLimit,
  type DatabaseExecutor,
} from "./send-verification-email-limit";

describe("SendEmailVerificationLimit Middleware (Unit Tests com Mocks Explícitos)", () => {
  it.each([
    { count: "not-a-number", reset_at: new Date() },
    { count: Infinity, reset_at: new Date() },
    { count: -1, reset_at: new Date() },
    { count: 1.5, reset_at: new Date() },
    { count: 1, reset_at: "invalid-date" },
  ])("fails closed for malformed storage values", async (row) => {
    const executor: DatabaseExecutor = {
      execute: vi.fn().mockResolvedValue({ rows: [row] }),
    };
    expect(
      (
        await checkAndIncrementEmailVerificationRateLimit(
          "fixture@example.com",
          undefined,
          3,
          executor,
        )
      ).status,
    ).toBe("INFRASTRUCTURE_ERROR");
  });
  it("1. Rejeita requisição sem e-mail com 400 VALIDATION_ERROR e nunca chama next()", async () => {
    const middleware = createSendEmailVerificationLimit();

    const req = {
      body: {},
      ip: "127.0.0.1",
    } as unknown as Request;

    const setHeader = vi.fn();
    let responseStatus: number | undefined;
    let responseBody: unknown;

    const res = {
      setHeader,
      status: vi.fn((s: number) => {
        responseStatus = s;
        return {
          json: vi.fn((b: unknown) => {
            responseBody = b;
          }),
        };
      }),
    } as unknown as Response;

    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(responseStatus).toBe(400);
    expect((responseBody as { code?: string })?.code).toBe("VALIDATION_ERROR");
  });

  it("2. Responde 503 SERVICE_UNAVAILABLE e zero next() quando o banco falha (sem fail-open)", async () => {
    const failingExecutor: DatabaseExecutor = {
      execute: vi.fn().mockRejectedValue(new Error("Connection terminated")),
    };

    const middleware = createSendEmailVerificationLimit(failingExecutor);

    const req = {
      body: { email: "usuario@teste.com" },
      ip: "127.0.0.1",
    } as unknown as Request;

    const setHeader = vi.fn();
    let responseStatus: number | undefined;
    let responseBody: unknown;

    const res = {
      setHeader,
      status: vi.fn((s: number) => {
        responseStatus = s;
        return {
          json: vi.fn((b: unknown) => {
            responseBody = b;
          }),
        };
      }),
    } as unknown as Response;

    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith("Retry-After", "60");
    expect(responseStatus).toBe(503);
    expect((responseBody as { code?: string })?.code).toBe(
      "SERVICE_UNAVAILABLE",
    );
  });

  it("3. Responde 429 TOO_MANY_REQUESTS com Retry-After e zero next() quando o limite é excedido", async () => {
    const resetAt = new Date(Date.now() + 45000); // 45s no futuro
    const rateLimitedExecutor: DatabaseExecutor = {
      execute: vi.fn().mockResolvedValue({
        rows: [{ count: 4, reset_at: resetAt }],
      }),
    };

    const middleware = createSendEmailVerificationLimit(rateLimitedExecutor);

    const req = {
      body: { email: "usuario@teste.com" },
      ip: "127.0.0.1",
    } as unknown as Request;

    const setHeader = vi.fn();
    let responseStatus: number | undefined;
    let responseBody: unknown;

    const res = {
      setHeader,
      status: vi.fn((s: number) => {
        responseStatus = s;
        return {
          json: vi.fn((b: unknown) => {
            responseBody = b;
          }),
        };
      }),
    } as unknown as Response;

    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(responseStatus).toBe(429);
    expect((responseBody as { code?: string })?.code).toBe("TOO_MANY_REQUESTS");
  });

  it("4. Permite requisição chamando next() uma vez quando dentro do limite", async () => {
    const resetAt = new Date(Date.now() + 60000);
    const allowedExecutor: DatabaseExecutor = {
      execute: vi.fn().mockResolvedValue({
        rows: [{ count: 1, reset_at: resetAt }],
      }),
    };

    const middleware = createSendEmailVerificationLimit(allowedExecutor);

    const req = {
      body: { email: "usuario@teste.com" },
      ip: "127.0.0.1",
    } as unknown as Request;

    const setHeader = vi.fn();
    const res = {
      setHeader,
      status: vi.fn(),
    } as unknown as Response;

    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
});
