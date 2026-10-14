# Evidências Reproduzíveis de Desempenho e EXPLAIN — Grupo 1

**Data:** 2026-10-14
**Horário da Execução:** 2026-10-14T23:11:15.881Z
**Ambiente medido:** win32/x64, Node.js v22.16.0, PostgreSQL 18.1 on x86_64-windows, compiled by msvc-19.44.35221, 64-bit
**Banco de Dados Isolado:** descartável via schema dedicado
**Volume Sintético:** 10.000 unidades determinísticas (Seed: 42)
**Orçamento Local Aprovado (Meta):** SQL Total $\le 200\text{ ms}$
**Resultado desta execução:** APROVADO.

Critério: volume verificado de 10.000 unidades, dez amostras válidas, respostas coerentes com a página consultada e todas as somas COUNT + Items <=200ms. Falha ou orçamento excedido resulta em saída não zero. Ausência da variável produz NOT TESTED, sem novo relatório.
Tempos COUNT/Items incluem driver e ida/volta; execução interna PostgreSQL está nos planos EXPLAIN capturados durante aquecimento. repo.search inclui compilação/mapeamento e é separado da soma. HTTP inclui saúde, leitura e validação completa do JSON. Séries SQL e HTTP são independentes; não se deriva overhead subtraindo medianas. Não se infere Docker nem SLA de produção.

---

## 1. Distribuição Sintética do Volume (10.000 Unidades)

As 10.000 unidades foram distribuídas deterministicamente em torno do centro de referência (Praça da Sé, São Paulo: lat `-23.55052`, lon `-46.633308`) com gerador pseudo-aleatório congruente linear (LCG, semente `42`):
- **9.500 unidades:** `ACTIVE`, `status = 'CONFIRMED'`, `source = 'MANUAL'`, `valid_until = NOW() + 20 dias`.
- **300 unidades:** `INACTIVE` (para testar exclusão pré-cálculo de inativos).
- **100 unidades:** `status = 'CONFIRMED'`, `source = 'GOOGLE'`, com expiração vencida (`acquired_at = NOW() - 30 dias`, `valid_until = NOW() - 5 dias`).
- **100 unidades:** `status = 'UNCONFIRMED'`, coordenadas `NULL`.
- **Saúde da Manutenção:** 1 registro em `location_maintenance_health` (`component = 'google_maps_cache'`, `is_healthy = true`, `last_heartbeat_at = NOW()`).

---

## 2. Medições Estatísticas (Série de 10 Amostras após 3 Aquecimentos)

### Resumo Executivo das Métricas

| Métrica | Mínimo | Mediana | Média | Máximo | Orçamento Local | Status |
|---|---|---|---|---|---|---|
| **SQL COUNT (ms)** | 3.02 ms | 4.90 ms | 4.57 ms | 6.24 ms | — | Informativo |
| **SQL Items (ms)** | 3.53 ms | 4.31 ms | 4.36 ms | 5.98 ms | — | Informativo |
| **SQL Total (COUNT + Items)** | **6.99 ms** | **8.98 ms** | **8.93 ms** | **11.12 ms** | **$\le 200\text{ ms}$** | **APROVADO** |
| **repo.search completo** | 7.18 ms | 9.20 ms | 9.20 ms | 11.37 ms | — | Informativo |
| **HTTP com JSON consumido e validado** | **10.68 ms** | **13.82 ms** | **13.41 ms** | **15.32 ms** | — | Evidência Separada |

### Tabela Detalhada das 10 Amostras

| Iteração | SQL COUNT (ms) | SQL Items (ms) | Soma (ms) | repo.search (ms) | HTTP completo (ms) |
|:---:|:---:|:---:|:---:|:---:|:---:|
| #1 | 6.24 | 4.88 | 11.12 | 11.37 | 13.70 |
| #2 | 4.83 | 3.53 | 8.36 | 8.65 | 14.30 |
| #3 | 4.43 | 4.30 | 8.73 | 9.01 | 12.06 |
| #4 | 3.02 | 5.98 | 9.00 | 9.21 | 14.65 |
| #5 | 5.32 | 3.64 | 8.95 | 9.19 | 13.95 |
| #6 | 5.00 | 5.43 | 10.43 | 11.03 | 15.32 |
| #7 | 3.42 | 3.59 | 7.01 | 7.27 | 14.15 |
| #8 | 4.97 | 4.31 | 9.28 | 9.48 | 12.14 |
| #9 | 3.45 | 3.54 | 6.99 | 7.18 | 10.68 |
| #10 | 5.00 | 4.43 | 9.43 | 9.63 | 13.12 |

*Condições de cache: Shared buffers do PostgreSQL quentes após 3 iterações de aquecimento; conexões reutilizadas via pool isolado.*

---

## 3. EXPLAIN (ANALYZE, BUFFERS, VERBOSE) Bruto da Consulta COUNT

Abaixo está o plano de execução real e integral emitido pelo PostgreSQL para a contagem total de unidades elegíveis dentro do raio de 10 km:

```text
Aggregate  (cost=86.07..86.09 rows=1 width=4) (actual time=2.497..2.498 rows=1.00 loops=1)
  Output: (count(*))::integer
  Buffers: shared hit=576
  ->  Nested Loop  (cost=4.75..86.07 rows=1 width=0) (actual time=0.269..2.482 rows=121.00 loops=1)
        Inner Unique: true
        Buffers: shared hit=576
        ->  Bitmap Heap Scan on discovery_ab9d010227e44b2ea6f7bb3b29cb4de7.barbershop_locations bl  (cost=4.47..77.32 rows=1 width=16) (actual time=0.255..2.120 rows=128.00 loops=1)
              Output: bl.id, bl.barbershop_id, bl.status, bl.latitude, bl.longitude, bl.version, bl.confirmed_at, bl.source, bl.google_place_id, bl.google_reference, bl.acquired_at, bl.valid_until, bl.pin_adjusted, bl.last_mutation_id, bl.last_mutation_actor_id, bl.last_mutation_hash, bl.last_mutation_saved_version, bl.created_at, bl.updated_at
              Recheck Cond: (bl.status = 'CONFIRMED'::barbershop_location_status)
              Filter: ((bl.latitude IS NOT NULL) AND (bl.longitude IS NOT NULL) AND (bl.latitude >= '-90'::double precision) AND (bl.latitude <= '90'::double precision) AND (bl.longitude >= '-180'::double precision) AND (bl.longitude <= '180'::double precision) AND (bl.latitude >= '-23.641801143000748'::double precision) AND (bl.latitude <= '-23.45923885699925'::double precision) AND (bl.longitude >= '-46.734446907814565'::double precision) AND (bl.longitude <= '-46.532169092185434'::double precision) AND CASE WHEN ((bl.source = 'GOOGLE'::text) OR (bl.google_place_id IS NOT NULL) OR (bl.google_reference IS NOT NULL)) THEN ((bl.source = 'GOOGLE'::text) AND (bl.acquired_at IS NOT NULL) AND (bl.valid_until IS NOT NULL) AND (bl.acquired_at <= now()) AND (bl.valid_until > now()) AND (bl.valid_until <= (bl.acquired_at + '25 days'::interval)) AND ((bl.acquired_at + '25 days'::interval) >= now())) WHEN ((bl.source = 'MANUAL'::text) AND (bl.google_place_id IS NULL) AND (bl.google_reference IS NULL)) THEN ((bl.valid_until IS NULL) OR (bl.valid_until > now())) ELSE false END AND (('12742000'::double precision * asin(sqrt(LEAST('1'::double precision, GREATEST('0'::double precision, (power(sin((radians((bl.latitude - '-23.55052'::double precision)) / '2'::double precision)), '2'::double precision) + (('0.9167081248003267'::double precision * cos(radians(bl.latitude))) * power(sin((radians((bl.longitude - '-46.633308'::double precision)) / '2'::double precision)), '2'::double precision)))))))) <= '10000'::double precision))
              Rows Removed by Filter: 9772
              Heap Blocks: exact=181
              Buffers: shared hit=192
              ->  Bitmap Index Scan on barbershop_locations_status_valid_until_idx  (cost=0.00..4.47 rows=25 width=0) (actual time=0.194..0.194 rows=9900.00 loops=1)
                    Index Cond: (bl.status = 'CONFIRMED'::barbershop_location_status)
                    Index Searches: 1
                    Buffers: shared hit=11
        ->  Index Scan using barbershops_pkey on discovery_ab9d010227e44b2ea6f7bb3b29cb4de7.barbershops b  (cost=0.28..8.30 rows=1 width=16) (actual time=0.003..0.003 rows=0.95 loops=128)
              Output: b.id, b.name, b.avatar_url, b.owner_id, b.slug, b.cnpj, b.location, b.timezone, b.status, b.created_at
              Index Cond: (b.id = bl.barbershop_id)
              Filter: (b.status = 'ACTIVE'::barbershop_status)
              Rows Removed by Filter: 0
              Index Searches: 128
              Buffers: shared hit=384
Planning Time: 0.307 ms
Execution Time: 2.569 ms
```

---

## 4. EXPLAIN (ANALYZE, BUFFERS, VERBOSE) Bruto da Consulta de Items

Abaixo está o plano de execução real e integral emitido pelo PostgreSQL para a seleção paginada dos 20 itens mais próximos (com cálculo esférico Haversine e ordenação determinística `distance_meters ASC, b.id ASC`):

```text
Limit  (cost=86.13..86.14 rows=1 width=168) (actual time=2.084..2.087 rows=20.00 loops=1)
  Output: b.id, b.name, b.slug, b.location, b.avatar_url, bl.latitude, bl.longitude, (('12742000'::double precision * asin(sqrt(LEAST('1'::double precision, GREATEST('0'::double precision, (power(sin((radians((bl.latitude - '-23.55052'::double precision)) / '2'::double precision)), '2'::double precision) + (('0.9167081248003267'::double precision * cos(radians(bl.latitude))) * power(sin((radians((bl.longitude - '-46.633308'::double precision)) / '2'::double precision)), '2'::double precision)))))))))
  Buffers: shared hit=576
  ->  Sort  (cost=86.13..86.14 rows=1 width=168) (actual time=2.083..2.085 rows=20.00 loops=1)
        Output: b.id, b.name, b.slug, b.location, b.avatar_url, bl.latitude, bl.longitude, (('12742000'::double precision * asin(sqrt(LEAST('1'::double precision, GREATEST('0'::double precision, (power(sin((radians((bl.latitude - '-23.55052'::double precision)) / '2'::double precision)), '2'::double precision) + (('0.9167081248003267'::double precision * cos(radians(bl.latitude))) * power(sin((radians((bl.longitude - '-46.633308'::double precision)) / '2'::double precision)), '2'::double precision)))))))))
        Sort Key: (('12742000'::double precision * asin(sqrt(LEAST('1'::double precision, GREATEST('0'::double precision, (power(sin((radians((bl.latitude - '-23.55052'::double precision)) / '2'::double precision)), '2'::double precision) + (('0.9167081248003267'::double precision * cos(radians(bl.latitude))) * power(sin((radians((bl.longitude - '-46.633308'::double precision)) / '2'::double precision)), '2'::double precision))))))))), b.id
        Sort Method: top-N heapsort  Memory: 33kB
        Buffers: shared hit=576
        ->  Nested Loop  (cost=4.75..86.12 rows=1 width=168) (actual time=0.222..2.049 rows=121.00 loops=1)
              Output: b.id, b.name, b.slug, b.location, b.avatar_url, bl.latitude, bl.longitude, ('12742000'::double precision * asin(sqrt(LEAST('1'::double precision, GREATEST('0'::double precision, (power(sin((radians((bl.latitude - '-23.55052'::double precision)) / '2'::double precision)), '2'::double precision) + (('0.9167081248003267'::double precision * cos(radians(bl.latitude))) * power(sin((radians((bl.longitude - '-46.633308'::double precision)) / '2'::double precision)), '2'::double precision))))))))
              Inner Unique: true
              Buffers: shared hit=576
              ->  Bitmap Heap Scan on discovery_ab9d010227e44b2ea6f7bb3b29cb4de7.barbershop_locations bl  (cost=4.47..77.32 rows=1 width=32) (actual time=0.212..1.789 rows=128.00 loops=1)
                    Output: bl.id, bl.barbershop_id, bl.status, bl.latitude, bl.longitude, bl.version, bl.confirmed_at, bl.source, bl.google_place_id, bl.google_reference, bl.acquired_at, bl.valid_until, bl.pin_adjusted, bl.last_mutation_id, bl.last_mutation_actor_id, bl.last_mutation_hash, bl.last_mutation_saved_version, bl.created_at, bl.updated_at
                    Recheck Cond: (bl.status = 'CONFIRMED'::barbershop_location_status)
                    Filter: ((bl.latitude IS NOT NULL) AND (bl.longitude IS NOT NULL) AND (bl.latitude >= '-90'::double precision) AND (bl.latitude <= '90'::double precision) AND (bl.longitude >= '-180'::double precision) AND (bl.longitude <= '180'::double precision) AND (bl.latitude >= '-23.641801143000748'::double precision) AND (bl.latitude <= '-23.45923885699925'::double precision) AND (bl.longitude >= '-46.734446907814565'::double precision) AND (bl.longitude <= '-46.532169092185434'::double precision) AND CASE WHEN ((bl.source = 'GOOGLE'::text) OR (bl.google_place_id IS NOT NULL) OR (bl.google_reference IS NOT NULL)) THEN ((bl.source = 'GOOGLE'::text) AND (bl.acquired_at IS NOT NULL) AND (bl.valid_until IS NOT NULL) AND (bl.acquired_at <= now()) AND (bl.valid_until > now()) AND (bl.valid_until <= (bl.acquired_at + '25 days'::interval)) AND ((bl.acquired_at + '25 days'::interval) >= now())) WHEN ((bl.source = 'MANUAL'::text) AND (bl.google_place_id IS NULL) AND (bl.google_reference IS NULL)) THEN ((bl.valid_until IS NULL) OR (bl.valid_until > now())) ELSE false END AND (('12742000'::double precision * asin(sqrt(LEAST('1'::double precision, GREATEST('0'::double precision, (power(sin((radians((bl.latitude - '-23.55052'::double precision)) / '2'::double precision)), '2'::double precision) + (('0.9167081248003267'::double precision * cos(radians(bl.latitude))) * power(sin((radians((bl.longitude - '-46.633308'::double precision)) / '2'::double precision)), '2'::double precision)))))))) <= '10000'::double precision))
                    Rows Removed by Filter: 9772
                    Heap Blocks: exact=181
                    Buffers: shared hit=192
                    ->  Bitmap Index Scan on barbershop_locations_status_valid_until_idx  (cost=0.00..4.47 rows=25 width=0) (actual time=0.157..0.158 rows=9900.00 loops=1)
                          Index Cond: (bl.status = 'CONFIRMED'::barbershop_location_status)
                          Index Searches: 1
                          Buffers: shared hit=11
              ->  Index Scan using barbershops_pkey on discovery_ab9d010227e44b2ea6f7bb3b29cb4de7.barbershops b  (cost=0.28..8.30 rows=1 width=144) (actual time=0.001..0.001 rows=0.95 loops=128)
                    Output: b.id, b.name, b.avatar_url, b.owner_id, b.slug, b.cnpj, b.location, b.timezone, b.status, b.created_at
                    Index Cond: (b.id = bl.barbershop_id)
                    Filter: (b.status = 'ACTIVE'::barbershop_status)
                    Rows Removed by Filter: 0
                    Index Searches: 128
                    Buffers: shared hit=384
Planning Time: 0.238 ms
Execution Time: 2.135 ms
```

---

## 5. SQL e parâmetros sintéticos capturados

COUNT e Items emitidos pelo repositório:
```json
{
  "count": {
    "sql": "\n      SELECT COUNT(*)::int AS total\n      FROM barbershops b\n      INNER JOIN barbershop_locations bl ON bl.barbershop_id = b.id\n      WHERE b.status = 'ACTIVE' AND (\n      bl.status = 'CONFIRMED'\n      AND bl.latitude IS NOT NULL\n      AND bl.longitude IS NOT NULL\n      AND bl.latitude >= -90.0 AND bl.latitude <= 90.0\n      AND bl.longitude >= -180.0 AND bl.longitude <= 180.0\n      AND (\n        CASE\n          WHEN (bl.source = 'GOOGLE' OR bl.google_place_id IS NOT NULL OR bl.google_reference IS NOT NULL) THEN (\n            bl.source = 'GOOGLE'\n            AND bl.acquired_at IS NOT NULL\n            AND bl.valid_until IS NOT NULL\n            AND bl.acquired_at <= NOW()\n            AND bl.valid_until > NOW()\n            AND bl.valid_until <= (bl.acquired_at + INTERVAL '25 days')\n            AND (bl.acquired_at + INTERVAL '25 days') >= NOW()\n          )\n          WHEN bl.source = 'MANUAL' AND bl.google_place_id IS NULL AND bl.google_reference IS NULL THEN (\n            bl.valid_until IS NULL OR bl.valid_until > NOW()\n          )\n          ELSE FALSE\n        END\n      )\n    ) AND bl.latitude BETWEEN $1::double precision AND $2::double precision AND bl.longitude BETWEEN $3::double precision AND $4::double precision\n        AND (\n      2.0 * 6371000.0 * asin(sqrt(\n        least(1.0::double precision, greatest(0.0::double precision,\n          power(sin(radians(bl.latitude - $5::double precision) / 2.0), 2) +\n          cos(radians($6::double precision)) * cos(radians(bl.latitude)) * power(sin(radians(bl.longitude - $7::double precision) / 2.0), 2)\n        ))\n      ))\n    ) <= $8::double precision\n    ",
    "params": [
      -23.641801143000748,
      -23.45923885699925,
      -46.734446907814565,
      -46.532169092185434,
      -23.55052,
      -23.55052,
      -46.633308,
      10000
    ]
  },
  "items": {
    "sql": "\n      SELECT\n        b.id,\n        b.name,\n        b.slug,\n        b.location,\n        b.avatar_url,\n        bl.latitude,\n        bl.longitude,\n        (\n      2.0 * 6371000.0 * asin(sqrt(\n        least(1.0::double precision, greatest(0.0::double precision,\n          power(sin(radians(bl.latitude - $1::double precision) / 2.0), 2) +\n          cos(radians($2::double precision)) * cos(radians(bl.latitude)) * power(sin(radians(bl.longitude - $3::double precision) / 2.0), 2)\n        ))\n      ))\n    ) AS distance_meters\n      FROM barbershops b\n      INNER JOIN barbershop_locations bl ON bl.barbershop_id = b.id\n      WHERE b.status = 'ACTIVE' AND (\n      bl.status = 'CONFIRMED'\n      AND bl.latitude IS NOT NULL\n      AND bl.longitude IS NOT NULL\n      AND bl.latitude >= -90.0 AND bl.latitude <= 90.0\n      AND bl.longitude >= -180.0 AND bl.longitude <= 180.0\n      AND (\n        CASE\n          WHEN (bl.source = 'GOOGLE' OR bl.google_place_id IS NOT NULL OR bl.google_reference IS NOT NULL) THEN (\n            bl.source = 'GOOGLE'\n            AND bl.acquired_at IS NOT NULL\n            AND bl.valid_until IS NOT NULL\n            AND bl.acquired_at <= NOW()\n            AND bl.valid_until > NOW()\n            AND bl.valid_until <= (bl.acquired_at + INTERVAL '25 days')\n            AND (bl.acquired_at + INTERVAL '25 days') >= NOW()\n          )\n          WHEN bl.source = 'MANUAL' AND bl.google_place_id IS NULL AND bl.google_reference IS NULL THEN (\n            bl.valid_until IS NULL OR bl.valid_until > NOW()\n          )\n          ELSE FALSE\n        END\n      )\n    ) AND bl.latitude BETWEEN $4::double precision AND $5::double precision AND bl.longitude BETWEEN $6::double precision AND $7::double precision\n        AND (\n      2.0 * 6371000.0 * asin(sqrt(\n        least(1.0::double precision, greatest(0.0::double precision,\n          power(sin(radians(bl.latitude - $8::double precision) / 2.0), 2) +\n          cos(radians($9::double precision)) * cos(radians(bl.latitude)) * power(sin(radians(bl.longitude - $10::double precision) / 2.0), 2)\n        ))\n      ))\n    ) <= $11::double precision\n      ORDER BY distance_meters ASC, b.id ASC\n      LIMIT $12\n      OFFSET $13\n    ",
    "params": [
      -23.55052,
      -23.55052,
      -46.633308,
      -23.641801143000748,
      -23.45923885699925,
      -46.734446907814565,
      -46.532169092185434,
      -23.55052,
      -23.55052,
      -46.633308,
      10000,
      20,
      0
    ]
  }
}
```

## 6. Procedimento de Reprodução

Para reproduzir este benchmark no ambiente local:

```powershell
# Configurar DISCOVERY_TEST_DATABASE_URL com banco local sb_discovery_test_*
# previamente validado. Não publicar URL ou credenciais nas evidências.

# 2. Executar o benchmark
npx --no-install tsx test/benchmark/run-benchmark.ts
```
