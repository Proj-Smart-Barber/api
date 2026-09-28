import "dotenv/config";
import cors from "cors";
import express, { type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";
import { routes } from "./infra/http/routes";
import { swaggerDocument } from "./infra/http/swagger";
import { runSchemaMigrations } from "./infra/drizzle/migrator";

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

app.get("/", (_request: Request, response: Response) => {
  return response.json({ message: "hello, world" });
});

export default app;
