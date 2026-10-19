# Fase 1: jornadas, reservas e localização

## Resultado

- Jornada com estados INHERIT/CUSTOM/CLOSED, versão, escrita idempotente e conflitos tipados de horários/reservas.
- Disponibilidade, criação e remarcação validam jornada geral/individual, exceções e duração autoritativa dos serviços.
- Criação, edição e exclusão de exceções usam a mesma transação do lock da unidade.
- Localização comercial com candidatos Google efêmeros, autorização por unidade/onboarding, consumo único, CAS e rollback.
- Quota por pares exatos de janelas horária/diária, erros429/503 e ausência de coordenadas fictícias.
- Projeção do próximo atendimento preserva valores desconhecidos e usa um snapshot consistente, sem presumir duração para reserva passada sem fim conhecido.

## Verificação local de 19/10/2026

- Seleção dirigida:19 arquivos e115 testes aprovados, incluindo11 testes de HTTP/PostgreSQL real em bancos descartáveis.
- TypeScript: `npx tsc --noEmit --incremental false` aprovado.
- Sem opt-in:6 testes do guard aprovados e11 integrações explicitamente ignoradas.
- Alvo remoto: rejeitado antes da conexão. Ao final não ficaram bancos de teste gerados.
- A suíte backend completa não foi repetida; resultados antigos de538 testes não representam esta verificação.

O procedimento reproduzível, requisitos e limites estão em [TESTES_INTEGRACAO_FASE_1.md](TESTES_INTEGRACAO_FASE_1.md). Para repetir a seleção, configure o opt-in local conforme esse documento e execute:

```powershell
node node_modules/vitest/vitest.mjs run test/helpers/isolated-phase1-db.spec.ts src/domain/application/use-cases/schedule src/domain/application/use-cases/location src/domain/application/use-cases/booking/create-booking/create-booking.spec.ts src/infra/http/controllers/location src/infra/http/controllers/booking/fetch-my-bookings.controller.spec.ts src/infra/http/phase1-six-corrections.integration.spec.ts
```

## Integração e publicação

Há alterações aditivas de persistência em `schema.ts`/`migrator.ts`: escopos de jornada, recurso SCHEDULE e unicidade de escopo geral. A publicação deve contemplar essas alterações antes de habilitar o frontend dependente.

Google exige chave de servidor configurada; o endpoint de manutenção exige `CRON_SECRET`. A existência do endpoint não comprova agendamento do job. Google externo, cron publicado e produção não foram homologados nesta execução.

Não há mudanças de frontend/SDK/design nesta entrega. O ajuste incidental anterior de credenciais do seed permanece fora do PR. Merge, migração de produção e deploy continuam etapas separadas.
