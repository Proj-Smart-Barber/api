# SmartBarber API

[![CI/CD](https://github.com/Proj-Smart-Barber/api/actions/workflows/ci-cd.yml/badge.svg?branch=main)](https://github.com/Proj-Smart-Barber/api/actions/workflows/ci-cd.yml)

Backend do **SmartBarber**, uma plataforma de gestão e agendamento para barbearias. A API cobre cadastro e autenticação de usuários (donos, barbeiros e clientes), barbearias, equipe e convites, serviços, horários de funcionamento, agendamentos, avaliações, notificações e mídia.

## Tecnologias

- Node.js 24, TypeScript, Express 5
- PostgreSQL + Drizzle ORM
- Zod (validação), JWT + refresh tokens opacos (autenticação), bcryptjs
- React Email + Resend (e-mails transacionais)
- Vitest (testes), Biome (lint/format), Husky + commitlint (Conventional Commits)
- tsup (build), Docker, GitHub Actions (CI/CD), GitHub Container Registry

## Pré-requisitos

- Node.js 24+ e npm
- Docker (para subir o PostgreSQL local ou rodar a imagem da API)

## Como executar localmente

```bash
# 1. Instalar dependências
npm ci

# 2. Subir o PostgreSQL (usuário/senha: docker, banco: smartbarber)
docker compose up -d

# 3. Criar o arquivo .env na raiz (veja as variáveis abaixo)

# 4. Rodar em modo desenvolvimento (http://localhost:3333)
npm run dev
```

Documentação Swagger em `http://localhost:3333/docs`.

### Variáveis de ambiente

Obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`.

Opcionais: `PORT` (padrão `3333`), `FRONTEND_URL`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, variáveis `STORAGE_*` (mídia em storage S3/R2), `CRON_SECRET`, `SYSTEM_MAINTENANCE_SECRET`.

Exemplo mínimo de `.env`:

```env
DATABASE_URL=postgresql://docker:docker@localhost:5432/smartbarber
JWT_SECRET=troque-por-um-segredo
NODE_ENV=development
APP_URL=http://localhost:3333
RESEND_API_KEY=re_sua_chave
EMAIL_FROM="SmartBarber <noreply@seudominio.com>"
```

## Testes

```bash
npm run test:ci   # suíte unitária usada no CI (sem banco de dados)
npm test          # suíte completa (os testes de integração exigem PostgreSQL isolado na porta 55432)
```

## Build e execução em produção

```bash
npm run build     # gera dist/server.js
npm start         # node dist/server.js
```

## Docker

```bash
# Construir localmente
docker build -t smartbarber-api .

# Ou baixar a imagem publicada pelo pipeline
docker pull ghcr.io/proj-smart-barber/api:latest

# Executar
docker run -p 3333:3333 --env-file .env ghcr.io/proj-smart-barber/api:latest
```

## CI/CD

O pipeline está em [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml).

- **Gatilhos:** abertura ou atualização de Pull Requests para `main` e pushes na `main` (também pode ser disparado manualmente).
- **CI:** checkout → Node.js 24 + `npm ci` → `npm run test:ci` → `npm run build` → upload do artefato `dist/`.
- **CD (Entrega Contínua):** somente em pushes na `main` e após o CI passar, a imagem Docker é publicada no GitHub Container Registry com as tags `latest`, `v1.0.<número da execução>` e `sha-<commit>`. A implantação é feita manualmente com `docker pull` / `docker run`.

## Fluxo de branches

- `main`: versão estável.
- `feat/*`, `fix/*`, `ci/*`, ...: desenvolvimento de funcionalidades e correções.
- Alterações entram na `main` por Pull Request, depois que o pipeline passa.
