import type { Request, Response } from "express";
import type { Controller } from "../controller";

export const adaptRoute = (controller: Controller) => {
  return async (request: Request, response: Response) => {
    const requestData = {
      ...request.body,
      ...request.params,
      ...request.query,
      userId: request.user?.sub as string,
      // file: request.file,
    };

    // Cabeçalhos originais (Cookie/Bearer) ficam no contexto: só os
    // controllers de sessão precisam deles, e assim os schemas `.strict()`
    // de entrada não são contaminados por chaves inesperadas.
    const httpResponse = await controller.handle(requestData, {
      headers: request.headers,
    });

    if (httpResponse.headers) {
      for (const [key, value] of Object.entries(httpResponse.headers)) {
        response.setHeader(key, value);
      }
    }

    if (httpResponse.statusCode >= 200 && httpResponse.statusCode <= 299) {
      return response.status(httpResponse.statusCode).json(httpResponse.body);
    } else {
      let errorMessage = "Unknown error";

      if (
        typeof httpResponse.body === "object" &&
        httpResponse.body !== null &&
        "error" in httpResponse.body
      ) {
        errorMessage = (httpResponse.body as any).error;
      } else if (typeof httpResponse.body === "string") {
        errorMessage = httpResponse.body;
      }

      if (httpResponse.statusCode >= 500) {
        console.error(
          `[HTTP ${httpResponse.statusCode}] Error on ${request.method} ${request.originalUrl}:`,
          httpResponse.body,
        );
      }

      return response.status(httpResponse.statusCode).json({
        error: errorMessage,
      });
    }
  };
};
