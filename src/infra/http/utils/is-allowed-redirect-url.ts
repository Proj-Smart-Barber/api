import { env } from "../../env";

/**
 * Whitelist de URLs de retorno (callbackURL/redirectTo) aceitas nos e-mails de
 * confirmação e recuperação: caminhos relativos do web, a origem de APP_URL e
 * o deep link do app (APP_SCHEME://...). Impede open redirect.
 */
export function isAllowedRedirectUrl(url: string): boolean {
  if (url.startsWith("/")) {
    // Relativo, mas nunca protocol-relative ("//evil.com").
    return !url.startsWith("//");
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol === `${env.APP_SCHEME}:`) return true;

    return parsed.origin === new URL(env.APP_URL).origin;
  } catch {
    return false;
  }
}
