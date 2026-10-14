import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { validateDiscoveryTestUrl } from "../helpers/isolated-discovery-db";

async function main() {
  const target = process.env.DISCOVERY_TEST_DATABASE_URL;
  if (!target) {
    console.log("NOT TESTED: no dedicated test database; no report generated.");
    return;
  }
  validateDiscoveryTestUrl(target);
  // Load application modules only after guarding the disposable target.
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: target,
    JWT_SECRET: "benchmark-local-only",
    APP_URL: "http://localhost:3333",
    RESEND_API_KEY: "re_test_dummy_key",
    EMAIL_FROM: "Benchmark <noreply@example.com>",
  });
  const { runProximityBenchmark } = await import(
    "./discovery-group1-benchmark.js"
  );
  const result = await runProximityBenchmark();
  if (!result) {
    throw new Error("Benchmark did not execute");
  }

  const dateIso = new Date().toISOString();
  const outputPath = resolve(
    "docs/benchmarks/discovery-group1-benchmark-2026-10-14.md",
  );
  const status = result.passed ? "APROVADO" : "REPROVADO";

  const markdown = `# Evidências Reproduzíveis de Desempenho e EXPLAIN — Grupo 1

**Data:** ${dateIso.slice(0, 10)}
**Horário da Execução:** ${dateIso}
**Ambiente medido:** ${result.environment.platform}/${result.environment.arch}, Node.js ${result.environment.node}, ${result.environment.postgres}
**Banco de Dados Isolado:** descartável via schema dedicado
**Volume Sintético:** ${result.totalUnits.toLocaleString("pt-BR")} unidades determinísticas (Seed: 42)
**Orçamento Local Aprovado (Meta):** SQL Total $\\le 200\\text{ ms}$
**Resultado desta execução:** ${status}.

Critério: volume verificado de 10.000 unidades, dez amostras válidas, respostas coerentes com a página consultada e todas as somas COUNT + Items <=200ms. Falha ou orçamento excedido resulta em saída não zero. Ausência da variável produz NOT TESTED, sem novo relatório.
Tempos COUNT/Items incluem driver e ida/volta; execução interna PostgreSQL está nos planos EXPLAIN capturados durante aquecimento. repo.search inclui compilação/mapeamento e é separado da soma. HTTP inclui saúde, leitura e validação completa do JSON. Séries SQL e HTTP são independentes; não se deriva overhead subtraindo medianas. Não se infere Docker nem SLA de produção.

---

## 1. Distribuição Sintética do Volume (10.000 Unidades)

As 10.000 unidades foram distribuídas deterministicamente em torno do centro de referência (Praça da Sé, São Paulo: lat \`-23.55052\`, lon \`-46.633308\`) com gerador pseudo-aleatório congruente linear (LCG, semente \`42\`):
- **9.500 unidades:** \`ACTIVE\`, \`status = 'CONFIRMED'\`, \`source = 'MANUAL'\`, \`valid_until = NOW() + 20 dias\`.
- **300 unidades:** \`INACTIVE\` (para testar exclusão pré-cálculo de inativos).
- **100 unidades:** \`status = 'CONFIRMED'\`, \`source = 'GOOGLE'\`, com expiração vencida (\`acquired_at = NOW() - 30 dias\`, \`valid_until = NOW() - 5 dias\`).
- **100 unidades:** \`status = 'UNCONFIRMED'\`, coordenadas \`NULL\`.
- **Saúde da Manutenção:** 1 registro em \`location_maintenance_health\` (\`component = 'google_maps_cache'\`, \`is_healthy = true\`, \`last_heartbeat_at = NOW()\`).

---

## 2. Medições Estatísticas (Série de 10 Amostras após 3 Aquecimentos)

### Resumo Executivo das Métricas

| Métrica | Mínimo | Mediana | Média | Máximo | Orçamento Local | Status |
|---|---|---|---|---|---|---|
| **SQL COUNT (ms)** | ${result.sqlCountStats.min.toFixed(2)} ms | ${result.sqlCountStats.median.toFixed(2)} ms | ${result.sqlCountStats.mean.toFixed(2)} ms | ${result.sqlCountStats.max.toFixed(2)} ms | — | Informativo |
| **SQL Items (ms)** | ${result.sqlItemsStats.min.toFixed(2)} ms | ${result.sqlItemsStats.median.toFixed(2)} ms | ${result.sqlItemsStats.mean.toFixed(2)} ms | ${result.sqlItemsStats.max.toFixed(2)} ms | — | Informativo |
| **SQL Total (COUNT + Items)** | **${result.sqlTotalStats.min.toFixed(2)} ms** | **${result.sqlTotalStats.median.toFixed(2)} ms** | **${result.sqlTotalStats.mean.toFixed(2)} ms** | **${result.sqlTotalStats.max.toFixed(2)} ms** | **$\\le 200\\text{ ms}$** | **${status}** |
| **repo.search completo** | ${result.repositoryStats.min.toFixed(2)} ms | ${result.repositoryStats.median.toFixed(2)} ms | ${result.repositoryStats.mean.toFixed(2)} ms | ${result.repositoryStats.max.toFixed(2)} ms | — | Informativo |
| **HTTP com JSON consumido e validado** | **${result.httpStats.min.toFixed(2)} ms** | **${result.httpStats.median.toFixed(2)} ms** | **${result.httpStats.mean.toFixed(2)} ms** | **${result.httpStats.max.toFixed(2)} ms** | — | Evidência Separada |

### Tabela Detalhada das 10 Amostras

| Iteração | SQL COUNT (ms) | SQL Items (ms) | Soma (ms) | repo.search (ms) | HTTP completo (ms) |
|:---:|:---:|:---:|:---:|:---:|:---:|
${result.samples
  .map(
    (s) =>
      `| #${s.iteration} | ${s.sqlCountMs.toFixed(2)} | ${s.sqlItemsMs.toFixed(2)} | ${s.sqlTotalMs.toFixed(2)} | ${s.repositoryTotalMs.toFixed(2)} | ${s.httpTotalMs.toFixed(2)} |`,
  )
  .join("\n")}

*Condições de cache: Shared buffers do PostgreSQL quentes após 3 iterações de aquecimento; conexões reutilizadas via pool isolado.*

---

## 3. EXPLAIN (ANALYZE, BUFFERS, VERBOSE) Bruto da Consulta COUNT

Abaixo está o plano de execução real e integral emitido pelo PostgreSQL para a contagem total de unidades elegíveis dentro do raio de 10 km:

\`\`\`text
${result.sqlCountPlan}
\`\`\`

---

## 4. EXPLAIN (ANALYZE, BUFFERS, VERBOSE) Bruto da Consulta de Items

Abaixo está o plano de execução real e integral emitido pelo PostgreSQL para a seleção paginada dos 20 itens mais próximos (com cálculo esférico Haversine e ordenação determinística \`distance_meters ASC, b.id ASC\`):

\`\`\`text
${result.sqlItemsPlan}
\`\`\`

---

## 5. SQL e parâmetros sintéticos capturados

COUNT e Items emitidos pelo repositório:
\`\`\`json
${JSON.stringify(result.queries, null, 2)}
\`\`\`

## 6. Procedimento de Reprodução

Para reproduzir este benchmark no ambiente local:

\`\`\`powershell
# Configurar DISCOVERY_TEST_DATABASE_URL com banco local sb_discovery_test_*
# previamente validado. Não publicar URL ou credenciais nas evidências.

# 2. Executar o benchmark
npx --no-install tsx test/benchmark/run-benchmark.ts
\`\`\`
`;

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath.replace(/\.md$/, ".json"),
    JSON.stringify({ measuredAt: dateIso, ...result }, null, 2),
    "utf-8",
  );
  await writeFile(outputPath, markdown, "utf-8");
  console.log(
    `[Benchmark] Successfully written benchmark report to ${outputPath}`,
  );
  console.log(
    JSON.stringify({
      status,
      sql: result.sqlTotalStats,
      repository: result.repositoryStats,
      http: result.httpStats,
    }),
  );
  if (!result.passed) process.exitCode = 1;
}

main().catch(() => {
  console.error(
    "Benchmark failed; check the dedicated local target and fixtures. No approval issued.",
  );
  process.exitCode = 1;
});
