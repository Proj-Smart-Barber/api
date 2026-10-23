# Relatório Consolidado de Entrega: Mídia, Galeria, Link Google Maps e Avaliações Próprias

**Data de Conclusão:** 22 de Outubro de 2026  
**Documento Canônico de Referência:** `docs/PLANO_CONSOLIDADO_CORRECOES_MIDIA_AVALIACOES_2026-10-22.md`  
**Worktrees Isoladas:**
- Backend API: `D:/smart_barber/worktrees/api-midia-avaliacoes` (branch `feat/midia-galeria-avaliacoes`)
- Frontend Mobile/Web: `D:/smart_barber/worktrees/frontend-midia-avaliacoes` (branch `feat/midia-galeria-avaliacoes`)

---

## 1. Matriz de Resolução dos Achados da Auditoria (F01–F12)

| ID | Descrição do Achado | Resolução Implementada | Status | Evidência Automatizada |
|---|---|---|:---:|---|
| **F01** | Constante de limite da galeria ausente e testes invertidos no frontend | Adicionada constante canônica `MAX_GALLERY_PHOTO_SIZE_BYTES` (10 MiB) em `media.types.ts`. Adicionados testes garantindo que foto de galeria com 7 MiB seja aceita e avatar de 7 MiB seja recusado. | **PASS** | `src/features/media/tests/media-upload-validation.test.ts` (14/14 testes aprovados) |
| **F02** | Validação de imagem tolerava PNG truncado de 24 bytes e não limpava EXIF em uploads | Integrado `sharp` para decodificação segura com trava <=4.096 px e <=16 MP. `PureImageProcessor` corrigido exigindo chunks IHDR/IDAT/IEND (>=57 bytes). Rejeição imediata de imagens corrompidas e remoção comprovada de metadados EXIF/GPS. | **PASS** | `test/regressions/f01-f12-consolidated-regressions.spec.ts` (Cenário F02 aprovado) |
| **F03** | Upload direto sobrescrevia chave final e confirm permitia bypass de tamanho | Isolamento estrito entre `stagingBucket` (privado) e `publicBucket` (entrega). O cliente faz upload temporário no staging; `ConfirmMediaUploadUseCase` inspeciona o stream limitando leitura a 5/10 MiB, processa com Sharp, grava variantes sob chaves imutáveis (`variants/{mediaId}/main.{ext}`) no bucket público e remove o objeto de staging. | **PASS** | `ConfirmMediaUploadUseCase` e `test/regressions/f01-f12-consolidated-regressions.spec.ts` |
| **F04** | Bypass de autorização por `ownerId` dispensava papel `OWNER` ativo | Removida verificação ingênua `shop.ownerId === userId`. Todas as operações comerciais (logo, galeria, link Google) exigem estritamente `membership.role === 'OWNER'` e `membership.state === 'ACTIVE'`. | **PASS** | `UpdateBarbershopGoogleUrlUseCase`, `UpdateBarbershopLogoUseCase` e regressões F04 |
| **F05** | Avaliações sem trava de concorrência e moderação permitia restaurar avaliações excluídas pelo autor | Implementado CAS com `expectedVersion` e incremento atômico (`WHERE id = ? AND version = ?`). Moderação exige razão obrigatória (mínimo 3 caracteres) e proíbe estritamente a restauração de avaliações com status `DELETED_BY_AUTHOR`. Tratamento amigável de duplicidade (código 23505). | **PASS** | `UpdateReviewUseCase`, `ModerateReviewUseCase` e regressões F05 |
| **F06** | `GetBookingReviewController` vazava comentários sob moderação para requisições anônimas | Controlador exige autenticação obrigatória do cliente beneficiário da reserva e mascara o comentário (`undefined`/null) quando o status da avaliação for `HIDDEN_BY_MODERATION`. | **PASS** | `GetBookingReviewController` e regressões F06 |
| **F07** | Reordenação de galeria ignorava `itemIds` do frontend e limite de 10 fotos sofria corrida | `ManageBarbershopGalleryUseCase.reorder` recebe `itemIds: string[]`, valida unicidade e integridade com a unidade e atualiza as ordens atomicamente em transação. Checagem de idempotência de mídia precede o limite de 10 fotos. Primeira foto torna-se capa automaticamente; remoção de capa promove primeira foto restante. | **PASS** | `DrizzleBarbershopGalleryRepository`, `ManageBarbershopGalleryUseCase` e regressões F07 |
| **F08** | Descoberta e catálogo omitiam `coverUrl`, `rating`, `reviewCount` e `googleMapsUrl` | Consulta SQL (modos `searchAll` e `searchNearby`) atualizada no repositório Drizzle para incluir `cover_url`, média numérica calculada `rating`, contagem inteira `review_count` e `google_maps_url`. | **PASS** | `drizzle-discovery-repository.ts` e contratos de descoberta |
| **F09** | Remoção de logotipo da barbearia acionava DELETE de avatar pessoal | Implementada rota dedicada `DELETE /api/barbershops/:shopId/logo`, atualizando `avatarUrl` para `NULL` no PostgreSQL. `AppearanceSettingsScreen` passa `customRemove` apontando para a exclusão do logotipo comercial, preservando intacto o avatar do usuário. | **PASS** | `barbershop.routes.ts`, `media.api.ts` e `f01-f12-frontend-regressions.test.tsx` |
| **F10** | Formulário de avaliação assíncrono mantinha 5 estrelas e comentário vazio | Adicionado `useEffect` em `ReviewFormModal` sincronizando `rating` e `comment` quando o modal é exibido ou novos dados chegam da API, enviando `expectedVersion` na atualização. | **PASS** | `ReviewFormModal.tsx` e `f01-f12-frontend-regressions.test.tsx` |
| **F11** | Visualizador de galeria omitia `publicUrl`, impedindo exibição de imagens | `BarbershopGalleryItem` e mapeador Drizzle atualizados com `publicUrl` resolvido a partir do join com a tabela `media`. Controlador de listagem retorna `publicUrl` para todos os itens da galeria. | **PASS** | `BarbershopGalleryViewer.tsx` e `f01-f12-frontend-regressions.test.tsx` |
| **F12** | Storage configurado com defaults localhost fictícios e crash de importação | `src/infra/env/index.ts` canonizou todas as variáveis de storage. `UnconfiguredStorageService` foi criado para responder com `StorageUnavailableError` (HTTP 503) limpo caso o ambiente não possua credenciais R2 configuradas, sem quebrar módulos não relacionados. | **PASS** | `storage-service-factory.ts` e regressões F12 |

---

## 2. Resumo das Verificações Automatizadas

### Frontend (`Smart-Barber-frontend-mobile-web`)
- **Typecheck (`tsc --noEmit`):** Código de saída 0 (zero erros de tipagem).
- **Testes Vitest:** 101 arquivos de teste executados, **663 testes aprovados**, 0 falhas.
  - Inclui `src/features/media/tests/media-upload-validation.test.ts` (14 testes)
  - Inclui `src/features/media/tests/f01-f12-frontend-regressions.test.tsx` (4 testes)
  - Preservadas integralmente todas as regressões da Fase 1 (relógio, timezone, reservas, cancelamentos).

### Backend (`api`)
- **Testes de Casos de Uso:**
  - `src/domain/application/use-cases/media/media-use-cases.spec.ts` (8 testes aprovados)
  - `src/domain/application/use-cases/reviews/reviews-use-cases.spec.ts` (14 testes aprovados)
- **Suíte de Regressão Consolidada F01–F12:**
  - `test/regressions/f01-f12-consolidated-regressions.spec.ts` (15 testes aprovados)

---

## 3. Roteiro Operacional para o Backend (Álvaro)

Para ativar e operar o pipeline de mídia, armazenamento de objetos e moderação no ambiente de produção/homologação, siga as etapas abaixo:

### 3.1. Variáveis de Ambiente Canônicas (`.env`)

Configure as seguintes variáveis sem expor credenciais em commits ou logs:

```bash
# Provedor de Storage (Cloudflare R2 / AWS S3)
STORAGE_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
STORAGE_REGION=auto
STORAGE_ACCESS_KEY_ID=<CHAVE_R2_COM_PERMISSAO_PUT_GET_DELETE>
STORAGE_SECRET_ACCESS_KEY=<SEGREDO_R2>
STORAGE_STAGING_BUCKET=smartbarber-staging-private
STORAGE_PUBLIC_BUCKET=smartbarber-public-variants
STORAGE_PUBLIC_URL=https://media.smartbarber.com.br

# Autenticação de Tarefas de Manutenção (Limpeza de Staging)
CRON_SECRET=<CHAVE_SECRETA_ALFANUMERICA_MINIMO_32_CHARS>
```

### 3.2. Configuração dos Buckets Cloudflare R2

1. **Bucket de Staging (`smartbarber-staging-private`):**
   - Acesso público: **DESATIVADO** (Bucket estritamente privado).
   - Política de ciclo de vida (Lifecycle): Exclusão automática de objetos após 1 dia (para garantir expiração de arquivos não confirmados).
   - Configuração de **CORS** para upload direto:
     ```json
     [
       {
         "AllowedOrigins": ["https://app.smartbarber.com.br", "http://localhost:8081"],
         "AllowedMethods": ["PUT"],
         "AllowedHeaders": ["Content-Type", "Content-Length"],
         "MaxAgeSeconds": 3600
       }
     ]
     ```

2. **Bucket de Entrega Pública (`smartbarber-public-variants`):**
   - Conectado ao domínio customizado `media.smartbarber.com.br`.
   - Cabeçalhos de cache recomendados: `Cache-Control: public, max-age=31536000, immutable`.
   - As chaves gravadas pelo backend (`variants/{mediaId}/main.{ext}`) são imutáveis e não podem ser sobrescritas por clientes.

### 3.3. Configuração do Cron Job de Limpeza

O backend disponibiliza o endpoint protegido:
- **Rota:** `POST /api/internal/storage/cleanup`
- **Cabeçalho obrigatório:** `Authorization: Bearer <CRON_SECRET>`

No Vercel ou provedor de hospedagem, configure um Cron Job a cada 1 hora chamando este endpoint. Objetos temporários pendentes com mais de 2 horas no staging serão automaticamente deletados e suas entidades marcadas como `EXPIRED`.

### 3.4. Roteiro de Smoke Test Pós-Deploy

1. Realizar login com usuário cliente e fazer upload de avatar de teste (PNG < 5 MB).
2. Confirmar que a imagem final servida está hospedada em `media.smartbarber.com.br/variants/...`.
3. Tentar enviar arquivo HEIC ou SVG e verificar recusa com erro amigável.
4. Como `OWNER` ativo, cadastrar foto de galeria e definir capa da barbearia.
5. Inspecionar o bucket de staging e constatar que o arquivo intermediário foi removido após a confirmação.

---

## 4. Guia para o Frontend

1. **Variáveis Públicas:** Nenhuma credencial ou segredo do storage é injetado no frontend. O cliente apenas consome as presigned URLs geradas temporariamente pelo backend.
2. **Build Web & Mobile:** As chamadas de API respeitam timeout, cancelamento via `AbortController`, e tratam HTTP 503 com alerta informativo caso o serviço de armazenamento esteja temporariamente indisponível.

---

## 5. Descrições Formais dos Pull Requests (Prontos para Revisão)

### PR Backend: `feat/midia-galeria-avaliacoes`

**Título:** `feat: pipeline de midia r2, galeria do espaco, link google maps e avaliacoes com cas`

**Resumo das Alterações:**
- Criação das tabelas `media`, `barbershop_gallery`, `reviews`, `review_reports` e `review_moderation_logs`.
- Pipeline de upload direto para staging privado com processamento seguro via `sharp` (normalização, remoção de EXIF, variantes e checagem de pixels <= 16 MP).
- Armazenamento de variantes imutáveis no bucket público com deleção automática do staging.
- Implementação de regras de autorização estritas exigindo vínculo `OWNER` ativo para logo, fotos do espaço e URL do Google Maps.
- Rota dedicada `DELETE /api/barbershops/:shopId/logo` que atualiza o logotipo para `NULL` no PostgreSQL.
- Sistema de avaliações verificadas (1 a 5 estrelas) vinculado exclusivamente a atendimentos `COMPLETED`, com trava de concorrência otimista (CAS via `expectedVersion`) e moderação segura restrita a `PLATFORM_ADMIN`.
- Suíte completa de testes unitários e de regressão permanente cobrindo os cenários F01–F12.

---

### PR Frontend: `feat/midia-galeria-avaliacoes`

**Título:** `feat: upload universal de midia, gerenciamento de galeria, link google e avaliacoes`

**Resumo das Alterações:**
- Adição da constante canônica `MAX_GALLERY_PHOTO_SIZE_BYTES` (10 MiB) e alinhamento de validações de extensão e tipo MIME.
- Criação e integração dos módulos `src/features/media` e `src/features/reviews`.
- Suporte a upload e remoção isolada de logotipo da barbearia em `AppearanceSettingsScreen`, desacoplado do avatar de usuário.
- Sincronização em tempo real do formulário de avaliação assíncrono em `ReviewFormModal` (correção F10) com suporte a `expectedVersion`.
- Controles acessíveis de reordenação de fotos da galeria com navegação e chamadas atômicas a `reorderGallery`.
- Apresentação honesta de avaliações ("Ainda sem avaliações" quando zerado, e alertas visíveis explícitos em caso de erro de conexão).
- 101 suítes de teste passando integralmente (663 testes) e typecheck com zero erros.
