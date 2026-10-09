import { relations } from "drizzle-orm/_relations";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["OWNER", "BARBERMAN"]);

export const barbershopStatusEnum = pgEnum("barbershop_status", [
  "ACTIVE",
  "INACTIVE",
]);

// ── Tables ────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  avatarUrl: text("avatar_url"),
  email: text().notNull().unique(),
  password: text().notNull(),
  cpf: text().notNull().unique(),
  phoneNumber: text("phone_number"),
  emailVerifiedAt: timestamp("email_verified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    familyId: uuid("family_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    replacedByTokenId: uuid("replaced_by_token_id"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("refresh_tokens_user_id_idx").on(table.userId),
    index("refresh_tokens_family_id_idx").on(table.familyId),
  ],
);

export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("email_verifications_user_id_idx").on(table.userId)],
);

export const membership = pgTable(
  "membership",
  {
    id: uuid().primaryKey().defaultRandom(),
    role: roleEnum("role").notNull(),
    barbershopId: uuid("barbershop_id")
      .notNull()
      .references(() => barbershops.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    unique("membership_barbershop_user_unique").on(
      table.barbershopId,
      table.userId,
    ),
  ],
);

export const barbershops = pgTable("barbershops", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  avatarUrl: text("avatar_url"),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  slug: text().notNull().unique(),
  cnpj: text().notNull().unique(),
  location: text().notNull(),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  status: barbershopStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const barbershopSchedules = pgTable("barbershop_schedules", {
  id: uuid().primaryKey().defaultRandom(),
  barbershopId: uuid("barbershop_id")
    .notNull()
    .references(() => barbershops.id),
  barbermanId: uuid("barberman_id").references(() => users.id),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  dayOfWeek: text("day_of_week").notNull(),
  openTime: text("open_time").notNull(),
  closeTime: text("close_time").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const services = pgTable(
  "services",
  {
    id: uuid().primaryKey().defaultRandom(),
    barbershopId: uuid("barbershop_id")
      .notNull()
      .references(() => barbershops.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text(),
    priceInCents: integer("price_in_cents").notNull(),
    durationInMinutes: integer("duration_in_minutes").notNull().default(30),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("services_barbershop_active_title_id_idx").on(
      table.barbershopId,
      table.isActive,
      table.title,
      table.id,
    ),
    check("services_price_positive_check", sql`${table.priceInCents} > 0`),
    check(
      "services_duration_positive_check",
      sql`${table.durationInMinutes} > 0`,
    ),
  ],
);

export const serviceItems = pgTable("service_items", {
  id: uuid().primaryKey().defaultRandom(),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => services.id),
  titleSnapshot: text("title_snapshot"),
  priceInCentsSnapshot: integer("price_in_cents_snapshot"),
  durationInMinutesSnapshot: integer("duration_in_minutes_snapshot"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shoppingCarts = pgTable("shopping_carts", {
  id: uuid().primaryKey().defaultRandom(),
  serviceItemId: uuid("service_item_id")
    .notNull()
    .references(() => serviceItems.id),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  totalPriceInCents: integer("total_price_in_cents").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: uuid().primaryKey().defaultRandom(),
  barbershopId: uuid("barbershop_id")
    .notNull()
    .references(() => barbershops.id),
  barbermanId: uuid("barberman_id")
    .notNull()
    .references(() => users.id),
  shoppingCartId: uuid("shopping_cart_id")
    .notNull()
    .references(() => shoppingCarts.id),
  date: timestamp("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scheduleExceptions = pgTable("schedule_exceptions", {
  id: uuid().primaryKey().defaultRandom(),
  barbershopId: uuid("barbershop_id")
    .notNull()
    .references(() => barbershops.id),
  barbermanId: uuid("barberman_id").references(() => users.id),
  date: timestamp("date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid().primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id),
  type: text().notNull(),
  title: text().notNull(),
  message: text().notNull(),
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Relations ─────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  ownedBarbershops: many(barbershops),
  memberships: many(membership),
  createdSchedules: many(barbershopSchedules, {
    relationName: "createdByUser",
  }),
  schedules: many(barbershopSchedules, {
    relationName: "barberman",
  }),
  exceptions: many(scheduleExceptions),
  barbermanBookings: many(bookings),
  shoppingCarts: many(shoppingCarts),
  refreshTokens: many(refreshTokens),
  emailVerifications: many(emailVerifications),
}));

export const emailVerificationsRelations = relations(
  emailVerifications,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerifications.userId],
      references: [users.id],
    }),
  }),
);

export const barbershopsRelations = relations(barbershops, ({ one, many }) => ({
  owner: one(users, {
    fields: [barbershops.ownerId],
    references: [users.id],
  }),
  services: many(services),
  memberships: many(membership),
  schedules: many(barbershopSchedules),
  exceptions: many(scheduleExceptions),
  bookings: many(bookings),
}));

export const membershipRelations = relations(membership, ({ one }) => ({
  barbershop: one(barbershops, {
    fields: [membership.barbershopId],
    references: [barbershops.id],
  }),
  user: one(users, {
    fields: [membership.userId],
    references: [users.id],
  }),
}));

export const barbershopSchedulesRelations = relations(
  barbershopSchedules,
  ({ one }) => ({
    barbershop: one(barbershops, {
      fields: [barbershopSchedules.barbershopId],
      references: [barbershops.id],
    }),
    barberman: one(users, {
      fields: [barbershopSchedules.barbermanId],
      references: [users.id],
      relationName: "barberman",
    }),
    createdByUser: one(users, {
      fields: [barbershopSchedules.createdBy],
      references: [users.id],
      relationName: "createdByUser",
    }),
  }),
);

export const servicesRelations = relations(services, ({ one, many }) => ({
  barbershop: one(barbershops, {
    fields: [services.barbershopId],
    references: [barbershops.id],
  }),
  serviceItems: many(serviceItems),
}));

export const serviceItemsRelations = relations(
  serviceItems,
  ({ one, many }) => ({
    service: one(services, {
      fields: [serviceItems.serviceId],
      references: [services.id],
    }),
    shoppingCarts: many(shoppingCarts),
  }),
);

export const shoppingCartsRelations = relations(shoppingCarts, ({ one }) => ({
  user: one(users, {
    fields: [shoppingCarts.userId],
    references: [users.id],
  }),
  serviceItem: one(serviceItems, {
    fields: [shoppingCarts.serviceItemId],
    references: [serviceItems.id],
  }),
  booking: one(bookings, {
    fields: [shoppingCarts.id],
    references: [bookings.shoppingCartId],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  barbershop: one(barbershops, {
    fields: [bookings.barbershopId],
    references: [barbershops.id],
  }),
  barberman: one(users, {
    fields: [bookings.barbermanId],
    references: [users.id],
  }),
  shoppingCart: one(shoppingCarts, {
    fields: [bookings.shoppingCartId],
    references: [shoppingCarts.id],
  }),
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  booking: one(bookings, {
    fields: [notifications.bookingId],
    references: [bookings.id],
  }),
}));

export const scheduleExceptionsRelations = relations(
  scheduleExceptions,
  ({ one }) => ({
    barbershop: one(barbershops, {
      fields: [scheduleExceptions.barbershopId],
      references: [barbershops.id],
    }),
    barberman: one(users, {
      fields: [scheduleExceptions.barbermanId],
      references: [users.id],
    }),
  }),
);
