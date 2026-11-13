import { fakerPT_BR } from "@faker-js/faker";
import { SAO_PAULO_DISTRICT_CENTROIDS } from "../district-centroids";
import {
  DEMO_BARBERSHOPS,
  DEMO_BOOKINGS,
  DEMO_CUSTOMERS,
  DEMO_EXCEPTIONS,
  DEMO_SERVICES,
  DEMO_STAFFS,
  buildDemoMemberships,
  buildDemoSchedules,
} from "./fixtures";
import type {
  DemoBarbershopFixture,
  DemoBookingFixture,
  DemoCustomerFixture,
  DemoScheduleExceptionFixture,
  DemoScheduleFixture,
  DemoSeedProfileFixtures,
  DemoServiceFixture,
  DemoStaffFixture,
} from "./types";

export const FULL_DEMO_PROFILE_COUNTS = {
  barbershops: 100,
  generatedCustomers: 1_000,
  generatedServicesPerBarbershop: 10,
  generatedBookingsPerBarbershop: 250,
  barbersPerGeneratedShop: 4,
} as const;

const RANDOM_SEED = 20261112;
const WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

const SERVICE_CATALOG = [
  { title: "Corte tradicional", duration: 30, min: 3500, max: 6500 },
  { title: "Corte degradê", duration: 45, min: 4500, max: 8500 },
  { title: "Corte infantil", duration: 30, min: 3000, max: 5500 },
  { title: "Barba completa", duration: 30, min: 3500, max: 7000 },
  { title: "Barba com toalha quente", duration: 45, min: 5000, max: 9000 },
  { title: "Corte e barba", duration: 60, min: 7000, max: 14000 },
  { title: "Acabamento", duration: 15, min: 2000, max: 4000 },
  { title: "Pigmentação capilar", duration: 45, min: 5000, max: 10000 },
  { title: "Hidratação capilar", duration: 30, min: 4000, max: 8000 },
  { title: "Sobrancelha", duration: 15, min: 1500, max: 3000 },
] as const;

const BASE_COVERED_DISTRICTS = new Set([
  "republica",
  "mooca",
  "santana",
  "santo amaro",
  "perdizes",
  "tatuape",
  "vila prudente",
  "penha",
]);

const normalizeDistrict = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function checkDigits(digits: string, weights: number[]): number {
  const sum = [...digits].reduce(
    (total, digit, index) => total + Number(digit) * weights[index],
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function syntheticCpf(sequence: number): string {
  const base = String(700_000_000 + sequence).padStart(9, "0");
  const first = checkDigits(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigits(
    `${base}${first}`,
    [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return `${base}${first}${second}`;
}

function syntheticCnpj(sequence: number): string {
  const base = `98${String(sequence).padStart(10, "0")}`;
  const first = checkDigits(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigits(
    `${base}${first}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return `${base}${first}${second}`;
}

function addMinutes(time: string, minutes: number): string {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function buildFullDemoSeedFixtures(): DemoSeedProfileFixtures {
  fakerPT_BR.seed(RANDOM_SEED);

  const unrepresentedDistricts = SAO_PAULO_DISTRICT_CENTROIDS.filter(
    (district) => !BASE_COVERED_DISTRICTS.has(normalizeDistrict(district.name)),
  );
  if (unrepresentedDistricts.length !== 88) {
    throw new Error(
      `Expected 88 districts not covered by legacy fixtures; found ${unrepresentedDistricts.length}.`,
    );
  }

  const extraEastDistrict = SAO_PAULO_DISTRICT_CENTROIDS.find(
    (district) => district.name === "Itaquera",
  );
  const extraSouthDistrict = SAO_PAULO_DISTRICT_CENTROIDS.find(
    (district) => district.name === "Grajaú",
  );
  if (!extraEastDistrict || !extraSouthDistrict) {
    throw new Error(
      "Regional extra-shop districts are missing from the catalog.",
    );
  }
  const generatedDistricts = [
    ...unrepresentedDistricts,
    extraEastDistrict,
    extraSouthDistrict,
  ];

  const generatedShops: DemoBarbershopFixture[] = generatedDistricts.map(
    (district, index) => {
      const unit = `scale-${String(index + 1).padStart(3, "0")}`;
      return {
        logicalKey: `${unit}:barbershop`,
        name: `Barbearia ${fakerPT_BR.person.lastName()} ${district.name} — Demonstração`,
        ownerLogicalKey: `${unit}:owner`,
        slug: `barbearia-demo-${String(index + 1).padStart(3, "0")}-demo`,
        cnpj: syntheticCnpj(index + 1),
        location: `${district.name}, São Paulo - SP — referência sintética de teste`,
        timezone: "America/Sao_Paulo",
        status: (index % 20 === 19 ? "INACTIVE" : "ACTIVE") as
          | "ACTIVE"
          | "INACTIVE",
        region: district.region,
        point: district.point,
      };
    },
  );
  const barbershops = [...DEMO_BARBERSHOPS, ...generatedShops];

  const generatedStaffs: DemoStaffFixture[] = generatedShops.flatMap(
    (_shop, shopIndex) => {
      const unit = `scale-${String(shopIndex + 1).padStart(3, "0")}`;
      const ownerKey = `${unit}:owner`;
      const barbers = Array.from(
        { length: FULL_DEMO_PROFILE_COUNTS.barbersPerGeneratedShop },
        (_, barberIndex) =>
          `${unit}:barber:${String(barberIndex + 1).padStart(2, "0")}`,
      );
      const team: DemoStaffFixture[] = [
        {
          logicalKey: ownerKey,
          githubUser: `@demo-${unit}-owner`,
          name: fakerPT_BR.person.fullName(),
          email:
            shopIndex === 0
              ? "qa.owner@demo.smartbarber.test"
              : `owner.${unit}@demo.smartbarber.test`,
          cpf: syntheticCpf(10_000 + shopIndex),
          role: "OWNER",
          unitKey: unit,
        },
        ...barbers.map((logicalKey, barberIndex) => ({
          logicalKey,
          githubUser: `@demo-${unit}-barber-${barberIndex + 1}`,
          name: fakerPT_BR.person.fullName(),
          email:
            shopIndex === 0 && barberIndex === 0
              ? "qa.barber@demo.smartbarber.test"
              : `barber.${unit}.${barberIndex + 1}@demo.smartbarber.test`,
          cpf: syntheticCpf(20_000 + shopIndex * 10 + barberIndex),
          role: "BARBERMAN" as const,
          unitKey: unit,
        })),
      ];
      return team;
    },
  );
  const staffs = [...DEMO_STAFFS, ...generatedStaffs];

  const generatedCustomers: DemoCustomerFixture[] = Array.from(
    { length: FULL_DEMO_PROFILE_COUNTS.generatedCustomers },
    (_, index) => ({
      logicalKey: `scale:customer:${String(index + 1).padStart(4, "0")}`,
      name: fakerPT_BR.person.fullName(),
      email:
        index === 0
          ? "qa.client@demo.smartbarber.test"
          : `cliente.${String(index + 1).padStart(4, "0")}@demo.smartbarber.test`,
      cpf: syntheticCpf(30_000 + index),
      phoneNumber: `1195${String(index + 1).padStart(7, "0")}`,
    }),
  );
  const customers = [...DEMO_CUSTOMERS, ...generatedCustomers];

  const generatedServices: DemoServiceFixture[] = generatedShops.flatMap(
    (shop, shopIndex) =>
      SERVICE_CATALOG.map((service, serviceIndex) => ({
        logicalKey: `${shop.logicalKey}:service:${String(serviceIndex + 1).padStart(2, "0")}`,
        barbershopLogicalKey: shop.logicalKey,
        title: service.title,
        description: `${service.title} com atendimento demonstrativo na região de ${shop.location.split(",")[0]}.`,
        priceInCents:
          service.min +
          ((shopIndex * 977 + serviceIndex * 613) %
            (service.max - service.min + 1)),
        durationInMinutes: service.duration,
        isActive: serviceIndex !== SERVICE_CATALOG.length - 1,
      })),
  );
  const services = [...DEMO_SERVICES, ...generatedServices];

  const memberships = buildDemoMemberships(staffs, barbershops);
  const generatedSchedules: DemoScheduleFixture[] = generatedShops.flatMap(
    (shop, shopIndex) => {
      const unit = `scale-${String(shopIndex + 1).padStart(3, "0")}`;
      const staff = generatedStaffs.filter((person) => person.unitKey === unit);
      const general = WEEKDAYS.map((day) => ({
        logicalKey: `${unit}:schedule:general:${day.toLowerCase()}`,
        barbershopLogicalKey: shop.logicalKey,
        createdByLogicalKey: shop.ownerLogicalKey,
        dayOfWeek: day,
        openTime: "09:00",
        closeTime: day === "SATURDAY" ? "16:00" : "19:00",
      }));
      const individual = staff
        .filter((member) => member.role === "BARBERMAN")
        .flatMap((barber) =>
          WEEKDAYS.map((day) => ({
            logicalKey: `${barber.logicalKey}:schedule:${day.toLowerCase()}`,
            barbershopLogicalKey: shop.logicalKey,
            barbermanLogicalKey: barber.logicalKey,
            createdByLogicalKey: shop.ownerLogicalKey,
            dayOfWeek: day,
            openTime: "09:00",
            closeTime: day === "SATURDAY" ? "16:00" : "19:00",
          })),
        );
      return [...general, ...individual];
    },
  );
  const schedules = [...buildDemoSchedules(), ...generatedSchedules];

  const generatedExceptions: DemoScheduleExceptionFixture[] =
    generatedShops.flatMap((shop, shopIndex) => {
      const unit = `scale-${String(shopIndex + 1).padStart(3, "0")}`;
      const barber = generatedStaffs.find(
        (person) => person.unitKey === unit && person.role === "BARBERMAN",
      );
      if (!barber) throw new Error(`Missing barber fixture for ${unit}.`);
      return [
        {
          logicalKey: `${unit}:exception:team-break`,
          barbershopLogicalKey: shop.logicalKey,
          dateOffsetDays: 14 + (shopIndex % 30),
          reason: "Pausa de equipe para treinamento de atendimento",
        },
        {
          logicalKey: `${unit}:exception:barber-day-off`,
          barbershopLogicalKey: shop.logicalKey,
          barbermanLogicalKey: barber.logicalKey,
          dateOffsetDays: 21 + (shopIndex % 30),
          reason: "Folga programada para demonstração",
        },
      ];
    });
  const exceptions = [...DEMO_EXCEPTIONS, ...generatedExceptions];

  const generatedBookings: DemoBookingFixture[] = generatedShops.flatMap(
    (shop, shopIndex) => {
      const unit = `scale-${String(shopIndex + 1).padStart(3, "0")}`;
      const barbers = generatedStaffs.filter(
        (person) => person.unitKey === unit && person.role === "BARBERMAN",
      );
      const shopServices = generatedServices.filter(
        (service) =>
          service.barbershopLogicalKey === shop.logicalKey && service.isActive,
      );
      if (barbers.length !== 4 || shopServices.length !== 9) {
        throw new Error(`Invalid generated catalog for ${unit}.`);
      }
      return Array.from(
        { length: FULL_DEMO_PROFILE_COUNTS.generatedBookingsPerBarbershop },
        (_, bookingIndex) => {
          const barberIndex = bookingIndex % barbers.length;
          const daySlot = Math.floor(bookingIndex / barbers.length);
          const service = shopServices[bookingIndex % shopServices.length];
          const startHour = 9 + (daySlot % 14) / 2;
          const hour = Math.floor(startHour);
          const minute = startHour % 1 === 0 ? 0 : 30;
          const startTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
          const dateOffsetDays = -180 + (daySlot % 211);
          const status =
            dateOffsetDays > 0
              ? bookingIndex % 10 === 0
                ? "CANCELLED"
                : "CONFIRMED"
              : bookingIndex % 10 < 7
                ? "COMPLETED"
                : bookingIndex % 10 < 9
                  ? "CANCELLED"
                  : "CONFIRMED";
          const customer =
            generatedCustomers[
              (shopIndex * 250 + bookingIndex) % generatedCustomers.length
            ];
          const logicalKey = `${shop.logicalKey}:booking:${String(bookingIndex + 1).padStart(3, "0")}`;
          return {
            logicalKey,
            barbershopLogicalKey: shop.logicalKey,
            barbermanLogicalKey: barbers[barberIndex].logicalKey,
            customerLogicalKey: customer.logicalKey,
            serviceLogicalKey: service.logicalKey,
            dateOffsetDays,
            startTime,
            endTime: addMinutes(startTime, service.durationInMinutes),
            status,
          };
        },
      );
    },
  );
  const bookings = [...DEMO_BOOKINGS, ...generatedBookings];

  assertFullFixtureIntegrity({
    barbershops,
    staffs,
    customers,
    memberships,
    schedules,
    services,
    exceptions,
    bookings,
  });

  return {
    barbershops,
    staffs,
    customers,
    memberships,
    schedules,
    services,
    exceptions,
    bookings,
  };
}

function assertFullFixtureIntegrity(fixtures: DemoSeedProfileFixtures): void {
  const {
    barbershops,
    staffs,
    customers,
    memberships,
    schedules,
    services,
    exceptions,
    bookings,
  } = fixtures;
  if (barbershops.length !== FULL_DEMO_PROFILE_COUNTS.barbershops) {
    throw new Error(
      `Full profile expected 100 barbershops; found ${barbershops.length}.`,
    );
  }

  const unique = (values: string[], label: string) => {
    if (new Set(values).size !== values.length)
      throw new Error(`Duplicate ${label} in full profile.`);
  };
  unique(
    barbershops.map((row) => row.logicalKey),
    "barbershop key",
  );
  unique(
    barbershops.map((row) => row.slug),
    "barbershop slug",
  );
  unique(
    barbershops.map((row) => row.cnpj),
    "barbershop CNPJ",
  );
  unique(
    staffs.map((row) => row.logicalKey),
    "staff key",
  );
  unique(
    staffs.map((row) => row.email),
    "staff email",
  );
  unique(
    staffs.map((row) => row.cpf),
    "staff CPF",
  );
  unique(
    customers.map((row) => row.logicalKey),
    "customer key",
  );
  unique(
    customers.map((row) => row.email),
    "customer email",
  );
  unique(
    customers.map((row) => row.cpf),
    "customer CPF",
  );
  unique(
    services.map((row) => row.logicalKey),
    "service key",
  );
  unique(
    bookings.map((row) => row.logicalKey),
    "booking key",
  );

  const shops = new Set(barbershops.map((row) => row.logicalKey));
  const users = new Set([...staffs, ...customers].map((row) => row.logicalKey));
  const servicesByShop = new Map<string, Set<string>>();
  for (const service of services) {
    if (!shops.has(service.barbershopLogicalKey))
      throw new Error("Service has no seeded barbershop.");
    const set =
      servicesByShop.get(service.barbershopLogicalKey) ?? new Set<string>();
    set.add(service.logicalKey);
    servicesByShop.set(service.barbershopLogicalKey, set);
  }
  for (const shop of barbershops) {
    if (!users.has(shop.ownerLogicalKey))
      throw new Error(`Missing shop owner for ${shop.logicalKey}.`);
    if (!servicesByShop.get(shop.logicalKey)?.size)
      throw new Error(`Missing service catalog for ${shop.logicalKey}.`);
  }
  for (const booking of bookings) {
    if (!shops.has(booking.barbershopLogicalKey))
      throw new Error("Booking has no seeded barbershop.");
    if (
      !users.has(booking.barbermanLogicalKey) ||
      !users.has(booking.customerLogicalKey)
    ) {
      throw new Error("Booking references an unknown seeded user.");
    }
    if (
      !servicesByShop
        .get(booking.barbershopLogicalKey)
        ?.has(booking.serviceLogicalKey)
    ) {
      throw new Error("Booking service belongs to another barbershop.");
    }
  }
  for (const row of [...memberships, ...schedules, ...exceptions]) {
    if (!shops.has(row.barbershopLogicalKey))
      throw new Error("Fixture references an unknown barbershop.");
  }

  const regions = new Set(
    barbershops.map((shop) => shop.region).filter(Boolean),
  );
  for (const region of ["CENTRO", "LESTE", "NORTE", "SUL", "OESTE"] as const) {
    if (!regions.has(region))
      throw new Error(`Full profile lacks ${region} coverage.`);
  }
}
