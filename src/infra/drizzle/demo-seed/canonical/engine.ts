import { reconcileDemoGeography } from "../geography";
import { LEGACY_REGIONAL_BARBERSHOPS } from "./legacy-regional-barbershops";
import {
  planRetiredBarbershops,
  type RegisteredBarbershop,
} from "./retired-barbershops";
import type { SeedRegistryRecord } from "./types";
import {
  createReadStream,
  openSync,
  readSync,
  closeSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "../../index";
import type { SeedDatabase } from "./database";
import { env } from "../../../env";
import {
  barbershopSchedules,
  barbershops,
  bookings,
  bookingEvents,
  bookingServiceItems,
  users,
  membership,
  scheduleExceptions,
  serviceItems,
  services,
  shoppingCarts,
} from "../../schema";
import {
  DEMO_BARBERSHOPS,
  DEMO_BOOKINGS,
  DEMO_CUSTOMERS,
  DEMO_EXCEPTIONS,
  DEMO_STAFFS,
  buildDemoSchedules,
  DEMO_SERVICES,
  buildDemoMemberships,
} from "./fixtures";
import { SeedRegistryManager } from "./registry";
import {
  DEFAULT_DEMO_PASSWORD,
  hashPlainText,
  inspectDatabaseTarget,
  loadOrCreateStaffCredentials,
} from "./security";
import {
  DEMO_SEED_NAMESPACE,
  type DemoSeedExecutionSummary,
  type DemoSeedProfileFixtures,
} from "./types";

const MANIFEST_FILE_PATH = resolve(process.cwd(), ".demo-seed-manifest.json");

export interface SeedEngineOptions {
  dryRun?: boolean;
  rollback?: boolean;
  confirmSecret?: string;
  forceReplenishDisposables?: boolean;
  profile?: "smoke" | "full";
  fullProfileFixtures?: DemoSeedProfileFixtures;
  confirmFullProductionTarget?: string;
  productionBackupPath?: string;
  productionBackupSha256?: string;
}

interface VerifiedProductionBackup {
  sha256: string;
  sizeBytes: number;
  verifiedAt: string;
}

async function verifyProductionSeedBackup(
  backupPath: string,
  expectedSha256: string,
): Promise<VerifiedProductionBackup> {
  if (!isAbsolute(backupPath)) {
    throw new Error("Production backup path must be absolute.");
  }
  const absolutePath = resolve(backupPath);
  const sourceRoot = resolve(__dirname, "../../../../..");
  const relativePath = relative(sourceRoot, absolutePath);
  if (
    relativePath === "" ||
    (!isAbsolute(relativePath) &&
      relativePath !== ".." &&
      !relativePath.startsWith(`..${sep}`))
  ) {
    throw new Error("Production backup must be outside the source checkout.");
  }

  const stats = statSync(absolutePath);
  const ageMs = Date.now() - stats.mtimeMs;
  if (
    !stats.isFile() ||
    stats.size < 5 ||
    ageMs < 0 ||
    ageMs > 24 * 60 * 60 * 1000
  ) {
    throw new Error(
      "Production backup is missing, empty, or older than 24 hours.",
    );
  }

  const header = Buffer.alloc(5);
  const fileDescriptor = openSync(absolutePath, "r");
  try {
    readSync(fileDescriptor, header, 0, header.length, 0);
  } finally {
    closeSync(fileDescriptor);
  }
  if (header.toString("ascii") !== "PGDMP") {
    throw new Error(
      "Production backup is not a PostgreSQL custom-format dump.",
    );
  }

  const hash = createHash("sha256");
  for await (const chunk of createReadStream(absolutePath)) hash.update(chunk);
  const sha256 = hash.digest("hex");
  if (sha256.toLowerCase() !== expectedSha256.toLowerCase()) {
    throw new Error(
      "Production backup SHA-256 does not match the confirmation.",
    );
  }

  return {
    sha256,
    sizeBytes: stats.size,
    verifiedAt: new Date().toISOString(),
  };
}

export class DemoSeedEngine {
  private registry: SeedRegistryManager;

  constructor(private database: SeedDatabase = db) {
    this.registry = new SeedRegistryManager(database);
  }

  private getTodayDateSP(): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
    }).format(new Date());
  }

  private calculateDateFromOffset(
    baseDateStr: string,
    offsetDays: number,
  ): {
    dateString: string;
    utcDate: Date;
  } {
    const [year, month, day] = baseDateStr.split("-").map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() + offsetDays);

    const yearStr = d.getUTCFullYear();
    const monthStr = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dayStr = String(d.getUTCDate()).padStart(2, "0");
    const dateString = `${yearStr}-${monthStr}-${dayStr}`;
    const utcDate = new Date(`${dateString}T00:00:00.000Z`);

    return { dateString, utcDate };
  }

  async run(
    options: SeedEngineOptions = {},
  ): Promise<DemoSeedExecutionSummary> {
    const isDryRun = options.dryRun ?? false;
    const profile = options.profile ?? "smoke";
    const fullProfile =
      profile === "full" ? (options.fullProfileFixtures ?? null) : null;
    if (profile === "full" && !fullProfile) {
      throw new Error(
        "The full seed profile must be built by its CLI entry point.",
      );
    }
    const seedStaffs = fullProfile?.staffs ?? DEMO_STAFFS;
    const seedBarbershops = fullProfile?.barbershops ?? DEMO_BARBERSHOPS;
    const seedMemberships = fullProfile?.memberships ?? buildDemoMemberships();
    const seedSchedules = fullProfile?.schedules ?? buildDemoSchedules();
    const seedServices = fullProfile?.services ?? DEMO_SERVICES;
    const seedCustomers = fullProfile?.customers ?? DEMO_CUSTOMERS;
    const seedExceptions = fullProfile?.exceptions ?? DEMO_EXCEPTIONS;
    const seedBookings = fullProfile?.bookings ?? DEMO_BOOKINGS;
    const targetInfo = inspectDatabaseTarget(env.DATABASE_URL);

    // ── Preflight de Segurança de Banco ──────────────────────────
    if (!targetInfo.isLocal && !isDryRun) {
      if (options.confirmSecret !== "CONFIRMAR_SEED_DEMO_PRODUCAO") {
        throw new Error(
          `[DEMO SEED BLOQUEADO] O banco alvo (${targetInfo.host}:${targetInfo.port}/${targetInfo.database}) NÃO é local. ` +
            `Para executar a escrita real em ambiente de produção, forneça a flag: --confirm=CONFIRMAR_SEED_DEMO_PRODUCAO`,
        );
      }
    }
    let productionBackup: VerifiedProductionBackup | undefined;
    if (profile === "full" && !targetInfo.isLocal && !isDryRun) {
      if (options.confirmFullProductionTarget !== targetInfo.database) {
        throw new Error(
          "[FULL SEED BLOQUEADO] Confirme o nome exato do banco remoto com --confirm-full-production=<database>.",
        );
      }
      if (!options.productionBackupPath || !options.productionBackupSha256) {
        throw new Error(
          "[FULL SEED BLOQUEADO] Informe o dump recente e seu SHA-256 com --production-backup e --production-backup-sha256.",
        );
      }
      productionBackup = await verifyProductionSeedBackup(
        options.productionBackupPath,
        options.productionBackupSha256,
      );
      console.log(
        `[DemoSeed] Produção confirmada: ${targetInfo.database}; backup verificado (${productionBackup.sizeBytes} bytes, SHA-256 ${productionBackup.sha256}).`,
      );
    }

    // ── Rollback ────────────────────────────────────────────────
    if (options.rollback) {
      if (isDryRun) {
        console.log(
          `[DemoSeed] Dry-run ativo para rollback: nenhuma exclusão será realizada no banco.`,
        );
        return {
          namespace: DEMO_SEED_NAMESPACE,
          baseDateSP: this.getTodayDateSP(),
          targetDatabase: targetInfo,
          dryRun: true,
          counts: {},
          createdIds: {},
        };
      }

      console.log(
        `[DemoSeed] Iniciando rollback cirúrgico do namespace '${DEMO_SEED_NAMESPACE}'...`,
      );
      const deletedCounts = await this.registry.rollback(DEMO_SEED_NAMESPACE);
      console.log("[DemoSeed] Rollback concluído com sucesso:", deletedCounts);

      return {
        namespace: DEMO_SEED_NAMESPACE,
        baseDateSP: this.getTodayDateSP(),
        targetDatabase: targetInfo,
        dryRun: false,
        counts: Object.fromEntries(
          Object.entries(deletedCounts).map(([k, v]) => [
            k,
            { planned: 0, created: 0, reused: v },
          ]),
        ),
        createdIds: {},
      };
    }

    const baseDateSP = this.getTodayDateSP();
    const existingRegistry = isDryRun
      ? await this.safeGetRegistryMap(DEMO_SEED_NAMESPACE)
      : await this.registry.getExistingRecords(DEMO_SEED_NAMESPACE);
    await this.assertSeedIdentities(
      existingRegistry,
      seedStaffs,
      seedCustomers,
      seedBarbershops,
    );
    const retirementPlan = await this.inspectRetiredBarbershops(
      existingRegistry,
      seedBarbershops,
    );

    const counts: Record<
      string,
      { planned: number; created: number; reused: number }
    > = {
      staffs: { planned: seedStaffs.length, created: 0, reused: 0 },
      barbershops: { planned: seedBarbershops.length, created: 0, reused: 0 },
      membership: {
        planned: seedMemberships.length,
        created: 0,
        reused: 0,
      },
      barbershop_schedules: { planned: 0, created: 0, reused: 0 },
      services: { planned: seedServices.length, created: 0, reused: 0 },
      customers: { planned: seedCustomers.length, created: 0, reused: 0 },
      schedule_exceptions: {
        planned: seedExceptions.length,
        created: 0,
        reused: 0,
      },
      service_items: { planned: seedBookings.length, created: 0, reused: 0 },
      shopping_carts: { planned: seedBookings.length, created: 0, reused: 0 },
      bookings: { planned: seedBookings.length, created: 0, reused: 0 },
    };

    const resolvedIds: Record<string, string> = {};

    // ── 1. Staffs e Credenciais ─────────────────────────────────
    const staffCredentials = !isDryRun
      ? await loadOrCreateStaffCredentials(
          seedStaffs.filter((staff) => !existingRegistry.has(staff.logicalKey)),
          {
            standardized: profile === "full",
            credentialsFilePath:
              profile === "full"
                ? ".demo-seed-full-credentials.json"
                : undefined,
          },
        )
      : ({} as Record<string, { passwordHash: string }>);

    for (const staffFixture of seedStaffs) {
      const reg = existingRegistry.get(staffFixture.logicalKey);
      if (reg) {
        resolvedIds[staffFixture.logicalKey] = reg.recordId;
        counts.staffs.reused++;

        // Registered users are reused without modifying credentials or profile fields.
      } else {
        counts.staffs.created++;
        if (!isDryRun) {
          // Prevenção de colisão por e-mail preexistente fora do registry
          const existingByEmail = await this.database
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, staffFixture.email));

          let staffId: string;
          if (existingByEmail.length > 0) {
            staffId = existingByEmail[0].id;
            throw new Error(
              "Colisão de usuário não registrado no namespace do seed.",
            );
          } else {
            const cred = staffCredentials[staffFixture.logicalKey];
            const [created] = await this.database
              .insert(users)
              .values({
                name: staffFixture.name,
                email: staffFixture.email,
                password: cred.passwordHash,
                cpf: staffFixture.cpf,
                emailVerifiedAt: new Date(),
                accountType: staffFixture.role === "OWNER" ? "OWNER" : "BARBER",
              })
              .returning({ id: users.id });
            staffId = created.id;
          }

          resolvedIds[staffFixture.logicalKey] = staffId;
          await this.registry.recordEntry(
            DEMO_SEED_NAMESPACE,
            staffFixture.logicalKey,
            "users",
            staffId,
          );
        } else {
          resolvedIds[staffFixture.logicalKey] =
            `dry-run-staff-${staffFixture.logicalKey}`;
        }
      }
    }

    // ── 2. Barbearias ───────────────────────────────────────────
    for (const shopFixture of seedBarbershops) {
      const reg = existingRegistry.get(shopFixture.logicalKey);
      if (reg) {
        resolvedIds[shopFixture.logicalKey] = reg.recordId;
        counts.barbershops.reused++;
      } else {
        counts.barbershops.created++;
        if (!isDryRun) {
          const ownerId = resolvedIds[shopFixture.ownerLogicalKey];
          if (!ownerId) {
            throw new Error(
              `Owner não encontrado para barbearia ${shopFixture.name}`,
            );
          }

          const existingBySlug = await this.database
            .select({ id: barbershops.id })
            .from(barbershops)
            .where(eq(barbershops.slug, shopFixture.slug));

          let shopId: string;
          if (existingBySlug.length > 0) {
            throw new Error(
              "Colisão de barbearia não registrada no namespace do seed.",
            );
          } else {
            const [created] = await this.database
              .insert(barbershops)
              .values({
                name: shopFixture.name,
                ownerId,
                slug: shopFixture.slug,
                cnpj: shopFixture.cnpj,
                location: shopFixture.location,
                timezone: shopFixture.timezone,
                status: shopFixture.status,
              })
              .returning({ id: barbershops.id });
            shopId = created.id;
          }

          resolvedIds[shopFixture.logicalKey] = shopId;
          await this.registry.recordEntry(
            DEMO_SEED_NAMESPACE,
            shopFixture.logicalKey,
            "barbershops",
            shopId,
          );
        } else {
          resolvedIds[shopFixture.logicalKey] =
            `dry-run-shop-${shopFixture.logicalKey}`;
        }
      }
    }

    for (const shopFixture of seedBarbershops) {
      if (isDryRun || !shopFixture.point) continue;
      const result = await reconcileDemoGeography(
        this.database,
        resolvedIds[shopFixture.logicalKey],
        shopFixture as any,
        resolvedIds[shopFixture.ownerLogicalKey],
      );
      resolvedIds[`${shopFixture.logicalKey}:location`] = result.locationId;
    }

    // ── 3. Memberships ──────────────────────────────────────────
    const allMemberships = seedMemberships;
    counts.membership.planned = allMemberships.length;

    for (const membershipFixture of allMemberships) {
      const membershipKey = membershipFixture.logicalKey;
      const reg = existingRegistry.get(membershipKey);

      if (reg) {
        resolvedIds[membershipKey] = reg.recordId;
        counts.membership.reused++;
      } else {
        counts.membership.created++;
        if (!isDryRun) {
          const barbershopId =
            resolvedIds[membershipFixture.barbershopLogicalKey];
          const staffId = resolvedIds[membershipFixture.staffLogicalKey];

          const existingMember = await this.database
            .select({ id: membership.id })
            .from(membership)
            .where(
              sql`${membership.barbershopId} = ${barbershopId} AND ${membership.userId} = ${staffId}`,
            );

          let memberId: string;
          if (existingMember.length > 0) {
            memberId = existingMember[0].id;
          } else {
            const [created] = await this.database
              .insert(membership)
              .values({
                barbershopId,
                userId: staffId,
                role: membershipFixture.role,
              })
              .returning({ id: membership.id });
            memberId = created.id;
          }

          resolvedIds[membershipKey] = memberId;
          await this.registry.recordEntry(
            DEMO_SEED_NAMESPACE,
            membershipKey,
            "membership",
            memberId,
          );
        } else {
          resolvedIds[membershipKey] = `dry-run-member-${membershipKey}`;
        }
      }
    }

    // ── 4. Jornadas (barbershop_schedules) ──────────────────────
    const allSchedules = seedSchedules;
    counts.barbershop_schedules.planned = allSchedules.length;

    for (const scheduleFixture of allSchedules) {
      const reg = existingRegistry.get(scheduleFixture.logicalKey);

      if (reg) {
        resolvedIds[scheduleFixture.logicalKey] = reg.recordId;
        counts.barbershop_schedules.reused++;
      } else {
        counts.barbershop_schedules.created++;
        if (!isDryRun) {
          const barbershopId =
            resolvedIds[scheduleFixture.barbershopLogicalKey];
          const createdBy = resolvedIds[scheduleFixture.createdByLogicalKey];
          const barbermanId = scheduleFixture.barbermanLogicalKey
            ? resolvedIds[scheduleFixture.barbermanLogicalKey]
            : null;

          const [created] = await this.database
            .insert(barbershopSchedules)
            .values({
              barbershopId,
              createdBy,
              barbermanId,
              dayOfWeek: scheduleFixture.dayOfWeek,
              openTime: scheduleFixture.openTime,
              closeTime: scheduleFixture.closeTime,
            })
            .returning({ id: barbershopSchedules.id });

          resolvedIds[scheduleFixture.logicalKey] = created.id;
          await this.registry.recordEntry(
            DEMO_SEED_NAMESPACE,
            scheduleFixture.logicalKey,
            "barbershop_schedules",
            created.id,
          );
        } else {
          resolvedIds[scheduleFixture.logicalKey] =
            `dry-run-schedule-${scheduleFixture.logicalKey}`;
        }
      }
    }

    // ── 5. Serviços (services) ──────────────────────────────────
    for (const serviceFixture of seedServices) {
      const reg = existingRegistry.get(serviceFixture.logicalKey);

      if (reg) {
        resolvedIds[serviceFixture.logicalKey] = reg.recordId;
        counts.services.reused++;
      } else {
        counts.services.created++;
        if (!isDryRun) {
          const barbershopId = resolvedIds[serviceFixture.barbershopLogicalKey];

          const [created] = await this.database
            .insert(services)
            .values({
              barbershopId,
              title: serviceFixture.title,
              description: serviceFixture.description,
              priceInCents: serviceFixture.priceInCents,
              durationInMinutes: serviceFixture.durationInMinutes,
              isActive: serviceFixture.isActive,
            })
            .returning({ id: services.id });

          resolvedIds[serviceFixture.logicalKey] = created.id;
          await this.registry.recordEntry(
            DEMO_SEED_NAMESPACE,
            serviceFixture.logicalKey,
            "services",
            created.id,
          );
        } else {
          resolvedIds[serviceFixture.logicalKey] =
            `dry-run-service-${serviceFixture.logicalKey}`;
        }
      }
    }

    // ── 6. Clientes (customers) ─────────────────────────────────
    const customerPasswordHash = await hashPlainText(DEFAULT_DEMO_PASSWORD);

    for (const customerFixture of seedCustomers) {
      const reg = existingRegistry.get(customerFixture.logicalKey);

      if (reg) {
        resolvedIds[customerFixture.logicalKey] = reg.recordId;
        counts.customers.reused++;

        // Preserve existing customer credentials and identity.
      } else {
        counts.customers.created++;
        if (!isDryRun) {
          const existingByEmail = await this.database
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, customerFixture.email));

          let customerId: string;
          if (existingByEmail.length > 0) {
            throw new Error(
              "Colisão de cliente não registrado no namespace do seed.",
            );
          } else {
            const [created] = await this.database
              .insert(users)
              .values({
                name: customerFixture.name,
                email: customerFixture.email,
                password: customerPasswordHash,
                cpf: customerFixture.cpf,
                phoneNumber: customerFixture.phoneNumber,
                emailVerifiedAt: new Date(),
                accountType: "CLIENT",
              })
              .returning({ id: users.id });
            customerId = created.id;
          }

          resolvedIds[customerFixture.logicalKey] = customerId;
          await this.registry.recordEntry(
            DEMO_SEED_NAMESPACE,
            customerFixture.logicalKey,
            "users",
            customerId,
          );
        } else {
          resolvedIds[customerFixture.logicalKey] =
            `dry-run-customer-${customerFixture.logicalKey}`;
        }
      }
    }

    // ── 7. Exceções de Jornada (schedule_exceptions) ────────────
    for (const exceptionFixture of seedExceptions) {
      const reg = existingRegistry.get(exceptionFixture.logicalKey);

      if (reg) {
        resolvedIds[exceptionFixture.logicalKey] = reg.recordId;
        counts.schedule_exceptions.reused++;
      } else {
        counts.schedule_exceptions.created++;
        if (!isDryRun) {
          const barbershopId =
            resolvedIds[exceptionFixture.barbershopLogicalKey];
          const barbermanId = exceptionFixture.barbermanLogicalKey
            ? resolvedIds[exceptionFixture.barbermanLogicalKey]
            : null;
          const { utcDate } = this.calculateDateFromOffset(
            baseDateSP,
            exceptionFixture.dateOffsetDays,
          );

          const [created] = await this.database
            .insert(scheduleExceptions)
            .values({
              barbershopId,
              barbermanId,
              date: utcDate,
              startTime: exceptionFixture.startTime ?? null,
              endTime: exceptionFixture.endTime ?? null,
              reason: exceptionFixture.reason,
            })
            .returning({ id: scheduleExceptions.id });

          resolvedIds[exceptionFixture.logicalKey] = created.id;
          await this.registry.recordEntry(
            DEMO_SEED_NAMESPACE,
            exceptionFixture.logicalKey,
            "schedule_exceptions",
            created.id,
          );
        } else {
          resolvedIds[exceptionFixture.logicalKey] =
            `dry-run-exception-${exceptionFixture.logicalKey}`;
        }
      }
    }

    // ── 8. Reservas, Itens e Carrinhos (service_items, shopping_carts, bookings)
    for (const bookingFixture of seedBookings) {
      const regBooking = existingRegistry.get(bookingFixture.logicalKey);

      let needCreation = !regBooking;

      if (regBooking) {
        if (!isDryRun) {
          const [exists] = await this.database
            .select({
              id: bookings.id,
              status: bookings.status,
              startsAt: bookings.startsAt,
            })
            .from(bookings)
            .where(eq(bookings.id, regBooking.recordId));

          const isDisposableStale =
            bookingFixture.isDisposable &&
            (!exists ||
              exists.status === "CANCELLED" ||
              (exists.startsAt && exists.startsAt.getTime() <= Date.now()));

          if (
            (!exists || isDisposableStale) &&
            options.forceReplenishDisposables
          ) {
            needCreation = true;
          } else {
            resolvedIds[bookingFixture.logicalKey] = regBooking.recordId;
            counts.bookings.reused++;
            counts.service_items.reused++;
            counts.shopping_carts.reused++;
            continue;
          }
        } else {
          resolvedIds[bookingFixture.logicalKey] = regBooking.recordId;
          counts.bookings.reused++;
          counts.service_items.reused++;
          counts.shopping_carts.reused++;
          continue;
        }
      }

      if (needCreation) {
        counts.bookings.created++;
        counts.service_items.created++;
        counts.shopping_carts.created++;

        if (!isDryRun) {
          const barbershopId = resolvedIds[bookingFixture.barbershopLogicalKey];
          const barbermanId = resolvedIds[bookingFixture.barbermanLogicalKey];
          const customerId = resolvedIds[bookingFixture.customerLogicalKey];
          const serviceId = resolvedIds[bookingFixture.serviceLogicalKey];

          // Busca snapshot do serviço correspondente
          const [serviceRow] = await this.database
            .select()
            .from(services)
            .where(eq(services.id, serviceId));

          if (!serviceRow) {
            throw new Error(
              `Serviço ${serviceId} não encontrado para reserva ${bookingFixture.logicalKey}`,
            );
          }

          // 1. service_items
          const [serviceItem] = await this.database
            .insert(serviceItems)
            .values({
              serviceId,
              titleSnapshot: serviceRow.title,
              priceInCentsSnapshot: serviceRow.priceInCents,
              durationInMinutesSnapshot: serviceRow.durationInMinutes,
            })
            .returning({ id: serviceItems.id });

          const itemKey = `${bookingFixture.logicalKey}:service_item`;
          resolvedIds[itemKey] = serviceItem.id;
          await this.registry.recordEntry(
            DEMO_SEED_NAMESPACE,
            itemKey,
            "service_items",
            serviceItem.id,
          );

          // 2. shopping_carts
          const [cart] = await this.database
            .insert(shoppingCarts)
            .values({
              serviceItemId: serviceItem.id,
              userId: customerId,
              totalPriceInCents: serviceRow.priceInCents,
            })
            .returning({ id: shoppingCarts.id });

          const cartKey = `${bookingFixture.logicalKey}:shopping_cart`;
          resolvedIds[cartKey] = cart.id;
          await this.registry.recordEntry(
            DEMO_SEED_NAMESPACE,
            cartKey,
            "shopping_carts",
            cart.id,
          );

          // 3. bookings
          const { utcDate, dateString } = this.calculateDateFromOffset(
            baseDateSP,
            bookingFixture.dateOffsetDays,
          );

          const startsAt = new Date(
            `${dateString}T${bookingFixture.startTime}:00-03:00`,
          );
          const endsAt = new Date(
            `${dateString}T${bookingFixture.endTime}:00-03:00`,
          );

          const [booking] = await this.database
            .insert(bookings)
            .values({
              barbershopId,
              barbermanId,
              customerId,
              shoppingCartId: cart.id,
              date: utcDate,
              startTime: bookingFixture.startTime,
              endTime: bookingFixture.endTime,
              startsAt,
              endsAt,
              totalPriceInCents: serviceRow.priceInCents,
              totalDurationInMinutes: serviceRow.durationInMinutes,
              createdByUserId: customerId,
              status: bookingFixture.status ?? "CONFIRMED",
            })
            .returning({ id: bookings.id });

          resolvedIds[bookingFixture.logicalKey] = booking.id;
          // Fresh seeds must populate the current booking model as well as legacy cart snapshots.
          const [snapshot] = await this.database
            .insert(bookingServiceItems)
            .values({
              bookingId: booking.id,
              serviceId,
              title: serviceRow.title,
              priceInCents: serviceRow.priceInCents,
              durationInMinutes: serviceRow.durationInMinutes,
              legacyAggregate: false,
            })
            .returning({ id: bookingServiceItems.id });
          await this.registry.recordEntry(
            DEMO_SEED_NAMESPACE,
            `${bookingFixture.logicalKey}:snapshot`,
            "booking_service_items",
            snapshot.id,
          );
          const [event] = await this.database
            .insert(bookingEvents)
            .values({
              bookingId: booking.id,
              actorId: customerId,
              eventType: "CREATED",
              newVersion: 1,
              newStatus: bookingFixture.status ?? "CONFIRMED",
              metadata: JSON.stringify({ source: "demo-seed" }),
            })
            .returning({ id: bookingEvents.id });
          await this.registry.recordEntry(
            DEMO_SEED_NAMESPACE,
            `${bookingFixture.logicalKey}:created-event`,
            "booking_events",
            event.id,
          );
          await this.registry.recordEntry(
            DEMO_SEED_NAMESPACE,
            bookingFixture.logicalKey,
            "bookings",
            booking.id,
          );
        } else {
          resolvedIds[bookingFixture.logicalKey] =
            `dry-run-booking-${bookingFixture.logicalKey}`;
        }
      }
    }

    // Retire only unchanged, registered legacy demo units; retain users, bookings and registry history.
    if (!isDryRun && retirementPlan.length > 0) {
      await this.database.transaction(async (transaction) => {
        for (const shop of retirementPlan) {
          const changed = await transaction
            .update(barbershops)
            .set({ status: "INACTIVE" })
            .where(
              and(
                eq(barbershops.id, shop.id),
                eq(barbershops.ownerId, shop.ownerId),
                eq(barbershops.slug, shop.slug),
                eq(barbershops.cnpj, shop.cnpj),
                eq(barbershops.status, "ACTIVE"),
              ),
            )
            .returning({ id: barbershops.id });
          if (changed.length !== 1)
            throw new Error(
              "Legacy demo unit changed during retirement; review and retry.",
            );
        }
      });
    }
    console.log(
      `[DemoSeed] Unidades anteriores: ${retirementPlan.length} ${isDryRun ? "planejadas para desativação; sem escrita" : "desativadas sem exclusão de histórico"}.`,
    );

    // ── Gravação de Manifesto Seguro (sem senhas) ───────────────
    if (!isDryRun) {
      const manifestData = {
        retiredBarbershops: retirementPlan.map((shop) => ({
          id: shop.id,
          previousStatus: "ACTIVE",
        })),
        namespace: DEMO_SEED_NAMESPACE,
        generatedAt: new Date().toISOString(),
        baseDateSP,
        targetDatabase: targetInfo,
        productionBackup: productionBackup
          ? {
              sha256: productionBackup.sha256,
              sizeBytes: productionBackup.sizeBytes,
              verifiedAt: productionBackup.verifiedAt,
            }
          : undefined,
        staffs: seedStaffs.map((s) => ({
          logicalKey: s.logicalKey,
          id: resolvedIds[s.logicalKey],
          githubUser: s.githubUser,
          name: s.name,
          email: s.email,
          role: s.role,
          unit: s.unitKey,
        })),
        barbershops: seedBarbershops.map((b) => ({
          logicalKey: b.logicalKey,
          id: resolvedIds[b.logicalKey],
          name: b.name,
          slug: b.slug,
          cnpj: b.cnpj,
        })),
        counts,
        disposableBookings: seedBookings
          .filter((b) => b.isDisposable)
          .map((b) => ({
            logicalKey: b.logicalKey,
            bookingId: resolvedIds[b.logicalKey],
            barberman: b.barbermanLogicalKey,
            dateOffsetDays: b.dateOffsetDays,
          })),
      };

      try {
        writeFileSync(
          MANIFEST_FILE_PATH,
          JSON.stringify(manifestData, null, 2),
          {
            encoding: "utf-8",
          },
        );
      } catch {
        // Ignora erro em ambientes de filesystem read-only (ex: Vercel serverless)
      }
    }

    return {
      namespace: DEMO_SEED_NAMESPACE,
      baseDateSP,
      targetDatabase: targetInfo,
      dryRun: isDryRun,
      counts,
      createdIds: resolvedIds,
      retiredBarbershops: {
        planned: retirementPlan.length,
        applied: isDryRun ? 0 : retirementPlan.length,
      },
    };
  }

  private async assertSeedIdentities(
    registry: Map<string, SeedRegistryRecord>,
    staffFixtures: typeof DEMO_STAFFS,
    customerFixtures: typeof DEMO_CUSTOMERS,
    barbershopFixtures: typeof DEMO_BARBERSHOPS,
  ) {
    const people = [...staffFixtures, ...customerFixtures];
    const existingUsers = await this.database
      .select({ id: users.id, email: users.email, cpf: users.cpf })
      .from(users)
      .where(
        or(
          inArray(
            users.email,
            people.map((person) => person.email),
          ),
          inArray(
            users.cpf,
            people.map((person) => person.cpf),
          ),
        ),
      );
    for (const person of people) {
      const registration = registry.get(person.logicalKey);
      const matched = existingUsers.find(
        (user) => user.email === person.email || user.cpf === person.cpf,
      );
      if (!registration && matched)
        throw new Error(
          "Colisão de usuário não registrado no namespace do seed.",
        );
      if (
        registration &&
        (registration.tableName !== "users" ||
          !matched ||
          matched.id !== registration.recordId ||
          matched.cpf !== person.cpf)
      )
        throw new Error(
          "Identidade de usuário registrado não confere com a fixture.",
        );
    }
    const existingShops = await this.database
      .select({
        id: barbershops.id,
        slug: barbershops.slug,
        cnpj: barbershops.cnpj,
        ownerId: barbershops.ownerId,
      })
      .from(barbershops)
      .where(
        or(
          inArray(
            barbershops.slug,
            barbershopFixtures.map((shop) => shop.slug),
          ),
          inArray(
            barbershops.cnpj,
            barbershopFixtures.map((shop) => shop.cnpj),
          ),
        ),
      );
    for (const shop of barbershopFixtures) {
      const registration = registry.get(shop.logicalKey);
      const matched = existingShops.find(
        (row) => row.slug === shop.slug || row.cnpj === shop.cnpj,
      );
      if (!registration && matched)
        throw new Error(
          "Colisão de barbearia não registrada no namespace do seed.",
        );
      if (registration) {
        const owner = registry.get(shop.ownerLogicalKey);
        if (
          registration.tableName !== "barbershops" ||
          !matched ||
          matched.id !== registration.recordId ||
          matched.slug !== shop.slug ||
          matched.cnpj !== shop.cnpj ||
          !owner ||
          matched.ownerId !== owner.recordId
        )
          throw new Error(
            "Identidade da barbearia registrada não confere com a fixture.",
          );
      }
    }
  }

  private async inspectRetiredBarbershops(
    registry: Map<string, SeedRegistryRecord>,
    currentBarbershops: typeof DEMO_BARBERSHOPS,
  ) {
    const currentKeys = new Set(
      currentBarbershops.map((shop) => shop.logicalKey),
    );
    const rows = new Map<string, RegisteredBarbershop>();
    for (const fixture of LEGACY_REGIONAL_BARBERSHOPS) {
      if (currentKeys.has(fixture.logicalKey)) continue;
      const registration = registry.get(fixture.logicalKey);
      if (!registration) continue;
      const [row] = await this.database
        .select({
          id: barbershops.id,
          ownerId: barbershops.ownerId,
          slug: barbershops.slug,
          cnpj: barbershops.cnpj,
          status: barbershops.status,
        })
        .from(barbershops)
        .where(eq(barbershops.id, registration.recordId));
      if (row?.ownerId && row.slug && row.cnpj)
        rows.set(row.id, {
          ...row,
          ownerId: row.ownerId,
          slug: row.slug,
          cnpj: row.cnpj,
        });
    }
    return planRetiredBarbershops({
      namespace: DEMO_SEED_NAMESPACE,
      previous: LEGACY_REGIONAL_BARBERSHOPS,
      current: currentBarbershops,
      registry,
      rows,
    });
  }

  private async safeGetRegistryMap(namespace: string) {
    try {
      const records = await this.registry.getExistingRecordsReadOnly(namespace);
      return records ?? new Map();
    } catch {
      throw new Error(
        "Não foi possível consultar o registro do seed com segurança.",
      );
    }
  }
}
