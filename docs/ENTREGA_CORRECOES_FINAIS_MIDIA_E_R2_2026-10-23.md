# Relatório Canônico de Fechamento: Mídia, Galeria, Avaliações e R2 (A01–A10)

**Data de Emissão:** 23 de Outubro de 2026  
**Status da Auditoria:** CONCLUÍDO E INTEGRALMENTE VALIDADO COM CÓDIGO REAL  
**Documentos Canônicos de Origem:**
- `docs/REVISAO_FECHAMENTO_PENDENCIAS_MIDIA_AVALIACOES_2026-10-23.md` (Itens A01–A10)
- `docs/REVISAO_CORRECOES_MIDIA_AVALIACOES_2026-10-23.md` (Itens R01–R10)
- `docs/PLANO_CONSOLIDADO_CORRECOES_MIDIA_AVALIACOES_2026-10-22.md` (Tarefas T01–T12)
- `docs/REVISAO_MIDIA_AVALIACOES_2026-10-22.md` (Achados originais F01–F12)

**Worktrees e Branches Auditadas:**
- Backend API: `D:/smart_barber/worktrees/api-midia-avaliacoes` (branch `feat/midia-galeria-avaliacoes`, base HEAD `238064b2b6f336d76813d2f3ace2ceb308ad3638`)
- Frontend Mobile/Web: `D:/smart_barber/worktrees/frontend-midia-avaliacoes` (branch `feat/midia-galeria-avaliacoes`, base HEAD `4abb193457fb7d4194220540bb2bc836ecfadd17`)

---

## 1. Matriz Canônica de Resolução Integral dos Achados (A01–A10)

| Item | Gravidade | Descrição do Bloqueador Auditado | Resolução Implementada | Rastreabilidade | Status |
|:---:|:---:|---|---|:---:|:---:|
| **A01** | P1 | Concorrência de galeria: lock em memória frágil entre réplicas e falta de atomicidade no banco. | Removido `Map` de lock local do caso de uso. O repositório PostgreSQL/Drizzle coordena transações com `SELECT id FROM barbershops WHERE id = $1 FOR UPDATE`. Contagem (<10), verificação de duplicata `(barbershopId, mediaId)` e atualização de capa em `barbershops.coverUrl` ocorrem atomicamente na mesma transação. Adicionado índice parcial único `barbershop_gallery_unique_cover_idx` e mutex assíncrono equivalente no repositório de teste. | R03 / F07 / T07 | **RESOLVIDO** |
| **A02** | P1 | Pipeline de upload: falta de lease CAS no banco, rejeição definitiva quando arquivo de staging ainda não chegou e falta de idempotência de confirmação. | Adicionadas colunas `lease_token`, `lease_expires_at`, `retry_count`, `error_message` e índice `media_lease_idx`. Método `claimForProcessing` aloca lease atômico com timeout de 5 min. Se staging não estiver disponível, `releaseProcessing` com `resetToPending: true` incrementa `retry_count`, registra o motivo e permite retentativas. `finalizeProcessing` grava variantes e marca `READY` somente mediante conferência do `lease_token`. | R06 / F03 / T03 | **RESOLVIDO** |
| **A03** | P1 | Frontend galeria: loop contínuo de requisições de galeria disparado por array default instável. | Removido parâmetro default `initialItems = []` que gerava nova referência em cada ciclo de renderização. O `useEffect` dispara exclusivamente quando `shopId` ou `initialItems` mudarem de referência real. Adicionado `AbortController` com cancelamento no desmontar ou troca de loja. | R08 / F07 / T07 | **RESOLVIDO** |
| **A04** | P1 | Frontend galeria: corrida assíncrona entre lojas na interface proprietária (`BarbershopGalleryManager`). | Implementado `activeShopIdRef` monitorando a barbearia ativa. Todas as mutações (`handleFileChange`, `handlePickPhoto`, `handleSetCover`, `handleRemove`, `handleMove`) e respostas de rede validam se `activeShopIdRef.current === targetShopId` antes de atualizar o estado local (`setItems`), descartando ações de contextos anteriores. | R08 / F07 / T07 | **RESOLVIDO** |
| **A05** | P1 | Frontend avaliações: sobrescrita de rascunho em background e perda de versão base (`expectedVersion`). | `ReviewFormModal` rastreia `baseVersionRef` inicializada na abertura. Quando `isDirty` é verdadeiro, refetches remotos não sobrescrevem os campos nem atualizam a versão base. O envio submete estritamente a versão inicial do rascunho, assegurando detecção de concorrência com 409 Conflict. | R04 / R08 / F05 / T05 | **RESOLVIDO** |
| **A06** | P1 | Avaliações: falta de obrigatoriedade de `expectedVersion` e ausência de CAS em remoção e moderação. | Schema Zod de entrada exige obrigatoriamente `expectedVersion: z.coerce.number().int().positive()`. Casos de uso `DeleteReviewUseCase` e `ModerateReviewUseCase` e repositórios Drizzle/PostgreSQL executam CAS estrito `WHERE id = $1 AND version = $2`. Falhas retornam erro mapeado para HTTP 409 Conflict. Moderação e exclusão de registro já deletado pelo autor são bloqueadas. | R04 / F05 / F06 / T05 / T06 | **RESOLVIDO** |
| **A07** | P1 | Módulo nativo `expo-image-picker` como extraneous e logotipo comercial forçado a recorte quadrado 1:1. | `"expo-image-picker": "~57.0.20"` declarado nas `dependencies` do `package.json` do frontend e sincronizado no `package-lock.json` (`npm ls` não reporta mais extraneous). `AvatarUploader` atualizado para receber `allowsEditing?: boolean`, `aspect?: [number, number]` e `shape?: 'circle' | 'rounded'`. Em `AppearanceSettingsScreen.tsx`, o logo comercial passa `allowsEditing={false}` e `shape="rounded"`, preservando proporções retangulares. | R07 / R09 / F01 / F09 / T01 / T09 | **RESOLVIDO** |
| **A08** | P1 | Divergência nos nomes das variáveis de ambiente de storage entre documentação e código. | Padronização e alinhamento canônico nos módulos `src/infra/env/index.ts` e `src/infra/storage/storage-service-factory.ts`. Nomes consumidos pelo código real: `STORAGE_STAGING_BUCKET`, `STORAGE_PUBLIC_BUCKET`, `STORAGE_PUBLIC_URL`, `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` e `CRON_SECRET`. | R02 / R10 / F12 / T12 | **RESOLVIDO** |
| **A09** | P2 | Limites de payload de imagens: orçamentos não aplicados a todas as finalidades e extensões de variantes incorretas. | `SharpImageProcessor` implementa orçamentos estritos via `optimizeBufferUnderBudget`: avatares (300 KiB / 100 KiB thumb), logos (512 KiB / 200 KiB thumb), galeria e capa (1.5 MiB / 250 KiB thumb). Se o stepping de qualidade (82, 72, 60, 48) não atingir o limite, a requisição é explicitamente recusada. Chaves de variantes geradas utilizam a extensão real do formato (`.webp`, `.jpg`, `.png`) e geram hash SHA-256. | R07 / F02 / T02 | **RESOLVIDO** |
| **A10** | P1 | Falta de roteiro operacional seguro para o Álvaro aplicar DDL no banco e configurar o backend de produção. | DDL canônico idempotente consolidado abaixo contendo todas as novas tabelas, colunas, enums e índices parciais de proteção (`barbershop_gallery_unique_cover_idx`, `media_lease_idx`, `reviews_single_active_booking_idx`). Roteiro seguro sem exposição de segredos. | R01–R10 / T01–T12 | **RESOLVIDO** |

---

## 2. Evidências de Validação Automatizada do Produto

### 2.1. Frontend Mobile/Web (`worktrees/frontend-midia-avaliacoes`)
- **Compilação e Verificação de Tipos TypeScript:**
  - `npm run typecheck` (`tsc --noEmit`) executado com **0 erros** (código de saída: 0).
- **Suíte de Testes Automatizados (`npm test` / Vitest):**
  - **101 arquivos de teste executados.**
  - **663 testes aprovados com 100% de sucesso (PASS: 663, FAIL: 0).**
  - Regressões permanentes em `src/features/media/tests/f01-f12-frontend-regressions.test.tsx`:
    - Validação de logotipo comercial não forçando corte 1:1 (`A07`).
    - Validação de estabilidade de referências de galeria sem loops infinitos (`A03`).
    - Validação de isolamento contextual entre unidades (`A04`).
    - Validação de preservação de versão-base em rascunhos concorrentes de avaliação (`A05`).
  - Todas as suítes da Fase 1 (monotonicidade, relógio do servidor, timezone e locks de agendamento) foram preservadas 100% verdes.

### 2.2. Backend API (`worktrees/api-midia-avaliacoes`)
- **Compilação e Verificação de Tipos TypeScript:**
  - `npx tsc --noEmit` executado com **0 erros** (código de saída: 0).
- **Suítes de Regressão e Casos de Uso de Domínio (`npx vitest run`):**
  - `test/regressions/f01-f12-consolidated-regressions.spec.ts` (18 testes passando).
  - `src/domain/application/use-cases/reviews/reviews-use-cases.spec.ts` (14 testes passando).
  - `src/domain/application/use-cases/media/media-use-cases.spec.ts` (8 testes passando).
  - Total de testes de domínio e regressão: **294 testes executados com 100% de aprovação (PASS: 294, FAIL: 0)**.
  - Regressões permanentes validadas:
    - Serialização atômica concorrente da galeria com limite de 10 fotos e idempotência (`A01`).
    - Reivindicação atômica de lease, recuperação em retry após ausência de staging e confirmação atômica (`A02`).
    - CAS obrigatório com `expectedVersion` em remoção e moderação com detecção de 409 Conflict (`A06`).
    - Orçamento e compressão Sharp com stepping e recusa de estouro de tamanho (`A09`).

---

## 3. Roteiro Operacional para o Álvaro (Backend & Banco de Dados)

### 3.1. Variáveis de Ambiente no Serviço de Hospedagem da API

Preencher no painel do serviço que hospeda a API (Render, VPS, Docker ou ECS) utilizando as credenciais Cloudflare R2 já emitidas:

```env
# Cloudflare R2 Storage (Variáveis canônicas consumidas pelo código)
STORAGE_ENDPOINT=https://<CF_ACCOUNT_ID>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
STORAGE_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
STORAGE_STAGING_BUCKET=smartbarber
STORAGE_PUBLIC_BUCKET=smartbarber-public
STORAGE_PUBLIC_URL=https://midia-smartbarber.wellingtonsp.uk

# Segredo de Execução da Rotina de Limpeza Noturna de Storage (CRON)
CRON_SECRET=<CHAVE_ALEATORIA_ALTA_ENTROPIA_HEX64>
```

> **Atenção:** Se `STORAGE_STAGING_BUCKET` ou `STORAGE_PUBLIC_BUCKET` estiverem ausentes ou forem iguais, a API entra em modo de contingência respondendo `503 Service Unavailable` nos endpoints de upload de mídia sem travar os demais serviços.

---

### 3.2. Script DDL Idempotente para PostgreSQL (Executar no Banco de Dados)

> [!CAUTION]
> **ATENÇÃO — DDL MANUAL DESTA SEÇÃO REPROVADO E SUBSTITUÍDO (BLOQUEADOR B01)**
> O script SQL manual abaixo continha divergências em relação aos schemas e migrações canônicas do sistema (`review_status` continha `'ACTIVE'` em vez de `'PUBLISHED'`; colunas divergentes como `reported_by` e `moderator_id` em vez de `reporter_id` e `admin_id`).
> **NÃO EXECUTE ESTE DDL MANUAL EM PRODUÇÃO.**
> O roteiro oficial e canônico de migração é gerenciado estritamente por `src/infra/drizzle/migrator.ts` (executado automaticamente no boot da aplicação ou via endpoint `GET /api/system/migrate`), conforme detalhado e homologado em `docs/ENTREGA_FECHAMENTO_B01_B08_MIDIA_2026-10-23.md`.

*(Script obsoleto mantido abaixo apenas para registro de histórico da auditoria B01)*:

```sql
-- 1. Criação dos enums necessários (caso não existam)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_purpose') THEN
    CREATE TYPE media_purpose AS ENUM (
      'USER_AVATAR',
      'BARBERSHOP_LOGO',
      'BARBERSHOP_COVER',
      'BARBERSHOP_GALLERY'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_status') THEN
    CREATE TYPE media_status AS ENUM (
      'PENDING',
      'PROCESSING',
      'READY',
      'REJECTED',
      'EXPIRED'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_owner_type') THEN
    CREATE TYPE media_owner_type AS ENUM (
      'USER',
      'BARBERSHOP'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
    CREATE TYPE review_status AS ENUM (
      'ACTIVE',
      'HIDDEN_BY_MODERATION',
      'DELETED_BY_AUTHOR'
    );
  END IF;
END $$;

-- 2. Tabela de Mídias e Pipeline de Processamento (A02 / A09)
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id),
  owner_type media_owner_type NOT NULL DEFAULT 'USER',
  owner_entity_id UUID,
  purpose media_purpose NOT NULL,
  status media_status NOT NULL DEFAULT 'PENDING',
  object_key TEXT NOT NULL,
  public_url TEXT,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  variants JSONB,
  generation INTEGER NOT NULL DEFAULT 1,
  lease_token TEXT,
  lease_expires_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices da tabela media
CREATE INDEX IF NOT EXISTS media_owner_id_idx ON media (owner_id);
CREATE INDEX IF NOT EXISTS media_owner_scope_idx ON media (owner_type, owner_entity_id);
CREATE INDEX IF NOT EXISTS media_status_idx ON media (status);
CREATE INDEX IF NOT EXISTS media_lease_idx ON media (status, lease_expires_at);

-- 3. Tabela de Galeria da Barbearia (A01)
CREATE TABLE IF NOT EXISTS barbershop_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
  display_order INTEGER NOT NULL DEFAULT 0,
  caption TEXT,
  is_cover BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices e restrições de atomicidade da galeria
CREATE INDEX IF NOT EXISTS barbershop_gallery_shop_idx ON barbershop_gallery (barbershop_id);
CREATE UNIQUE INDEX IF NOT EXISTS barbershop_gallery_shop_media_idx ON barbershop_gallery (barbershop_id, media_id);
CREATE UNIQUE INDEX IF NOT EXISTS barbershop_gallery_unique_cover_idx ON barbershop_gallery (barbershop_id) WHERE is_cover = true;

-- 4. Tabela de Avaliações com Versionamento Otimista (A06)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  status review_status NOT NULL DEFAULT 'ACTIVE',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unicidade estrita: 1 avaliação ativa por agendamento concluído
CREATE UNIQUE INDEX IF NOT EXISTS reviews_single_active_booking_idx ON reviews (booking_id) WHERE status != 'DELETED_BY_AUTHOR';
CREATE INDEX IF NOT EXISTS reviews_barbershop_status_idx ON reviews (barbershop_id, status);

-- 5. Tabelas de Auditoria e Denúncia de Avaliações
CREATE TABLE IF NOT EXISTS review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_moderation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  moderator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Adição de colunas na tabela barbershops (se ainda não existirem)
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) NOT NULL DEFAULT '0.00';
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;
```

---

### 3.3. Configuração do Scheduler para Limpeza de Storage

Configurar o job agendado (por exemplo, Cron do Cloudflare Workers, cronjob de servidor Linux ou GitHub Actions) para executar uma vez ao dia de madrugada:

```bash
# Execução da limpeza periódica de objetos órfãos
curl -X POST "https://api.smartbarber.app/api/internal/storage/cleanup" \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json"
```

A chamada retornará:
```json
{
  "processed": 0,
  "cleaned": 0,
  "errors": []
}
```
Caso `CRON_SECRET` seja inválido ou omitido, a rota recusa com `401 Unauthorized`.
