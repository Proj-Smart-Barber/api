import "dotenv/config";
import cors from "cors";
import express, { type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";
import { routes } from "./infra/http/routes";
import { swaggerDocument } from "./infra/http/swagger";
import { runSchemaMigrations } from "./infra/drizzle/migrator";
import { DemoSeedEngine } from "./infra/drizzle/demo-seed/engine";

const app = express();

// Executa migrações idempotentes no boot do servidor
void runSchemaMigrations().catch((err) => {
  console.error("[App] Failed to run schema migrations on startup:", err);
});
app.use(cors());
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
app.use("/api", routes);

app.get(
  "/api/system/migrate",
  async (_request: Request, response: Response) => {
    const result = await runSchemaMigrations();
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
