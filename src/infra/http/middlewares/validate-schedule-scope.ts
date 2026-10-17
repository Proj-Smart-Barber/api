import type { Request, Response, NextFunction } from "express";

export function validateScheduleScope(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const paramShopId = request.params?.shopId;
  const query = (request.query ?? {}) as Record<string, unknown>;
  const body =
    request.body && typeof request.body === "object"
      ? (request.body as Record<string, unknown>)
      : {};

  // 1. params.shopId é a fonte canônica da barbearia.
  // Rejeita qualquer shopId divergente enviado na query ou no body.
  if (
    paramShopId !== undefined &&
    ((query.shopId !== undefined &&
      query.shopId !== null &&
      String(query.shopId) !== String(paramShopId)) ||
      (body.shopId !== undefined &&
        body.shopId !== null &&
        String(body.shopId) !== String(paramShopId)))
  ) {
    return response.status(400).json({
      error: "Conflito de escopo: shopId divergente da rota.",
    });
  }

  // 2. query.barbermanId é a fonte canônica de barbermanId.
  // Se body.barbermanId e query.barbermanId estiverem ambos definidos (não-undefined e não-null) e divergirem, rejeita com 400.
  const queryBarbermanId = query.barbermanId;
  const bodyBarbermanId = body.barbermanId;

  if (
    queryBarbermanId !== undefined &&
    queryBarbermanId !== null &&
    bodyBarbermanId !== undefined &&
    bodyBarbermanId !== null &&
    String(bodyBarbermanId) !== String(queryBarbermanId)
  ) {
    return response.status(400).json({
      error: "Conflito de escopo: barbermanId divergente entre body e query.",
    });
  }

  // 3. Sanitização anti-spoofing: remove userId e createdBy injetados em body ou query,
  // garantindo que apenas request.user?.sub (extraído do JWT) represente o autor autenticado.
  if (request.body && typeof request.body === "object") {
    delete (request.body as Record<string, unknown>).userId;
    delete (request.body as Record<string, unknown>).createdBy;
  }

  if (request.query && typeof request.query === "object") {
    const queryObj = request.query as Record<string, unknown>;
    delete queryObj.userId;
    delete queryObj.createdBy;

    const sanitizedQuery = { ...queryObj };
    delete sanitizedQuery.userId;
    delete sanitizedQuery.createdBy;

    Object.defineProperty(request, "query", {
      value: sanitizedQuery,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  return next();
}
