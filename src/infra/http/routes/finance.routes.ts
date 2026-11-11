import { Router, type Request, type Response } from "express";
import { z, ZodError } from "zod";
import { ensureUserIsAuthenticated } from "../middlewares/ensure-user-is-authenticated";
import { FinanceRepository } from "../controllers/finance/finance-repository";
import { FinanceError } from "../../../domain/application/services/finance/finance";

const uuid = z.string().uuid();
export function createFinanceRouter(repository = new FinanceRepository()) {
  const router = Router({ mergeParams: true });
  router.use(ensureUserIsAuthenticated);
  const handle =
    (operation: string) => async (request: Request, response: Response) => {
      try {
        const shopId = uuid.parse(request.params.shopId);
        const userId = uuid.parse(request.user?.sub);
        let input: unknown = request.body;
        if (operation === "period")
          input = {
            month: request.query.month,
            from: request.query.from,
            to: request.query.to,
          };
        if (operation === "update")
          input = {
            ...request.body,
            entryId: uuid.parse(request.params.entryId),
          };
        if (operation === "copy")
          input = {
            ...z.object({ requestId: uuid }).strict().parse(request.body),
            entryId: uuid.parse(request.params.entryId),
          };
        const result = await repository.execute(
          shopId,
          userId,
          operation,
          input,
        );
        return response.json(result);
      } catch (error) {
        if (error instanceof ZodError)
          return response.status(400).json({
            error: "Confira os valores, as datas e os campos informados.",
          });
        if (error instanceof FinanceError)
          return response.status(error.status).json({ error: error.message });
        return response.status(503).json({
          error: "Não foi possível acessar o financeiro. Tente novamente.",
        });
      }
    };
  router.get("/", handle("period"));
  router.post("/entries", handle("create"));
  router.patch("/entries/:entryId", handle("update"));
  router.post("/entries/:entryId/copy", handle("copy"));
  router.post("/receipts", handle("receipt"));
  return router;
}
