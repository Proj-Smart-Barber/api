import app from "./app";
import { env } from "./infra/env";

const port = env.PORT;

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
