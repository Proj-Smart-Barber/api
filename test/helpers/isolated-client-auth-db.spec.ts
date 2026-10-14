import { describe, expect, it } from "vitest";
import { validateClientAuthTestUrl } from "./isolated-client-auth-db";

describe("Client auth test database guard", () => {
  it("accepts only explicit local disposable database names", () => {
    expect(
      validateClientAuthTestUrl(
        "postgresql://test:test@127.0.0.1:15437/sb_client_auth_test_example",
      ).hostname,
    ).toBe("127.0.0.1");
  });
  it.each([
    "postgresql://test:test@remote.example.com/sb_client_auth_test_example",
    "postgresql://test:test@127.0.0.1/smartbarber",
    "postgresql://test:test@127.0.0.1/postgres",
    "postgresql://test:test@127.0.0.1/sb_client_auth_test_example?options=arbitrary",
  ])("refuses unverified targets before connecting: %s", (value) => {
    expect(() => validateClientAuthTestUrl(value)).toThrow();
  });
});
