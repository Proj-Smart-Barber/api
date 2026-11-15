import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "../../../drizzle/index";
import {
  barbershops,
  bookingEvents,
  bookings,
  bookingServiceItems,
  membership,
  platformFeedbacks,
  reviewItems,
  reviews,
  services,
  users,
} from "../../../drizzle/schema";
import { makeGetOwnerReviewSummaryController } from "../../factories/make-get-owner-review-summary-controller";
import { makeGetOwnerServiceMetricsController } from "../../factories/make-get-owner-service-metrics-controller";
import { makeGetOwnerProfessionalMetricsController } from "../../factories/make-get-owner-professional-metrics-controller";
import { makeGetOwnerFeedbacksController } from "../../factories/make-get-owner-feedbacks-controller";
import { makeReportReviewController } from "../../factories/make-report-review-controller";

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
  const reportReviewController = makeReportReviewController();

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

  describe("Regressions: Active Owner Authorization", () => {
    it("should reject owner with INACTIVE membership across all 4 endpoints", async () => {
      await db
        .update(membership)
        .set({ state: "INACTIVE" })
        .where(sql`${membership.barbershopId} = ${shopId} AND ${membership.userId} = ${ownerId}`);

      const r1 = await summaryController.handle({ shopId, userId: ownerId });
      const r2 = await serviceMetricsController.handle({ shopId, userId: ownerId });
      const r3 = await professionalMetricsController.handle({ shopId, userId: ownerId });
      const r4 = await feedbacksController.handle({ shopId, userId: ownerId });

      expect(r1.statusCode).toBe(403);
      expect(r2.statusCode).toBe(403);
      expect(r3.statusCode).toBe(403);
      expect(r4.statusCode).toBe(403);
    });

    it("should reject removed owner (no membership row) even if barbershop.ownerId matches", async () => {
      await db
        .delete(membership)
        .where(sql`${membership.barbershopId} = ${shopId} AND ${membership.userId} = ${ownerId}`);

      const r1 = await summaryController.handle({ shopId, userId: ownerId });
      expect(r1.statusCode).toBe(403);
    });

    it("should reject BARBERMAN from accessing owner insights", async () => {
      const r1 = await summaryController.handle({ shopId, userId: barberId });
      const r2 = await serviceMetricsController.handle({ shopId, userId: barberId });
      expect(r1.statusCode).toBe(403);
      expect(r2.statusCode).toBe(403);
    });
  });

  describe("Regressions: Provenance Separation (CUSTOMER, DEMO, UNKNOWN, ALL) & Response Rate", () => {
    it("should NOT contaminate CUSTOMER response rate with DEMO bookings or DEMO reviews", async () => {
      const demoBookingId = randomUUID();
      const demoReviewId = randomUUID();
      const now = new Date();

      await db.insert(bookings).values({
        id: demoBookingId,
        barbershopId: shopId,
        barbermanId: barberId,
        customerId,
        status: "COMPLETED",
        source: "DEMO",
        date: now,
        startTime: "14:00",
        endTime: "14:30",
      });

      await db.insert(reviews).values({
        id: demoReviewId,
        barbershopId: shopId,
        bookingId: demoBookingId,
        customerId,
        rating: 2,
        comment: "[Demonstração] Teste",
        status: "PUBLISHED",
        source: "DEMO",
        createdAt: now,
      });

      await db.insert(reviewItems).values({
        id: randomUUID(),
        reviewId: demoReviewId,
        bookingId: demoBookingId,
        targetType: "BARBERSHOP",
        targetKey: `BARBERSHOP:${shopId}`,
        targetId: shopId,
        targetLabel: "Barbearia",
        rating: 2,
        createdAt: now,
      });

      // CUSTOMER should still see only the 2 CUSTOMER bookings and 1 CUSTOMER review (50%, avg 5)
      const custRes = await summaryController.handle({
        shopId,
        userId: ownerId,
        source: "CUSTOMER",
      });
      expect(custRes.statusCode).toBe(200);
      const custData = custRes.body as any;
      expect(custData.metrics.reviewCount).toBe(1);
      expect(custData.metrics.averageRating).toBe(5);
      expect(custData.responseRate.cohortCompletedBookings).toBe(2);
      expect(custData.responseRate.reviewedBookings).toBe(1);
      expect(custData.responseRate.ratePercentage).toBe(50);
      expect(custData.flags.isMixedEnvironment).toBe(true);

      // DEMO should see only the 1 DEMO booking and 1 DEMO review (100%, avg 2)
      const demoRes = await summaryController.handle({
        shopId,
        userId: ownerId,
        source: "DEMO",
      });
      expect(demoRes.statusCode).toBe(200);
      const demoData = demoRes.body as any;
      expect(demoData.metrics.reviewCount).toBe(1);
      expect(demoData.metrics.averageRating).toBe(2);
      expect(demoData.responseRate.cohortCompletedBookings).toBe(1);
      expect(demoData.responseRate.reviewedBookings).toBe(1);
      expect(demoData.responseRate.ratePercentage).toBe(100);
    });

    it("should classify UNKNOWN provenance explicitly and not treat it as CUSTOMER", async () => {
      const unkBookingId = randomUUID();
      const unkReviewId = randomUUID();
      const now = new Date();

      await db.insert(bookings).values({
        id: unkBookingId,
        barbershopId: shopId,
        barbermanId: barberId,
        customerId,
        status: "COMPLETED",
        source: "LEGACY_IMPORT",
        date: now,
        startTime: "15:00",
        endTime: "15:30",
      });

      await db.insert(reviews).values({
        id: unkReviewId,
        barbershopId: shopId,
        bookingId: unkBookingId,
        customerId,
        rating: 1,
        comment: "Origem desconhecida",
        status: "PUBLISHED",
        source: "LEGACY_IMPORT",
        createdAt: now,
      });

      await db.insert(reviewItems).values({
        id: randomUUID(),
        reviewId: unkReviewId,
        bookingId: unkBookingId,
        targetType: "BARBERSHOP",
        targetKey: `BARBERSHOP:${shopId}`,
        targetId: shopId,
        targetLabel: "Barbearia",
        rating: 1,
        createdAt: now,
      });

      const custRes = await summaryController.handle({
        shopId,
        userId: ownerId,
        source: "CUSTOMER",
      });
      const custData = custRes.body as any;
      expect(custData.metrics.reviewCount).toBe(1);
      expect(custData.flags.hasUnknownReviews).toBe(true);

      const unkRes = await summaryController.handle({
        shopId,
        userId: ownerId,
        source: "UNKNOWN",
      });
      const unkData = unkRes.body as any;
      expect(unkData.metrics.reviewCount).toBe(1);
      expect(unkData.metrics.averageRating).toBe(1);
      expect(unkData.latestReview.source).toBe("UNKNOWN");
    });
  });

  describe("Regressions: Cohort Completion Date, Late Reviews, Multiple Snapshots & Boundaries", () => {
    it("should count late reviews (created after period end) in response rate if booking completed in period", async () => {
      const lateBookingId = randomUUID();
      const lateReviewId = randomUUID();

      // Completed on 2026-10-15T15:00:00Z via booking_events
      const completedAt = new Date("2026-10-15T15:00:00.000Z");
      // Reviewed 10 days later on 2026-10-25T15:00:00Z (outside Oct 10-20 window)
      const reviewedAt = new Date("2026-10-25T15:00:00.000Z");

      await db.insert(bookings).values({
        id: lateBookingId,
        barbershopId: shopId,
        barbermanId: barberId,
        customerId,
        status: "COMPLETED",
        source: "CUSTOMER",
        date: new Date("2026-10-01T10:00:00.000Z"), // scheduled date outside window!
        startTime: "10:00",
        endTime: "10:30",
      });

      await db.insert(bookingEvents).values({
        id: randomUUID(),
        bookingId: lateBookingId,
        actorId: barberId,
        eventType: "COMPLETED",
        newVersion: 2,
        newStatus: "COMPLETED",
        createdAt: completedAt,
      });

      await db.insert(reviews).values({
        id: lateReviewId,
        barbershopId: shopId,
        bookingId: lateBookingId,
        customerId,
        rating: 4,
        status: "PUBLISHED",
        source: "CUSTOMER",
        createdAt: reviewedAt,
      });

      await db.insert(reviewItems).values({
        id: randomUUID(),
        reviewId: lateReviewId,
        bookingId: lateBookingId,
        targetType: "BARBERSHOP",
        targetKey: `BARBERSHOP:${shopId}`,
        targetId: shopId,
        targetLabel: "Barbearia",
        rating: 4,
        createdAt: reviewedAt,
      });

      const res = await summaryController.handle({
        shopId,
        userId: ownerId,
        source: "CUSTOMER",
        startDate: "2026-10-10",
        endDate: "2026-10-20",
      });

      expect(res.statusCode).toBe(200);
      const data = res.body as any;
      // Review was created on Oct 25, so 0 reviews received in Oct 10-20
      expect(data.metrics.reviewCount).toBe(0);
      // Cohort completed in Oct 10-20 = 1, and it was answered later = 1 (100%)
      expect(data.responseRate.cohortCompletedBookings).toBe(1);
      expect(data.responseRate.reviewedBookings).toBe(1);
      expect(data.responseRate.ratePercentage).toBe(100);
    });

    it("should reject invalid dates and inverted intervals with 400 VALIDATION_ERROR", async () => {
      const rInvalid = await summaryController.handle({
        shopId,
        userId: ownerId,
        startDate: "2026-02-30",
        endDate: "2026-03-10",
      });
      expect(rInvalid.statusCode).toBe(400);

      const rInverted = await summaryController.handle({
        shopId,
        userId: ownerId,
        startDate: "2026-11-10",
        endDate: "2026-11-01",
      });
      expect(rInverted.statusCode).toBe(400);

      const rTooLong = await summaryController.handle({
        shopId,
        userId: ownerId,
        startDate: "2025-01-01",
        endDate: "2026-12-31",
      });
      expect(rTooLong.statusCode).toBe(400);
    });

    it("should not overlap adjacent periods at boundary instant and return timeSeries with null for empty buckets", async () => {
      const boundaryBookingId = randomUUID();
      const boundaryReviewId = randomUUID();
      // Exact start of 2026-11-10 in America/Sao_Paulo (-03:00) = 2026-11-10T03:00:00.000Z
      const boundaryInstant = new Date("2026-11-10T03:00:00.000Z");

      await db.insert(bookings).values({
        id: boundaryBookingId,
        barbershopId: shopId,
        barbermanId: barberId,
        customerId,
        status: "COMPLETED",
        source: "CUSTOMER",
        date: boundaryInstant,
        startsAt: boundaryInstant,
        endsAt: boundaryInstant,
        startTime: "00:00",
        endTime: "00:30",
      });

      await db.insert(reviews).values({
        id: boundaryReviewId,
        barbershopId: shopId,
        bookingId: boundaryBookingId,
        customerId,
        rating: 3,
        status: "PUBLISHED",
        source: "CUSTOMER",
        createdAt: boundaryInstant,
      });

      await db.insert(reviewItems).values({
        id: randomUUID(),
        reviewId: boundaryReviewId,
        bookingId: boundaryBookingId,
        targetType: "BARBERSHOP",
        targetKey: `BARBERSHOP:${shopId}`,
        targetId: shopId,
        targetLabel: "Barbearia",
        rating: 3,
        createdAt: boundaryInstant,
      });

      // Previous period 2026-11-05 to 2026-11-09 -> endDate exclusive is 2026-11-10T03:00:00.000Z
      const prevRes = await summaryController.handle({
        shopId,
        userId: ownerId,
        source: "CUSTOMER",
        startDate: "2026-11-05",
        endDate: "2026-11-09",
      });
      expect((prevRes.body as any).metrics.reviewCount).toBe(0);

      // Current period 2026-11-10 to 2026-11-14 -> startDate inclusive is 2026-11-10T03:00:00.000Z
      const currRes = await summaryController.handle({
        shopId,
        userId: ownerId,
        source: "CUSTOMER",
        startDate: "2026-11-10",
        endDate: "2026-11-14",
        granularity: "WEEK",
      });
      const currData = currRes.body as any;
      expect(currData.metrics.reviewCount).toBe(1);
      expect(currData.comparison.previousReviewCount).toBe(0);
      expect(Array.isArray(currData.timeSeries)).toBe(true);
      expect(currData.timeSeries.length).toBeGreaterThanOrEqual(1);
    });

    it("should exclude platform_feedbacks from owner metrics and prevent duplicate review reports", async () => {
      await db.insert(platformFeedbacks).values({
        id: randomUUID(),
        bookingId: booking1Id,
        reviewId: review1Id,
        customerId,
        rating: 1,
        comment: "Feedback privado plataforma",
      });

      const fbRes = await feedbacksController.handle({
        shopId,
        userId: ownerId,
        source: "CUSTOMER",
      });
      const fbData = fbRes.body as any;
      expect(fbData.items[0].generalComment).toBe("Excelente atendimento geral!");
      expect(JSON.stringify(fbData)).not.toContain("Feedback privado plataforma");

      // Report review once -> 201, twice -> 409 Conflict
      const rep1 = await reportReviewController.handle({
        userId: ownerId,
        reviewId: review1Id,
        reason: "Conteúdo impróprio",
      });
      expect(rep1.statusCode).toBe(201);

      const rep2 = await reportReviewController.handle({
        userId: ownerId,
        reviewId: review1Id,
        reason: "Repetido",
      });
      expect(rep2.statusCode).toBe(409);
    });

    it("should paginate services and professionals while preserving global totals and coverage", async () => {
      const s3Id = randomUUID();
      await db.insert(services).values({
        id: s3Id,
        barbershopId: shopId,
        title: "Sobrancelha",
        priceInCents: 2000,
        durationInMinutes: 15,
        isActive: true,
      });

      const page1 = await serviceMetricsController.handle({
        shopId,
        userId: ownerId,
        source: "CUSTOMER",
        page: 1,
        limit: 2,
      });
      expect(page1.statusCode).toBe(200);
      const d1 = page1.body as any;
      expect(d1.items.length).toBe(2);
      expect(d1.totalServices).toBe(3);
      expect(d1.evaluatedServices).toBe(1);
      expect(d1.hasNext).toBe(true);

      const page2 = await serviceMetricsController.handle({
        shopId,
        userId: ownerId,
        source: "CUSTOMER",
        page: 2,
        limit: 2,
      });
      const d2 = page2.body as any;
      expect(d2.items.length).toBe(1);
      expect(d2.totalServices).toBe(3);
      expect(d2.hasNext).toBe(false);
    });
  });
});
