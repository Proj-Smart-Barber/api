import type { NextFunction, Request, Response } from "express";
import { ensureUserIsAuthenticated } from "./ensure-user-is-authenticated";

vi.mock("../../auth/better-auth-gateway", () => ({
  authGateway: {
    getSession: vi.fn(),
  },
}));

import { authGateway } from "../../auth/better-auth-gateway";

const getSession = vi.mocked(authGateway.getSession);

function makeRequest(): Request {
  return {
    headers: { authorization: "Bearer valid-token" },
  } as unknown as Request;
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

describe("ensureUserIsAuthenticated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should attach the session user and continue when the session is valid", async () => {
    getSession.mockResolvedValue({
      token: "valid-token",
      expiresAt: new Date(),
      setCookies: [],
      user: {
        id: "user-1",
        name: "Fulano",
        email: "fulano@email.com",
        cpf: "52998224725",
        role: "OWNER",
        emailVerified: true,
      },
    });

    const request = makeRequest();
    const reply = makeReply();
    const next = vi.fn() as NextFunction;

    await ensureUserIsAuthenticated(request, reply, next);

    expect(next).toHaveBeenCalledOnce();
    expect(request.user).toEqual({ sub: "user-1", role: "OWNER" });
    expect(reply.status).not.toHaveBeenCalled();
  });

  it("should answer 401 when there is no session", async () => {
    getSession.mockResolvedValue(null);

    const reply = makeReply();
    const next = vi.fn() as NextFunction;

    await ensureUserIsAuthenticated(makeRequest(), reply, next);

    expect(next).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.json).toHaveBeenCalledWith({
      message: "Sessão inválida ou expirada.",
    });
  });

  it("should answer 401 (never 500) when the session check fails", async () => {
    getSession.mockRejectedValue(new Error("bad token"));

    const reply = makeReply();
    const next = vi.fn() as NextFunction;

    await ensureUserIsAuthenticated(makeRequest(), reply, next);

    expect(next).not.toHaveBeenCalled();
    expect(reply.status).toHaveBeenCalledWith(401);
  });
});
