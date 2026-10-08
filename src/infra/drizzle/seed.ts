import { hashPassword } from "better-auth/crypto";
import { db } from "./index";
import {
  account,
  barbershopSchedules,
  barbershops,
  bookings,
  users,
  membership,
  notifications,
  scheduleExceptions,
  serviceItems,
  services,
  session,
  shoppingCarts,
  verification,
} from "./schema";

async function main() {
  await db.delete(notifications);
  await db.delete(scheduleExceptions);
  await db.delete(bookings);
  await db.delete(shoppingCarts);
  await db.delete(serviceItems);
  await db.delete(services);
  await db.delete(barbershopSchedules);
  await db.delete(membership);
  await db.delete(barbershops);
  await db.delete(session);
  await db.delete(account);
  await db.delete(verification);
  await db.delete(users);

  // Hash no formato better-auth (credencial fica em account.password)
  const passwordHash = await hashPassword("123456");

  const [owner] = await db
    .insert(users)
    .values({
      name: "Carlos Silva",
      email: "owner@smartbarber.com",
      password: passwordHash,
      cpf: "12345678900",
      role: "OWNER",
      emailVerified: true,
    })
    .returning();

  const [barberman] = await db
    .insert(users)
    .values({
      name: "João Souza",
      email: "barberman@smartbarber.com",
      password: passwordHash,
      cpf: "98765432100",
      role: "BARBER",
      emailVerified: true,
    })
    .returning();

  await db.insert(account).values([
    {
      accountId: owner.id,
      providerId: "credential",
      userId: owner.id,
      password: passwordHash,
    },
    {
      accountId: barberman.id,
      providerId: "credential",
      userId: barberman.id,
      password: passwordHash,
    },
  ]);

  const [barbershop] = await db
    .insert(barbershops)
    .values({
      name: "Barbearia do Carlos",
      ownerId: owner.id,
      slug: "barbearia-do-carlos",
      cnpj: "12345678000190",
      location: "Av. Paulista, 1000 - São Paulo/SP",
    })
    .returning();

  await db.insert(membership).values([
    {
      role: "OWNER",
      barbershopId: barbershop.id,
      userId: owner.id,
    },
    {
      role: "BARBERMAN",
      barbershopId: barbershop.id,
      userId: barberman.id,
    },
  ]);

  await db.insert(barbershopSchedules).values([
    {
      barbershopId: barbershop.id,
      createdBy: owner.id,
      dayOfWeek: "MONDAY",
      openTime: "09:00",
      closeTime: "18:00",
    },
    {
      barbershopId: barbershop.id,
      createdBy: owner.id,
      dayOfWeek: "TUESDAY",
      openTime: "09:00",
      closeTime: "18:00",
    },
  ]);

  const [customer] = await db
    .insert(users)
    .values({
      name: "Ana Pereira",
      email: "ana@example.com",
      password: passwordHash,
      cpf: "55544433322",
      phoneNumber: "(11) 99999-1234",
      role: "CLIENT",
      emailVerified: true,
    })
    .returning();

  await db.insert(account).values({
    accountId: customer.id,
    providerId: "credential",
    userId: customer.id,
    password: passwordHash,
  });

  const [service] = await db
    .insert(services)
    .values({
      barbershopId: barbershop.id,
      title: "Corte de cabelo",
      description: "Corte com máquina e tesoura",
      priceInCents: 4000,
      durationInMinutes: 30,
      isActive: true,
    })
    .returning();

  const [serviceItem] = await db
    .insert(serviceItems)
    .values({
      serviceId: service.id,
      titleSnapshot: service.title,
      priceInCentsSnapshot: service.priceInCents,
      durationInMinutesSnapshot: service.durationInMinutes,
    })
    .returning();

  const [shoppingCart] = await db
    .insert(shoppingCarts)
    .values({
      serviceItemId: serviceItem.id,
      userId: customer.id,
      totalPriceInCents: 4000,
    })
    .returning();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [booking] = await db
    .insert(bookings)
    .values({
      barbershopId: barbershop.id,
      barbermanId: barberman.id,
      shoppingCartId: shoppingCart.id,
      date: today,
      startTime: "23:40",
      endTime: "23:50",
    })
    .returning();

  await db.insert(notifications).values({
    bookingId: booking.id,
    type: "BOOKING_CONFIRMED",
    title: "Agendamento confirmado",
    message: "Seu corte de cabelo foi confirmado.",
    scheduledAt: new Date(),
  });

  console.log("Seed completed successfully.");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
