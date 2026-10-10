# AGENTS.md

## Project Overview

SmartBarber API — a barbershop management/booking backend built with Express + TypeScript, following clean architecture (DDD-style layering). The application is broken into framework-agnostic domain layers and infrastructure concerns so that business rules can be tested in isolation.

The HTTP app (`src/app.ts`) is separated from the process that listens (`src/server.ts`) so the app can also run as a serverless function (Vercel). Persistence uses Drizzle ORM over PostgreSQL.

## Tech Stack

- **Runtime/Framework:** Node.js, Express 5, TypeScript
- **Database:** PostgreSQL via `bitnami/postgresql` docker-compose; Drizzle ORM + drizzle-kit for schema/migrations. Uses `drizzle-orm/node-postgres` locally and `drizzle-orm/neon-serverless` when `NODE_ENV=production` (Neon).
- **Validation:** Zod (env schema + controller input schemas)
- **Auth/Security:** bcryptjs (password hashing), jsonwebtoken + ms (JWT access tokens), SHA-256 opaque refresh tokens with family-based rotation
- **Email:** React Email templates rendered to HTML/text, delivered with Resend
- **API docs:** Swagger UI served at `/docs`, OpenAPI document at `/docs-json`
- **Testing:** Vitest (globals enabled) with in-memory repositories and fakes
- **Lint/format:** Biome; **Git hooks:** Husky + lint-staged + commitlint (Conventional Commits)
- **Scripts runner:** tsx (dev watch, seeds, verification scripts)
- **Deployment:** Vercel (`vercel.json` builds `src/app.ts` with `@vercel/node`)

## Directory Layout

```
src/
  core/                                # Framework-agnostic building blocks
    crypto/token.ts                    # generateOpaqueToken, hashToken (SHA-256)
    entities/                          # Entity base class + UniqueEntityId
    errors/                            # UseCaseError interface
    infra/                              # Generic HTTP plumbing
      adapters/express-route-adapter.ts # adaptRoute: Controller -> Express handler
      controller.ts                    # Controller interface (handle(request) -> HttpResponse)
      http-response.ts                 # ok/created/clientError/notFound/... response helpers
    logic/                             # Either (left/right) monad
    types/                             # Optional<T, K> helper type
  domain/
    enterprise/                        # Core domain model
      entities/                        # Entities (user, barbershop, booking, service, ...)
        value-objects/                 # Password, Slug, Cpf
      errors/                          # Entity-level errors (e.g. invalid-cpf-error)
      mappers/                         # Domain <-> persistence mappers (static-only classes)
    application/
      repositories/                    # Repository interfaces (ports)
      services/                        # Domain service interfaces (auth tokens, email, ...)
      use-cases/                       # Business use-cases organized by domain
        _errors/                       # Domain-specific errors (implement UseCaseError)
        barbershop/ booking/ invitations/ notifications/ schedule/ service/ users/
                                       # Each use-case folder: DTO, Response, use-case + colocated .spec.ts
  infra/
    drizzle/                           # Persistence layer
      schema.ts                        # Drizzle table/enum definitions + relations
      index.ts                         # DB client (selects Neon vs node-postgres by NODE_ENV)
      migrator.ts                      # runSchemaMigrations(): idempotent startup migrations
      seed.ts                          # Basic seed script
      mappers/                         # Drizzle row <-> domain mappers
      repositories/                    # Drizzle repository implementations
      demo-seed/                       # Isolated demo-data engine (dry-run/apply/rollback/verify)
    email/                             # React Email renderers, templates/, ResendEmailService
    env/index.ts                       # Zod-validated environment variables (exposes `env`)
    http/
      controllers/                     # Controller implementations (grouped by domain)
      factories/                       # make-*Controller(): dependency wiring
      middlewares/                     # ensureUserIsAuthenticated, optionalUserAuthentication
      routes/                          # Express routers (see routes/index.ts)
      swagger/index.ts                 # OpenAPI document
  app.ts                               # Builds and exports the Express app
  server.ts                            # Process entry point: app.listen(env.PORT)
test/
  setup.ts                             # Vitest setup (loads dotenv)
  fakes/                               # Test doubles (e.g. fake-email-service)
  repositories/                        # In-memory implementations of repository interfaces
scripts/                               # Manual verification scripts (verify-http-services, verify-full-e2e)
drizzle/                               # Generated migrations + snapshots
```

## Commands

```bash
# Dev server (tsx watch on src/server.ts, port from env.PORT, default 3333)
npm run dev

# Tests
npm test          # vitest run
npm run test:watch

# Database (drizzle-kit), requires DATABASE_URL in .env and Postgres running
npm run db:seed       # src/infra/drizzle/seed.ts
npm run db:push       # push schema to DB
npm run db:migrate    # run migrations
npm run db:generate   # generate migration from schema
npm run db:studio     # open drizzle studio

# Demo seed (isolated demo data engine)
npm run db:seed:demo:dry-run   # simulate, no writes
npm run db:seed:demo:apply     # write (requires confirm secret for remote/production)
npm run db:seed:demo:verify    # verify generated data
npm run db:seed:demo:rollback  # remove demo data

# Lint / format (Biome)
npm run lint        # biome check .
npm run lint:fix    # biome check --write .
npm run format      # biome format --write .
npm run check       # biome ci . (CI-style, no writes)
```

Stand up Postgres with the included `docker-compose.yml` (`POSTGRESQL_USERNAME/PASSWORD=docker`, DB `smartbarber`).

## Environment Variables

Validated at import time by `src/infra/env/index.ts` (Zod); the app fails fast if required vars are missing. Names only — never commit real values (`.env` is gitignored and there is no committed `.env.example`).

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_SECRET` | yes | Signs access tokens |
| `ACCESS_TOKEN_EXPIRES_IN` | default `15m` | JWT access token TTL |
| `REFRESH_TOKEN_EXPIRES_IN` | default `30d` | Opaque refresh token TTL |
| `JWT_EXPIRES_IN` | optional | Legacy/optional |
| `PORT` | default `3333` | Coerced to number |
| `NODE_ENV` | yes | Also selects the DB driver |
| `APP_URL` | yes | Public API URL (Swagger server) |
| `FRONTEND_URL` | optional | Empty string is normalized to `undefined` |
| `RESEND_API_KEY` | yes | Resend API key |
| `EMAIL_FROM` | yes | From address for transactional email |
| `VERIFICATION_TOKEN_EXPIRES_IN` | default `1d` | Email verification token TTL |
| `PASSWORD_RECOVERY_TOKEN_EXPIRES_IN` | default `1h` | Password recovery token TTL |
| `INVITATION_EXPIRES_IN` | default `7d` | Barbershop invitation TTL |

## Coding Conventions

### Entities
- Extend the `Entity<T>` base class in `src/core/entities/Entity.ts`.
- Store all properties in a private/protected `props` object; prefer read-only getters. Mutation happens through intent-revealing methods (e.g. `user.verifyEmail(at)`, `user.changePassword(newPassword)`). A few entities expose setters (e.g. `schedule-exception.ts`) for simpler updates.
- Provide a `static create(props, id?)` factory that assigns `createdAt` and constructs the entity.
- Use `UniqueEntityId` for IDs and reference other entities by their `UniqueEntityId`.
- `Optional<Props, "createdAt">` makes `createdAt` optional on input.

Example pattern (see `src/domain/enterprise/entities/user.ts`):
```ts
interface UserProps { name: string; email: string; password: Password; cpf: string; /* ... */ createdAt?: Date; }

export class User extends Entity<UserProps> {
  get name(): string { return this.props.name; }
  // ... more getters + behavior methods

  static create(props: Optional<UserProps, "createdAt">, id?: UniqueEntityId) {
    return new User({ ...props, createdAt: new Date() }, id);
  }
}
```

### Value objects
- Small immutable objects with static factories: `Password`, `Slug`, `Cpf` (see `entities/value-objects/`).
- `Password` uses bcryptjs (`generateHashFromPlainText`, `isValid` returning `Either`).
- `Cpf` validates on creation and pairs with `entities/errors/invalid-cpf-error.ts`.

### Use-cases
- Receive dependencies (repository/service interfaces) via constructor injection.
- Expose a single `execute(dto)` method.
- Return `Either<Error, Response>` (from `src/core/logic/either.ts`), returning `left(...)` for failure and `right(...)` for success.
- Input payloads typed as `*DTO`; success output typed as `*Response`.
- Domain errors live in `use-cases/_errors/` and implement `UseCaseError` (e.g. `ResourceNotFoundError`, `NotAllowedError`, `BookingConflictError`).

Example (see `src/domain/application/use-cases/users/create-user/create-user.ts`):
```ts
export class CreateUserUseCase {
  constructor(private usersRepository: UsersRepository) {}

  async execute({ name, email, password, cpf }: CreateUserDTO): Promise<CreateUserResponse> {
    // ... return left(error) | right({ user })
  }
}
```

### Repositories
- Interface (port) in `src/domain/application/repositories/*-repository.ts`.
- Drizzle implementation in `src/infra/drizzle/repositories/drizzle-*-repository.ts`.
- In-memory implementation for tests in `test/repositories/in-memory-*-repository.ts`.

### Mappers
- Domain ↔ persistence mappers are **static-only classes** (add `// biome-ignore lint/complexity/noStaticOnlyClass` per the existing convention).
- Domain-side mappers (`domain/enterprise/mappers/*`) expose `toDomain` / `toPersistence`.
- Drizzle row mappers (`infra/drizzle/mappers/drizzle-*-mapper.ts`) expose `toDrizzle` / `toDomain` for HTTP serialization and hydration.

### Services
- Interface in `src/domain/application/services/*` (e.g. `EmailService`, token services).
- Implementations live in `src/infra/...` (e.g. `ResendEmailService`).
- Test doubles live in `test/fakes/`.

## HTTP Layer

- **Controller:** implement the `Controller` interface (`src/core/infra/controller.ts`) with `handle(request): Promise<HttpResponse>`.
- **Responses:** use helpers from `src/core/infra/http-response.ts` (`ok`, `created`, `accepted`, `noContent`, `clientError`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `tooManyRequests`, `fail`).
- **Adapter:** `adaptRoute(controller)` merges `request.body`, `request.params`, `request.query`, and `request.user?.sub` (as `userId`) into the request passed to `handle`. Non-2xx responses are normalized to `{ error: message }`.
- **Validation:** controllers parse input with Zod schemas and return `clientError({ error: z.prettifyError(error) })` on `ZodError`.
- **Factories:** `src/infra/http/factories/make-*-controller.ts` wire repositories + use-cases into controllers; routes call `adaptRoute(makeXController())`.
- **Routes:** registered under `/api` in `src/infra/http/routes/index.ts`:
  - `/users` and alias `/staffs`, `/invitations`, `/notifications`, `/barbershops`, `/bookings`
  - `/barbershops/:shopId` (schedule + barbershop invitation routes, `Router({ mergeParams: true })`)
  - Health check at `/`; Swagger UI at `/docs`, spec at `/docs-json`
- **System endpoints:** `GET /api/system/migrate` (runs idempotent migrations), `GET/POST /api/system/demo-seed` (dry-run / confirmed apply).

## Auth & Security

- **Access tokens:** JWT signed with `JWT_SECRET` via `createAccessToken(userId)` (`domain/application/services/auth-token-service.ts`); TTL from `ACCESS_TOKEN_EXPIRES_IN`.
- **Refresh tokens:** opaque random tokens (`core/crypto/token.ts`) stored SHA-256 hashed in `refresh_tokens` with a `family_id`, rotation (`replaced_by_token_id`) and revocation — see `createRefreshToken` and the `refresh-session` use-case.
- **Middlewares:** `ensureUserIsAuthenticated` (401 if missing/invalid/expired; loads the user) and `optionalUserAuthentication` (continues as guest). Both attach `request.user = { sub }`.
- **Roles:** `OWNER` / `BARBERMAN` (`roleEnum`), enforced per-use-case via `NotAllowedError` / `UnauthorizedError`.
- **Email verification:** a user may be blocked by `EmailNotVerifiedError` until `emailVerifiedAt` is set.

## Email

- `EmailService` interface defines `sendVerificationEmail`, `sendPasswordRecoveryEmail`, `sendInvitationEmail`.
- `ResendEmailService` (infra) renders React Email templates and sends via Resend using `EMAIL_FROM`.
- Templates in `src/infra/email/templates/` with render helpers (`render-*-email.tsx`) covered by `.spec.tsx` tests.
- `test/fakes/fake-email-service.ts` is used in use-case tests.

## Database & Migrations

- Schema, enums (`role`, `barbershop_status`, `invitation_status`) and relations live in `src/infra/drizzle/schema.ts`. Core tables include `users`, `refresh_tokens`, `email_verifications`, `password_recovery_tokens`, `barbershops`, `membership`, `invitations`, `services`, `service_items`, `shopping_carts`, `bookings`, `barbershop_schedules`, `schedule_exceptions`, `notifications`.
- `runSchemaMigrations()` (`src/infra/drizzle/migrator.ts`) applies **idempotent** DDL on server boot and via `GET /api/system/migrate`. Historically it unifies `staffs`/`customers` into `users`, adds snapshot columns to `service_items`, and creates `refresh_tokens`/`invitations` + constraints/indexes when missing.
- `drizzle-kit` handles schema push/generate/migrate (`drizzle.config.ts` points at `schema.ts`, output `./drizzle`).

## Demo Seed

`src/infra/drizzle/demo-seed/` generates isolated, namespaced demo data (dry-run, apply, rollback, verify). See `cli.ts` for flags (`--apply`, `--rollback`, `--dry-run`, `--replenish`, `--confirm=<secret>`). It writes `.demo-seed-credentials.json` and `.demo-seed-manifest.json` (both gitignored) and refuses remote/production writes without the confirm secret (`CONFIRMAR_SEED_DEMO_PRODUCAO`).

## Testing

- Vitest with `globals: true`; setup file `test/setup.ts` loads dotenv via `dotenv/config`.
- Use-case specs are colocated: `use-cases/<domain>/<use-case>/<use-case>.spec.ts`.
- Controller specs instantiate controllers directly with in-memory repositories/fakes (no HTTP server needed).
- Prefer in-memory repositories (`test/repositories/`) and fakes (`test/fakes/`) over hitting the database.
- `scripts/verify-http-services.ts` and `scripts/verify-full-e2e.ts` spin up the app on an ephemeral port for manual end-to-end checks (not part of `npm test`).

## Code Quality & Tooling

- **Biome** is the linter/formatter (`biome.json`): recommended rules, 2-space indent, double quotes, semicolons, some paths ignored (`drizzle`, `seed.ts`, config files).
- **Husky hooks** (`.husky/`): `pre-commit` runs `lint-staged` (Biome on staged files); `commit-msg` runs `commitlint`.
- **commitlint** extends `@commitlint/config-conventional` → use **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`, ...).

## Deployment

- `vercel.json` builds `src/app.ts` with `@vercel/node` and rewrites all paths to it; `src/server.ts` is used for local/runtime process listening.
- In production the DB client uses the Neon serverless driver; locally it uses node-postgres.

## Git Conventions

- **Regra de Nomenclatura Neutra:** Nunca incluir "coder", "codex", "antigravity" ou qualquer nome de ferramenta/agente de IA em nomes de branch, mensagens de commit, pull requests ou qualquer artefato de código. Sempre utilizar nomenclaturas convencionais e neutras (ex.: `feat/...`, `fix/...`, `chore/...`, `refactor/...`).
- Commit messages must follow Conventional Commits (enforced by commitlint).
