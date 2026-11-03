import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { DrizzleDiscoveryRepository } from "../src/infra/drizzle/repositories/drizzle-discovery-repository";
import { GetExploreFeedUseCase } from "../src/domain/application/use-cases/barbershop/get-explore-feed/get-explore-feed";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");

  const target = new URL(databaseUrl);
  const database = decodeURIComponent(target.pathname.slice(1));

  process.env.DATABASE_URL = databaseUrl;
  process.env.PGHOST = target.hostname;
  process.env.PGPORT = target.port || "5432";
  process.env.PGUSER = decodeURIComponent(target.username);
  process.env.PGPASSWORD = decodeURIComponent(target.password);
  process.env.PGDATABASE = database;

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);
  const repo = new DrizzleDiscoveryRepository(db);

  console.log("=== Validação de Descoberta e Proximidade no Banco ===");

  // 1. Verificar saúde
  const isHealthy = await repo.isLocationServiceHealthy();
  const isGoogleHealthy = await repo.isGoogleMapsCacheHealthy();
  console.log(`Saúde do motor de localização (banco/ping): ${isHealthy}`);
  console.log(`Saúde do cache Google Maps: ${isGoogleHealthy}`);

  // 2. Busca NEARBY próxima à Sé / Centro (-23.5442, -46.6400) com raio 5km
  console.log("\n--- Teste 1: NEARBY Centro SP (raio 5km) ---");
  const nearbyCentro = await repo.search({
    mode: "NEARBY",
    point: { latitude: -23.5442, longitude: -46.6400 },
    radiusKm: 5,
    page: 1,
    limit: 10,
  });

  console.log(`Total encontrados: ${nearbyCentro.total}`);
  for (const item of nearbyCentro.items) {
    console.log(`- ${item.name} (${item.location}): dist = ${Math.round(item.distanceMeters ?? 0)}m, coords = ${JSON.stringify(item.coordinates)}`);
  }

  // 3. Busca NEARBY no Rio de Janeiro (fora do raio de SP)
  console.log("\n--- Teste 2: NEARBY Rio de Janeiro (-22.9068, -43.1729, raio 5km) ---");
  const nearbyRio = await repo.search({
    mode: "NEARBY",
    point: { latitude: -22.9068, longitude: -43.1729 },
    radiusKm: 5,
    page: 1,
    limit: 10,
  });
  console.log(`Total encontrados (esperado 0): ${nearbyRio.total}, items: ${nearbyRio.items.length}`);

  // 4. Teste UseCase GetExploreFeedUseCase com NEARBY
  console.log("\n--- Teste 3: GetExploreFeedUseCase NEARBY Centro SP ---");
  const exploreUseCase = new GetExploreFeedUseCase(repo);
  const feedResult = await exploreUseCase.execute({
    mode: "NEARBY",
    point: { latitude: -23.5442, longitude: -46.6400 },
    radiusKm: 10,
    limit: 10,
  });

  if (feedResult.isRight()) {
    console.log(`Explore Feed NEARBY items: ${feedResult.value.items.length}`);
    for (const item of feedResult.value.items) {
      console.log(`- Shop: ${item.barbershop.name}, dist: ${Math.round(item.distanceMeters ?? 0)}m, media: ${item.media.length}`);
    }
  } else {
    console.error("Explore Feed retornou erro:", feedResult.value);
  }

  // 5. Teste ALL mode: 10 barbearias retornadas
  console.log("\n--- Teste 4: Busca em modo ALL ---");
  const allShops = await repo.search({
    mode: "ALL",
    page: 1,
    limit: 20,
  });
  console.log(`Total em ALL: ${allShops.total}`);
  const withCoords = allShops.items.filter(i => i.coordinates !== null);
  const withoutCoords = allShops.items.filter(i => i.coordinates === null);
  console.log(`Com coordenadas (fontes MANUAL confirmadas): ${withCoords.length}`);
  console.log(`Sem coordenadas (bloqueadas por ausência de fonte primária): ${withoutCoords.length}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Erro no teste:", err);
  process.exit(1);
});
