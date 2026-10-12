import type { Request, Response } from "express";
import type { Controller } from "../controller";

export const adaptRoute = (controller: Controller) => {
  return async (request: Request, response: Response) => {
    const isWebClient = request.headers["x-smartbarber-client"] === "web";
    const requestData: Record<string, any> = {
      ...request.body,
      ...request.params,
      ...request.query,
      headers: request.headers,
      userId: request.user?.sub as string,
      _body: request.body,
      _query: request.query,
    };

    if (isWebClient && !requestData.refresh_token && request.headers.cookie) {
      const match = request.headers.cookie.match(
        /smartbarber_refresh_token=([^;]+)/,
      );
      if (match) {
        requestData.refresh_token = decodeURIComponent(match[1]);
      }
    }

    if (
      request.originalUrl?.includes("/sessions") ||
      request.originalUrl?.includes("/me") ||
      request.originalUrl?.includes("/operation-attempts") ||
      request.originalUrl?.includes("/bookings") ||
      request.originalUrl?.includes("/customers/lookup")
    ) {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Pragma", "no-cache");
    }

    const httpResponse = await controller.handle(requestData);

    if (httpResponse.statusCode >= 200 && httpResponse.statusCode <= 299) {
      if (isWebClient) {
        const isProd = process.env.NODE_ENV === "production";
        if (
          httpResponse.body &&
          typeof httpResponse.body === "object" &&
          "refresh_token" in httpResponse.body
        ) {
          const refreshToken = (httpResponse.body as Record<string, any>)
            .refresh_token;
          response.cookie("smartbarber_refresh_token", refreshToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: "strict",
            path: "/api/users/sessions",
            maxAge: 30 * 24 * 60 * 60 * 1000,
          });

          const { refresh_token: _, ...sanitizedBody } =
            httpResponse.body as Record<string, any>;
          return response.status(httpResponse.statusCode).json(sanitizedBody);
        }

        if (
          request.originalUrl?.includes("/sessions/sign-out") ||
          request.originalUrl?.includes("/sessions/logout-all")
        ) {
          response.clearCookie("smartbarber_refresh_token", {
            httpOnly: true,
            secure: isProd,
            sameSite: "strict",
            path: "/api/users/sessions",
          });
        }
      }

      if (httpResponse.statusCode === 204) {
        return response.status(204).send();
      }

      return response.status(httpResponse.statusCode).json(httpResponse.body);
    } else {
      let errorMessage = "Unknown error";

      if (typeof httpResponse.body === "object" && httpResponse.body !== null) {
        if ("error" in httpResponse.body) {
          errorMessage = (httpResponse.body as any).error;
        } else if ("message" in httpResponse.body) {
          errorMessage = (httpResponse.body as any).message;
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

      if (typeof httpResponse.body === "object" && httpResponse.body !== null) {
        return response.status(httpResponse.statusCode).json({
          error: errorMessage,
          message: errorMessage,
          ...httpResponse.body,
        });
      }

      return response.status(httpResponse.statusCode).json({
        error: errorMessage,
        message: errorMessage,
      });
    }
  };
};
