import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import app from "../../../app";
import { db } from "../index";
import { users } from "../schema";
import { eq } from "drizzle-orm";
import { DEMO_CUSTOMERS, DEMO_STAFFS } from "./fixtures";
import { Password } from "../../../domain/enterprise/entities/value-objects/password";

describe("Smoke HTTP Auth — Contas Seed e Verificação", () => {
  let server: Server;
  let baseUrl: string;
  let staffCredentials: Record<string, { plainPassword: string }> = {};

  beforeAll(async () => {
    // Carrega credenciais fortes se existirem em disco
    const credsPath = resolve(process.cwd(), ".demo-seed-credentials.json");
    if (existsSync(credsPath)) {
      try {
        staffCredentials = JSON.parse(readFileSync(credsPath, "utf-8"));
      } catch {
        // Fallback
      }
    }

    await new Promise<void>((resolvePromise) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://localhost:${address.port}`;
        }
        resolvePromise();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolvePromise) =>
        server.close(() => resolvePromise()),
      );
    }
  });

  it("deve permitir login com sucesso para os 8 staffs gerenciados pelo seed", async () => {
    for (const staff of DEMO_STAFFS) {
      const password =
        staffCredentials[staff.logicalKey]?.plainPassword || "123456";

      const res = await fetch(`${baseUrl}/api/users/sessions/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: staff.email,
          password,
        }),
      });

      expect(
        res.status,
        `Staff ${staff.email} deve autenticar com sucesso (201/200). Recebeu status ${res.status}`,
      ).toBe(201);

      const body = (await res.json()) as any;
      expect(body.access_token).toBeDefined();
      expect(typeof body.access_token).toBe("string");
      expect(body.refresh_token).toBeDefined();
    }
  }, 20000);

  it("deve permitir login com sucesso para os 12 clientes gerenciados pelo seed", async () => {
    for (const customer of DEMO_CUSTOMERS) {
      const res = await fetch(`${baseUrl}/api/users/sessions/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customer.email,
          password: "DemoCustomerSecret2026!#",
        }),
      });

      expect(
        res.status,
        `Cliente ${customer.email} deve autenticar com sucesso (201/200). Recebeu status ${res.status}`,
      ).toBe(201);

      const body = (await res.json()) as any;
      expect(body.access_token).toBeDefined();
      expect(typeof body.access_token).toBe("string");
      expect(body.refresh_token).toBeDefined();
    }
  }, 25000);

  it("deve retornar 403 email_not_verified para conta real/externa com emailVerifiedAt nulo", async () => {
    const unverifiedEmail = "usuario.real.pendente@gmail.com";
    const unverifiedCpf = "99988877714";
    await db.delete(users).where(eq(users.email, unverifiedEmail));

    const testHash = await Password.generateHashFromPlainText(
      "MinhaSenhaForte123!",
      10,
    );
    await db.insert(users).values({
      name: "Usuario Real Nao Verificado",
      email: unverifiedEmail,
      cpf: unverifiedCpf,
      password: testHash.value,
      emailVerifiedAt: null, // Verificação pendente!
    });

    const res = await fetch(`${baseUrl}/api/users/sessions/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: unverifiedEmail,
        password: "MinhaSenhaForte123!",
      }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error || body.message).toMatch(/email_not_verified|verifi/i);

    // Limpeza
    await db.delete(users).where(eq(users.email, unverifiedEmail));
  });

  it("deve retornar 401 para credenciais incorretas", async () => {
    const res = await fetch(`${baseUrl}/api/users/sessions/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: DEMO_STAFFS[0].email,
        password: "senha-completamente-errada-9999",
      }),
    });

    expect(res.status).toBe(401);
  });
});
