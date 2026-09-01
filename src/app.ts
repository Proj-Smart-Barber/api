import "dotenv/config";
import express, { Request, Response } from "express";

const app = express();
app.use(express.json());

app.get("/", (request: Request, response: Response) => {
  return response.json({ message: "hello, world" });
});

const port = 3333;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
