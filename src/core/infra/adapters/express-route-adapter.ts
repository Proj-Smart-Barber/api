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

    const urlPath = (request.originalUrl ?? request.url ?? "").split("?")[0];
    const hasAuthHeader = Boolean(request.headers.authorization);
    const isPrivateOrRealtimeRoute =
      request.method !== "GET" ||
      hasAuthHeader ||
      urlPath.includes("/sessions") ||
      urlPath.includes("/me") ||
      urlPath.includes("/operation-attempts") ||
      urlPath.includes("/bookings") ||
      urlPath.includes("/customers/lookup") ||
      urlPath.includes("/barbershops/nearby") ||
      urlPath.includes("/barbershops/explore") ||
      urlPath.includes("/availability") ||
      urlPath.includes("/notifications") ||
      urlPath.includes("/finance") ||
      urlPath.includes("/memberships") ||
      urlPath.includes("/invitations");

    const isPublicBarbershopCatalogGet =
      request.method === "GET" &&
      !hasAuthHeader &&
      !isPrivateOrRealtimeRoute &&
      (/^\/api\/barbershops\/[0-9a-fA-F-]{36}(?:\/(?:professionals|reviews|gallery|services))?$/.test(
        urlPath,
      ) ||
        /^\/api\/barbershops\/[0-9a-fA-F-]{36}\/services\/public$/.test(
          urlPath,
        ));

    if (isPrivateOrRealtimeRoute) {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Pragma", "no-cache");
    } else if (
      isPublicBarbershopCatalogGet &&
      !request.headers.cookie &&
      process.env.ENABLE_PUBLIC_HTTP_CACHE === "true"
    ) {
      response.setHeader(
        "Cache-Control",
        "public, max-age=30, stale-while-revalidate=60",
      );
      response.setHeader("Vary", "Accept-Encoding, Authorization");
    }

    const httpResponse = await controller.handle(requestData);

    if (httpResponse.statusCode >= 400)
      response.setHeader("Cache-Control", "no-store");
    if (httpResponse.headers) {
      for (const [headerName, headerValue] of Object.entries(
        httpResponse.headers,
      )) {
        response.setHeader(headerName, headerValue);
      }
    }

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
        const sanitizedUrl = request.originalUrl
          ? request.originalUrl.split("?")[0]
          : (request.url ?? "unknown-url");
        console.error(
          `[HTTP ${httpResponse.statusCode}] Error on ${request.method} ${sanitizedUrl}:`,
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
