# Financeiro do proprietário

## Contrato

O módulo registra controle financeiro por unidade. Os serviços concluídos e a previsão
dos agendados são apurados pela data civil do atendimento no fuso da unidade.
Recebimentos e despesas pagas compõem o caixa pela data do pagamento.
Os recebimentos são registrados explicitamente para cada atendimento COMPLETED,
com valor integral conhecido obtido do snapshot da reserva.

As despesas têm categoria FIXED, VARIABLE, BARBER_PAYOUT, PAYROLL ou OTHER.
Descrição, valor em centavos e vencimento são obrigatórios. Favorecido é opcional.
A cópia para o próximo mês preserva os dados e ajusta o dia ao calendário.
As despesas fixas são repetidas por uma ação explícita do proprietário.

A documentação HTTP está em src/infra/http/swagger/finance.ts e é incorporada a /docs-json.
Todas as rotas usam o prefixo /api/barbershops/:shopId/finance.

| Método | Sufixo | Efeito |
| --- | --- | --- |
| GET | ?month=YYYY-MM | Resumo, série diária, despesas e atendimentos |
| POST | /entries | Criar despesa PLANNED |
| PATCH | /entries/:entryId | Registrar PAY ou CANCEL com expectedVersion |
| POST | /entries/:entryId/copy | Criar uma cópia no mês seguinte |
| POST | /receipts | Registrar recebimento integral de reserva concluída |

## Consistência

Cada operação exige sessão e membership OWNER ACTIVE da unidade solicitada.
O vínculo é conferido e bloqueado para leitura na mesma transação dos dados financeiros.
A API sempre combina unidade e identificador do recurso nas consultas.
Uma chave requestId repetida retorna o registro original. Dados diferentes com a mesma
chave retornam 409. O bloqueio da reserva e o índice único impedem dois recebimentos
para o mesmo atendimento. Alterações de despesas usam versão e bloqueio de linha.
Um pagamento permanece registrado no histórico. O fluxo inicial permite cancelar
previsões de despesas antes do pagamento.

Os preços ausentes em dados antigos são identificados no resumo.
O backend mantém esses valores como desconhecidos.
O faturamento inclui apenas COMPLETED; a previsão inclui WAITING, CONFIRMED e IN_SERVICE.
Cancelados e ausências ficam fora dos indicadores de faturamento.

## Migration

A fonte da migration é src/infra/drizzle/finance-migration.ts, executada pelo migrator
idempotente existente. A representação Drizzle está em src/infra/drizzle/schema.ts.
A tabela finance_entries referencia usuários, unidade, reserva e origem da cópia.
A migration não exige backfill de reservas existentes.
A aplicação em banco compartilhado e a publicação ainda precisam de autorização.

## Validação isolada

O teste de integração exige FINANCE_TEST_DATABASE_URL, host de loopback e banco terminado
em _test. Sem a variável, os testes PostgreSQL são ignorados pela suíte padrão.
O teste cria e remove um schema próprio, usa HTTP local e não importa src/app.ts,
evitando migrations gerais de boot e acesso ao restante do sistema.

Exemplo para o banco descartável usado nesta implementação

~~~powershell
docker run --rm -d --name smartbarber-finance-test -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=smartbarber_finance_test -p 127.0.0.1:55479:5432 postgres:17-alpine
$env:DOTENV_CONFIG_PATH = 'D:/smart_barber/worktrees/api-financeiro/.env.nonexistent'
$env:NODE_ENV = 'test'
$env:DATABASE_URL = 'postgresql://postgres@127.0.0.1:55479/smartbarber_finance_test'
$env:FINANCE_TEST_DATABASE_URL = $env:DATABASE_URL
npm run test:finance
~~~

Os testes cobrem proprietários ativos, barbeiros, vínculos inativos, outra unidade,
recebimentos duplicados, pagamentos concorrentes, repetição de despesas e datas inválidas.
A autenticação HTTP é substituída por um ator de fixture no teste. A autorização de
unidade e as operações financeiras utilizam o repositório real e PostgreSQL.

## Resultado desta implementação

Os 12 testes de projeção e HTTP passaram com PostgreSQL 17 descartável.
O TypeScript global permanece com cinco erros preexistentes em
drizzle-discovery-unbounded.spec.ts e create-barbershop.controller.ts.
As fontes novas do módulo passaram na verificação seletiva do Biome.
Os comandos de teste não utilizaram a aplicação publicada nem o banco compartilhado.
