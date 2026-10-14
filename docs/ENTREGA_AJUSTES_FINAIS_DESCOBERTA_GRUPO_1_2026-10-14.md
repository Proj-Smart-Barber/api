# Ajustes finais — Grupo 1 de descoberta e geolocalização

Data: 2026-10-14. **Status: concluído e validado localmente; pronto para avançar ao Grupo 2 (T3/T4).**

Worktree: `D:/smart_barber/Smart-Barber-frontend-mobile-web/.tmp/api-discovery`, branch `feat/discovery-api`, HEAD preservado `e9d2d83`. Todas as correções permanecem no working tree. Nenhum novo commit, push, PR, merge ou deploy foi realizado. O checkout original e o trabalho anterior foram preservados.

## Resolução dos três pontos da revisão final

| Ponto | Alteração | Evidência | Resultado |
| --- | --- | --- | --- |
| Runner e medições | Runner valida alvo antes de carregar módulos do DB, prepara runtime sintético local e retorna erro não zero. Aprovação depende de volume, dez amostras válidas e todas as somas COUNT+Items <=200ms. HTTP consome e valida JSON/status/headers; soma de consultas e tempo do repositório são métricas distintas. | Runner executado nos cenários ausente, inseguro e válido; três novos testes de aceitação e resposta HTTP. | PASS |
| Testes declarados | Ponto externo usa 60.000m e sua inclusão não altera items/total/hasNext de 50km. Saúde usa uma conexão/transação, NOW fixo e verifica exatamente 36h e ±1 microssegundo, com rollback. | 22 regressões reais de PostgreSQL passando. | PASS |
| Handoff e relatórios | LocationState copiado da fonte com point e datas string; dados históricos rotulados; amostras manuais divergentes substituídas por referência a MD/JSON gerados juntos. Avisos incluem arquivos de produção; geocodificação comercial preserva o fluxo aprovado. | Documentos retificados e benchmark gerado pela ferramenta, sem tabela manual duplicada. | PASS |

Arquivos desta intervenção: `test/discovery-group1-regressions.spec.ts`, `test/benchmark/discovery-group1-benchmark.ts`, `test/benchmark/run-benchmark.ts`, novos `test/benchmark/benchmark-policy.ts` e `.spec.ts`, relatórios e evidências. As quatro correções funcionais anteriores foram mantidas.

## Verificação final

- **Vitest: 7 arquivos / 77 testes PASS, 0 falhas, 0 skips** com banco dedicado. Inclui 22 regressões, 23 HTTP/integração, 9 schema, 20 unitários existentes e 3 novos testes do benchmark.
- Sem variável: runner retorna **NOT TESTED/saída 0**, sem gerar relatório novo; suíte de regressões retorna **22 skips intencionais/saída 0**.
- Alvo inseguro `remote.invalid`: guarda recusa antes de conexão; runner retorna **saída 1**, sem aprovação.
- TypeScript: `npx tsc --noEmit`, **saída 0**.
- Biome nos 14 arquivos TS alterados/novos: **0 erros, 41 avisos noExplicitAny**. Há avisos em adapter, controller e repositório de produção, além de testes/benchmark. Nenhum aviso foi apresentado como erro ou como ausência de avisos.
- `git diff --check`: **saída 0**. Avisos de conversão LF/CRLF do Git não são falhas de whitespace.

Banco de integração: PostgreSQL local `sb_discovery_test_main` em loopback porta 5433, guardado por DISCOVERY_TEST_DATABASE_URL. Fixtures criam/removem apenas schemas próprios. Testes não usaram banco do produto, serviço Google ou configuração paga.

### Comando da suíte validada

Na worktree da API, com variável dedicada previamente configurada:

```powershell
npx vitest run test/helpers/isolated-discovery-db.spec.ts src/domain/application/use-cases/barbershop/search-barbershops/search-barbershops.spec.ts src/infra/http/controllers/barbershop/search-barbershops.controller.spec.ts src/infra/drizzle/discovery-schema.integration.spec.ts src/infra/http/discovery.integration.spec.ts test/discovery-group1-regressions.spec.ts test/benchmark/benchmark-policy.spec.ts
npx tsc --noEmit
git diff --check
```

## Desempenho da versão final

Carga determinística de **10.000 unidades**, semente 42, IDs fixos, três aquecimentos e dez amostras por série. Saída do runner: **APROVADO/0**, com respostas completas validadas.

| Medição local (ms) | Mediana | Máximo |
| --- | ---: | ---: |
| Soma COUNT + Items, incluindo driver e ida/volta | 8,98 | 11,12 |
| repo.search completo | 9,20 | 11,37 |
| HTTP incluindo leitura e validação do JSON | 13,82 | 15,32 |

Todas as somas ficaram <=200ms. Meta de laboratório, não SLA de produção. Séries independentes não permitem calcular overhead pela subtração de medianas. EXPLAIN registra tempos internos do PostgreSQL separadamente. Ambiente real foi consultado, sem presumir Docker ou versão fixa.

Evidências atuais, geradas na mesma execução:

- [Benchmark, SQL/parâmetros sintéticos e planos brutos](benchmarks/discovery-group1-benchmark-2026-10-14.md).
- [JSON de amostras e planos da mesma execução](benchmarks/discovery-group1-benchmark-2026-10-14.json).

Reprodução usando dependência instalada:

```powershell
npx --no-install tsx test/benchmark/run-benchmark.ts
```

O runner exige a variável dedicada, não publica URL/credenciais nas evidências e não migra o banco do produto. Ausência não deve ser confundida com execução aprovada; erro ou orçamento excedido produz saída não zero.

## Contrato para os próximos grupos

A fonte canônica é `src/domain/application/services/discovery-contract.ts` da API:

```typescript
export type LocationState = {
  shopId: string;
  address: string;
  status: LocationStatus;
  source: LocationSource;
  version: number;
  point: GeoPoint | null;
  confirmedAt: string | null;
  acquiredAt: string | null;
  validUntil: string | null;
  lastOwnerMutation: LastOwnerMutation | null;
};
```

PublicShop e SetLocationCommand não ganharam source para justificar documentação antiga. Regras de negócio, fronteira de 36h e elegibilidade Google de 25 dias foram preservadas.

Não há pendência material identificada nos ajustes solicitados. Próximo checkpoint: Grupo 2, T3 adaptadores de mapa/posição e T4 geocodificação de endereço comercial/candidatos, conforme plano aprovado. Nenhuma dessas tarefas foi iniciada nesta intervenção. Esta entrega não constitui homologação Google real, visual, nativa ou de produção.
