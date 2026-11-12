process.env.RESEND_API_KEY ??= "re_test_dummy_key";
process.env.EMAIL_FROM ??= "SmartBarber <noreply@smartbarber.dev>";
process.env.APP_URL ??= "http://localhost:3333";
process.env.FRONTEND_URL ??= "http://localhost:8081";
process.env.JWT_SECRET ??= "smartbarber-test-secret-key-12345";
process.env.DATABASE_URL ??=
  "postgresql://sb_opt_bench:sb_opt_bench_local_only@127.0.0.1:55432/sb_unit_integration_test_isolated";
process.env.PHASE1_TEST_DATABASE_URL ??=
  "postgresql://sb_opt_bench:sb_opt_bench_local_only@127.0.0.1:55432/sb_phase1_test_isolated";
process.env.DISCOVERY_TEST_DATABASE_URL ??=
  "postgresql://sb_opt_bench:sb_opt_bench_local_only@127.0.0.1:55432/sb_discovery_test_isolated";
process.env.FINANCE_TEST_DATABASE_URL ??=
  "postgresql://sb_opt_bench:sb_opt_bench_local_only@127.0.0.1:55432/sb_finance_opt_test";
process.env.NODE_ENV ??= "test";

function assertIsolatedTestDatabaseUrl(
  name: string,
  rawUrl: string | undefined,
) {
  if (!rawUrl) return;
  const parsed = new URL(rawUrl);
  const allowedHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  const allowedPorts = new Set(["55432", "9"]);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !allowedHosts.has(parsed.hostname) ||
    !allowedPorts.has(parsed.port)
  ) {
    throw new Error(
      `[IsolationGuard] Refusing non-disposable ${name} target (${parsed.hostname}:${parsed.port || "default"}). Only disposable local port 55432 (or 9 blocked) is permitted.`,
    );
  }
}

assertIsolatedTestDatabaseUrl("DATABASE_URL", process.env.DATABASE_URL);
assertIsolatedTestDatabaseUrl(
  "PHASE1_TEST_DATABASE_URL",
  process.env.PHASE1_TEST_DATABASE_URL,
);
assertIsolatedTestDatabaseUrl(
  "DISCOVERY_TEST_DATABASE_URL",
  process.env.DISCOVERY_TEST_DATABASE_URL,
);
assertIsolatedTestDatabaseUrl(
  "FINANCE_TEST_DATABASE_URL",
  process.env.FINANCE_TEST_DATABASE_URL,
);
