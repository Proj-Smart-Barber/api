# Relatório de Fechamento de Pendências: Mídia, Galeria e Avaliações (R01–R10)

**Data de Emissão:** 23 de Outubro de 2026  
**Status da Revisão:** APROVADO / VERIFICADO  
**Documentos Canônicos de Origem:**
- `docs/REVISAO_CORRECOES_MIDIA_AVALIACOES_2026-10-23.md` (Itens de Revisão R01–R10)
- `docs/PLANO_CONSOLIDADO_CORRECOES_MIDIA_AVALIACOES_2026-10-22.md` (Plano T01–T12)
- `docs/REVISAO_MIDIA_AVALIACOES_2026-10-22.md` (Achados originais F01–F12)

**Worktrees Isoladas:**
- Backend API: `D:/smart_barber/worktrees/api-midia-avaliacoes` (branch `feat/midia-galeria-avaliacoes`)
- Frontend: `D:/smart_barber/worktrees/frontend-midia-avaliacoes` (branch `feat/midia-galeria-avaliacoes`)

---

## 1. Matriz de Rastreabilidade e Resolução Integral (R01–R10)

| Item | Gravidade | Descrição do Bloqueador Original | Resolução Implementada | Rastreabilidade | Status |
|:---:|:---:|---|---|:---:|:---:|
| **R01** | P1 | Erro de tipagem no build da API (`StorageUnavailableError` não exportado, divergência de parâmetro `mimeType` em teste). | Exportado `StorageUnavailableError` em `src/infra/storage/storage-service-factory.ts`. Corrigido parâmetro para `mimeType` na suite `test/regressions/f01-f12-consolidated-regressions.spec.ts`. `npx tsc --noEmit` executado com 0 erros. | F12 / T12 | **CONCLUÍDO** |
| **R02** | P1 | Rota de limpeza `/api/internal/storage/cleanup` desprotegida e falhas de exclusão de storage mascaradas. | Controlador `StorageCleanupController` valida token estrito `CRON_SECRET` via header `Authorization: Bearer <token>`. Retorna `401 Unauthorized` se a variável não estiver definida ou o token for inválido. Registradas rotas `GET` e `POST` em `internal.routes.ts`. `StorageCleanupService` removeu `catch` vazio: falhas de remoção de arquivo são registradas em `errors[]`, não marcam `EXPIRED` e não contabilizam como sucesso. | F03 / T03 / T12 | **CONCLUÍDO** |
| **R03** | P1 | Concorrência de galeria: corrida no limite de 10 fotos e ausência de restrição de capa única no banco. | Adicionado lock em memória assíncrono por barbearia (`acquireLock`) no caso de uso `ManageBarbershopGalleryUseCase`. Criados índices únicos parciais no PostgreSQL (`barbershop_gallery_single_cover_idx` para `WHERE is_cover = true` e `barbershop_gallery_shop_media_idx`). Repositório Drizzle executa transação que desmarca capa anterior antes de promover nova capa. | F07 / T07 | **CONCLUÍDO** |
| **R04** | P1 | Avaliações: race condition no cálculo de métricas da barbearia, falta de CAS em remoção/moderação e vazamento de ID privado. | `ModerateReviewUseCase`, `DeleteReviewUseCase` e `UpdateReviewUseCase` exigem `expectedVersion` com CAS (`WHERE id = ? AND version = ?`), mapeando conflito para HTTP 409. `CreateReviewUseCase` mapeia unicidade (23505) para HTTP 409. Criado método dedicado `updateRatingMetrics(barbershopId, rating, reviewCount)` no repositório Drizzle para isolar escrita de métricas sem sobrescrever dados não relacionados via `save(shop)`. Listagem pública mascara ID do cliente (`review.customerId`), expondo apenas dados autorizados de apresentação. | F05 / F06 / T05 / T06 | **CONCLUÍDO** |
| **R05** | P1 | Escopo e ownership de mídia: uploads sem vínculo de entidade dona permitiam atrelar foto alheia à barbearia. | Adicionadas colunas `owner_type` (`USER` \| `BARBERSHOP`), `owner_entity_id` e índice `media_owner_scope_idx` no schema e entidade `Media`. `InitiateMediaUploadUseCase` valida e registra escopo. Casos de uso de galeria e logotipo bloqueiam mídia com dono divergente (`ownerEntityId !== barbershopId`). | F03 / F04 / T03 / T04 | **CONCLUÍDO** |
| **R06** | P1 | Upload sem lease/trava contra processamento concorrente; falta de persistência de variantes e status de polling. | Implementada transição transacional de lease `PENDING` -> `PROCESSING` em `ConfirmMediaUploadUseCase` (rejeitando confirmações concorrentes). Persistência de metadados de variantes (`jsonb`) e chave imutável versionada por geração (`variants/{id}/{gen}/main.ext`). Deleção de staging ocorre estritamente após commit no banco. Criado endpoint `GET /api/media/:mediaId/status` com controller e factory. | F03 / T03 | **CONCLUÍDO** |
| **R07** | P2 | Sharp Image Budgets: avatares e logos comerciais podiam exceder o limite de 512 KB. | Implementado método `optimizeBufferUnderBudget` no `SharpImageProcessor`. Aplica compressão progressiva com stepping de qualidade (82, 72, 60, 48) e conversão para WebP preservando canal alfa, garantindo que o payload final fique abaixo de 512 KB mantendo qualidade visual. | F02 / T02 | **CONCLUÍDO** |
| **R08** | P1 | Frontend: rascunho de avaliação era sobrescrito por refetches e troca de barbearia na galeria sofria corrida assíncrona. | Em `ReviewFormModal.tsx`, adicionado rastreamento de dirty state (`isDirty`) e `currentBookingIdRef`. Dados locais do usuário não são sobrescritos enquanto o rascunho estiver sendo editado. Em `BarbershopGalleryManager.tsx`, adicionado `activeShopIdRef` para descartar respostas defasadas vindas de barbearias anteriores. | F07 / F10 / T07 / T10 | **CONCLUÍDO** |
| **R09** | P1 | Seletor de arquivo limitado à Web no mobile e falta de feedback visual em falhas de galeria e avaliações. | `AvatarUploader.tsx` e `BarbershopGalleryManager.tsx` utilizam `expo-image-picker` no ecossistema mobile (iOS/Android) e input HTML na Web. Adicionado tratamento de erro com feedback visual nos botões e toasts em todas as operações de galeria. `BookingReviewAction.tsx` trata o status `HIDDEN_BY_MODERATION` e expõe erros ao usuário. Cliente de API `media.api.ts` suporta `AbortSignal`. | F01 / F09 / F11 / T01 / T09 / T11 | **CONCLUÍDO** |
| **R10** | P1/P2 | Validação frouxa de storage (`staging === public`) e respostas com 500 em vez de 503 sem storage. | `storage-service-factory.ts` exige que `STORAGE_BUCKET_STAGING !== STORAGE_BUCKET_PUBLIC` para considerar configurado. Caso desconfigurado, `InitiateMediaUploadController` e `ConfirmMediaUploadController` retornam `HTTP 503 Service Unavailable` limpo, sem afetar o restante da aplicação. | F12 / T12 | **CONCLUÍDO** |

---

## 2. Evidências de Validação Automatizada

### 2.1. Frontend (`worktrees/frontend-midia-avaliacoes`)
- **Verificação de Tipos TypeScript (`npm run typecheck`):**
  - **Zero erros.** (Código de saída: 0).
- **Suíte de Testes Automatizados (`npx vitest run`):**
  - **101 arquivos de teste executados.**
  - **663 testes executados com 100% de aprovação (PASS: 663, FAIL: 0).**
  - Todas as suítes de regressão da Fase 1 (monotonicidade, relógio PostgreSQL, filtros de passado, cancelamento e locks de agendamento) foram preservadas e continuam 100% verdes.

### 2.2. Backend API (`worktrees/api-midia-avaliacoes`)
- **Verificação de Tipos TypeScript (`npx tsc --noEmit`):**
  - **Zero erros.** (Código de saída: 0).
- **Suítes de Regressão e Casos de Uso (`npx vitest run`):**
  - `test/regressions/f01-f12-consolidated-regressions.spec.ts` (15 testes passando).
  - `src/domain/application/use-cases/reviews/reviews-use-cases.spec.ts` (14 testes passando).
  - `src/domain/application/use-cases/media/media-use-cases.spec.ts` (8 testes passando).
  - **Total de 37 testes unitários e de regressão executados com 100% de aprovação (PASS: 37, FAIL: 0).**

---

## 3. Roteiro Operacional para o Responsável Técnico (Álvaro)

### 3.1. Variáveis de Ambiente Obrigatórias (`.env`)

Configurar no ambiente seguro da API:

```env
# Storage S3 / Cloudflare R2
STORAGE_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_ACCESS_KEY_ID=<SUA_ACCESS_KEY_ID>
STORAGE_SECRET_ACCESS_KEY=<SUA_SECRET_ACCESS_KEY>
STORAGE_BUCKET_STAGING=smart-barber-staging
STORAGE_BUCKET_PUBLIC=smart-barber-public
STORAGE_PUBLIC_BASE_URL=https://cdn.smartbarber.app

# Chave Secreta para Trigger da Limpeza de Storage (Cron)
CRON_SECRET=<CHAVE_ALEATORIA_ALTA_ENTROPIA_HEX64>
```

> **Atenção:** Os nomes dos buckets de staging e público devem ser distintos. Se forem iguais ou ausentes, a API opera em modo de contingência respondendo `503 Service Unavailable` nos endpoints de upload sem derrubar o restante dos serviços.

### 3.2. Configuração de CORS no Cloudflare R2 / AWS S3

#### Bucket de Staging (`smart-barber-staging`):
Necessita de suporte a `PUT` direto via presigned URL a partir do frontend web e mobile:
```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://app.smartbarber.app</AllowedOrigin>
    <AllowedOrigin>https://smartbarber.app</AllowedOrigin>
    <AllowedOrigin>http://localhost:8081</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3600</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

#### Bucket Público (`smart-barber-public`):
Necessita apenas de `GET` e `HEAD` para entrega das imagens processadas:
```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>*</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <MaxAgeSeconds>86400</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

### 3.3. DDL de Migração no Banco de Dados (PostgreSQL)

Executar a migração correspondente às novas colunas e restrições atômicas:

```sql
-- 1. Colunas e índices de escopo e versionamento na tabela media
ALTER TABLE media
  ADD COLUMN IF NOT EXISTS owner_type VARCHAR(20) NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS owner_entity_id UUID,
  ADD COLUMN IF NOT EXISTS generation INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS variants JSONB;

CREATE INDEX IF NOT EXISTS media_owner_scope_idx 
  ON media (owner_type, owner_entity_id);

-- 2. Restrições atômicas e índices parciais na galeria da barbearia
CREATE UNIQUE INDEX IF NOT EXISTS barbershop_gallery_single_cover_idx
  ON barbershop_gallery (barbershop_id)
  WHERE is_cover = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS barbershop_gallery_shop_media_idx
  ON barbershop_gallery (barbershop_id, media_id);

-- 3. Índices de moderação e consulta de avaliações
CREATE INDEX IF NOT EXISTS reviews_status_idx 
  ON reviews (status);

CREATE INDEX IF NOT EXISTS reviews_shop_status_idx 
  ON reviews (barbershop_id, status);
```

### 3.4. Agendamento do Cron Job de Limpeza de Storage

Configurar o cron runner (ex: Cloudflare Cron Triggers, GitHub Actions ou crontab) para disparar a cada 30 minutos ou 1 hora:

```bash
curl -X POST https://api.smartbarber.app/api/internal/storage/cleanup \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json"
```

Resposta esperada (HTTP 200):
```json
{
  "cleanedCount": 0,
  "errors": []
}
```

---

## 4. Governança e Estado dos Repositórios

- **Git Commit / Push / PR:** Nenhum commit ou push foi realizado automaticamente. Todo o código permanece isolado nas worktrees `feat/midia-galeria-avaliacoes` pronto para conferência e integração do Álvaro.
- **Isolamento de Branches:** Worktrees estritamente separadas de `main`. O PR #51 permanece intocado e independente. Nenhuma alteração da Carteirinha ou estilos não relacionados foi introduzida.
