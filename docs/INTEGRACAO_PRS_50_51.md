# Consolidação dos PRs50 e51 — 13/10/2026

O PR51 incorpora o histórico do [PR50, do Jhon](https://github.com/Proj-Smart-Barber/api/pull/50), preservando seus commits/autoria. A entrega canônica continua no [PR51](https://github.com/Proj-Smart-Barber/api/pull/51). O frontend correspondente [PR30](https://github.com/Proj-Smart-Barber/Smart-Barber-frontend-mobile-web/pull/30) já foi mergeado; sua árvore src é igual à usada na validação.

## Contribuição aproveitada

- NotifyBookingEventUseCase, DTO e teste do PR50 foram adaptados para createManyWithTx. Cancelamento e remarcação chamam o mesmo helper dentro da transação que grava a reserva e o evento.
- Mantida a formatação da data civil em UTC e a deduplicação de cliente/profissional/proprietário. O profissional anterior também recebe aviso em transferência. A lista inclui o autor quando ele também é destinatário; duplicação de papéis gera somente um aviso por pessoa.
- O evento de remarcação é BOOKING_RESCHEDULED; cancelamento é BOOKING_CANCELLED. Não são emitidos dois tipos para a mesma remarcação. Horário/instantes/version/snapshots continuam atualizados pelo método de domínio reschedule.
- A fixture futura do teste de cancelamento foi aproveitada e o teste passou a verificar os três destinatários, tipo e referência da notificação.
- Retirados da árvore final os setters independentes e os arquivos, rota e Swagger da implementação legada /update. O histórico original permanece recuperável nos commits do Jhon. Não há consumidor identificado que precise dessa rota; o frontend já usa /reschedule.
- Não introduzida interface createMany sem transação. Produção usa os factories com BarbershopsRepository para incluir ownerId real; helper não fabrica destinatários.

## Contratos e testes

As alterações continuam exigindo Idempotency-Key UUIDv7 e expectedVersion. /reschedule aplica vínculo ACTIVE, estados terminais, prazos, fuso, duração/preço dos serviços, locks e ledger. Falha ao gravar notificações reverte reserva, evento e avisos. Replay da mesma chave não incrementa novamente a versão nem duplica avisos.

| Evidência | Resultado |
| --- | --- |
| Suíte completa da API com PostgreSQL temporário real | PASS:69arquivos/316testes |
| HTTP de ações incluído nessa suíte | PASS:17testes |
| Regressões novas HTTP | /update404, ausência de key/version400, estados terminais409, vínculo INACTIVE403, prazo pessoal409, edições simultâneas200/409 com único evento, duração derivada dos serviços, rollback de cancel/remarcação ao falhar notificação |
| Replay e notificações | Exatamente3destinatários cliente/profissional/owner após primeira execução e replay; data civil correta; start/end instantes coerentes com São Paulo |
| TypeScript | PASS, exit0 |
| Testes finais do helper/cancelamento após melhoria das asserções | PASS:3arquivos/9testes; não foi repetida a suíte completa após essa alteração apenas no teste |
| Chrome headless com API/PostgreSQL locais | PASS:OWNER1280px e BARBER390px login/Atendimentos/reload; CLIENT390px/UTC reserva dois serviços, PATCH mantendo ID sem outro POST, DELETE lógico e avisos de remarcação/cancelamento visíveis |
| Produção/dispositivos Android e iOS | NOT TESTED nesta execução |

O PostgreSQL pertence exclusivamente a esta validação, com banco temporário exclusivo e contas fictícias. A porta anterior foi bloqueada pelo Windows; o mesmo cluster foi iniciado em outra porta localhost, sem alteração de configuração de produção. Scripts, logs e credenciais de teste não fazem parte do PR. A preparação inicial de navegador usou um diretório incorreto; o ambiente foi corrigido e o fluxo completo passou, sem alterar código de autenticação.

## Revisão e encerramento

Esta entrega substitui funcionalmente o PR50. Revisar novamente o PR51, inclusive a contribuição incorporada, e aguardar os checks. O PR50 fica aberto durante a revisão; após o merge do PR51, encerrá-lo como incorporado, com reconhecimento da autoria do Jhon. Não fazer merge separado do PR50 atual: ele reintroduziria /update.

Não foi realizado merge em main ou deploy de produção. A aprovação e a publicação dependem da revisão humana; o frontend30 já mergeado deve ser usado no teste de produção após a publicação da API. A trilha detalhada de eventos na UI continua sujeita ao seu contrato próprio, fora desta consolidação.
