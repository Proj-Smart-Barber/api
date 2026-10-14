import { describe, expect, it } from "vitest";
import { hashToken } from "../../../core/crypto/token";
import {
  buildEmailVerificationUrl,
  createEmailVerificationToken,
} from "./email-verification-token-service";

describe("EmailVerificationTokenService", () => {
  it("deve criar token opaco com hash SHA-256 e TTL de 24 horas por padrão", () => {
    const issued = createEmailVerificationToken();

    expect(issued.plainToken).toBeDefined();
    expect(issued.plainToken.length).toBeGreaterThan(16);
    expect(issued.tokenHash).toBe(hashToken(issued.plainToken));
    expect(issued.expiresInHours).toBe(24);
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("deve construir URL segura de confirmação respeitando o path de EMAIL_VERIFICATION_URL", () => {
    const plainToken = "test-token-custom";
    const urlString = buildEmailVerificationUrl(plainToken, {
      baseUrl: "https://minhabarbearia.com.br/custom-verify-route",
      nodeEnv: "production",
    });

    const parsed = new URL(urlString);
    expect(parsed.protocol).toBe("https:");
    expect(parsed.host).toBe("minhabarbearia.com.br");
    expect(parsed.pathname).toBe("/custom-verify-route");
    expect(parsed.searchParams.get("token")).toBe(plainToken);
    expect(parsed.hash).toBe("");
  });

  it("deve construir URL com path padrão /verify-email quando a base for uma origem sem path específico", () => {
    const plainToken = "test-token-origin";
    const urlString = buildEmailVerificationUrl(plainToken, {
      baseUrl: "https://app.smartbarber.com.br",
      nodeEnv: "production",
    });

    const parsed = new URL(urlString);
    expect(parsed.pathname).toBe("/verify-email");
    expect(parsed.searchParams.get("token")).toBe(plainToken);
  });

  it("deve permitir HTTP em ambiente de desenvolvimento/teste local", () => {
    const plainToken = "test-token-local";
    const urlString = buildEmailVerificationUrl(plainToken, {
      baseUrl: "http://localhost:8081",
      nodeEnv: "development",
    });

    const parsed = new URL(urlString);
    expect(parsed.protocol).toBe("http:");
    expect(parsed.host).toBe("localhost:8081");
    expect(parsed.pathname).toBe("/verify-email");
    expect(parsed.searchParams.get("token")).toBe(plainToken);
  });

  it("deve rejeitar HTTP inseguro quando executando em produção", () => {
    const plainToken = "test-token-prod";

    expect(() =>
      buildEmailVerificationUrl(plainToken, {
        baseUrl: "http://insecure.smartbarber.com.br",
        nodeEnv: "production",
      }),
    ).toThrow(/Insecure HTTP protocol is not permitted/i);
  });

  it("deve rejeitar esquemas perigosos como javascript:, data: e file:", () => {
    const plainToken = "test-token-xss";

    expect(() =>
      buildEmailVerificationUrl(plainToken, {
        baseUrl: "javascript:alert(1)",
        nodeEnv: "development",
      }),
    ).toThrow(/Insecure or unsupported protocol/i);

    expect(() =>
      buildEmailVerificationUrl(plainToken, {
        baseUrl: "data:text/html,<html>",
        nodeEnv: "development",
      }),
    ).toThrow(/Insecure or unsupported protocol/i);

    expect(() =>
      buildEmailVerificationUrl(plainToken, {
        baseUrl: "file:///etc/passwd",
        nodeEnv: "development",
      }),
    ).toThrow(/Insecure or unsupported protocol/i);
  });

  it("deve rejeitar URLs com credenciais embutidas para evitar vazamentos e SSRF", () => {
    const plainToken = "test-token-cred";

    expect(() =>
      buildEmailVerificationUrl(plainToken, {
        baseUrl: "https://user:password@app.smartbarber.com.br",
        nodeEnv: "production",
      }),
    ).toThrow(/must not contain embedded user credentials/i);
  });

  it("deve lançar erro operacional claro quando nenhuma URL confiável de frontend estiver configurada", () => {
    const plainToken = "test-token-noconfig";

    expect(() =>
      buildEmailVerificationUrl(plainToken, {
        baseUrl: "",
        nodeEnv: "development",
      }),
    ).toThrow(/Frontend URL for email verification is not configured/i);
  });

  it("deve rejeitar HTTP para hosts remotos mesmo fora de produção (permitido apenas localhost)", () => {
    const plainToken = "test-token-remote-http";

    expect(() =>
      buildEmailVerificationUrl(plainToken, {
        baseUrl: "http://meusite.com.br/verify-email",
        nodeEnv: "development",
      }),
    ).toThrow(/Insecure HTTP protocol is not permitted for remote hosts/i);
  });

  it("deve remover parâmetros de query arbitrários da URL configurada, contendo exclusivamente o token", () => {
    const plainToken = "test-token-only";
    const urlString = buildEmailVerificationUrl(plainToken, {
      baseUrl: "https://app.smartbarber.com.br/verify-email?utm_source=spam&foo=bar#section",
      nodeEnv: "production",
    });

    const parsed = new URL(urlString);
    expect(parsed.searchParams.get("token")).toBe("test-token-only");
    expect(parsed.searchParams.get("utm_source")).toBeNull();
    expect(parsed.searchParams.get("foo")).toBeNull();
    expect(parsed.hash).toBe("");
    expect(Array.from(parsed.searchParams.keys())).toEqual(["token"]);
  });
});
