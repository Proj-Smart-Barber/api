import type { Request, Response, NextFunction } from "express";
import { validateScheduleScope } from "./validate-schedule-scope";

describe("validateScheduleScope middleware (TEC-16)", () => {
  const createMockRes = () => {
    const res: Partial<Response> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res as Response;
  };

  it("should call next() when scope parameters are clean and non-conflicting", () => {
    const req = {
      params: { shopId: "shop-1" },
      query: { barbermanId: "barber-1" },
      body: { schedules: [] },
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validateScheduleScope(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should call next() when body.barbermanId and query.barbermanId match", () => {
    const req = {
      params: { shopId: "shop-1" },
      query: { barbermanId: "barber-1" },
      body: { barbermanId: "barber-1", schedules: [] },
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validateScheduleScope(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should call next() when body.barbermanId is null and query.barbermanId is defined (query is canonical)", () => {
    const req = {
      params: { shopId: "shop-1" },
      query: { barbermanId: "barber-1" },
      body: { barbermanId: null, schedules: [] },
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validateScheduleScope(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should return 400 when query.shopId diverges from params.shopId", () => {
    const req = {
      params: { shopId: "shop-1" },
      query: { shopId: "shop-other" },
      body: { schedules: [] },
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validateScheduleScope(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Conflito de escopo: shopId divergente da rota.",
    });
  });

  it("should return 400 when body.shopId diverges from params.shopId", () => {
    const req = {
      params: { shopId: "shop-1" },
      query: {},
      body: { shopId: "shop-other", schedules: [] },
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validateScheduleScope(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Conflito de escopo: shopId divergente da rota.",
    });
  });

  it("should return 400 when body.barbermanId and query.barbermanId are both defined and diverge", () => {
    const req = {
      params: { shopId: "shop-1" },
      query: { barbermanId: "barber-1" },
      body: { barbermanId: "barber-2", schedules: [] },
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validateScheduleScope(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Conflito de escopo: barbermanId divergente entre body e query.",
    });
  });

  it("should sanitize spoofed userId and createdBy from both request.body and request.query", () => {
    const req = {
      params: { shopId: "shop-1" },
      query: {
        barbermanId: "barber-1",
        userId: "spoofed-owner-query",
        createdBy: "spoofed-owner-query",
      },
      body: {
        userId: "spoofed-owner-body",
        createdBy: "spoofed-owner-body",
        schedules: [],
      },
    } as unknown as Request;
    const res = createMockRes();
    const next = vi.fn() as NextFunction;

    validateScheduleScope(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body.userId).toBeUndefined();
    expect(req.body.createdBy).toBeUndefined();
    expect(req.query.userId).toBeUndefined();
    expect(req.query.createdBy).toBeUndefined();
    expect(req.query.barbermanId).toBe("barber-1");
  });
});
