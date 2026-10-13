# Contrato de reservas e publicação coordenada

As alterações DELETE /api/bookings/:id/cancel, PATCH /api/bookings/:id/reschedule e PATCH /api/bookings/:id/status exigem Idempotency-Key UUIDv7 e expectedVersion inteiro positivo. Não reutilizar uma chave com outro payload. Status aceita somente COMPLETED ou NO_SHOW. A criação mantém compatibilidade com a chamada legada sem chave; o consumidor novo utiliza o ledger.

slotStartAt, quando informado na criação/remarcação, deve ser um instante ISO com offset e corresponder a date/startTime no fuso IANA da unidade. O instante normalizado participa do hash, evitando replay de um horário diferente. O detalhe aceita scope PERSONAL ou UNIT; a leitura profissional exige vínculo ACTIVE e papel autorizado na unidade. CreatedByUserId não concede acesso pessoal ao agendamento de outro cliente.

Uma resposta perdida após commit não significa falha definitiva. O cliente conserva a chave, consulta a própria tentativa e somente descarta a referência após resultado autoritativo. APPLIED preserva o mesmo recurso; UNKNOWN e indisponibilidade não autorizam uma nova tentativa independente. A leitura do resultado revalida o acesso atual, inclusive quando o vínculo foi desativado.

## Compatibilidade e revisão

Esta entrega depende do frontend consolidado de reservas/Atendimentos. A interface anterior pode enviar alterações sem chave/versão: publicar apenas esta API bloquearia essas ações. Revisar ambos os PRs e combinar o corte de publicação ou uma janela de manutenção antes do merge/deploy automático. Nenhum merge ou deploy foi executado durante a validação.

Não há nova migração de esquema. Em NODE_ENV=test, preparar explicitamente o esquema antes da suíte: imports do app não executam DDL concorrente com fixtures. O comportamento de inicialização de produção foi preservado.

## Evidência local

Suíte completa: 67 arquivos / 300 testes passaram em PostgreSQL temporário isolado. Após acrescentar um cenário de payload/instante, os 8 testes HTTP de contrato passaram; TypeScript passou. A suíte completa não foi repetida após esse cenário adicional. O teste de rede encerra a conexão depois do commit e verifica GET/close APPLIED com o mesmo recurso.

Chrome headless com API/PostgreSQL reais e contas fictícias: OWNER e BARBER abrem/recarregam Atendimentos; CLIENT reserva dois serviços, remarca via PATCH mantendo o ID e cancela logicamente via DELETE, inclusive com navegador UTC. Produção e dispositivos Android/iOS não foram homologados nesta execução. Não versionar credenciais, logs ou scripts do ambiente temporário.
