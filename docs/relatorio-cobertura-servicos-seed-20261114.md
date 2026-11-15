# Relatório de Cobertura de Avaliações por Serviço e Diagnóstico das Unidades Originais

**Data do Levantamento:** 15 de novembro de 2026  
**Status:** Concluído e Validado em Ambiente Isolado  
**Contexto:** smart_barber (API & Frontend)

---

## 1. Sumário Executivo

O Smart Barber adota uma arquitetura de avaliações multi-alvo vinculada a atendimentos (`bookings`), onde uma única avaliação de agendamento concluído gera notas independentes para:
1. **Barbearia (`BARBERSHOP`)**
2. **Profissional / Barbeiro (`BARBER`)**
3. **Serviço (`SERVICE`)**

A integridade do sistema exige que nenhuma avaliação exista sem um agendamento concluído correspondente (`reviews.booking_id -> bookings.id`).

O levantamento realizado no namespace do seed identificou o seguinte cenário:
* **Total de serviços no namespace seed:** 962 (870 ativos, 92 inativos).
* **Serviços ativos com avaliações publicadas:** 810 serviços (distribuídos em 90 lojas ampliadas).
* **Serviços ativos sem avaliações:** 60 serviços (concentrados estritamente nas 10 barbearias originais do seed).

---

## 2. Diagnóstico da Causa Raiz

### 2.1 Por que 810 serviços pareciam estar sem avaliação no catálogo público?
Na execução anterior de seed, as avaliações foram inseridas corretamente nas tabelas `reviews` e `review_items`. No entanto, os repositórios `DrizzleServicesRepository` e `DrizzleBarbershopsRepository` liam diretamente as colunas legadas `services.rating` e `services.review_count`, que continuavam com valor `0.00` / `0`.

**Correção Implementada:**
* Os repositórios agora enriquecem as entidades em lote (`enrichServicesWithCanonicalRatings` e `enrichBarbershopsWithCanonicalRatings`) diretamente a partir da fonte canônica (`review_items` inner join `reviews` com `status = 'PUBLISHED'`).
* Foi eliminada a divergência onde o detalhe de um serviço respondia `rating=null/reviewCount=0` e o endpoint de avaliações respondia nota 5 com contagem 1.
* A consistência é 100% idêntica entre detalhe de serviço, catálogo público, perfil profissional, Explore e o novo painel do proprietário.

### 2.2 Por que os 60 serviços das 10 lojas originais não têm avaliações?
1. Na rodada aditiva anterior de seed, vigorou a regra estrita de **"adicionar somente avaliações sem alterar ou fabricar novas reservas"**.
2. As 10 barbearias originais do seed já possuíam reservas criadas em fases preliminares que não continham itens de serviço correspondentes aos seus 60 serviços ativos, ou não possuíam agendamentos com status `COMPLETED` no passado.
3. Como o modelo do Smart Barber rejeita avaliações "órfãs" (sem agendamento elegível concluído), os 60 serviços não receberam avaliações no seed aditivo para não violar os invariantes relacionais.

---

## 3. Inventário das 10 Barbearias Originais e Serviços Sem Avaliações

| # | Barbearia (Unidade Original) | Serviços Ativos | Serviços Avaliados | Serviços Pendentes | Motivo da Ausência |
|---|-----------------------------|-----------------|--------------------|--------------------|--------------------|
| 1 | Barbearia Retrô São Paulo | 6 | 0 | 6 | Ausência de reservas seed `COMPLETED` com este serviço |
| 2 | Barbearia Navalha de Ouro | 6 | 0 | 6 | Ausência de reservas seed `COMPLETED` com este serviço |
| 3 | Barbearia Vintage Jardins | 6 | 0 | 6 | Ausência de reservas seed `COMPLETED` com este serviço |
| 4 | Barbearia Dom Pedro | 6 | 0 | 6 | Ausência de reservas seed `COMPLETED` com este serviço |
| 5 | Barbearia Confraria da Barba | 6 | 0 | 6 | Ausência de reservas seed `COMPLETED` com este serviço |
| 6 | Barbearia Espaço Homem | 6 | 0 | 6 | Ausência de reservas seed `COMPLETED` com este serviço |
| 7 | Barbearia Alfa & Ômega | 6 | 0 | 6 | Ausência de reservas seed `COMPLETED` com este serviço |
| 8 | Barbearia Cavalheiros Club | 6 | 0 | 6 | Ausência de reservas seed `COMPLETED` com este serviço |
| 9 | Barbearia Dom Barbeiro | 6 | 0 | 6 | Ausência de reservas seed `COMPLETED` com este serviço |
| 10 | Barbearia Barba Negra | 6 | 0 | 6 | Ausência de reservas seed `COMPLETED` com este serviço |
| **Total** | **10 unidades** | **60** | **0** | **60** | **100% elegibilidade pendente de atendimento** |

---

## 4. Tratamento no Painel Gerencial do Proprietário

O painel de avaliações do Owner (`/(app)/reviews` e endpoint `GET /api/barbershops/:shopId/review-insights/services`) foi projetado para lidar com ausência de avaliações com total transparência:

1. **Classificação Explícita do Motivo (`absenceReason`):**
   * `NO_COMPLETED_BOOKINGS`: O serviço ainda não teve atendimentos concluídos no período.
   * `NO_CUSTOMER_FEEDBACK`: O serviço teve atendimentos concluídos (`completedBookingsCount > 0`), mas os clientes ainda não deixaram nota específica para ele.
2. **Prevenção de Falsa Penalização:**
   * Nenhum serviço sem nota é classificado como ruim ou recebe média zero; o retorno é estritamente `averageRating = null` e `reviewCount = 0`.
   * Para serviços com menos de 5 avaliações, é exibido o selo `Amostra reduzida (< 5)`.
3. **Indicador de Cobertura de Serviços:**
   * O painel exibe a métrica `Cobertura de Serviços Ativos`: percentual de serviços ativos do estabelecimento que já receberam ao menos uma nota de cliente.

---

## 5. Estratégia de Convite Pós-Atendimento para Clientes Reais

Para clientes reais da plataforma, a cobertura deve ser conquistada organicamente através de um fluxo pós-atendimento estruturado:

1. **Gatilho de Envio:**
   * Disparado quando o agendamento muda para o status `COMPLETED` e atinge a hora de término.
2. **Controle de Frequência (Anti-Fadiga):**
   * Limite de **1 solicitação de avaliação por cliente a cada 14 dias** para o mesmo estabelecimento.
   * Se o cliente realizou 3 atendimentos na mesma semana, recebe apenas o convite do primeiro atendimento concluído.
3. **Respeito às Preferências de Comunicação:**
   * Respeito estrito aos opt-outs e canais cadastrados pelo cliente (notificação in-app / push prioritário, WhatsApp ou e-mail caso habilitado).
4. **Liberdade do Cliente no Formulário:**
   * O cliente avalia a barbearia obrigatoriamente (1 a 5 estrelas) e pode, opcionalmente, avaliar os serviços executados ou o barbeiro. Ele tem a liberdade de pular a nota de um serviço sem ser impedido de enviar.
5. **Segurança Operacional:**
   * Nenhuma mensagem real ou push deve ser disparada em produção sem autorização explícita do operador.

---

## 6. Recomendações e Decisões Operacionais para o Seed

Para os 60 serviços das 10 lojas originais, existem duas opções operacionais:

* **Opção 1 (Adotada nesta entrega):**
  * Manter os 60 serviços no catálogo sem avaliações demonstrativas, exibindo com honestidade `Sem avaliações` e o motivo `Sem atendimentos concluídos no período`.
  * Essa abordagem preserva o banco de dados de produção limpo, sem criar dados históricos sintéticos adicionais.
* **Opção 2 (Evolução Futura sob Autorização Específica):**
  * Caso a diretoria exija que as 10 lojas originais também possuam 100% de cobertura demonstrativa, será necessário executar uma operação autorizada de carga sintética que primeiro crie agendamentos seed no passado (`bookings` concluídos com seus respectivos `booking_service_items`), e posteriormente aplique as avaliações correspondentes registradas no `demo_seed_registry`.

---

## 7. Conclusão

Com a unificação canônica das leituras na API, a criação dos endpoints gerenciais de insights, o novo painel privado do proprietário no frontend e a identificação confiável da origem (`CUSTOMER` vs `DEMO` vs `UNKNOWN`), todos os 810 serviços avaliados apresentam notas consistentes em todas as telas, e os 60 serviços sem notas são tratados com total clareza técnica e transparência gerencial.

---

## 8. Auditoria Reprodutível, Plano de Índices (EXPLAIN) e Sincronização de Cache

### 8.1 Consultas SQL Reprodutíveis para Auditoria de Cobertura e Procedência

```sql
-- 1. Serviços ativos sem avaliações publicadas no catálogo
SELECT b.id AS barbershop_id, b.name AS barbershop_name, s.id AS service_id, s.name AS service_name
FROM services s
INNER JOIN barbershops b ON b.id = s.barbershop_id
WHERE s.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM review_items ri
    INNER JOIN reviews r ON r.id = ri.review_id
    WHERE ri.target_type = 'SERVICE'
      AND ri.target_id = s.id
      AND r.status = 'PUBLISHED'
  )
ORDER BY b.name, s.name;

-- 2. Taxa de resposta por procedência verificável (CUSTOMER vs DEMO vs UNKNOWN)
SELECT
  b.source AS booking_source,
  COUNT(DISTINCT b.id) AS cohort_completed_bookings,
  COUNT(DISTINCT CASE WHEN r.id IS NOT NULL AND r.source = b.source THEN b.id END) AS reviewed_bookings
FROM bookings b
LEFT JOIN reviews r ON r.booking_id = b.id AND r.status = 'PUBLISHED'
WHERE b.barbershop_id = :shop_id
  AND b.status = 'COMPLETED'
GROUP BY b.source;
```

### 8.2 Análise EXPLAIN ANALYZE (Ambiente Isolado PostgreSQL)

Executado em instância PostgreSQL descartável (`127.0.0.1:55432`) sobre as consultas de taxa de resposta e `NOT EXISTS`:
- Consulta de numerador (`COUNT(DISTINCT r.booking_id)` com `reviews` + `bookings`): utiliza `Index Scan using reviews_barbershop_status_created_idx` (Execution Time: `0.465 ms`).
- Consulta de atendimentos sem avaliação (`NOT EXISTS` sobre `bookings` + `reviews`): utiliza `Hash Right Anti Join` + `Bitmap Index Scan on reviews_barbershop_status_created_idx` (Execution Time: `0.218 ms`).
- Novo índice composto `bookings_barbershop_source_status_idx` em `(barbershop_id, source, status)` garante filtragem direta por unidade e procedência no denominador.

### 8.3 Cache, Invalidação e Sincronização com Explore

- **Painel do Proprietário (`owner-reviews`)**: Todas as mutações de avaliação (criação, edição, exclusão, moderação e denúncia) invalidam o prefixo `['owner-reviews', barbershopId]`, além de `['reviews']` e `['barbershop']`. As chaves gerenciais incluem `actorId` para descartar dados privados na troca de conta ou unidade.
- **Cabeçalhos HTTP**: Os 4 endpoints gerenciais retornam `Cache-Control: no-store, private`.
- **Cargas Externas / Explore**: Após cargas externas (seed ou backfill), snapshots de Explore ou projeções públicas que dependem de cache HTTP/CDN devem aguardar expiração do TTL ou passar por invalidação/revalidação explícita antes de comparar contagens com o painel gerencial (que lê sempre em tempo real das tabelas canônicas).
