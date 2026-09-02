import "dotenv/config";
import cors from "cors";
import express, { type Request, type Response } from "express";
import swaggerUi from "swagger-ui-express";
import { routes } from "./infra/http/routes";
import { swaggerDocument } from "./infra/http/swagger";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api", routes);

app.get("/", (_request: Request, response: Response) => {
  return response.json({ message: "hello, world" });
});

const port = 3333;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
