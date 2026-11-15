import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "./index";
import { DrizzleServicesRepository } from "./repositories/drizzle-services-repository";
import { DrizzleBarbershopsRepository } from "./repositories/drizzle-barbershops-repository";
import { DrizzleServiceMapper } from "./mappers/drizzle-service-mapper";
import { DrizzleBarbershopMapper } from "./mappers/drizzle-barbershop-mapper";
import {
  barbershops,
  bookings,
  reviewItems,
  reviews,
  services,
  users,
} from "./schema";

describe("Canonical Ratings Enrichment Integration", () => {
  let servicesRepository: DrizzleServicesRepository;
  let barbershopsRepository: DrizzleBarbershopsRepository;

  const ownerId = randomUUID();
  const customerId = randomUUID();
  const shopId = randomUUID();
  const serviceWithReviewId = randomUUID();
  const serviceWithoutReviewId = randomUUID();
  const bookingId = randomUUID();
  const reviewId = randomUUID();

  async function cleanTestData() {
    await db.execute(
      sql`TRUNCATE TABLE platform_feedbacks, review_items, review_reports, review_moderation_logs, reviews, booking_service_items, bookings, service_media, barbershop_gallery, media, services, barbershop_locations, membership, barbershops, users CASCADE`,
    );
  }

  beforeAll(async () => {
    servicesRepository = new DrizzleServicesRepository(db);
    barbershopsRepository = new DrizzleBarbershopsRepository(db);
  });

  afterAll(async () => {
    await cleanTestData();
    await pool.end();
  });

  beforeEach(async () => {
    await cleanTestData();

    // 1. Create owner and customer
    await db.insert(users).values([
      {
        id: ownerId,
        name: "Owner Test",
        email: "owner@canonical.test",
        password: "hash",
        cpf: "11111111101",
        accountType: "OWNER",
      },
      {
        id: customerId,
        name: "Customer Test",
        email: "customer@canonical.test",
        password: "hash",
        cpf: "11111111102",
        accountType: "CLIENT",
      },
    ]);

    // 2. Create Barbershop with outdated/zero rating in column
    await db.insert(barbershops).values({
      id: shopId,
      ownerId,
      name: "Barbearia Canonica",
      slug: "barbearia-canonica",
      cnpj: "00000000000199",
      location: "Centro",
      timezone: "America/Sao_Paulo",
      status: "ACTIVE",
      rating: "0.00",
      reviewCount: 0,
    });

    // 3. Create two services: both have rating=0 and reviewCount=0 in table
    await db.insert(services).values([
      {
        id: serviceWithReviewId,
        barbershopId: shopId,
        title: "Corte Degradê",
        priceInCents: 5000,
        durationInMinutes: 30,
        isActive: true,
        rating: "0.00",
        reviewCount: 0,
      },
      {
        id: serviceWithoutReviewId,
        barbershopId: shopId,
        title: "Barba Terapia",
        priceInCents: 4000,
        durationInMinutes: 30,
        isActive: true,
        rating: "0.00",
        reviewCount: 0,
      },
    ]);

    // 4. Create completed booking
    await db.insert(bookings).values({
      id: bookingId,
      barbershopId: shopId,
      barbermanId: ownerId,
      customerId,
      date: new Date("2026-11-10T10:00:00Z"),
      startTime: "10:00",
      endTime: "10:30",
      status: "COMPLETED",
    });

    // 5. Create PUBLISHED review with items:
    // - Barbershop rating = 4
    // - Service rating = 5
    await db.insert(reviews).values({
      id: reviewId,
      bookingId,
      barbershopId: shopId,
      customerId,
      rating: 4,
      comment: "Atendimento top",
      status: "PUBLISHED",
      version: 1,
      createdAt: new Date("2026-11-10T11:00:00Z"),
      updatedAt: new Date("2026-11-10T11:00:00Z"),
    });

    await db.insert(reviewItems).values([
      {
        reviewId,
        bookingId,
        targetType: "BARBERSHOP",
        targetKey: `BARBERSHOP:${shopId}`,
        targetId: shopId,
        targetLabel: "Barbearia",
        rating: 4,
      },
      {
        reviewId,
        bookingId,
        targetType: "SERVICE",
        targetKey: `SERVICE:${serviceWithReviewId}`,
        targetId: serviceWithReviewId,
        targetLabel: "Corte Degradê",
        rating: 5,
      },
    ]);
  });

  it("enriquece serviços com ratings canônicos independentes da coluna armazenada", async () => {
    // findById
    const serviceWithReview = await servicesRepository.findById(
      serviceWithReviewId,
    );
    expect(serviceWithReview).not.toBeNull();
    expect(serviceWithReview?.rating).toBe(5);
    expect(serviceWithReview?.reviewCount).toBe(1);

    const httpDto = DrizzleServiceMapper.toHTTP(serviceWithReview!);
    expect(httpDto.rating).toBe(5);
    expect(httpDto.reviewCount).toBe(1);

    // Serviço sem review
    const serviceWithoutReview = await servicesRepository.findById(
      serviceWithoutReviewId,
    );
    expect(serviceWithoutReview).not.toBeNull();
    expect(serviceWithoutReview?.rating).toBe(0);
    expect(serviceWithoutReview?.reviewCount).toBe(0);

    const httpDtoEmpty = DrizzleServiceMapper.toHTTP(serviceWithoutReview!);
    expect(httpDtoEmpty.rating).toBeNull();
    expect(httpDtoEmpty.reviewCount).toBe(0);
  });

  it("enriquece múltiplos serviços em lote via findManyByBarbershopId", async () => {
    const result = await servicesRepository.findManyByBarbershopId(shopId, {
      page: 1,
      limit: 10,
    });

    expect(result.total).toBe(2);
    const evaluated = result.services.find(
      (s) => s.id.toString() === serviceWithReviewId,
    );
    const unrated = result.services.find(
      (s) => s.id.toString() === serviceWithoutReviewId,
    );

    expect(evaluated?.rating).toBe(5);
    expect(evaluated?.reviewCount).toBe(1);

    expect(unrated?.rating).toBe(0);
    expect(unrated?.reviewCount).toBe(0);
  });

  it("enriquece barbearia com notas canônicas independentes das notas de serviços", async () => {
    const shop = await barbershopsRepository.findById(shopId);
    expect(shop).not.toBeNull();
    // Loja recebeu nota 4, serviço recebeu nota 5
    expect(shop?.rating).toBe(4);
    expect(shop?.reviewCount).toBe(1);

    const httpShop = DrizzleBarbershopMapper.toHTTP(shop!);
    expect(httpShop.rating).toBe(4);
    expect(httpShop.reviewCount).toBe(1);
  });
});
