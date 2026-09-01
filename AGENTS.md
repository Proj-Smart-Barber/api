# AGENTS.md

## Project Overview

SmartBarber API — a barbershop management/booking backend built with Express + TypeScript, following clean architecture (DDD-style layering). The application is broken into framework-agnostic domain layers and infrastructure concerns so that business rules can be tested in isolation.

## Tech Stack

- **Runtime/Framework:** Node.js, Express 5, TypeScript
- **Database:** PostgreSQL via `bitnami/postgresql` docker-compose; Drizzle ORM + drizzle-kit for schema/migrations
- **Auth/Security:** bcryptjs for password hashing
- **Testing:** Vitest (globals enabled)
- **Scripts runner:** tsx (used for dev watch and the seed script)

## Directory Layout

```
src/
  core/                                # Framework-agnostic building blocks
    entities/                          # Entity base class + UniqueEntityId
    errors/                            # UseCaseError interface
    logic/                             # Either (left/right) monad
    types/                             # Optional<T, K> helper type
  domain/
    enterprise/entities/               # Domain entities + value objects
      value-objects/                   # Password, Slug
    application/
      repositories/                    # Repository interfaces (e.g. staffs-repository)
      use-cases/                       # Business use-cases organized by domain
        _errors/                       # Domain-specific errors (implement UseCaseError)
        staff/create-staff/            # DTO, Response, use-case + colocated .spec.ts
  infra/
    drizzle/                           # Persistence layer
      schema.ts                        # Drizzle table/enum definitions + relations
      index.ts                         # DB client (reads DATABASE_URL)
      seed.ts                          # Seed script
  app.ts                               # Express entry point and HTTP server
test/
  setup.ts                             # Vitest setup (loads dotenv)
  repositories/                        # In-memory implementations of repository interfaces
drizzle/                               # Generated migrations + snapshots
```

## Commands

```bash
# Dev server (tsx watch on src/app.ts, port 3333)
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
```

Stand up Postgres with the included `docker-compose.yml` (`POSTGRESQL_USERNAME/PASSWORD=docker`, DB `smartbarber`).

## Coding Conventions

### Entities
- Extend the `Entity<T>` base class in `src/core/entities/Entity.ts`.
- Store all properties in a private/protected `props` object; expose read-only getters (no setters).
- Provide a `static create(props, id?)` factory that assigns `createdAt` and constructs the entity.
- Use `UniqueEntityId` for IDs and reference other entities by their `UniqueEntityId`.
- `Optional<Props, "createdAt">` makes `createdAt` optional on input.

Example pattern (see `src/domain/enterprise/entities/staff.ts`):
```ts
interface StaffProps { name: string; email: string; ...; createdAt?: Date; }

export class Staff extends Entity<StaffProps> {
  get name() { return this.props.name; }
  // ... more getters

  static create(props: Optional<StaffProps, "createdAt">, id?: UniqueEntityId) {
    return new Staff({ ...props, createdAt: new Date() }, id);
  }
}
```

### Value objects
- Small immutable objects like `Password` and `Slug` with static factory methods.
- `Password` uses bcryptjs for hashing and validation.

### Use-cases
- Receive dependencies (repository interfaces) via constructor injection.
- Expose a single `execute(dto)` method.
- Return `Either<Error, Response>` (from `src/core/logic/either.ts`), returning `left(...)` for failure and `right(...)` for success.
- Input payloads typed as `*DTO`; success output typed as `*Response`.

Example (see `src/domain/application/use-cases/staff/create-staff/create-staff.ts`):
```ts
export class CreateStaffUseCase {
  constructor(private staffsRepository: StaffsRepository) {}

  async execute({ name, email, password, cpf }: CreateStaffDTO): Promise<CreateStaffResponse> {