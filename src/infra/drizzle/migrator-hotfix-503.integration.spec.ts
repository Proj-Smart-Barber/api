import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { sql } from "drizzle-orm";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { db } from "./index";
import { runSchemaMigrations } from "./migrator";

interface PostgresLikeError {
  code?: string;
  message: string;
  cause?: {
    code?: string;
    message?: string;
  };
}

describe("Hotfix 503 & Startup Migration (PostgreSQL Isolated Regression)", () => {
  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL ?? "";
    if (
      !dbUrl.includes("55441") &&
      !dbUrl.includes("localhost") &&
      !dbUrl.includes("127.0.0.1")
    ) {
      throw new Error(
        `ABORT: Teste integrado exige PostgreSQL local isolado. URL atual: ${dbUrl}`,
      );
    }
  });

  it("comprova que a query antiga com dollar quoting incorreto falha no PostgreSQL com erro 42601", async () => {
    const invalidDollarQuotingQuery = sql`DO $ BEGIN
  CREATE TYPE "invitation_delivery_status_broken_probe" AS ENUM('PENDING', 'PROCESSING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $;`;

    let capturedError: PostgresLikeError | null = null;
    try {
      await db.execute(invalidDollarQuotingQuery);
    } catch (error) {
      capturedError = error as PostgresLikeError;
    }

    expect(capturedError).not.toBeNull();
    const pgCode = capturedError?.code ?? capturedError?.cause?.code;
    const errorMsg =
      capturedError?.cause?.message ?? capturedError?.message ?? "";
    // PostgreSQL error code 42601 = syntax_error
    expect(pgCode).toBe("42601");
    expect(errorMsg).toMatch(/syntax error at or near "\$"/i);
  });

  it("comprova que a query corrigida com dollar quoting duplo ($$) executa com sucesso e é idempotente", async () => {
    const fixedDollarQuotingQuery = sql`DO $$ BEGIN
  CREATE TYPE "invitation_delivery_status_fixed_probe" AS ENUM('PENDING', 'PROCESSING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;`;

    // Primeira execução deve ter sucesso
    await expect(db.execute(fixedDollarQuotingQuery)).resolves.not.toThrow();

    // Segunda execução imediata deve ter sucesso sem quebrar (WHEN duplicate_object THEN null)
    await expect(db.execute(fixedDollarQuotingQuery)).resolves.not.toThrow();

    // Limpeza da probe temporária
    await db.execute(
      sql`DROP TYPE IF EXISTS "invitation_delivery_status_fixed_probe";`,
    );
  });

  it("comprova que a execução completa de runSchemaMigrations() é idempotente", async () => {
    // 1ª Execução
    const firstRun = await runSchemaMigrations(db);
    expect(firstRun.success).toBe(true);

    // 2ª Execução consecutiva
    const secondRun = await runSchemaMigrations(db);
    expect(secondRun.success).toBe(true);
  });

  it("comprova que o enum invitation_delivery_status e a tabela invitation_deliveries existem com colunas e índices esperados", async () => {
    // 1. Verifica valores do enum invitation_delivery_status
    const enumResult = await db.execute<{ enumlabel: string }>(sql`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'invitation_delivery_status'
      ORDER BY e.enumsortorder;
    `);

    const enumRows = (enumResult.rows ?? enumResult) as unknown as Array<{
      enumlabel: string;
    }>;
    const enumValues = enumRows.map((r) => r.enumlabel);
    expect(enumValues).toEqual([
      "PENDING",
      "PROCESSING",
      "ACCEPTED",
      "FAILED",
      "REVOKED",
      "EXPIRED",
    ]);

    // 2. Verifica colunas da tabela invitation_deliveries
    const columnsResult = await db.execute<{ column_name: string }>(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'invitation_deliveries'
      ORDER BY ordinal_position;
    `);

    const columnRows = (columnsResult.rows ??
      columnsResult) as unknown as Array<{ column_name: string }>;
    const columnNames = columnRows.map((r) => r.column_name);
    expect(columnNames).toEqual(
      expect.arrayContaining([
        "id",
        "invitation_id",
        "barbershop_id",
        "recipient_email",
        "recipient_name",
        "barbershop_name",
        "owner_name",
        "token_hash",
        "invitation_url",
        "status",
        "attempts",
        "max_attempts",
        "next_attempt_at",
        "provider_message_id",
        "last_error",
        "locked_at",
        "locked_by",
        "processed_at",
        "created_at",
        "updated_at",
      ]),
    );

    // 3. Verifica índices
    const indexesResult = await db.execute<{ indexname: string }>(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'invitation_deliveries';
    `);

    const indexRows = (indexesResult.rows ??
      indexesResult) as unknown as Array<{ indexname: string }>;
    const indexNames = indexRows.map((r) => r.indexname);
    expect(indexNames).toContain("invitation_deliveries_status_idx");
    expect(indexNames).toContain("invitation_deliveries_invitation_idx");
  });

  describe("Trava de segurança de inicialização HTTP 503", () => {
    let server: Server | null = null;
    let baseUrl = "";

    afterEach(async () => {
      const activeServer = server;
      if (activeServer) {
        await new Promise<void>((resolve) =>
          activeServer.close(() => resolve()),
        );
        server = null;
      }
    });

    it("bloqueia com HTTP 503 quando a migration falha na inicialização", async () => {
      const app = express();
      const failedSchemaReady = Promise.reject(
        new Error('syntax error at or near "$"'),
      );
      failedSchemaReady.catch(() => {}); // evita PromiseRejectionHandledWarning em Node

      // Middleware exato utilizado em src/app.ts
      app.use(async (_request, response, next) => {
        try {
          const result = (await failedSchemaReady) as { success?: boolean };
          if (!result.success) {
            return response
              .status(503)
              .json({ error: "Serviço temporariamente indisponível." });
          }
          next();
        } catch {
          return response
            .status(503)
            .json({ error: "Serviço temporariamente indisponível." });
        }
      });

      app.get("/docs-json", (_req, res) => res.status(200).json({ ok: true }));
      app.get("/api/barbershops", (_req, res) =>
        res.status(200).json({ barbershops: [] }),
      );

      await new Promise<void>((resolve) => {
        const s = app.listen(0, "127.0.0.1", () => {
          server = s;
          const addr = s.address() as AddressInfo;
          baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });

      // Validar endpoint docs-json
      const docsRes = await fetch(`${baseUrl}/docs-json`);
      expect(docsRes.status).toBe(503);
      const docsBody = await docsRes.json();
      expect(docsBody).toEqual({
        error: "Serviço temporariamente indisponível.",
      });

      // Validar endpoint api/barbershops
      const apiRes = await fetch(`${baseUrl}/api/barbershops`);
      expect(apiRes.status).toBe(503);
      const apiBody = await apiRes.json();
      expect(apiBody).toEqual({
        error: "Serviço temporariamente indisponível.",
      });
    });

    it("libera requisições com HTTP 200 quando a migration conclui com sucesso", async () => {
      const app = express();
      const successfulSchemaReady = runSchemaMigrations(db);

      // Middleware exato utilizado em src/app.ts
      app.use(async (_request, response, next) => {
        try {
          const result = await successfulSchemaReady;
          if (!result.success) {
            return response
              .status(503)
              .json({ error: "Serviço temporariamente indisponível." });
          }
          next();
        } catch {
          return response
            .status(503)
            .json({ error: "Serviço temporariamente indisponível." });
        }
      });

      app.get("/docs-json", (_req, res) =>
        res.status(200).json({ openapi: "3.0.0", paths: {} }),
      );
      app.get("/api/barbershops", (_req, res) =>
        res.status(200).json({ barbershops: [] }),
      );

      await new Promise<void>((resolve) => {
        const s = app.listen(0, "127.0.0.1", () => {
          server = s;
          const addr = s.address() as AddressInfo;
          baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });

      // Validar endpoint docs-json
      const docsRes = await fetch(`${baseUrl}/docs-json`);
      expect(docsRes.status).toBe(200);
      const docsBody = await docsRes.json();
      expect(docsBody).toEqual({ openapi: "3.0.0", paths: {} });

      // Validar endpoint api/barbershops
      const apiRes = await fetch(`${baseUrl}/api/barbershops`);
      expect(apiRes.status).toBe(200);
      const apiBody = await apiRes.json();
      expect(apiBody).toEqual({ barbershops: [] });
    });
  });
});
