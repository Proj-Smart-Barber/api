import { relations } from "drizzle-orm/_relations";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["OWNER", "BARBERMAN"]);

export const barbershopStatusEnum = pgEnum("barbershop_status", [
  "ACTIVE",
  "INACTIVE",
]);

// ── Tables ────────────────────────────────────────────────

export const staffs = pgTable("staffs", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  avatarUrl: text(),
  email: text().notNull().unique(),
  password: text().notNull(),
  role: roleEnum("role").notNull(),
  cpf: text().notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const barbershops = pgTable("barbershops", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  avatarUrl: text(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => staffs.id),
  slug: text().notNull().unique(),
  cnpj: text().notNull().unique(),
  location: text().notNull(),
  status: barbershopStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const barbershopSchedules = pgTable("barbershop_schedules", {
  id: uuid().primaryKey().defaultRandom(),
  barbershopId: uuid("barbershop_id")
    .notNull()
    .references(() => barbershops.id),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => staffs.id),
  dayOfWeek: text("day_of_week").notNull(),
  openTime: text("open_time").notNull(),
  closeTime: text("close_time").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customers = pgTable("customers", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  avatarUrl: text(),
  email: text().notNull().unique(),
  password: text().notNull(),
  cpf: text().notNull().unique(),
  phoneNumber: text("phone_number").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const services = pgTable("services", {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  description: text(),
  priceInCents: integer("price_in_cents").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const serviceItems = pgTable("service_items", {
  id: uuid().primaryKey().defaultRandom(),
  serviceId: uuid("service_id")
    .notNull()
    .references(() => services.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shoppingCarts = pgTable("shopping_carts", {
  id: uuid().primaryKey().defaultRandom(),
  serviceItemId: uuid("service_item_id")
    .notNull()
    .references(() => serviceItems.id),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
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
    .references(() => staffs.id),
  shoppingCartId: uuid("shopping_cart_id")
    .notNull()
    .references(() => shoppingCarts.id),
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

export const staffsRelations = relations(staffs, ({ many }) => ({
  ownedBarbershops: many(barbershops),
  createdSchedules: many(barbershopSchedules),
  barbermanBookings: many(bookings),
}));

export const barbershopsRelations = relations(barbershops, ({ one, many }) => ({
  owner: one(staffs, {
    fields: [barbershops.ownerId],
    references: [staffs.id],
  }),
  schedules: many(barbershopSchedules),
  bookings: many(bookings),
}));

export const barbershopSchedulesRelations = relations(
  barbershopSchedules,
  ({ one }) => ({
    barbershop: one(barbershops, {
      fields: [barbershopSchedules.barbershopId],
      references: [barbershops.id],
    }),
    createdByStaff: one(staffs, {
      fields: [barbershopSchedules.createdBy],
      references: [staffs.id],
    }),
  }),
);

export const customersRelations = relations(customers, ({ many }) => ({
  shoppingCarts: many(shoppingCarts),
}));

export const servicesRelations = relations(services, ({ many }) => ({
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
  customer: one(customers, {
    fields: [shoppingCarts.customerId],
    references: [customers.id],
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
  barberman: one(staffs, {
    fields: [bookings.barbermanId],
    references: [staffs.id],
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
