import type { HttpResponse } from "./http-response";

/**
 * Contexto da requisição repassado como segundo argumento do `handle`.
 * Os controllers de sessão usam `headers` (Cookie/Bearer) para falar com o
 * better-auth — fica fora do payload para não poluir os schemas de entrada.
 */
export interface ControllerContext {
  headers: Record<string, string | string[] | undefined>;
}

export interface Controller<T = any> {
  handle(request: T, context?: ControllerContext): Promise<HttpResponse>;
}
