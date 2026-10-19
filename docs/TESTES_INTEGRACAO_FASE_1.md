# Testes isolados da Fase 1

A suíte `src/infra/http/phase1-six-corrections.integration.spec.ts` exige opt-in por `PHASE1_TEST_DATABASE_URL`. Ela não usa `DATABASE_URL` como destino de teste.

## Sem opt-in

Sem `PHASE1_TEST_DATABASE_URL`, os testes PostgreSQL dessa suíte são ignorados. A aplicação HTTP não é carregada. O módulo de banco da aplicação é interceptado antes dos imports e só recebe um banco depois de o isolamento concluir.

```powershell
Remove-Item Env:PHASE1_TEST_DATABASE_URL -ErrorAction SilentlyContinue
node node_modules/vitest/vitest.mjs run test/helpers/isolated-phase1-db.spec.ts src/infra/http/phase1-six-corrections.integration.spec.ts
```

Os testes do guard executam normalmente. SKIP da integração não é homologação PostgreSQL.

## Com PostgreSQL local

Provisione um banco-base local exclusivo com nome `sb_phase1_test_*` e uma conta local de testes com permissão de criar bancos. Configure a URL por variável de ambiente, sem registrá-la em documentação, logs ou commits. URLs remotas, outros nomes, query e fragmento são recusados antes de qualquer conexão.

```powershell
$env:NODE_ENV = 'test'
$env:DATABASE_URL = 'postgresql://invalid:invalid@127.0.0.1:9/blocked'
# Configure PHASE1_TEST_DATABASE_URL com a URL do banco-base local autorizado.
node node_modules/vitest/vitest.mjs run test/helpers/isolated-phase1-db.spec.ts src/infra/http/phase1-six-corrections.integration.spec.ts
```

O helper verifica a identidade do banco-base e cria outro banco, com UUID, para cada execução. Aplica o schema canônico usando o Drizzle Kit instalado, sem reinstalar dependências ou manter um DDL paralelo. A aplicação usa o Drizzle e as transações reais nesse banco exclusivo. O banco-base não recebe fixtures ou migrations.

Ao terminar, a suíte fecha o servidor e o pool e remove somente o banco gerado pelo helper. Falhas de limpeza não são ignoradas. O bootstrap tem limite próprio de 90 segundos para schema e carregamento frio da aplicação; operações PostgreSQL usam `lock_timeout=3000` e `statement_timeout=10000`. Isso permite detectar regressões de lock sem aumentar o tempo limite das requisições para escondê-las.

As duas chaves Google ficam vazias durante a execução. O cenário de indisponibilidade não consulta o provedor externo. Não há seed, envio real de e-mail ou configuração de produção necessária.

Os alvos locais e o opt-in são específicos desta suíte. Isso não torna automaticamente seguras as outras suítes legadas da API; a execução completa continua exigindo revisão e isolamento próprios.

## Contratos corrigidos

- Criar, alterar e excluir exceções compartilham a transação do lock da unidade nas leituras e nas gravações. Uma falha após INSERT provoca rollback.
- `view=upcoming` considera início futuro ou fim conhecido posterior ao relógio da consulta, com status elegível. Início passado com fim desconhecido não ganha duração presumida de 30 ou 60 minutos e continua disponível no histórico.
- Reservas futuras com preço/duração/fim desconhecidos continuam elegíveis quando seu início é conhecido; os valores nulos são preservados.
- Seleção de IDs e projeção do próximo atendimento usam uma transação somente leitura com isolamento `repeatable read`. Uma mudança concorrente aparece na próxima consulta, sem misturar snapshots na resposta atual.
