import { pathToFileURL } from "node:url";

const publicAddress = "Praça da Sé, São Paulo, SP, Brasil";

export async function verifyGoogleMaps(
  env = process.env,
  args = process.argv.slice(2),
) {
  if (args.some((arg) => !["--geocode", "--refresh"].includes(arg))) {
    throw new Error(
      "Use somente --geocode e/ou --refresh. Credenciais devem ficar no ambiente.",
    );
  }
  if (!env.GOOGLE_TEST_API_URL)
    throw new Error("Defina GOOGLE_TEST_API_URL com a origem da API.");
  const base = new URL(env.GOOGLE_TEST_API_URL);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== "/" ||
    (base.protocol !== "https:" && !(local && base.protocol === "http:"))
  ) {
    throw new Error(
      "Use uma origem HTTPS sem caminho, parâmetros ou credenciais; HTTP somente em loopback.",
    );
  }
  const geocode = args.includes("--geocode");
  const refresh = args.includes("--refresh");
  if (
    geocode &&
    (!env.GOOGLE_TEST_OWNER_TOKEN ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        env.GOOGLE_TEST_SHOP_ID ?? "",
      ))
  ) {
    throw new Error(
      "Defina GOOGLE_TEST_OWNER_TOKEN e GOOGLE_TEST_SHOP_ID para --geocode.",
    );
  }
  if (refresh && !env.CRON_SECRET?.trim())
    throw new Error("Defina CRON_SECRET para --refresh.");

  const results = [];
  async function request(name, path, expectedStatus, options = {}) {
    let response;
    try {
      response = await fetch(new URL(path, base), {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error(
        `${name}: falha de transporte, timeout ou redirecionamento. Verifique a origem da API.`,
      );
    }
    if (response.status !== expectedStatus) {
      throw new Error(
        `${name}: HTTP ${response.status}; esperado ${expectedStatus}.`,
      );
    }
    const data = await response.json().catch(() => null);
    results.push({ check: name, status: "PASS" });
    return data;
  }

  const catalog = await request(
    "Busca pública",
    "/api/barbershops?page=1&limit=1",
    200,
  );
  if (!Array.isArray(catalog?.items))
    throw new Error("Busca pública: contrato items ausente.");
  await request("Geocodificação exige sessão", "/api/geocoding/search", 401, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: publicAddress }),
  });
  await request(
    "Manutenção exige segredo",
    "/api/internal/locations/refresh",
    401,
  );

  if (refresh) {
    const health = await request(
      "Executar manutenção",
      "/api/internal/locations/refresh",
      200,
      {
        headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
      },
    );
    if (
      health?.status !== "OK" ||
      !Number.isFinite(Date.parse(health.heartbeatAt))
    ) {
      throw new Error("Manutenção: heartbeat saudável ausente.");
    }
  }
  if (geocode) {
    const candidatePage = await request(
      "Geocodificação autenticada",
      "/api/geocoding/search",
      200,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.GOOGLE_TEST_OWNER_TOKEN}`,
        },
        body: JSON.stringify({
          address: publicAddress,
          shopId: env.GOOGLE_TEST_SHOP_ID,
        }),
      },
    );
    const candidate = candidatePage?.candidates?.[0];
    const issuedAt = Date.parse(candidatePage?.serverTime);
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        candidate?.candidateId ?? "",
      ) ||
      !candidate?.displayAddress?.trim() ||
      candidate?.attribution !== "Google Maps" ||
      !Number.isFinite(issuedAt) ||
      !(Date.parse(candidate?.expiresAt) > issuedAt)
    ) {
      throw new Error(
        "Geocodificação: candidato, atribuição ou validade autoritativa ausente.",
      );
    }
    const point = candidate.point;
    if (
      !Number.isFinite(point?.latitude) ||
      Math.abs(point.latitude) > 90 ||
      !Number.isFinite(point?.longitude) ||
      Math.abs(point.longitude) > 180
    ) {
      throw new Error(
        "Geocodificação: candidato com coordenadas válidas não retornado.",
      );
    }
    for (const radiusKm of [5, 10, 25, 50]) {
      const page = await request(
        `Proximidade ${radiusKm} km`,
        "/api/barbershops/nearby",
        200,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...point, radiusKm, page: 1, limit: 1 }),
        },
      );
      if (!Array.isArray(page?.items))
        throw new Error(`Proximidade ${radiusKm} km: contrato items ausente.`);
    }
  }
  return {
    checks: results,
    geocoding: geocode ? "PASS" : "NOT TESTED",
    maintenance: refresh ? "PASS" : "NOT TESTED",
    gpsAndMapUI: "NOT TESTED",
  };
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  verifyGoogleMaps()
    .then((result) =>
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`),
    )
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
