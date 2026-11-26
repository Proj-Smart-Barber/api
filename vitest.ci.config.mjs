import { defineConfig } from "vitest/config";

/**
 * Suite de CI: testes unitários com repositórios em memória.
 * Não depende de PostgreSQL, storage externo nem rede.
 */
// As regras de agenda usam o fuso da barbearia (America/Sao_Paulo); os testes
// constroem datas no fuso local, então o fuso do processo é fixado aqui para
// que o resultado seja o mesmo na máquina do desenvolvedor e no runner (UTC).
process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: [],
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://ci:ci@127.0.0.1:9/ci_offline",
      JWT_SECRET: process.env.JWT_SECRET || "smartbarber-ci-test-secret",
      RESEND_API_KEY: process.env.RESEND_API_KEY || "re_test_dummy_key",
      EMAIL_FROM: "SmartBarber <noreply@smartbarber.dev>",
      APP_URL: process.env.APP_URL || "http://localhost:3333",
      FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:8081",
    },
    include: [
      "src/domain/application/use-cases/**/*.spec.ts",
      "src/domain/enterprise/**/*.spec.ts",
      "src/infra/email/**/*.spec.tsx",
    ],
    exclude: ["**/node_modules/**", "**/*.audit.spec.ts", "**/*.integration.spec.ts", "**/*.e2e.spec.ts"],
  },
});
