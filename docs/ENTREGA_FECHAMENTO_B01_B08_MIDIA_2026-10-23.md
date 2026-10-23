# Entrega Canônica: Fechamento dos Bloqueadores B01–B08 (Mídia R2 e Avaliações)

**Data de Conclusão:** 23/10/2026  
**Status:** Concluído e Homologado para Nova Revisão Independente  
**Worktrees de Trabalho:**
- API: `D:/smart_barber/worktrees/api-midia-avaliacoes` (branch `feat/midia-galeria-avaliacoes`)
- Frontend: `D:/smart_barber/worktrees/frontend-midia-avaliacoes` (branch `feat/midia-galeria-avaliacoes`)

---

## 1. Resumo Executivo

Esta entrega resolve integralmente os 8 bloqueadores (**B01–B08**) apontados na auditoria independente de 23/10/2026 (`REVISAO_ENTREGA_FINAL_MIDIA_R2_2026-10-23.md`), preservando as garantias anteriores de **A01–A10**, **R01–R10**, **F01–F12** e tarefas **T01–T12**.

O código foi corrigido de ponta a ponta: persistência, contratos, concorrência, use cases, componentes de interface, testes de contrato e regressões consolidadas. O DDL anterior foi expressamente retificado e substituído pelo sistema de migrações canônico do projeto.

---

## 2. Resolução Detalhada dos Bloqueadores B01–B08

### B01: Retificação do DDL e Alinhamento com as Migrações Canônicas (ORM Drizzle)
- **Causa Raiz:** O relatório anterior sugeria um script manual que continha incompatibilidades com as migrações gerenciadas (`review_status` continha o valor `'ACTIVE'` em vez de `'PUBLISHED'`, nomes de coluna discrepantes como `reported_by` e `moderator_id` em vez de `reporter_id` e `admin_id`).
- **Resolução:**
  1. A seção 3.2 de `ENTREGA_CORRECOES_FINAIS_MIDIA_E_R2_2026-10-23.md` foi oficialmente marcada com alerta de reprovação e obsolescência em ambos os repositórios.
  2. O mecanismo canônico de migração do produto é `src/infra/drizzle/migrator.ts` (`runSchemaMigrations`), executado automaticamente no boot da aplicação (`src/app.ts`) e disponível via endpoint administrativo seguro `GET /api/system/migrate`.
  3. Para ambientes que exigem execução manual via cliente SQL/psql, o script oficial e estritamente idêntico a `migrator.ts` é fornecido na Seção 4 deste documento.

### B02: Contrato CAS Obrigatório com `expectedVersion` em Exclusão e Moderação
- **Causa Raiz:** O backend já exigia `expectedVersion` como validação CAS, mas a camada de tipos, APIs e UIs do frontend permitiam chamadas sem a versão ou com versão opcional.
- **Resolução:**
  - `src/features/reviews/api/reviews.types.ts`: `UpdateReviewRequestDto` e `ModerateReviewRequestDto` tornaram `expectedVersion: number` estritamente obrigatório.
  - `src/features/reviews/api/reviews.api.ts`: `deleteReview(bookingId, expectedVersion, token?)` envia `expectedVersion` no corpo e nos query parameters (`?expectedVersion=...`); `moderateReview` envia `expectedVersion` no payload JSON.
  - `src/features/reviews/model/use-reviews.ts`: Hooks `useDeleteReview` e `useModerateReview` atualizados para exigir `expectedVersion`.
  - Componentes UI `BookingReviewAction.tsx`, `ModerationQueueView.tsx` e `ReviewFormModal.tsx` propagam a versão da entidade autoritativa sem atalhos ou conversões inseguras.
  - Suíte permanente `reviews-contract.test.ts` valida a propagação de `expectedVersion` para todas as chamadas HTTP.

### B03: Autorização Prévia ao Claim em Confirmação de Upload
- **Causa Raiz:** `ConfirmMediaUploadUseCase` executava `claimForProcessing` antes de verificar a titularidade do usuário, e se a mídia estivesse `READY`, retornava sucesso até para usuários não autorizados.
- **Resolução:**
  - Em `src/domain/application/use-cases/media/confirm-upload/confirm-upload.ts`:
    1. A mídia é primeiramente consultada via `findById`.
    2. A verificação de titularidade (`!current.isOwnedBy(new UniqueEntityId(dto.userId))`) é executada como primeiro gate. Se violada, retorna erro de autorização imediato sem alterar nenhum estado.
    3. Se a mídia já estiver `READY`, apenas o proprietário legítimo recebe retorno de sucesso (idempotência segura).
    4. O claim atômico com lease CAS (`claimForProcessing`) só é disparado após as validações de autorização e de status inicial.

### B04: Fencing de Lease contra Worker Vencido em Rejeições de Upload
- **Causa Raiz:** Rejeições por arquivo corrompido ou dimensões inválidas utilizavam `media.markRejected()` seguido de `mediaRepository.save(media)` incondicional, arriscando rebaixar para `REJECTED` uma mídia que outro worker já havia finalizado como `READY` após expiração do lease.
- **Resolução:**
  - Criado o método atômico no repositório:
    ```ts
    rejectProcessing(id: string, leaseToken: string, reason: string): Promise<boolean>
    ```
  - Implementado em `DrizzleMediaRepository` com filtro rigoroso:
    ```sql
    UPDATE media SET status = 'REJECTED', error_message = $1, lease_token = NULL, lease_expires_at = NULL, updated_at = NOW()
    WHERE id = $2 AND lease_token = $3 RETURNING id;
    ```
  - `ConfirmMediaUploadUseCase` substituiu todos os `save()` de rejeição por `rejectProcessing(media.id, leaseToken, reason)`. Se o lease foi perdido por timeout, o worker vencido não altera o registro.

### B05: Limpeza Segura Coordenada com Status e Geração no Banco
- **Causa Raiz:** `StorageCleanupService` excluía o objeto no storage e depois salvava `item.markExpired()` incondicionalmente, podendo deletar variantes públicas ou sobrescrever mídias que se tornaram `READY` concorrentemente.
- **Resolução:**
  - Adicionado no repositório o método atômico condicional:
    ```ts
    markExpiredConditional(id: string, params: { allowedStatuses: string[]; currentGeneration: number }): Promise<boolean>
    ```
  - No `StorageCleanupService`:
    1. A transição atômica no banco é executada primeiro. Se a mídia mudou de status ou avançou de geração (`generation`), a operação é abortada sem tocar no storage.
    2. A exclusão de arquivo só ocorre se a transição no banco teve sucesso e se o prefixo da chave for estritamente do staging (`item.objectKey.startsWith("staging/")`).

### B06: Verificação Integral do TypeScript Gate (Zero Erros)
- **Resolução:**
  - API: Fixture de teste em `test/regressions/f01-f12-consolidated-regressions.spec.ts` corrigida com a propriedade obrigatória `publicUrl`.
  - Frontend: Importação do utilitário `vi` ajustada em `reviews-contract.test.ts`.
  - Resultado: `npx tsc --noEmit` executado com **0 erros** em ambas as worktrees.

### B07: Transações Atômicas e Locks Pessimistas na Galeria e Avaliações
- **Causa Raiz:**
  - Em `setCoverPhotoAtomic`: a foto de capa anterior era desmarcada antes de validar a existência do item alvo; se o item não existisse, a capa ficava nula e o use case ignorava o retorno.
  - Em Avaliações: criação, edição e exclusão recalculavam métricas em chamadas separadas fora da transação de persistência da avaliação, permitindo condições de corrida em concorrência simultânea.
- **Resolução:**
  1. **Galeria:**
     - Em `DrizzleBarbershopGalleryRepository.setCoverPhotoAtomic`: valida a existência do item e pertencimento à barbearia antes de desmarcar a capa anterior.
     - Em `ManageBarbershopGalleryUseCase.setCover`: valida o retorno booleano e retorna erro explícito se a operação atômica falhar.
  2. **Avaliações:**
     - Criados os métodos atômicos transacionais no repositório:
       `createAtomic(review: Review): Promise<void>`
       `updateAtomic(review: Review, expectedVersion: number): Promise<boolean>`
       `deleteAtomic(review: Review, expectedVersion: number): Promise<boolean>`
     - Em todos eles e em `moderateReview`:
       1. Adquire lock pessimista na barbearia: `SELECT id FROM barbershops WHERE id = $1 FOR UPDATE`.
       2. Executa a mutação na tabela `reviews` sob verificação CAS de `version`.
       3. Recalcula `AVG(rating)` e `COUNT(*)` de avaliações `PUBLISHED` e atualiza as colunas agregadas em `barbershops` dentro da **mesma transação**.

### B08: Homologação e Cobertura de Regressões Permanentes
- **Resolução:**
  - Adicionadas regressões permanentes na suíte `test/regressions/f01-f12-consolidated-regressions.spec.ts`:
    - Rejeição de confirmação de estranho em mídias `READY` (B03).
    - Fencing de lease em rejeição tardia (B04).
    - Proteção contra expiração indevida de mídias ativas no cleanup (B05).
    - Integridade atômica da capa de galeria (B07).
    - Isolamento entre unidades na galeria e integridade estrita de reordenação (A03 / A04).
  - Resultados:
    - **API Regressões Canônicas:** 24 testes em 1 arquivo — **24 passed (100%)**.
    - **API Armazenamento R2 e Imagens:** 9 testes em 1 arquivo — **9 passed (100%)**.
    - **API Casos de Uso (Media & Reviews):** 22 testes em 2 arquivos — **22 passed (100%)**.
    - **Frontend Suíte Completa:** 666 testes em 101 arquivos — **666 passed (100%)**.

---

## 3. Matriz de Evidências por Camada

| Camada | Validação Executada | Resultado |
|---|---|---|
| **API TypeScript** | `npx tsc --noEmit` na worktree | **0 erros** |
| **API Regressões F01-F12 / B01-B08** | `npx vitest run test/regressions/f01-f12-consolidated-regressions.spec.ts` | **24/24 verdes** |
| **API R2 Storage & Codecs** | `npx vitest run src/infra/storage/r2-storage-service.spec.ts` | **9/9 verdes** |
| **API Media & Reviews Use Cases** | `npx vitest run src/domain/application/use-cases/media src/domain/application/use-cases/reviews` | **22/22 verdes** |
| **Frontend TypeScript** | `npm run typecheck` (`tsc --noEmit`) na worktree | **0 erros** |
| **Frontend Testes Gerais** | `npm test` (`vitest run`) na worktree | **101 arquivos, 666 testes verdes** |

---

## 4. Roteiro de Aplicação Canônica para o Álvaro (Backend)

O Álvaro pode aplicar as alterações em produção seguindo as instruções abaixo:

### Passo 1: Execução das Migrações Canônicas
O sistema utiliza migrações aditivas seguras (`IF NOT EXISTS`). O Álvaro tem duas opções idênticas:

#### Opção A (Recomendada): Via Boot ou Endpoint do Sistema
Basta iniciar a nova versão da API ou realizar uma requisição administrativa:
```bash
curl -X GET https://api-smartbarber.wellingtonsp.uk/api/system/migrate -H "Authorization: Bearer <ADMIN_SECRET>"
```
O método `runSchemaMigrations()` de `src/infra/drizzle/migrator.ts` aplicará todas as tabelas, colunas aditivas e índices de forma transacional e idempotente.

#### Opção B: Script SQL Canônico Idêntico ao ORM (PostgreSQL)
Caso prefira executar via `psql` direto no banco:
```sql
-- 1. Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Colunas de Mídia e Agregações em Barbershops
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS cover_url TEXT;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT '0.00' NOT NULL;
ALTER TABLE barbershops ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0 NOT NULL;

-- 3. Tabela de Mídias
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose VARCHAR(50) NOT NULL,
  object_key TEXT NOT NULL,
  public_url TEXT,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  status VARCHAR(20) DEFAULT 'PENDING' NOT NULL,
  owner_type VARCHAR(20) DEFAULT 'USER' NOT NULL,
  owner_entity_id UUID,
  generation INTEGER DEFAULT 1 NOT NULL,
  variants JSONB,
  lease_token TEXT,
  lease_expires_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS media_owner_idx ON media(owner_id);
CREATE INDEX IF NOT EXISTS media_status_idx ON media(status);
CREATE INDEX IF NOT EXISTS media_lease_expires_idx ON media(lease_expires_at);

-- 4. Tabela de Galeria da Barbearia
CREATE TABLE IF NOT EXISTS barbershop_gallery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL,
  caption VARCHAR(255),
  is_cover BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS barbershop_gallery_shop_order_idx ON barbershop_gallery(barbershop_id, display_order);
CREATE UNIQUE INDEX IF NOT EXISTS barbershop_gallery_unique_cover_idx ON barbershop_gallery(barbershop_id) WHERE is_cover = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS barbershop_gallery_shop_media_idx ON barbershop_gallery(barbershop_id, media_id);

-- 5. Tabelas de Avaliações, Denúncias e Auditoria
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  barbershop_id UUID NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  status TEXT DEFAULT 'PUBLISHED' NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS reviews_barbershop_status_idx ON reviews(barbershop_id, status);
CREATE INDEX IF NOT EXISTS reviews_customer_idx ON reviews(customer_id);

CREATE TABLE IF NOT EXISTS review_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS review_reports_review_idx ON review_reports(review_id);

CREATE TABLE IF NOT EXISTS review_moderation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS review_moderation_logs_review_idx ON review_moderation_logs(review_id);
```

### Passo 2: Configuração das Variáveis de Ambiente R2 no Backend
Aplicar as variáveis no `.env` do backend a partir do arquivo confidencial previamente recebido:
- `STORAGE_PROVIDER=r2`
- `STORAGE_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `STORAGE_STAGING_BUCKET=smartbarber`
- `STORAGE_PUBLIC_BUCKET=smartbarber-public`
- `STORAGE_PUBLIC_URL_PREFIX=https://midia-smartbarber.wellingtonsp.uk`
- `STORAGE_ACCESS_KEY_ID=<TOKEN_ACCESS_KEY>`
- `STORAGE_SECRET_ACCESS_KEY=<TOKEN_SECRET_KEY>`

---

## 5. Rastreabilidade Cruzada Completa

| Bloqueador | Problema Corrigido | Relacionamento Histórico | Arquivos Modificados Chave |
|---|---|---|---|
| **B01** | DDL incompatível com ORM | R01, A01, T01 | `migrator.ts`, `schema.ts`, `docs/ENTREGA_...` |
| **B02** | CAS `expectedVersion` incompleto no frontend | R05, A06, T05 | `reviews.types.ts`, `reviews.api.ts`, `BookingReviewAction.tsx`, `ModerationQueueView.tsx` |
| **B03** | Falta de autorização prévia ao claim de mídia | R04, A02, T02 | `confirm-upload.ts` |
| **B04** | Fencing de lease ausente em rejeições | R03, A02, T02 | `confirm-upload.ts`, `media-repository.ts`, `drizzle-media-repository.ts` |
| **B05** | Cleanup deletando mídias ativas | R08, A09, T08 | `storage-cleanup-service.ts`, `media-repository.ts`, `drizzle-media-repository.ts` |
| **B06** | Erro de compilação TypeScript em fixtures | R10, A10, T10 | `f01-f12-consolidated-regressions.spec.ts`, `reviews-contract.test.ts` |
| **B07** | Concorrência sem lock em capa e métricas | R06, R07, A01, A05, T07 | `drizzle-barbershop-gallery-repository.ts`, `drizzle-reviews-repository.ts`, use-cases de review |
| **B08** | Falta de testes permanentes para A03/A04/B03/B04/B05/B07 | R09, A10, T11 | `f01-f12-consolidated-regressions.spec.ts` |
