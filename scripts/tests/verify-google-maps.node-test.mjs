import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { verifyGoogleMaps } from "../verify-google-maps.mjs";

let server, origin;
let unavailable = false;
const calls = [];
before(async () => {
  server = http.createServer((request, response) => {
    calls.push({ path: request.url, auth: request.headers.authorization });
    response.setHeader("Content-Type", "application/json");
    if (unavailable && request.url.endsWith("/nearby")) {
      response.writeHead(503);
      response.end("{}");
      return;
    }
    if (
      request.url.startsWith("/api/barbershops?") ||
      request.url.endsWith("/nearby")
    ) {
      response.end(JSON.stringify({ items: [] }));
    } else if (!request.headers.authorization) {
      response.writeHead(401);
      response.end("{}");
    } else if (request.url.endsWith("/refresh")) {
      response.end(
        JSON.stringify({ status: "OK", heartbeatAt: new Date().toISOString() }),
      );
    } else {
      response.end(
        JSON.stringify({
          serverTime: new Date().toISOString(),
          candidates: [
            {
              candidateId: "2332c86f-6853-44b9-83ed-7b6b8ec1d650",
              displayAddress: "Endereço público de teste",
              attribution: "Google Maps",
              expiresAt: new Date(Date.now() + 900000).toISOString(),
              point: { latitude: -23.55, longitude: -46.63 },
            },
          ],
        }),
      );
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise((resolve) => server.close(resolve)));

test("default checks remain unauthenticated and do not invoke a provider or maintenance", async () => {
  const start = calls.length;
  const result = await verifyGoogleMaps({ GOOGLE_TEST_API_URL: origin }, []);
  assert.equal(result.checks.length, 3);
  assert.equal(result.geocoding, "NOT TESTED");
  assert.ok(calls.slice(start).every((call) => call.auth === undefined));
});

test("explicit flags validate maintenance, geocoding and all four radii without printing credentials", async () => {
  const result = await verifyGoogleMaps(
    {
      GOOGLE_TEST_API_URL: origin,
      GOOGLE_TEST_OWNER_TOKEN: "owner-fixture",
      GOOGLE_TEST_SHOP_ID: "2332c86f-6853-44b9-83ed-7b6b8ec1d650",
      CRON_SECRET: "cron-fixture",
    },
    ["--refresh", "--geocode"],
  );
  assert.equal(result.checks.length, 9);
  assert.equal(result.geocoding, "PASS");
  assert.equal(result.gpsAndMapUI, "NOT TESTED");
  assert.ok(!JSON.stringify(result).includes("owner-fixture"));
  assert.ok(!JSON.stringify(result).includes("cron-fixture"));
});

test("missing credentials fail before any HTTP request", async () => {
  const start = calls.length;
  await assert.rejects(
    verifyGoogleMaps({ GOOGLE_TEST_API_URL: origin }, ["--geocode"]),
    /GOOGLE_TEST_OWNER_TOKEN/,
  );
  await assert.rejects(
    verifyGoogleMaps({ GOOGLE_TEST_API_URL: origin }, ["--refresh"]),
    /CRON_SECRET/,
  );
  assert.equal(calls.length, start);
});

test("rejects credentials in URLs and non-local HTTP", async () => {
  for (const url of [
    "https://user:password@example.com",
    "https://example.com/?token=secret",
    "http://example.com",
  ]) {
    await assert.rejects(
      verifyGoogleMaps({ GOOGLE_TEST_API_URL: url }, []),
      /origem HTTPS/,
    );
  }
});

test("rejects unknown options rather than treating secrets as command arguments", async () => {
  await assert.rejects(
    verifyGoogleMaps({ GOOGLE_TEST_API_URL: origin }, ["--token=private"]),
    /somente/,
  );
});

test("503 never becomes successful proximity evidence", async () => {
  unavailable = true;
  try {
    await assert.rejects(
      verifyGoogleMaps(
        {
          GOOGLE_TEST_API_URL: origin,
          GOOGLE_TEST_OWNER_TOKEN: "owner-fixture",
          GOOGLE_TEST_SHOP_ID: "2332c86f-6853-44b9-83ed-7b6b8ec1d650",
        },
        ["--geocode"],
      ),
      /HTTP 503/,
    );
  } finally {
    unavailable = false;
  }
});
