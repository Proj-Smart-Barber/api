import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { Controller } from "../controller";
import { clientError, conflict, forbidden, ok } from "../http-response";
import { adaptRoute } from "./express-route-adapter";

describe("Express Route Adapter", () => {
  it("should return success response when controller returns 2xx status", async () => {
    const fakeController: Controller = {
      handle: vi.fn().mockResolvedValue(ok({ message: "Success" })),
    };

    const req = {
      body: {},
      params: {},
      query: {},
      user: { sub: "user-123" },
      method: "GET",
      originalUrl: "/test",
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const routeHandler = adaptRoute(fakeController);
    await routeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Success" });
  });

  it("should handle error response when body has { error: string }", async () => {
    const fakeController: Controller = {
      handle: vi
        .fn()
        .mockResolvedValue(clientError({ error: "Invalid credentials" })),
    };

    const req = {
      body: {},
      params: {},
      query: {},
      user: { sub: "user-123" },
      method: "POST",
      originalUrl: "/login",
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const routeHandler = adaptRoute(fakeController);
    await routeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid credentials",
    });
  });

  it("should handle error response when body is a plain string", async () => {
    const fakeController: Controller = {
      handle: vi
        .fn()
        .mockResolvedValue(forbidden("Not allowed to access resource")),
    };

    const req = {
      body: {},
      params: {},
      query: {},
      user: { sub: "user-123" },
      method: "PUT",
      originalUrl: "/schedules",
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const routeHandler = adaptRoute(fakeController);
    await routeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Not allowed to access resource",
    });
  });

  it("should preserve validation details when body has { errors: issues } and not fall back to 'Unknown error'", async () => {
    const zodIssues = [
      {
        code: "invalid_string",
        message: "Invalid UUID format",
        path: ["shopId"],
      },
      {
        code: "too_small",
        message: "String must contain at least 1 character(s)",
        path: ["name"],
      },
    ];

    const fakeController: Controller = {
      handle: vi.fn().mockResolvedValue(clientError({ errors: zodIssues })),
    };

    const req = {
      body: {},
      params: {},
      query: {},
      user: { sub: "user-123" },
      method: "PUT",
      originalUrl: "/barbershops/invalid-id/schedules",
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const routeHandler = adaptRoute(fakeController);
    await routeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid UUID format",
      errors: zodIssues,
    });
  });

  it("should provide fallback 'Validation error' if errors array is empty", async () => {
    const fakeController: Controller = {
      handle: vi.fn().mockResolvedValue(clientError({ errors: [] })),
    };

    const req = {
      body: {},
      params: {},
      query: {},
      user: { sub: "user-123" },
      method: "POST",
      originalUrl: "/test",
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const routeHandler = adaptRoute(fakeController);
    await routeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Validation error",
      errors: [],
    });
  });

  it("should preserve code and conflicts when controller returns 409 conflict", async () => {
    const conflicts = [
      {
        bookingId: "b-1",
        date: "2026-10-20",
        startTime: "14:00",
        endTime: "15:00",
        barbermanId: "barber-1",
      },
    ];

    const fakeController: Controller = {
      handle: vi.fn().mockResolvedValue(
        conflict({
          code: "SCHEDULE_BOOKING_CONFLICT",
          message: "Conflito na agenda",
          error: "Conflito na agenda",
          conflicts,
        }),
      ),
    };

    const req = {
      body: {},
      params: {},
      query: {},
      user: { sub: "user-123" },
      method: "PUT",
      originalUrl: "/schedules",
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const routeHandler = adaptRoute(fakeController);
    await routeHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      code: "SCHEDULE_BOOKING_CONFLICT",
      message: "Conflito na agenda",
      error: "Conflito na agenda",
      conflicts,
    });
  });
});
