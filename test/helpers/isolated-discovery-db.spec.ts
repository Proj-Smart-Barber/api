import { describe, expect, it } from "vitest";
import { validateDiscoveryTestUrl } from "./isolated-discovery-db";

describe("Discovery test database guard", () => {
  it("accepts only explicit local disposable database names", () => {
    expect(
      validateDiscoveryTestUrl(
        "postgresql://postgres:postgres@127.0.0.1:5433/sb_discovery_test_example",
      ).hostname,
    ).toBe("127.0.0.1");

    expect(
      validateDiscoveryTestUrl(
        "postgresql://postgres:postgres@localhost:5433/sb_discovery_test_123",
      ).hostname,
    ).toBe("localhost");
  });

  it.each([
    "postgresql://postgres:postgres@remote.example.com/sb_discovery_test_example",
    "postgresql://postgres:postgres@127.0.0.1/smartbarber",
    "postgresql://postgres:postgres@127.0.0.1/postgres",
    "postgresql://postgres:postgres@127.0.0.1/sb_discovery_test_example?options=arbitrary",
    "postgresql://postgres:postgres@127.0.0.1/sb_discovery_test_example#hash",
  ])("refuses unverified targets before connecting: %s", (value) => {
    expect(() => validateDiscoveryTestUrl(value)).toThrow();
  });
});
