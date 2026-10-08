import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql, and } from "drizzle-orm";
import { db } from "../index";
import { env } from "../../env";
import {
  account,
  barbershopSchedules,
  barbershops,
  bookings,
  users,
  membership,
  scheduleExceptions,
  serviceItems,
  services,
  shoppingCarts,
} from "../schema";
import { Cpf } from "../../../domain/enterprise/entities/value-objects/cpf";
import {
  DEMO_BARBERSHOPS,
  DEMO_BOOKINGS,
  DEMO_CUSTOMERS,
  DEMO_EXCEPTIONS,
  DEMO_STAFFS,
  buildDemoSchedules,
  DEMO_SERVICES,
} from "./fixtures";
import { SeedRegistryManager } from "./registry";
import {
  hashPlainText,
  inspectDatabaseTarget,
  loadOrCreateStaffCredentials,
} from "./security";
import { DEMO_SEED_NAMESPACE, type DemoSeedExecutionSummary } from "./types";

const MANIFEST_FILE_PATH = resolve(process.cwd(), ".demo-seed-manifest.json");

export interface SeedEngineOptions {
  dryRun?: boolean;
  rollback?: boolean;
  confirmSecret?: string;
  forceReplenishDisposables?: boolean;
}

export class DemoSeedEngine {
  private registry = new SeedRegistryManager();

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

  /**
   * Garante a credencial no formato better-auth (`account.password`), que é o
   * que o login unificado valida. Idempotente para reexecuções do seed.
   */
  private async ensureCredentialAccount(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    const [existing] = await db
      .select({ id: account.id })
      .from(account)
      .where(
        and(eq(account.userId, userId), eq(account.providerId, "credential")),
      );

    if (existing) return;

    await db.insert(account).values({
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });
  }

  async run(
    options: SeedEngineOptions = {},
  ): Promise<DemoSeedExecutionSummary> {
    const isDryRun = options.dryRun ?? false;
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

    // ── Rollback ────────────────────────────────────────────────
    if (options.rollback) {
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

    const counts: Record<
      string,
      { planned: number; created: number; reused: number }
    > = {
      staffs: { planned: DEMO_STAFFS.length, created: 0, reused: 0 },
      barbershops: { planned: DEMO_BARBERSHOPS.length, created: 0, reused: 0 },
      membership: { planned: DEMO_STAFFS.length, created: 0, reused: 0 },
      barbershop_schedules: { planned: 0, created: 0, reused: 0 },
      services: { planned: DEMO_SERVICES.length, created: 0, reused: 0 },
      customers: { planned: DEMO_CUSTOMERS.length, created: 0, reused: 0 },
      schedule_exceptions: {
        planned: DEMO_EXCEPTIONS.length,
        created: 0,
        reused: 0,
      },
      service_items: { planned: DEMO_BOOKINGS.length, created: 0, reused: 0 },
      shopping_carts: { planned: DEMO_BOOKINGS.length, created: 0, reused: 0 },
      bookings: { planned: DEMO_BOOKINGS.length, created: 0, reused: 0 },
    };

    const resolvedIds: Record<string, string> = {};

    // ── 1. Staffs e Credenciais ─────────────────────────────────
    const staffCredentials = await loadOrCreateStaffCredentials(DEMO_STAFFS);

    for (const staffFixture of DEMO_STAFFS) {
      const reg = existingRegistry.get(staffFixture.logicalKey);
      if (reg) {
        resolvedIds[staffFixture.logicalKey] = reg.recordId;
        counts.staffs.reused++;
      } else {
        counts.staffs.created++;
        if (!isDryRun) {
          // Prevenção de colisão por e-mail preexistente fora do registry
          const existingByEmail = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, staffFixture.email));

          const cred = staffCredentials[staffFixture.logicalKey];
          let staffId: string;
          if (existingByEmail.length > 0) {
            staffId = existingByEmail[0].id;
          } else {
            const [created] = await db
              .insert(users)
              .values({
                name: staffFixture.name,
                email: staffFixture.email,
                password: cred.passwordHash,
                cpf: Cpf.normalize(staffFixture.cpf),
                role: staffFixture.role === "OWNER" ? "OWNER" : "BARBER",
                emailVerified: true,
              })
              .returning({ id: users.id });
            staffId = created.id;
          }

          // Credencial no formato better-auth (login unificado)
          await this.ensureCredentialAccount(staffId, cred.passwordHash);

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
    for (const shopFixture of DEMO_BARBERSHOPS) {
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

          const existingBySlug = await db
            .select({ id: barbershops.id })
            .from(barbershops)
            .where(eq(barbershops.slug, shopFixture.slug));

          let shopId: string;
          if (existingBySlug.length > 0) {
            shopId = existingBySlug[0].id;
          } else {
            const [created] = await db
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

    // ── 3. Memberships ──────────────────────────────────────────
    for (const staffFixture of DEMO_STAFFS) {
      const membershipKey = `${staffFixture.logicalKey}:membership`;
      const reg = existingRegistry.get(membershipKey);

      if (reg) {
        resolvedIds[membershipKey] = reg.recordId;
        counts.membership.reused++;
      } else {
        counts.membership.created++;
        if (!isDryRun) {
          const shopKey = `${staffFixture.unitKey}:barbershop`;
          const barbershopId = resolvedIds[shopKey];
          const staffId = resolvedIds[staffFixture.logicalKey];

          const existingMember = await db
            .select({ id: membership.id })
            .from(membership)
            .where(
              sql`${membership.barbershopId} = ${barbershopId} AND ${membership.userId} = ${staffId}`,
            );

          let memberId: string;
          if (existingMember.length > 0) {
            memberId = existingMember[0].id;
          } else {
            const [created] = await db
              .insert(membership)
              .values({
                barbershopId,
                userId: staffId,
                role: staffFixture.role,
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
    const allSchedules = buildDemoSchedules();
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

          const [created] = await db
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
    for (const serviceFixture of DEMO_SERVICES) {
      const reg = existingRegistry.get(serviceFixture.logicalKey);

      if (reg) {
        resolvedIds[serviceFixture.logicalKey] = reg.recordId;
        counts.services.reused++;
      } else {
        counts.services.created++;
        if (!isDryRun) {
          const barbershopId = resolvedIds[serviceFixture.barbershopLogicalKey];

          const [created] = await db
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
    const customerPasswordHash = await hashPlainText(
      "DemoCustomerSecret2026!#",
    );

    for (const customerFixture of DEMO_CUSTOMERS) {
      const reg = existingRegistry.get(customerFixture.logicalKey);

      if (reg) {
        resolvedIds[customerFixture.logicalKey] = reg.recordId;
        counts.customers.reused++;
      } else {
        counts.customers.created++;
        if (!isDryRun) {
          const existingByEmail = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, customerFixture.email));

          let customerId: string;
          if (existingByEmail.length > 0) {
            customerId = existingByEmail[0].id;
          } else {
            const [created] = await db
              .insert(users)
              .values({
                name: customerFixture.name,
                email: customerFixture.email,
                password: customerPasswordHash,
                cpf: Cpf.normalize(customerFixture.cpf),
                phoneNumber: customerFixture.phoneNumber,
                role: "CLIENT",
                emailVerified: true,
              })
              .returning({ id: users.id });
            customerId = created.id;
          }

          await this.ensureCredentialAccount(customerId, customerPasswordHash);

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
    for (const exceptionFixture of DEMO_EXCEPTIONS) {
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

          const [created] = await db
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
    for (const bookingFixture of DEMO_BOOKINGS) {
      const regBooking = existingRegistry.get(bookingFixture.logicalKey);

      let needCreation = !regBooking;

      if (regBooking) {
        if (!isDryRun) {
          const [exists] = await db
            .select({ id: bookings.id })
            .from(bookings)
            .where(eq(bookings.id, regBooking.recordId));

          if (!exists && options.forceReplenishDisposables) {
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
          const [serviceRow] = await db
            .select()
            .from(services)
            .where(eq(services.id, serviceId));

          if (!serviceRow) {
            throw new Error(
              `Serviço ${serviceId} não encontrado para reserva ${bookingFixture.logicalKey}`,
            );
          }

          // 1. service_items
          const [serviceItem] = await db
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
          const [cart] = await db
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
          const { utcDate } = this.calculateDateFromOffset(
            baseDateSP,
            bookingFixture.dateOffsetDays,
          );

          const [booking] = await db
            .insert(bookings)
            .values({
              barbershopId,
              barbermanId,
              shoppingCartId: cart.id,
              date: utcDate,
              startTime: bookingFixture.startTime,
              endTime: bookingFixture.endTime,
            })
            .returning({ id: bookings.id });

          resolvedIds[bookingFixture.logicalKey] = booking.id;
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

    // ── Gravação de Manifesto Seguro (sem senhas) ───────────────
    if (!isDryRun) {
      const manifestData = {
        namespace: DEMO_SEED_NAMESPACE,
        generatedAt: new Date().toISOString(),
        baseDateSP,
        targetDatabase: targetInfo,
        staffs: DEMO_STAFFS.map((s) => ({
          logicalKey: s.logicalKey,
          id: resolvedIds[s.logicalKey],
          githubUser: s.githubUser,
          name: s.name,
          email: s.email,
          role: s.role,
          unit: s.unitKey,
        })),
        barbershops: DEMO_BARBERSHOPS.map((b) => ({
          logicalKey: b.logicalKey,
          id: resolvedIds[b.logicalKey],
          name: b.name,
          slug: b.slug,
          cnpj: b.cnpj,
        })),
        counts,
        disposableBookings: DEMO_BOOKINGS.filter((b) => b.isDisposable).map(
          (b) => ({
            logicalKey: b.logicalKey,
            bookingId: resolvedIds[b.logicalKey],
            barberman: b.barbermanLogicalKey,
            dateOffsetDays: b.dateOffsetDays,
          }),
        ),
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
    };
  }

  private async safeGetRegistryMap(namespace: string) {
    try {
      return await this.registry.getExistingRecords(namespace);
    } catch {
      return new Map();
    }
  }
}
