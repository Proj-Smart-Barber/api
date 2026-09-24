import { Password } from "../../domain/enterprise/entities/value-objects/password";
import { db } from "./index";
import {
  barbershopSchedules,
  barbershops,
  bookings,
  customers,
  membership,
  notifications,
  scheduleExceptions,
  serviceItems,
  services,
  shoppingCarts,
  staffs,
} from "./schema";

async function main() {
  await db.delete(notifications);
  await db.delete(scheduleExceptions);
  await db.delete(bookings);
  await db.delete(shoppingCarts);
  await db.delete(serviceItems);
  await db.delete(services);
  await db.delete(barbershopSchedules);
  await db.delete(customers);
  await db.delete(membership);
  await db.delete(barbershops);
  await db.delete(staffs);

  const ownerHash = await Password.generateHashFromPlainText("123456", 10);
  const customerHash = await Password.generateHashFromPlainText("123456", 10);

  const [owner] = await db
    .insert(staffs)
    .values({
      name: "Carlos Silva",
      email: "owner@smartbarber.com",
      password: ownerHash.value,
      cpf: "123.456.789-00",
    })
    .returning();

  const [barberman] = await db
    .insert(staffs)
    .values({
      name: "João Souza",
      email: "barberman@smartbarber.com",
      password: ownerHash.value,
      cpf: "987.654.321-00",
    })
    .returning();

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
      staffId: owner.id,
    },
    {
      role: "BARBERMAN",
      barbershopId: barbershop.id,
      staffId: barberman.id,
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
    .insert(customers)
    .values({
      name: "Ana Pereira",
      email: "ana@example.com",
      password: customerHash.value,
      cpf: "555.444.333-22",
      phoneNumber: "(11) 99999-1234",
    })
    .returning();

  const [service] = await db
    .insert(services)
    .values({
      title: "Corte de cabelo",
      description: "Corte com máquina e tesoura",
      priceInCents: 4000,
    })
    .returning();

  const [serviceItem] = await db
    .insert(serviceItems)
    .values({ serviceId: service.id })
    .returning();

  const [shoppingCart] = await db
    .insert(shoppingCarts)
    .values({
      serviceItemId: serviceItem.id,
      customerId: customer.id,
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
