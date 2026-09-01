import { Password } from "../../domain/enterprise/entities/value-objects/password";
import { db } from "./index";
import {
  barbershopSchedules,
  barbershops,
  bookings,
  customers,
  notifications,
  roleEnum,
  serviceItems,
  services,
  shoppingCarts,
  staffs,
} from "./schema";

async function main() {
  await db.delete(notifications);
  await db.delete(bookings);
  await db.delete(shoppingCarts);
  await db.delete(serviceItems);
  await db.delete(services);
  await db.delete(barbershopSchedules);
  await db.delete(customers);
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
      role: roleEnum.enumValues[0],
      cpf: "123.456.789-00",
    })
    .returning();

  const [barberman] = await db
    .insert(staffs)
    .values({
      name: "João Souza",
      email: "barberman@smartbarber.com",
      password: ownerHash.value,
      role: roleEnum.enumValues[1],
      cpf: "987.654.321-00",
    })
    .returning();

  const [barbershop] = await db
    .insert(barbershops)
    .values({
      name: "Barbearia do Carlos",
      ownerId: owner.id,
      slug: "barbearia-do-carlos",
      cnpj: "12.345.678/0001-90",
      location: "Av. Paulista, 1000 - São Paulo/SP",
    })
    .returning();

  await db.insert(barbershopSchedules).values([
    {
      barbershopId: barbershop.id,
      createdBy: owner.id,
      dayOfWeek: "monday",
      openTime: "09:00",
      closeTime: "18:00",
    },
    {
      barbershopId: barbershop.id,
      createdBy: owner.id,
      dayOfWeek: "tuesday",
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

  const [booking] = await db
    .insert(bookings)
    .values({
      barbershopId: barbershop.id,
      barbermanId: barberman.id,
      shoppingCartId: shoppingCart.id,
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
