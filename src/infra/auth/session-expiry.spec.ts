import {
  GESTOR_SESSION_TTL_SECONDS,
  USER_SESSION_TTL_SECONDS,
  isGestorRole,
  sessionExpiresAtForRole,
  sessionTtlSecondsForRole,
} from "./session-expiry";

describe("Session expiry policy", () => {
  it("should grant gestores 8 hours", () => {
    expect(GESTOR_SESSION_TTL_SECONDS).toBe(8 * 60 * 60);
    expect(sessionTtlSecondsForRole("OWNER")).toBe(8 * 60 * 60);
    expect(sessionTtlSecondsForRole("PLATFORM_ADMIN")).toBe(8 * 60 * 60);
    expect(isGestorRole("OWNER")).toBe(true);
  });

  it("should grant regular users 30 days", () => {
    expect(USER_SESSION_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(sessionTtlSecondsForRole("CLIENT")).toBe(30 * 24 * 60 * 60);
    expect(sessionTtlSecondsForRole("BARBER")).toBe(30 * 24 * 60 * 60);
    expect(isGestorRole("CLIENT")).toBe(false);
  });

  it("should compute the expiration date from now", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");

    expect(sessionExpiresAtForRole("CLIENT", now).toISOString()).toBe(
      "2026-01-31T00:00:00.000Z",
    );
    expect(sessionExpiresAtForRole("OWNER", now).toISOString()).toBe(
      "2026-01-01T08:00:00.000Z",
    );
  });
});
