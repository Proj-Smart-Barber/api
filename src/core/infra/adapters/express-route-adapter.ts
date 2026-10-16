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

    const httpResponse = await controller.handle(requestData);

    if (httpResponse.statusCode >= 200 && httpResponse.statusCode <= 299) {
      return response.status(httpResponse.statusCode).json(httpResponse.body);
    } else {
      let errorMessage = "Unknown error";
      let validationErrors: unknown;

      if (typeof httpResponse.body === "object" && httpResponse.body !== null) {
        const body = httpResponse.body as Record<string, unknown>;

        if ("error" in body && typeof body.error === "string") {
          errorMessage = body.error;
        } else if ("message" in body && typeof body.message === "string") {
          errorMessage = body.message;
        } else if ("errors" in body && Array.isArray(body.errors)) {
          validationErrors = body.errors;
          const firstIssue = body.errors[0];
          if (
            typeof firstIssue === "object" &&
            firstIssue !== null &&
            "message" in firstIssue &&
            typeof (firstIssue as { message: unknown }).message === "string"
          ) {
            errorMessage = (firstIssue as { message: string }).message;
          } else {
            errorMessage = "Validation error";
          }
        }
      } else if (typeof httpResponse.body === "string") {
        errorMessage = httpResponse.body;
      }

      if (httpResponse.statusCode >= 500) {
        console.error(
          `[HTTP ${httpResponse.statusCode}] Error on ${request.method} ${request.originalUrl}:`,
          httpResponse.body,
        );
      }

      const responsePayload: Record<string, unknown> = {
        error: errorMessage,
      };

      if (typeof httpResponse.body === "object" && httpResponse.body !== null) {
        const body = httpResponse.body as Record<string, unknown>;
        if ("code" in body) {
          responsePayload.code = body.code;
        }
        if ("message" in body && typeof body.message === "string") {
          responsePayload.message = body.message;
        }
        if ("conflicts" in body) {
          responsePayload.conflicts = body.conflicts;
        }
      }

      if (validationErrors !== undefined) {
        responsePayload.errors = validationErrors;
      }

      return response.status(httpResponse.statusCode).json(responsePayload);
    }
  };
};
