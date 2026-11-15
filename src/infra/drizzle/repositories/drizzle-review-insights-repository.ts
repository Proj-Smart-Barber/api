import {
  eq,
  and,
  desc,
  count,
  sql,
  inArray,
  gte,
  lte,
  exists,
} from "drizzle-orm";
import { db as defaultDb } from "../index";
import {
  reviews,
  reviewItems,
  bookings,
  bookingServiceItems,
  services,
  users,
  membership,
  barbershops,
} from "../schema";
import type {
  ReviewInsightsRepository,
  ReviewSummaryMetrics,
  ServiceMetricsResponse,
  ServiceReviewMetricItem,
  ProfessionalMetricsResponse,
  ProfessionalReviewMetricItem,
  FeedbacksResponse,
  OwnerFeedbackItem,
  OwnerFeedbackReviewItem,
  StarDistribution,
} from "../../../domain/application/repositories/review-insights-repository";

export class DrizzleReviewInsightsRepository implements ReviewInsightsRepository {
  constructor(private db = defaultDb) {}

  async getSummaryMetrics(params: {
    barbershopId: string;
    startDate: Date;
    endDate: Date;
    source: "CUSTOMER" | "DEMO" | "ALL";
    timezone: string;
  }): Promise<ReviewSummaryMetrics> {
    const { barbershopId, startDate, endDate, source, timezone } = params;

    // 1. Agregação do período atual para BARBERSHOP
    const currentConditions = [
      eq(reviews.barbershopId, barbershopId),
      eq(reviews.status, "PUBLISHED"),
      eq(reviewItems.targetType, "BARBERSHOP"),
      gte(reviews.createdAt, startDate),
      lte(reviews.createdAt, endDate),
    ];
    if (source !== "ALL") {
      currentConditions.push(eq(reviews.source, source));
    }

    const [current] = await this.db
      .select({
        count: count(),
        avg: sql<string | null>`AVG(${reviewItems.rating})`,
        s1: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 1 THEN 1 END)`,
        s2: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 2 THEN 1 END)`,
        s3: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 3 THEN 1 END)`,
        s4: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 4 THEN 1 END)`,
        s5: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 5 THEN 1 END)`,
      })
      .from(reviewItems)
      .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
      .where(and(...currentConditions));

    const reviewCount = Number(current?.count ?? 0);
    const averageRating =
      reviewCount > 0 ? Number(parseFloat(current?.avg ?? "0").toFixed(2)) : null;

    const distribution: StarDistribution = {
      1: Number(current?.s1 ?? 0),
      2: Number(current?.s2 ?? 0),
      3: Number(current?.s3 ?? 0),
      4: Number(current?.s4 ?? 0),
      5: Number(current?.s5 ?? 0),
    };

    const s1PlusS2 = distribution[1] + distribution[2];
    const percentage1to2Stars =
      reviewCount > 0 ? Number(((s1PlusS2 / reviewCount) * 100).toFixed(1)) : 0;
    const isSmallSample = reviewCount < 5;

    // 2. Período anterior de mesma duração
    const durationMs = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime());
    const prevStartDate = new Date(startDate.getTime() - durationMs);

    const prevConditions = [
      eq(reviews.barbershopId, barbershopId),
      eq(reviews.status, "PUBLISHED"),
      eq(reviewItems.targetType, "BARBERSHOP"),
      gte(reviews.createdAt, prevStartDate),
      lte(reviews.createdAt, prevEndDate),
    ];
    if (source !== "ALL") {
      prevConditions.push(eq(reviews.source, source));
    }

    const [prev] = await this.db
      .select({
        count: count(),
        avg: sql<string | null>`AVG(${reviewItems.rating})`,
      })
      .from(reviewItems)
      .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
      .where(and(...prevConditions));

    const previousReviewCount = Number(prev?.count ?? 0);
    const previousAverageRating =
      previousReviewCount > 0
        ? Number(parseFloat(prev?.avg ?? "0").toFixed(2))
        : null;

    const ratingDiff =
      averageRating !== null && previousAverageRating !== null
        ? Number((averageRating - previousAverageRating).toFixed(2))
        : null;
    const reviewCountDiff = reviewCount - previousReviewCount;

    // 3. Taxa de resposta da coorte de atendimentos concluídos no período
    const cohortConditions = [
      eq(bookings.barbershopId, barbershopId),
      eq(bookings.status, "COMPLETED"),
      gte(bookings.date, startDate),
      lte(bookings.date, endDate),
    ];

    const [cohort] = await this.db
      .select({
        totalCompleted: count(),
        reviewedCount: sql<number>`COUNT(CASE WHEN ${reviews.id} IS NOT NULL AND ${reviews.status} = 'PUBLISHED' THEN 1 END)`,
      })
      .from(bookings)
      .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
      .where(and(...cohortConditions));

    const cohortCompletedBookings = Number(cohort?.totalCompleted ?? 0);
    const reviewedBookings = Number(cohort?.reviewedCount ?? 0);
    const ratePercentage =
      cohortCompletedBookings > 0
        ? Number(((reviewedBookings / cohortCompletedBookings) * 100).toFixed(1))
        : null;

    // 4. Cobertura de serviços ativos da barbearia
    const activeServicesList = await this.db
      .select({ id: services.id })
      .from(services)
      .where(
        and(
          eq(services.barbershopId, barbershopId),
          eq(services.isActive, true),
        ),
      );

    const totalActiveServices = activeServicesList.length;
    let evaluatedActiveServices = 0;

    if (totalActiveServices > 0) {
      const activeIds = activeServicesList.map((s) => s.id);
      const serviceCovConditions = [
        eq(reviewItems.targetType, "SERVICE"),
        inArray(reviewItems.targetId, activeIds),
        eq(reviews.status, "PUBLISHED"),
      ];
      if (source !== "ALL") {
        serviceCovConditions.push(eq(reviews.source, source));
      }

      const rows = await this.db
        .select({ targetId: reviewItems.targetId })
        .from(reviewItems)
        .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
        .where(and(...serviceCovConditions))
        .groupBy(reviewItems.targetId);

      evaluatedActiveServices = rows.length;
    }

    const coveragePercentage =
      totalActiveServices > 0
        ? Number(((evaluatedActiveServices / totalActiveServices) * 100).toFixed(1))
        : null;

    // 5. Última avaliação recebida
    const latestConditions = [
      eq(reviews.barbershopId, barbershopId),
      eq(reviews.status, "PUBLISHED"),
    ];
    if (source !== "ALL") {
      latestConditions.push(eq(reviews.source, source));
    }

    const [latest] = await this.db
      .select({
        id: reviews.id,
        createdAt: reviews.createdAt,
        rating: reviews.rating,
        comment: reviews.comment,
        source: reviews.source,
        customerName: users.name,
      })
      .from(reviews)
      .leftJoin(users, eq(users.id, reviews.customerId))
      .where(and(...latestConditions))
      .orderBy(desc(reviews.createdAt))
      .limit(1);

    // 6. Flags de ambiente (presença de avaliações DEMO vs CUSTOMER na unidade)
    const [flagCounts] = await this.db
      .select({
        demoCount: sql<number>`COUNT(CASE WHEN ${reviews.source} = 'DEMO' THEN 1 END)`,
        customerCount: sql<number>`COUNT(CASE WHEN ${reviews.source} = 'CUSTOMER' THEN 1 END)`,
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.barbershopId, barbershopId),
          eq(reviews.status, "PUBLISHED"),
        ),
      );

    const hasDemoReviews = Number(flagCounts?.demoCount ?? 0) > 0;
    const hasCustomerReviews = Number(flagCounts?.customerCount ?? 0) > 0;
    const hasAnyReviews = hasDemoReviews || hasCustomerReviews;
    const isDemoEnvironment = hasDemoReviews && !hasCustomerReviews;

    return {
      metrics: {
        averageRating,
        reviewCount,
        distribution,
        percentage1to2Stars,
        isSmallSample,
      },
      comparison: {
        previousPeriodStart: prevStartDate.toISOString(),
        previousPeriodEnd: prevEndDate.toISOString(),
        previousAverageRating,
        previousReviewCount,
        ratingDiff,
        reviewCountDiff,
      },
      responseRate: {
        cohortCompletedBookings,
        reviewedBookings,
        ratePercentage,
        cohortDefinition: "Conclusão do atendimento no período",
      },
      serviceCoverage: {
        totalActiveServices,
        evaluatedActiveServices,
        coveragePercentage,
      },
      latestReview: latest
        ? {
            id: latest.id,
            createdAt: latest.createdAt.toISOString(),
            rating: latest.rating,
            comment: latest.comment,
            customerName: latest.customerName || "Cliente",
            source: (latest.source === "DEMO" ? "DEMO" : "CUSTOMER") as
              | "CUSTOMER"
              | "DEMO",
          }
        : null,
      flags: {
        hasAnyReviews,
        hasDemoReviews,
        hasCustomerReviews,
        isDemoEnvironment,
        appliedSource: source,
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        timezone,
      },
    };
  }

  async getServiceMetrics(params: {
    barbershopId: string;
    startDate?: Date;
    endDate?: Date;
    source: "CUSTOMER" | "DEMO" | "ALL";
    includeInactive?: boolean;
  }): Promise<ServiceMetricsResponse> {
    const { barbershopId, startDate, endDate, source, includeInactive } = params;

    const serviceFilter = [eq(services.barbershopId, barbershopId)];
    if (!includeInactive) {
      serviceFilter.push(eq(services.isActive, true));
    }

    const unitServices = await this.db
      .select({
        id: services.id,
        name: services.title,
        isActive: services.isActive,
      })
      .from(services)
      .where(and(...serviceFilter));

    if (unitServices.length === 0) {
      return {
        items: [],
        totalServices: 0,
        evaluatedServices: 0,
        coveragePercentage: null,
      };
    }

    const serviceIds = unitServices.map((s) => s.id);

    // Agregações de notas por serviço em lote
    const reviewConditions = [
      eq(reviewItems.targetType, "SERVICE"),
      inArray(reviewItems.targetId, serviceIds),
      eq(reviews.status, "PUBLISHED"),
      eq(reviews.barbershopId, barbershopId),
    ];
    if (startDate) {
      reviewConditions.push(gte(reviews.createdAt, startDate));
    }
    if (endDate) {
      reviewConditions.push(lte(reviews.createdAt, endDate));
    }
    if (source !== "ALL") {
      reviewConditions.push(eq(reviews.source, source));
    }

    const reviewStats = await this.db
      .select({
        targetId: reviewItems.targetId,
        count: count(),
        avg: sql<string | null>`AVG(${reviewItems.rating})`,
        s1: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 1 THEN 1 END)`,
        s2: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 2 THEN 1 END)`,
        s3: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 3 THEN 1 END)`,
        s4: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 4 THEN 1 END)`,
        s5: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 5 THEN 1 END)`,
        lastReviewAt: sql<string | null>`MAX(${reviews.createdAt})`,
      })
      .from(reviewItems)
      .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
      .where(and(...reviewConditions))
      .groupBy(reviewItems.targetId);

    const statsMap = new Map<
      string,
      {
        count: number;
        avg: number | null;
        distribution: StarDistribution;
        percentage1to2Stars: number;
        lastReviewAt: string | null;
      }
    >();

    for (const row of reviewStats) {
      if (!row.targetId) continue;
      const countNum = Number(row.count ?? 0);
      const avgNum =
        countNum > 0 ? Number(parseFloat(row.avg ?? "0").toFixed(2)) : null;
      const dist: StarDistribution = {
        1: Number(row.s1 ?? 0),
        2: Number(row.s2 ?? 0),
        3: Number(row.s3 ?? 0),
        4: Number(row.s4 ?? 0),
        5: Number(row.s5 ?? 0),
      };
      const s1PlusS2 = dist[1] + dist[2];
      const p1to2 =
        countNum > 0 ? Number(((s1PlusS2 / countNum) * 100).toFixed(1)) : 0;
      statsMap.set(row.targetId, {
        count: countNum,
        avg: avgNum,
        distribution: dist,
        percentage1to2Stars: p1to2,
        lastReviewAt: row.lastReviewAt ? new Date(row.lastReviewAt).toISOString() : null,
      });
    }

    // Contagem de bookings concluídos por serviço (para identificar motivo da ausência de avaliação)
    const bookingConditions = [
      eq(bookings.barbershopId, barbershopId),
      eq(bookings.status, "COMPLETED"),
      inArray(bookingServiceItems.serviceId, serviceIds),
    ];
    if (startDate) {
      bookingConditions.push(gte(bookings.date, startDate));
    }
    if (endDate) {
      bookingConditions.push(lte(bookings.date, endDate));
    }

    const bookingStats = await this.db
      .select({
        serviceId: bookingServiceItems.serviceId,
        completedCount: count(),
      })
      .from(bookingServiceItems)
      .innerJoin(bookings, eq(bookings.id, bookingServiceItems.bookingId))
      .where(and(...bookingConditions))
      .groupBy(bookingServiceItems.serviceId);

    const bookingStatsMap = new Map<string, number>();
    for (const b of bookingStats) {
      if (b.serviceId) {
        bookingStatsMap.set(b.serviceId, Number(b.completedCount ?? 0));
      }
    }

    let evaluatedCount = 0;
    const items: ServiceReviewMetricItem[] = unitServices.map((service) => {
      const stats = statsMap.get(service.id);
      const completedCount = bookingStatsMap.get(service.id) ?? 0;
      const reviewCount = stats?.count ?? 0;

      if (reviewCount > 0) {
        evaluatedCount++;
      }

      let absenceReason: "NO_COMPLETED_BOOKINGS" | "NO_CUSTOMER_FEEDBACK" | null = null;
      if (reviewCount === 0) {
        absenceReason =
          completedCount === 0
            ? "NO_COMPLETED_BOOKINGS"
            : "NO_CUSTOMER_FEEDBACK";
      }

      const unreviewedCount = Math.max(0, completedCount - reviewCount);

      return {
        serviceId: service.id,
        serviceName: service.name,
        isActive: service.isActive,
        averageRating: stats?.avg ?? null,
        reviewCount,
        distribution: stats?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        percentage1to2Stars: stats?.percentage1to2Stars ?? 0,
        isSmallSample: reviewCount < 5,
        lastReviewAt: stats?.lastReviewAt ?? null,
        completedBookingsCount: completedCount,
        unreviewedBookingsCount: unreviewedCount,
        absenceReason,
      };
    });

    // Ordenação estável: serviços com mais avaliações primeiro, depois por nome
    items.sort((a, b) => {
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
      if (b.averageRating !== null && a.averageRating !== null) {
        return b.averageRating - a.averageRating;
      }
      return a.serviceName.localeCompare(b.serviceName);
    });

    const totalServices = unitServices.length;
    const coveragePercentage =
      totalServices > 0
        ? Number(((evaluatedCount / totalServices) * 100).toFixed(1))
        : null;

    return {
      items,
      totalServices,
      evaluatedServices: evaluatedCount,
      coveragePercentage,
    };
  }

  async getProfessionalMetrics(params: {
    barbershopId: string;
    startDate?: Date;
    endDate?: Date;
    source: "CUSTOMER" | "DEMO" | "ALL";
  }): Promise<ProfessionalMetricsResponse> {
    const { barbershopId, startDate, endDate, source } = params;

    // Buscar membros da equipe da unidade
    const teamMembers = await this.db
      .select({
        userId: membership.userId,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(membership)
      .innerJoin(users, eq(users.id, membership.userId))
      .where(
        and(
          eq(membership.barbershopId, barbershopId),
          inArray(membership.role, ["BARBERMAN", "OWNER"]),
        ),
      );

    const professionalIds = teamMembers.map((m) => m.userId);

    // Agregações em lote para BARBER
    const reviewConditions = [
      eq(reviewItems.targetType, "BARBER"),
      eq(reviews.status, "PUBLISHED"),
      eq(reviews.barbershopId, barbershopId),
    ];
    if (professionalIds.length > 0) {
      reviewConditions.push(inArray(reviewItems.targetId, professionalIds));
    }
    if (startDate) {
      reviewConditions.push(gte(reviews.createdAt, startDate));
    }
    if (endDate) {
      reviewConditions.push(lte(reviews.createdAt, endDate));
    }
    if (source !== "ALL") {
      reviewConditions.push(eq(reviews.source, source));
    }

    const reviewStats = await this.db
      .select({
        targetId: reviewItems.targetId,
        count: count(),
        avg: sql<string | null>`AVG(${reviewItems.rating})`,
        s1: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 1 THEN 1 END)`,
        s2: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 2 THEN 1 END)`,
        s3: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 3 THEN 1 END)`,
        s4: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 4 THEN 1 END)`,
        s5: sql<number>`COUNT(CASE WHEN ${reviewItems.rating} = 5 THEN 1 END)`,
        lastReviewAt: sql<string | null>`MAX(${reviews.createdAt})`,
      })
      .from(reviewItems)
      .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
      .where(and(...reviewConditions))
      .groupBy(reviewItems.targetId);

    const statsMap = new Map<
      string,
      {
        count: number;
        avg: number | null;
        distribution: StarDistribution;
        percentage1to2Stars: number;
        lastReviewAt: string | null;
      }
    >();

    for (const row of reviewStats) {
      if (!row.targetId) continue;
      const countNum = Number(row.count ?? 0);
      const avgNum =
        countNum > 0 ? Number(parseFloat(row.avg ?? "0").toFixed(2)) : null;
      const dist: StarDistribution = {
        1: Number(row.s1 ?? 0),
        2: Number(row.s2 ?? 0),
        3: Number(row.s3 ?? 0),
        4: Number(row.s4 ?? 0),
        5: Number(row.s5 ?? 0),
      };
      const s1PlusS2 = dist[1] + dist[2];
      const p1to2 =
        countNum > 0 ? Number(((s1PlusS2 / countNum) * 100).toFixed(1)) : 0;
      statsMap.set(row.targetId, {
        count: countNum,
        avg: avgNum,
        distribution: dist,
        percentage1to2Stars: p1to2,
        lastReviewAt: row.lastReviewAt ? new Date(row.lastReviewAt).toISOString() : null,
      });
    }

    const items: ProfessionalReviewMetricItem[] = teamMembers.map((member) => {
      const stats = statsMap.get(member.userId);
      const reviewCount = stats?.count ?? 0;
      return {
        professionalId: member.userId,
        name: member.name,
        avatarUrl: member.avatarUrl,
        averageRating: stats?.avg ?? null,
        reviewCount,
        distribution: stats?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        percentage1to2Stars: stats?.percentage1to2Stars ?? 0,
        isSmallSample: reviewCount < 5,
        lastReviewAt: stats?.lastReviewAt ?? null,
      };
    });

    items.sort((a, b) => {
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
      if (b.averageRating !== null && a.averageRating !== null) {
        return b.averageRating - a.averageRating;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      items,
      totalProfessionals: items.length,
    };
  }

  async getFeedbacks(params: {
    barbershopId: string;
    startDate?: Date;
    endDate?: Date;
    source: "CUSTOMER" | "DEMO" | "ALL";
    targetType?: "ALL" | "BARBERSHOP" | "BARBER" | "SERVICE";
    targetId?: string;
    rating?: number;
    hasComment?: boolean;
    page: number;
    limit: number;
  }): Promise<FeedbacksResponse> {
    const {
      barbershopId,
      startDate,
      endDate,
      source,
      targetType,
      targetId,
      rating,
      hasComment,
      page,
      limit,
    } = params;

    const reviewConditions = [
      eq(reviews.barbershopId, barbershopId),
      eq(reviews.status, "PUBLISHED"),
    ];

    if (startDate) {
      reviewConditions.push(gte(reviews.createdAt, startDate));
    }
    if (endDate) {
      reviewConditions.push(lte(reviews.createdAt, endDate));
    }
    if (source !== "ALL") {
      reviewConditions.push(eq(reviews.source, source));
    }

    if (hasComment === true) {
      reviewConditions.push(
        sql`${reviews.comment} IS NOT NULL AND length(trim(${reviews.comment})) > 0`,
      );
    } else if (hasComment === false) {
      reviewConditions.push(
        sql`(${reviews.comment} IS NULL OR length(trim(${reviews.comment})) = 0)`,
      );
    }

    // Se houver filtros de alvo (targetType != ALL, targetId, rating específico do item)
    if (
      (targetType && targetType !== "ALL") ||
      targetId ||
      rating !== undefined
    ) {
      const itemFilterConditions = [eq(reviewItems.reviewId, reviews.id)];
      if (targetType && targetType !== "ALL") {
        itemFilterConditions.push(eq(reviewItems.targetType, targetType));
      }
      if (targetId) {
        itemFilterConditions.push(eq(reviewItems.targetId, targetId));
      }
      if (rating !== undefined) {
        itemFilterConditions.push(eq(reviewItems.rating, rating));
      }

      reviewConditions.push(
        exists(
          this.db
            .select({ one: sql`1` })
            .from(reviewItems)
            .where(and(...itemFilterConditions)),
        ),
      );
    }

    // Total de registros
    const [totalRow] = await this.db
      .select({ count: count() })
      .from(reviews)
      .where(and(...reviewConditions));

    const total = Number(totalRow?.count ?? 0);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;

    // Buscar avaliações da página com autor mínimo (apenas name e avatarUrl)
    const reviewRows = await this.db
      .select({
        id: reviews.id,
        bookingId: reviews.bookingId,
        source: reviews.source,
        createdAt: reviews.createdAt,
        rating: reviews.rating,
        comment: reviews.comment,
        customerName: users.name,
        customerAvatarUrl: users.avatarUrl,
      })
      .from(reviews)
      .leftJoin(users, eq(users.id, reviews.customerId))
      .where(and(...reviewConditions))
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(safeLimit)
      .offset(offset);

    if (reviewRows.length === 0) {
      return {
        items: [],
        page: safePage,
        limit: safeLimit,
        total,
        hasNext: false,
      };
    }

    // Buscar itens das avaliações em lote
    const reviewIds = reviewRows.map((r) => r.id);
    const itemRows = await this.db
      .select({
        reviewId: reviewItems.reviewId,
        targetType: reviewItems.targetType,
        targetId: reviewItems.targetId,
        targetLabel: reviewItems.targetLabel,
        rating: reviewItems.rating,
      })
      .from(reviewItems)
      .where(inArray(reviewItems.reviewId, reviewIds));

    const itemsByReviewId = new Map<string, OwnerFeedbackReviewItem[]>();
    for (const item of itemRows) {
      const list = itemsByReviewId.get(item.reviewId) ?? [];
      list.push({
        targetType: item.targetType as "BARBERSHOP" | "BARBER" | "SERVICE",
        targetId: item.targetId,
        targetLabel: item.targetLabel,
        rating: item.rating,
      });
      itemsByReviewId.set(item.reviewId, list);
    }

    const items: OwnerFeedbackItem[] = reviewRows.map((row) => ({
      id: row.id,
      bookingId: row.bookingId,
      source: (row.source === "DEMO" ? "DEMO" : "CUSTOMER") as
        | "CUSTOMER"
        | "DEMO",
      createdAt: row.createdAt.toISOString(),
      customer: {
        name: row.customerName || "Cliente",
        avatarUrl: row.customerAvatarUrl,
      },
      generalComment: row.comment,
      barbershopRating: row.rating,
      items: itemsByReviewId.get(row.id) ?? [],
    }));

    const hasNext = offset + reviewRows.length < total;

    return {
      items,
      page: safePage,
      limit: safeLimit,
      total,
      hasNext,
    };
  }
}
