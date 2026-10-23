# Relatório de Entrega: Fases 2 e 3 — Mídia, Galeria do Espaço, Link do Google Maps e Avaliações Verificadas

**Data:** 22 de Outubro de 2026  
**Branches:** `feat/midia-galeria-avaliacoes` em ambos os repositórios  
**Worktrees Isoladas:**
- Backend API: `D:/smart_barber/worktrees/api-midia-avaliacoes`
- Frontend: `D:/smart_barber/worktrees/frontend-midia-avaliacoes`

---

## 1. Visão Geral da Entrega

A evolução do Smart Barber referente às **Fases 2 e 3** do plano canônico (`docs/PLANO_AGENDAMENTO_MIDIA_AVALIACOES_2026-10-22.md`) foi concluída de ponta a ponta com rigor arquitetural, segurança serverless, tipagem estrita e testes automatizados.

### Escopo Entregue

1. **Armazenamento de Objetos e Processamento Serverless de Imagens (Fase 2):**
   - Suporte nativo a Cloudflare R2 / S3 via `@aws-sdk/client-s3` com presigned URLs temporárias para upload direto cliente -> storage (evitando tráfego de arquivos pesados pelo gateway/processo serverless).
   - Validador seguro com inspeção de **Magic Bytes** reais (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF....WEBP`).
   - Rejeição estrita de SVG, HTML, scripts disfarçados e formato HEIC com mensagem instrucional clara ao usuário.
   - Decodificação de dimensões com trava máxima de 4.096 px e 16 megapixels contra ataques de descompressão/pixel flood.
   - Remoção pura de metadados sensíveis EXIF/GPS (`APP1`/segmentos de metadados em JPEG e chunks PNG/WebP).
   - Limites rígidos de tamanho: **5 MB** para fotos de perfil / logotipo e **10 MB** para fotos do espaço da barbearia.

2. **Galeria do Espaço e Identidade da Barbearia (Fase 2):**
   - Usuário autenticado altera/remove seu próprio `avatarUrl`.
   - Vínculo ativo `OWNER` permite alterar o logotipo oficial da barbearia (`barbershops.avatarUrl`).
   - Galeria do espaço gerenciada exclusivamente por `OWNER` ativo da unidade: upload, listagem ordenada, definição atômica de foto de capa (`coverUrl`) e remoção, respeitando o limite rígido de até **10 fotos**.

3. **Link Público do Perfil no Google Maps (Fase 3):**
   - Campo opcional `googleMapsUrl` na unidade, configurável exclusivamente pelo `OWNER` ativo.
   - Whitelist rigorosa de domínios permitidos (`maps.google.com`, `google.com`, `maps.app.goo.gl`, `goo.gl`) e exigência de protocolo seguro `https://`.
   - Botão de acesso externo oficial para clientes e visitantes sem poluição visual ou notas fictícias.
   - Zero dependência de Places API, sem importação de notas externas, mantendo as avaliações do Smart Barber autênticas.

4. **Avaliações Próprias e Moderação da Plataforma (Fase 3):**
   - Nota inteira de 1 a 5 estrelas e comentário opcional de até 1.000 caracteres.
   - Trava de unicidade no banco de dados (`unique_booking_review`): 1 avaliação por agendamento.
   - Regra de negócio estrita: somente o cliente beneficiário de reserva com status `COMPLETED` pode avaliar a unidade.
   - Proibição absoluta de autoavaliação por proprietários e barbeiros com vínculo ativo na unidade.
   - Exclusão lógica (`DELETED_BY_AUTHOR`) para auditoria sem quebrar unicidade de atendimento.
   - Edição permitida pelo autor com trava de concorrência (`version`); edição é impedida se a avaliação estiver sob censura/ocultada pela moderação.
   - Painel e fila de moderação restritos exclusivamente ao papel canônico `PLATFORM_ADMIN` (`HIDE` / `RESTORE` com registro obrigatório de log administrativo).
   - Denúncia de conteúdo disponível para qualquer usuário autenticado (`review_reports`).
   - Apresentação honesta: sem avaliações, o aplicativo exibe explicitamente **"Ainda sem avaliações"**, sem notas fabricadas ou estrelas falsas.

---

## 2. Configurações de Armazenamento (Cloudflare R2 / S3)

O provedor configurado é Cloudflare R2 (compatível com a API S3). Todas as credenciais permanecem **estritamente no backend**, sem qualquer exposição de segredos ou uso de variáveis `EXPO_PUBLIC_*`.

### Variáveis de Ambiente no Backend (`api/.env`):
- `STORAGE_PROVIDER`: `r2` (ou `s3`)
- `STORAGE_ENDPOINT`: Endpoint S3 do Cloudflare R2 (ex: `https://<account_id>.r2.cloudflarestorage.com`)
- `STORAGE_BUCKET_NAME`: Nome do bucket de mídia
- `STORAGE_ACCESS_KEY_ID`: ID da chave de acesso R2
- `STORAGE_SECRET_ACCESS_KEY`: Chave secreta de acesso R2
- `STORAGE_PUBLIC_URL_BASE`: Domínio público de distribuição (ex: `https://midia.smartbarber.com.br`)

### Frontend:
- O frontend consome apenas a API `/api/media/upload-intent`, que fornece URLs pré-assinadas temporárias (15 minutos de validade). Nenhum segredo ou chave reside no cliente web ou mobile.

---

## 3. Arquitetura do Backend (API)

### 3.1. Tabelas Adicionadas no Banco (Drizzle ORM)
- `media`: Registros de arquivos, metadados verificados (MIME real, dimensões, tamanho, chave de objeto, finalidade, estado de processamento, dono e expiração).
- `barbershop_gallery`: Associação ordenada de fotos da galeria da unidade, com trava de unicidade de capa (`is_cover`) e ordenação (`display_order`).
- `reviews`: Avaliações vinculadas a agendamento (`booking_id`), cliente (`customer_id`) e barbearia (`barbershop_id`), com nota de 1 a 5, versão e status (`PUBLISHED`, `HIDDEN_BY_MODERATION`, `DELETED_BY_AUTHOR`).
- `review_reports`: Denúncias registradas por usuários.
- `review_moderation_logs`: Histórico de auditoria das ações de moderação executadas por `PLATFORM_ADMIN`.

### 3.2. Endpoints HTTP Adicionados
- `POST /api/media/upload-intent`: Inicia intenção de upload e gera presigned URL.
- `POST /api/media/:mediaId/confirm`: Valida o arquivo no storage, analisa magic bytes, limpa EXIF e finaliza status.
- `PATCH /api/users/me/avatar`: Atualiza foto do perfil do usuário autenticado.
- `DELETE /api/users/me/avatar`: Remove foto do perfil do usuário autenticado.
- `PATCH /api/barbershops/:shopId/logo`: Atualiza logotipo oficial da barbearia (apenas OWNER).
- `PATCH /api/barbershops/:shopId/google-url`: Atualiza link oficial do Google Maps (apenas OWNER).
- `GET /api/barbershops/:shopId/gallery`: Lista galeria ordenada do espaço.
- `POST /api/barbershops/:shopId/gallery`: Adiciona foto à galeria (apenas OWNER, max 10).
- `DELETE /api/barbershops/:shopId/gallery/:galleryItemId`: Remove foto da galeria.
- `PATCH /api/barbershops/:shopId/gallery/:galleryItemId/cover`: Define foto como capa da barbearia.
- `PATCH /api/barbershops/:shopId/gallery/reorder`: Reordena fotos da galeria atomicamente.
- `POST /api/bookings/:bookingId/review`: Cria avaliação para agendamento COMPLETED.
- `GET /api/bookings/:bookingId/review`: Obtém avaliação do agendamento.
- `PATCH /api/bookings/:bookingId/review`: Edita avaliação existente.
- `DELETE /api/bookings/:bookingId/review`: Exclui logicamente a avaliação (DELETED_BY_AUTHOR).
- `GET /api/barbershops/:shopId/reviews`: Lista avaliações públicas paginadas com média recalculada.
- `POST /api/reviews/:reviewId/report`: Denuncia conteúdo de avaliação.
- `GET /api/reviews/moderation/queue`: Fila de moderação (apenas PLATFORM_ADMIN).
- `PATCH /api/reviews/:reviewId/moderation`: Ação de ocultar/restaurar avaliação (apenas PLATFORM_ADMIN).

---

## 4. Arquitetura do Frontend (Mobile + Web)

### 4.1. Módulos Criados
- `src/features/media`:
  - `api/media.api.ts`: Cliente HTTP para upload direto, confirmação, logo, galeria e link Google.
  - `model/use-media-upload.ts`: Hooks `useAvatarUpload` e `useBarbershopMedia` com validação de cliente (tamanho e recusa HEIC).
  - `model/google-maps.validator.ts`: Validador de domínio e formato de URL.
  - `ui/AvatarUploader.tsx`: Componente com BrandMark fallback, overlay de câmera, progresso e suporte web/native.
  - `ui/BarbershopGalleryManager.tsx`: Gerenciador para OWNER (upload, capa, remoção, limite 10 fotos).
  - `ui/BarbershopGalleryViewer.tsx`: Carrossel horizontal de fotos com lightbox/modal ampliado.
  - `ui/GoogleProfileLink.tsx`: Botão externo para clientes + formulário de edição para proprietário.
- `src/features/reviews`:
  - `api/reviews.api.ts`: Cliente HTTP completo de avaliações, denúncias e moderação.
  - `model/use-reviews.ts`: Hooks TanStack Query com invalidação cirúrgica de cache.
  - `ui/StarRating.tsx`: Seletor interativo 1-5 estrelas e badge estático com acessibilidade WCAG.
  - `ui/ReviewFormModal.tsx`: Modal de avaliação com contador dinâmico de 1.000 caracteres.
  - `ui/BarbershopReviewsList.tsx`: Lista pública, nota média agregada, fallback "Ainda sem avaliações" e denúncia.
  - `ui/BookingReviewAction.tsx`: Ação integrada aos cards de agendamento concluído.
  - `ui/ModerationQueueView.tsx`: Painel de moderação para PLATFORM_ADMIN.

### 4.2. Integração nas Telas do Aplicativo
- **Agendamentos (`src/features/bookings/ui/BookingCard.tsx`):**
  - Quando `booking.status === 'COMPLETED'`, renderiza `<BookingReviewAction />` permitindo avaliar ou editar/remover avaliação existente.
- **Descoberta (`src/features/discovery/ui/BarbershopCard.tsx`):**
  - Exibe badge com nota média `★ 4.8 (12)` ou `"Ainda sem avaliações"` quando a barbearia não possui avaliações.
- **Catálogo Público (`src/features/services/ui/PublicCatalogView.tsx`):**
  - Renderiza a galeria de fotos do espaço (`BarbershopGalleryViewer`), o link oficial do Google Maps (`GoogleProfileLink`) e a lista de avaliações verificadas (`BarbershopReviewsList`).
- **Configurações da Unidade (`src/features/settings/ui/AppearanceSettingsScreen.tsx`):**
  - Para o `OWNER` ativo da unidade, disponibiliza o gerenciamento do Logotipo oficial, do Link oficial do Google Maps e da Galeria de Fotos do Espaço.
- **Perfil do Usuário (`src/app/(client)/profile.tsx`):**
  - Substitui as iniciais estáticas pelo `<AvatarUploader />` integrado com o backend.
- **Painel da Plataforma (`src/app/(platform)/index.tsx`):**
  - Renderiza a fila de moderação administrativa (`ModerationQueueView`).

---

## 5. Resultados de Verificação e Qualidade

| Verificação | Repositório | Resultado | Detalhes |
|---|---|---|---|
| **Testes de Domínio & Storage** | Backend API | **288 passados, 0 falhas** | Testes de Magic bytes, EXIF, Cloudflare R2 loopback HTTP real, Use Cases de Mídia (8/8) e Avaliações (14/14). |
| **Compilação TypeScript (API)** | Backend API | **0 erros** (`tsc --noEmit`) | Tipagem estrita completa em contratos, entidades, casos de uso e rotas. |
| **Suíte de Testes do Frontend** | Frontend | **657 passados, 0 falhas** | 100 arquivos de teste verificados com Vitest, incluindo validações de tamanho, HEIC e Google Maps. |
| **Compilação TypeScript (Frontend)** | Frontend | **0 erros** (`tsc --noEmit`) | Validação estrita em todos os componentes e rotas Expo Router. |
| **Isolamento de Branches** | Ambos | **Preservado** | Worktrees dedicadas em `feat/midia-galeria-avaliacoes`. Nenhuma alteração no PR #51 ou na branch principal. |
| **Segurança de Credenciais** | Ambos | **100% aderente** | Zero secrets no frontend. Sem uso de `EXPO_PUBLIC_*` para chaves. Upload via presigned URLs com expiração curta. |
| **Preservação da Fase 1** | Ambos | **100% preservado** | Relógio PostgreSQL, filtros monotônicos, fusos horários e locks de agendamento permanecem intactos. |

---

## 6. Próximos Passos (Publicação Futura)

1. Revisão por pares das branches `feat/midia-galeria-avaliacoes` em ambos os repositórios.
2. Cadastro das variáveis de ambiente de produção do Cloudflare R2 no painel serverless do backend.
3. Execução da etapa 15 de migrações (`migrator.ts`) no ambiente de produção durante a janela de lançamento.
4. Abertura e merge dos respectivos Pull Requests.
