import type { NextFunction, Request, Response } from "express";
import { ensureUserIsPlatformAdmin } from "./ensure-user-is-platform-admin";

vi.mock("../../auth/better-auth-gateway", () => ({
  authGateway: {
    getSession: vi.fn(),
  },
}));

import { authGateway } from "../../auth/better-auth-gateway";

const getSession = vi.mocked(authGateway.getSession);

function makeRequest(): Request {
  return { headers: {} } as unknown as Request;
}

function makeReply() {
  const reply = {
    status: vi.fn(),
    json: vi.fn(),
  };
  reply.status.mockReturnValue(reply);
  return reply as unknown as Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function session(role: "PLATFORM_ADMIN" | "CLIENT") {
  return {
    token: "valid-token",
    expiresAt: new Date(),
    setCookies: [],
    user: {
      id: "user-1",
      name: "Fulano",
      email: "fulano@email.com",
      cpf: "52998224725",
      role,
      emailVerified: true,
    },
  };
}

describe("ensureUserIsPlatformAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow a platform admin", async () => {
    getSession.mockResolvedValue(session("PLATFORM_ADMIN"));

    const reply = makeReply();
    const next = vi.fn() as NextFunction;

    await ensureUserIsPlatformAdmin(makeRequest(), reply, next);

    expect(next).toHaveBeenCalledOnce();
    expect(reply.status).not.toHaveBeenCalled();
  });

  it("should answer 403 for a signed-in non admin", async () => {
    getSession.mockResolvedValue(session("CLIENT"));

    const reply = makeReply();
    const next = vi.fn() as NextFunction;

    await ensureUserIsPlatformAdmin(makeRequest(), reply, next);

    expect(next).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(403);
  });

  it("should answer 401 without a session", async () => {
    getSession.mockResolvedValue(null);

    const reply = makeReply();
    const next = vi.fn() as NextFunction;

    await ensureUserIsPlatformAdmin(makeRequest(), reply, next);

    expect(next).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(401);
  });
});
