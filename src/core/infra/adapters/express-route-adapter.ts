import type { Request, Response } from "express";
import type { Controller } from "../controller";

export const adaptRoute = (controller: Controller) => {
  return async (request: Request, response: Response) => {
    const requestData = {
      ...request.body,
      ...request.params,
      ...request.query,
      // userId: request.user?.sub as string,
      // file: request.file,
    };

    const httpResponse = await controller.handle(requestData);

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

      return response.status(httpResponse.statusCode).json({
        error: errorMessage,
      });
    }
  };
};
