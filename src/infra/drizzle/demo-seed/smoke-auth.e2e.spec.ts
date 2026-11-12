import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import app from "../../../app";
import { db } from "../index";
import { users } from "../schema";
import { eq, inArray } from "drizzle-orm";
import { DEMO_CUSTOMERS, DEMO_STAFFS } from "./fixtures";
import { Password } from "../../../domain/enterprise/entities/value-objects/password";

const fixturePassword = "Fixture-only-password-123!";
const authStaffs = DEMO_STAFFS.map((staff, index) => ({
  ...staff,
  id: randomUUID(),
  name: `Synthetic staff ${index}`,
  email: `staff-${randomUUID()}@example.invalid`,
  cpf: randomUUID(),
}));
const authCustomers = DEMO_CUSTOMERS.map((customer, index) => ({
  ...customer,
  id: randomUUID(),
  name: `Synthetic customer ${index}`,
  email: `customer-${randomUUID()}@example.invalid`,
  cpf: randomUUID(),
  password: fixturePassword,
}));

describe("Smoke HTTP Auth — Fixtures locais e Verificação", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Fixtures own their accounts; tests never read a private seed credential file.
    const hash = await Password.generateHashFromPlainText(fixturePassword, 10);
    await db
      .insert(users)
      .values(
        [...authStaffs, ...authCustomers].map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          cpf: user.cpf,
          password: hash.value,
          emailVerifiedAt: new Date(),
          accountType: "CLIENT" as const,
        })),
      );

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
    await db.delete(users).where(
      inArray(
        users.id,
        [...authStaffs, ...authCustomers].map((user) => user.id),
      ),
    );
    if (server) {
      await new Promise<void>((resolvePromise) =>
        server.close(() => resolvePromise()),
      );
    }
  });

  it("deve permitir login com sucesso para os 8 staffs gerenciados pelo seed", async () => {
    for (const staff of authStaffs) {
      const password = fixturePassword;

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
    for (const customer of authCustomers) {
      const res = await fetch(`${baseUrl}/api/users/sessions/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customer.email,
          password: customer.password,
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
        email: authStaffs[0].email,
        password: "senha-completamente-errada-9999",
      }),
    });

    expect(res.status).toBe(401);
  });
});
