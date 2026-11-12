import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
import cors from "cors";
import express, { type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";
import { routes } from "./infra/http/routes";
import { swaggerDocument } from "./infra/http/swagger";
import { runSchemaMigrations, isSchemaReady } from "./infra/drizzle/migrator";
import { DemoSeedEngine } from "./infra/drizzle/demo-seed/canonical/engine";
import { requestMetricsMiddleware } from "./infra/observability/request-metrics";

const app = express();

app.use(requestMetricsMiddleware);

// Executa migrações idempotentes no boot do servidor (pode ser desativado via AUTO_RUN_MIGRATIONS=false em serverless)
// Integration tests prepare their isolated schema explicitly; concurrent boot DDL can deadlock fixtures.
// Releases run migrations before traffic; boot DDL is now an explicit compatibility opt-in.
const schemaReady =
  process.env.NODE_ENV === "test"
    ? Promise.resolve({ success: true })
    : process.env.AUTO_RUN_MIGRATIONS === "true"
      ? runSchemaMigrations()
      : isSchemaReady().then((success) => ({ success }));
app.use(async (_request, response, next) => {
  try {
    const result = await schemaReady;
    if (!result.success)
      return response
        .status(503)
        .json({ error: "Serviço temporariamente indisponível." });
    next();
  } catch {
    return response
      .status(503)
      .json({ error: "Serviço temporariamente indisponível." });
  }
});
app.use(
  cors({
    origin: true,
    credentials: true,
    exposedHeaders: [
      "Server-Timing",
      "X-Request-Id",
      "X-SQL-Count",
      "X-SQL-Duration-Ms",
    ],
  }),
);
app.use(
  express.json({
    type: ["application/json", "text/plain"],
  }),
);
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customCssUrl: "https://unpkg.com/swagger-ui-dist/swagger-ui.css",
    customJs: [
      "https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js",
      "https://unpkg.com/swagger-ui-dist/swagger-ui-standalone-preset.js",
    ],
    swaggerOptions: {
      url: "/docs-json",
    },
  }),
);

app.get("/docs-json", (_req: Request, res: Response) => {
  res.status(200).json(swaggerDocument);
});

// Maintenance cannot be invoked through a publicly known confirmation string.
app.use("/api/system", (request, response, next) => {
  const expected = process.env.SYSTEM_MAINTENANCE_SECRET;
  const received = request.headers["x-maintenance-key"];
  if (!expected || expected.length < 32)
    return response.status(404).json({ error: "Not found" });
  if (
    typeof received !== "string" ||
    Buffer.byteLength(received) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  )
    return response.status(403).json({ error: "Forbidden" });
  next();
});
app.use("/api", (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});
app.use("/api", routes);

app.get(
  "/api/system/migrate",
  async (_request: Request, response: Response) => {
    const result = await runSchemaMigrations(undefined, { force: true });
    return response.status(result.success ? 200 : 500).json(result);
  },
);

app.get(
  "/api/system/demo-seed",
  async (_request: Request, response: Response) => {
    try {
      const engine = new DemoSeedEngine();
      const result = await engine.run({ dryRun: true });
      return response.status(200).json({
        success: true,
        dryRun: true,
        summary: result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[System] Demo seed dry run error:", err);
      return response.status(500).json({ success: false, error: message });
    }
  },
);

app.post(
  "/api/system/demo-seed",
  async (request: Request, response: Response) => {
    const confirm =
      (request.query.confirm as string) || (request.body?.confirm as string);
    if (confirm !== "CONFIRMAR_SEED_DEMO_PRODUCAO") {
      return response.status(400).json({
        success: false,
        error:
          "Confirmação obrigatória: envie confirm=CONFIRMAR_SEED_DEMO_PRODUCAO na query ou body.",
      });
    }

    try {
      const engine = new DemoSeedEngine();
      const result = await engine.run({
        dryRun: false,
        confirmSecret: "CONFIRMAR_SEED_DEMO_PRODUCAO",
        forceReplenishDisposables: true,
      });
      return response.status(200).json({
        success: true,
        message: "Seed de demonstração aplicado com sucesso!",
        summary: result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[System] Demo seed execution error:", err);
      return response.status(500).json({ success: false, error: message });
    }
  },
);

app.get("/", (_request: Request, response: Response) => {
  return response.json({ message: "hello, world" });
});

export default app;
