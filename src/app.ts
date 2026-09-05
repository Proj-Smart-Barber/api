import "dotenv/config";
import cors from "cors";
import express, { type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";
import { routes } from "./infra/http/routes";
import { swaggerDocument } from "./infra/http/swagger";

const app = express();
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

app.get("/", (_request: Request, response: Response) => {
  return response.json({ message: "hello, world" });
});

export default app;
