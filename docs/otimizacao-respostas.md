# Contratos de otimização de respostas

Implementação local de 11/11/2026. Publicação e alterações em banco compartilhado exigem autorização específica.

## Reservas

`GET /api/barbershops/:shopId/bookings` mantém o contrato padrão de lista, total e resumo. A autorização por vínculo/papel permanece no servidor. Datas civis usam o fuso real da unidade; registros sem `starts_at` continuam no caminho legado.

Opções aditivas:

- `bootstrapOnly=true`: devolve relógio/contexto autorizado sem ler reservas. Itens vazios; `totalIsExact=false`; não devolve resumo.
- `includeSummary=false`: usa página com um item adicional para `hasNext`. Não devolve resumo; `total` é apenas limite inferior, marcado por `totalIsExact=false`. Clientes devem conservar o total exato da primeira página, em vez de substituir esse total pelo limite inferior.
- Sem essas opções, total/resumo continuam exatos para o filtro. Relações de uma página são buscadas em lote, preservando snapshots históricos e legado.

`GET /api/bookings/me` tem ordenação determinística e inclui registros modernos e legados. A consulta de próximo horário conserva snapshot transacional. Paginação pessoal continua por página/offset; cursor de notificações e cursor de Explorar têm contratos próprios.

## Financeiro

`GET /api/barbershops/:shopId/finance` aceita mês ou intervalo de até 366 dias. O resumo é agregado no PostgreSQL e continua distinguindo previsão, conclusão, recebimento, vencimento e pagamento. Valores desconhecidos permanecem identificados; somas são verificadas contra inteiro seguro.

Novo parâmetro `view`:

- `summary`: resumo e série diária, com arrays de lançamentos/atendimentos vazios.
- `entries`: despesas paginadas com `entriesPage` e `entriesLimit` (padrão 30, máximo 200).
- `bookings`: atendimentos paginados com `bookingsPage` e `bookingsLimit` (padrão 30, máximo 200).
- `all`, também usado na ausência de `view`: mantém a resposta de compatibilidade dos clientes anteriores. Pode devolver todas as listas do intervalo quando limites não forem enviados. O aplicativo atualizado usa as views limitadas. A retirada do modo legado exige uma transição de contrato separada.

As views acrescentam metadados de total/página/limite para cada seção. Resumo e página usam uma transação curta com autoridade verificada/bloqueada antes das leituras. As operações de escrita mantêm versão e idempotência.

## Cache e observabilidade

Respostas privadas, operações e disponibilidade usam `Cache-Control: no-store`. O cache HTTP público de catálogo só é habilitado explicitamente com `ENABLE_PUBLIC_HTTP_CACHE=true`, para rotas públicas elegíveis sem bearer/cookie. Falhas não recebem a política pública.

`ENABLE_REQUEST_METRICS=true` habilita instrumentação em produção. Desenvolvimento/teste mantêm as métricas locais. Cabeçalhos incluem correlação gerada pelo servidor, quantidade SQL e durações. Fingerprints são hashes; parâmetros não são registrados. A duração somada de comandos SQL pode superar o tempo HTTP quando há paralelismo. `lock_query` mede a duração do comando com lock, não o tempo isolado de espera por lock.

`FF_SQL_BOOKING_BATCH_HYDRATION=false` desativa a hidratação em lote para diagnóstico/rollback desse caminho. O restante das mudanças SQL tem rollback por versão compatível da aplicação. Evitou-se manter duas implementações financeiras de produção, que poderiam divergir nas regras de saldo/preço. A implantação deve ser dividida em entregas revisáveis.

## Schema e release

O identificador esperado é `2026-11-11-data-opt-v3`. Boot normal apenas verifica readiness; schema ausente/incompatível bloqueia tráfego com 503. `AUTO_RUN_MIGRATIONS=true` é um opt-in de compatibilidade, não o caminho recomendado de release.

Comandos novos:

- `npm run db:indexes:prepare`: valida definições/validade e prepara os quatro índices aprovados usando `CREATE INDEX CONCURRENTLY` fora de transação, numa conexão presa ao lock do runner.
- `npm run db:migrate:release`: exige `DATABASE_URL` explícita; usa lock transacional, aplica o schema e registra ledger somente se a transação concluir. Alvos compartilhados também exigem confirmação explícita do nome do banco e preparam índices concorrentes primeiro. Essa confirmação previne erro de destino; não substitui autorização operacional.
- `npm run db:prune:explore`: dry-run por padrão. `-- --apply` remove no máximo 500 snapshots já expirados, com `SKIP LOCKED`. Agendamento em infraestrutura permanece etapa de release autorizada.

Em banco local novo, bootstrap de tabelas com Drizzle e migrations deve usar somente banco descartável comprovado. O runner de release não é um comando para reconstruir bancos. Um alvo compartilhado com estrutura base ausente exige preparação/revisão própria.

Antes do rollout: verificar versão PostgreSQL/driver, região, orçamento de conexões, TLS, compatibilidade do app antigo e schema. Parâmetros `DB_POOL_MAX`, `DB_POOL_CONNECTION_TIMEOUT_MS`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_STATEMENT_TIMEOUT_MS`, `DB_LOCK_TIMEOUT_MS` e `DB_IDLE_IN_TX_TIMEOUT_MS` têm validação e limites. O tamanho padrão de pool de produção foi conservado em 10; isso não comprova dimensionamento adequado do provedor. Ajustes exigem medição externa.

## Índices aprovados e decisões

Foram mantidos os índices existentes e acrescentados quatro candidatos com benefício observado em massa sintética ampliada: jornada por unidade/dia/profissional; exceção por unidade/data/profissional; feed de notificações por usuário/data/ID; não lidas por usuário com índice parcial.

Os candidatos adicionais de membership por usuário, cliente/data/ID, carrinhos por usuário e unidade/profissional/data não foram promovidos. Os planos usados não mostraram redução suficiente de trabalho para justificar o custo de escrita. `index-assessment.json` registra os oito experimentos; seus dados ampliados são diferentes da massa usada no comparativo HTTP.

Nenhum índice foi criado em banco compartilhado. Redis, PostGIS, materialized views e ajustes de memória PostgreSQL não foram introduzidos sem necessidade demonstrada. A medição em produção continua necessária.

## Verificação reproduzível

A suíte usa bancos descartáveis exclusivos e helpers com verificação de identidade. Testes de equipe passaram a criar seu próprio banco; testes de autenticação possuem fixtures sintéticas e não dependem de arquivo privado de credenciais de seed. Suites opt-in de onboarding/rate-limit/promoção continuam exigindo seus destinos dedicados.

`scripts/benchmark-optimization.ts` fixa seu alvo na instância descartável de benchmark. `--phase=final --seed` recria exclusivamente a massa sintética desse alvo. Não aponta para serviços publicados. O primeiro request é warm-up do cenário; não é medição de cold start serverless.

`scripts/assess-optimization-indexes.ts` modifica temporariamente índices candidatos somente nesse banco de benchmark. É um experimento local, não um runner de migrations de produção. Preserve o arquivo de definições dos candidatos para repetir comparações após a seleção final.

Resultados integrados e limitações constam no relatório de execução entregue junto à auditoria do frontend.
