import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "../../../drizzle/index";
import {
  barbershops,
  bookings,
  bookingServiceItems,
  membership,
  reviewItems,
  reviews,
  services,
  users,
} from "../../../drizzle/schema";
import { makeGetOwnerReviewSummaryController } from "../../factories/make-get-owner-review-summary-controller";
import { makeGetOwnerServiceMetricsController } from "../../factories/make-get-owner-service-metrics-controller";
import { makeGetOwnerProfessionalMetricsController } from "../../factories/make-get-owner-professional-metrics-controller";
import { makeGetOwnerFeedbacksController } from "../../factories/make-get-owner-feedbacks-controller";

describe("Review Insights (Owner Management) Integration", () => {
  const ownerId = randomUUID();
  const unauthorizedUserId = randomUUID();
  const barberId = randomUUID();
  const customerId = randomUUID();
  const shopId = randomUUID();

  const service1Id = randomUUID();
  const service2Id = randomUUID();
  const booking1Id = randomUUID();
  const booking2Id = randomUUID();
  const review1Id = randomUUID();
  const review2Id = randomUUID();

  const summaryController = makeGetOwnerReviewSummaryController();
  const serviceMetricsController = makeGetOwnerServiceMetricsController();
  const professionalMetricsController = makeGetOwnerProfessionalMetricsController();
  const feedbacksController = makeGetOwnerFeedbacksController();

  async function cleanTestData() {
    await db.execute(
      sql`TRUNCATE TABLE platform_feedbacks, review_items, review_reports, review_moderation_logs, reviews, booking_service_items, bookings, service_media, barbershop_gallery, media, services, barbershop_locations, membership, barbershops, users CASCADE`,
    );
  }

  beforeAll(async () => {
    await cleanTestData();
  });

  afterAll(async () => {
    await cleanTestData();
    await pool.end();
  });

  beforeEach(async () => {
    await cleanTestData();

    // 1. Users
    await db.insert(users).values([
      {
        id: ownerId,
        name: "Owner John",
        email: "owner@insights.test",
        password: "hash",
        cpf: "22222222201",
        accountType: "OWNER",
      },
      {
        id: unauthorizedUserId,
        name: "Unauthorized User",
        email: "other@insights.test",
        password: "hash",
        cpf: "22222222202",
        accountType: "CLIENT",
      },
      {
        id: barberId,
        name: "Barber Lucas",
        email: "lucas@insights.test",
        password: "hash",
        cpf: "22222222203",
        accountType: "CLIENT",
      },
      {
        id: customerId,
        name: "Customer Pedro",
        email: "pedro@insights.test",
        password: "hash",
        cpf: "22222222204",
        accountType: "CLIENT",
      },
    ]);

    // 2. Barbershop
    await db.insert(barbershops).values({
      id: shopId,
      name: "Barbearia Insights Premium",
      slug: "barbearia-insights-premium",
      cnpj: "12.345.678/0001-99",
      location: "Av Paulista, 1000",
      ownerId,
      rating: "0.00",
      reviewCount: 0,
      timezone: "America/Sao_Paulo",
    });

    // 3. Memberships
    await db.insert(membership).values([
      {
        id: randomUUID(),
        barbershopId: shopId,
        userId: ownerId,
        role: "OWNER",
        state: "ACTIVE",
      },
      {
        id: randomUUID(),
        barbershopId: shopId,
        userId: barberId,
        role: "BARBERMAN",
        state: "ACTIVE",
      },
    ]);

    // 4. Services
    await db.insert(services).values([
      {
        id: service1Id,
        barbershopId: shopId,
        title: "Corte Tradicional",
        priceInCents: 5000,
        durationInMinutes: 30,
        isActive: true,
      },
      {
        id: service2Id,
        barbershopId: shopId,
        title: "Barba Terapia",
        priceInCents: 4000,
        durationInMinutes: 30,
        isActive: true,
      },
    ]);

    // 5. Bookings
    const today = new Date();
    await db.insert(bookings).values([
      {
        id: booking1Id,
        barbershopId: shopId,
        barbermanId: barberId,
        customerId,
        status: "COMPLETED",
        date: today,
        startTime: "10:00",
        endTime: "10:30",
      },
      {
        id: booking2Id,
        barbershopId: shopId,
        barbermanId: barberId,
        customerId,
        status: "COMPLETED",
        date: today,
        startTime: "11:00",
        endTime: "11:30",
      },
    ]);

    await db.insert(bookingServiceItems).values([
      {
        id: randomUUID(),
        bookingId: booking1Id,
        serviceId: service1Id,
        title: "Corte Tradicional",
      },
      {
        id: randomUUID(),
        bookingId: booking2Id,
        serviceId: service2Id,
        title: "Barba Terapia",
      },
    ]);

    // 6. Review 1: CUSTOMER source, 5 stars for shop, 4 stars for barber, 5 stars for service 1
    await db.insert(reviews).values({
      id: review1Id,
      barbershopId: shopId,
      bookingId: booking1Id,
      customerId,
      rating: 5,
      comment: "Excelente atendimento geral!",
      status: "PUBLISHED",
      source: "CUSTOMER",
      createdAt: today,
    });

    await db.insert(reviewItems).values([
      {
        id: randomUUID(),
        reviewId: review1Id,
        bookingId: booking1Id,
        targetType: "BARBERSHOP",
        targetKey: `BARBERSHOP:${shopId}`,
        targetId: shopId,
        targetLabel: "Barbearia",
        rating: 5,
        createdAt: today,
      },
      {
        id: randomUUID(),
        reviewId: review1Id,
        bookingId: booking1Id,
        targetType: "BARBER",
        targetKey: `BARBER:${barberId}`,
        targetId: barberId,
        targetLabel: "Barbeiro Lucas",
        rating: 4,
        createdAt: today,
      },
      {
        id: randomUUID(),
        reviewId: review1Id,
        bookingId: booking1Id,
        targetType: "SERVICE",
        targetKey: `SERVICE:${service1Id}`,
        targetId: service1Id,
        targetLabel: "Corte Tradicional",
        rating: 5,
        createdAt: today,
      },
    ]);
  });

  describe("Security & Authorization", () => {
    it("should return 403 Forbidden when non-owner tries to access summary", async () => {
      const response = await summaryController.handle({
        shopId,
        userId: unauthorizedUserId,
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 404 Not Found when shopId does not exist", async () => {
      const response = await summaryController.handle({
        shopId: randomUUID(),
        userId: ownerId,
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return Cache-Control: no-store header on successful response", async () => {
      const response = await summaryController.handle({
        shopId,
        userId: ownerId,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers?.["Cache-Control"]).toBe("no-store, private");
    });
  });

  describe("GET /review-insights/summary", () => {
    it("should calculate correct summary metrics, distribution, response rate and coverage", async () => {
      const response = await summaryController.handle({
        shopId,
        userId: ownerId,
        source: "CUSTOMER",
      });

      expect(response.statusCode).toBe(200);
      const data = response.body as any;

      // Metrics
      expect(data.metrics.averageRating).toBe(5);
      expect(data.metrics.reviewCount).toBe(1);
      expect(data.metrics.distribution).toEqual({
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 1,
      });
      expect(data.metrics.isSmallSample).toBe(true);

      // Response Rate (2 completed bookings, 1 reviewed = 50%)
      expect(data.responseRate.cohortCompletedBookings).toBe(2);
      expect(data.responseRate.reviewedBookings).toBe(1);
      expect(data.responseRate.ratePercentage).toBe(50);

      // Service Coverage (2 active services, 1 evaluated = 50%)
      expect(data.serviceCoverage.totalActiveServices).toBe(2);
      expect(data.serviceCoverage.evaluatedActiveServices).toBe(1);
      expect(data.serviceCoverage.coveragePercentage).toBe(50);

      // Flags
      expect(data.flags.hasCustomerReviews).toBe(true);
      expect(data.flags.isDemoEnvironment).toBe(false);
    });
  });

  describe("GET /review-insights/services", () => {
    it("should list service metrics and correctly identify absence reasons", async () => {
      const response = await serviceMetricsController.handle({
        shopId,
        userId: ownerId,
        source: "CUSTOMER",
      });

      expect(response.statusCode).toBe(200);
      const data = response.body as any;

      expect(data.totalServices).toBe(2);
      expect(data.evaluatedServices).toBe(1);
      expect(data.coveragePercentage).toBe(50);

      const service1 = data.items.find((s: any) => s.serviceId === service1Id);
      expect(service1).toBeDefined();
      expect(service1.averageRating).toBe(5);
      expect(service1.reviewCount).toBe(1);
      expect(service1.absenceReason).toBeNull();
      expect(service1.isSmallSample).toBe(true);

      // Service 2 has 1 completed booking but 0 reviews -> absenceReason: NO_CUSTOMER_FEEDBACK
      const service2 = data.items.find((s: any) => s.serviceId === service2Id);
      expect(service2).toBeDefined();
      expect(service2.averageRating).toBeNull();
      expect(service2.reviewCount).toBe(0);
      expect(service2.absenceReason).toBe("NO_CUSTOMER_FEEDBACK");
    });
  });

  describe("GET /review-insights/professionals", () => {
    it("should return ratings scoped to BARBER target type", async () => {
      const response = await professionalMetricsController.handle({
        shopId,
        userId: ownerId,
        source: "CUSTOMER",
      });

      expect(response.statusCode).toBe(200);
      const data = response.body as any;

      expect(data.totalProfessionals).toBeGreaterThanOrEqual(1);
      const barber = data.items.find((p: any) => p.professionalId === barberId);
      expect(barber).toBeDefined();
      expect(barber.name).toBe("Barber Lucas");
      expect(barber.averageRating).toBe(4);
      expect(barber.reviewCount).toBe(1);
    });
  });

  describe("GET /review-insights/feedbacks", () => {
    it("should paginate feedbacks and NEVER expose customer PII (CPF, email, phone)", async () => {
      const response = await feedbacksController.handle({
        shopId,
        userId: ownerId,
        source: "CUSTOMER",
        page: 1,
        limit: 10,
      });

      expect(response.statusCode).toBe(200);
      const data = response.body as any;

      expect(data.total).toBe(1);
      expect(data.items.length).toBe(1);

      const feedback = data.items[0];
      expect(feedback.generalComment).toBe("Excelente atendimento geral!");
      expect(feedback.barbershopRating).toBe(5);
      expect(feedback.customer.name).toBe("Customer Pedro");
      // Security: ensure no PII fields leaked
      expect(feedback.customer.email).toBeUndefined();
      expect(feedback.customer.cpf).toBeUndefined();
      expect(feedback.customer.phone).toBeUndefined();

      expect(feedback.items.length).toBe(3);
    });
  });
});
