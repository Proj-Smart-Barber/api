import {
  eq,
  and,
  desc,
  count,
  sql,
  inArray,
  gte,
  lt,
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
} from "../schema";
import type {
  ReviewInsightsRepository,
  ReviewSummaryMetrics,
  ReviewTimeSeriesPoint,
  ReviewTimeSeriesGranularity,
  ReviewDataSource,
  ReviewSourceFilter,
  ServiceMetricsResponse,
  ServiceReviewMetricItem,
  ProfessionalMetricsResponse,
  ProfessionalReviewMetricItem,
  FeedbacksResponse,
  OwnerFeedbackItem,
  OwnerFeedbackReviewItem,
  StarDistribution,
} from "../../../domain/application/repositories/review-insights-repository";
import {
  civilDateToUtcStart,
  getCivilDateStringInTimezone,
  addDaysToCivilDate,
} from "../../../domain/application/use-cases/reviews/owner-insights/period-utils";

function normalizeDataSource(raw: string | null | undefined): ReviewDataSource {
  if (raw === "CUSTOMER") return "CUSTOMER";
  if (raw === "DEMO") return "DEMO";
  return "UNKNOWN";
}

function buildReviewSourceCondition(source: ReviewSourceFilter) {
  if (source === "CUSTOMER") return eq(reviews.source, "CUSTOMER");
  if (source === "DEMO") return eq(reviews.source, "DEMO");
  if (source === "UNKNOWN") return sql`${reviews.source} NOT IN ('CUSTOMER', 'DEMO')`;
  return undefined;
}

function buildBookingSourceCondition(source: ReviewSourceFilter) {
  if (source === "CUSTOMER") return eq(bookings.source, "CUSTOMER");
  if (source === "DEMO") return eq(bookings.source, "DEMO");
  if (source === "UNKNOWN") return sql`${bookings.source} NOT IN ('CUSTOMER', 'DEMO')`;
  return undefined;
}

function buildReviewSourceSqlClause(source: ReviewSourceFilter, alias = "reviews") {
  const col = sql.raw(`"${alias}"."source"`);
  if (source === "CUSTOMER") return sql`${col} = 'CUSTOMER'`;
  if (source === "DEMO") return sql`${col} = 'DEMO'`;
  if (source === "UNKNOWN") return sql`${col} NOT IN ('CUSTOMER', 'DEMO')`;
  return sql`TRUE`;
}

function buildBookingCompletionExpr() {
  return sql<Date>`COALESCE(
    (SELECT MAX(be.created_at) FROM booking_events be WHERE be.booking_id = ${bookings.id} AND be.new_status = 'COMPLETED'),
    ${bookings.endsAt},
    ${bookings.startsAt},
    ${bookings.date} AT TIME ZONE COALESCE(${bookings.timezone}, 'America/Sao_Paulo'),
    ${bookings.updatedAt} AT TIME ZONE COALESCE(${bookings.timezone}, 'America/Sao_Paulo')
  )`;
}

function formatBucketLabel(
  bucketStart: Date,
  bucketEnd: Date,
  granularity: ReviewTimeSeriesGranularity,
  timezone: string,
): string {
  const fmtDay = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
  });
  const fmtMonth = new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    month: "short",
    year: "numeric",
  });
  if (granularity === "MONTH") {
    return fmtMonth.format(bucketStart);
  }
  const inclusiveEnd = new Date(bucketEnd.getTime() - 1);
  return `${fmtDay.format(bucketStart)} - ${fmtDay.format(inclusiveEnd)}`;
}

function generateTimeSeriesBuckets(
  startDate: Date,
  endDate: Date,
  granularity: ReviewTimeSeriesGranularity,
  timezone: string,
): Array<{ bucketStart: Date; bucketEnd: Date; key: string; label: string }> {
  const buckets: Array<{
    bucketStart: Date;
    bucketEnd: Date;
    key: string;
    label: string;
  }> = [];

  const startCivil = getCivilDateStringInTimezone(startDate, timezone);
  const endInclusiveCivil = getCivilDateStringInTimezone(
    new Date(endDate.getTime() - 1),
    timezone,
  );

  if (granularity === "MONTH") {
    let [y, m] = startCivil.split("-").map(Number);
    const [endY, endM] = endInclusiveCivil.split("-").map(Number);

    while (y < endY || (y === endY && m <= endM)) {
      const monthStr = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
      const nextY = m === 12 ? y + 1 : y;
      const nextM = m === 12 ? 1 : m + 1;
      const nextMonthStr = `${String(nextY).padStart(4, "0")}-${String(nextM).padStart(2, "0")}-01`;

      const bStart = civilDateToUtcStart(monthStr, timezone);
      const bEnd = civilDateToUtcStart(nextMonthStr, timezone);
      buckets.push({
        bucketStart: bStart,
        bucketEnd: bEnd,
        key: monthStr,
        label: formatBucketLabel(bStart, bEnd, "MONTH", timezone),
      });

      y = nextY;
      m = nextM;
      if (buckets.length > 24) break;
    }
    return buckets;
  }

  // WEEK granularity: align to Monday of startCivil
  const [sy, sm, sd] = startCivil.split("-").map(Number);
  const utcDay = new Date(Date.UTC(sy, sm - 1, sd)).getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  let curMonday = addDaysToCivilDate(startCivil, diffToMonday);

  while (curMonday <= endInclusiveCivil) {
    const nextMonday = addDaysToCivilDate(curMonday, 7);
    const bStart = civilDateToUtcStart(curMonday, timezone);
    const bEnd = civilDateToUtcStart(nextMonday, timezone);
    buckets.push({
      bucketStart: bStart,
      bucketEnd: bEnd,
      key: curMonday,
      label: formatBucketLabel(bStart, bEnd, "WEEK", timezone),
    });
    curMonday = nextMonday;
    if (buckets.length > 60) break;
  }

  return buckets;
}

export class DrizzleReviewInsightsRepository implements ReviewInsightsRepository {
  constructor(private db = defaultDb) {}

  async getSummaryMetrics(params: {
    barbershopId: string;
    startDate: Date;
    endDate: Date;
    source: ReviewSourceFilter;
    timezone: string;
    granularity?: ReviewTimeSeriesGranularity;
  }): Promise<ReviewSummaryMetrics> {
    const {
      barbershopId,
      startDate,
      endDate,
      source,
      timezone,
      granularity = "WEEK",
    } = params;

    const reviewSourceCond = buildReviewSourceCondition(source);
    const bookingSourceCond = buildBookingSourceCondition(source);
    const bookingCompletedAt = buildBookingCompletionExpr();

    // 1. Agregação do período atual para BARBERSHOP [startDate, endDate)
    const currentConditions = [
      eq(reviews.barbershopId, barbershopId),
      eq(reviews.status, "PUBLISHED"),
      eq(reviewItems.targetType, "BARBERSHOP"),
      gte(reviews.createdAt, startDate),
      lt(reviews.createdAt, endDate),
    ];
    if (reviewSourceCond) currentConditions.push(reviewSourceCond);

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

    // 2. Período anterior de mesma duração [prevStartDate, startDate) sem sobreposição
    const durationMs = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime());
    const prevStartDate = new Date(startDate.getTime() - durationMs);

    const prevConditions = [
      eq(reviews.barbershopId, barbershopId),
      eq(reviews.status, "PUBLISHED"),
      eq(reviewItems.targetType, "BARBERSHOP"),
      gte(reviews.createdAt, prevStartDate),
      lt(reviews.createdAt, prevEndDate),
    ];
    if (reviewSourceCond) prevConditions.push(reviewSourceCond);

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

    // 3. Série temporal semanal/mensal no fuso da unidade
    const truncUnit = granularity === "MONTH" ? "month" : "week";
    const bucketSql = sql<string>`to_char(date_trunc(${sql.raw(`'${truncUnit}'`)}, ${reviews.createdAt} AT TIME ZONE ${timezone}), 'YYYY-MM-DD')`;

    const seriesRows = await this.db
      .select({
        bucketKey: bucketSql,
        count: count(),
        avg: sql<string | null>`AVG(${reviewItems.rating})`,
      })
      .from(reviewItems)
      .innerJoin(reviews, eq(reviews.id, reviewItems.reviewId))
      .where(and(...currentConditions))
      .groupBy(sql`1`);

    const seriesByKey = new Map<string, { count: number; avg: number | null }>();
    for (const row of seriesRows) {
      const c = Number(row.count ?? 0);
      seriesByKey.set(row.bucketKey, {
        count: c,
        avg: c > 0 ? Number(parseFloat(row.avg ?? "0").toFixed(2)) : null,
      });
    }

    const buckets = generateTimeSeriesBuckets(
      startDate,
      endDate,
      granularity,
      timezone,
    );
    const timeSeries: ReviewTimeSeriesPoint[] = buckets.map((b) => {
      const hit = seriesByKey.get(b.key);
      return {
        bucketStart: b.bucketStart.toISOString(),
        bucketEnd: b.bucketEnd.toISOString(),
        label: b.label,
        reviewCount: hit?.count ?? 0,
        averageRating: hit?.avg ?? null,
      };
    });

    // 4. Taxa de resposta da coorte de atendimentos concluídos no período e origem
    const cohortConditions = [
      eq(bookings.barbershopId, barbershopId),
      eq(bookings.status, "COMPLETED"),
      sql`${bookingCompletedAt} >= ${startDate}`,
      sql`${bookingCompletedAt} < ${endDate}`,
    ];
    if (bookingSourceCond) cohortConditions.push(bookingSourceCond);

    const reviewMatchClause = buildReviewSourceSqlClause(source, "reviews");

    const [cohort] = await this.db
      .select({
        totalCompleted: sql<number>`COUNT(DISTINCT ${bookings.id})`,
        reviewedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${reviews.id} IS NOT NULL AND ${reviews.status} = 'PUBLISHED' AND (${reviewMatchClause}) THEN ${bookings.id} END)`,
      })
      .from(bookings)
      .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
      .where(and(...cohortConditions));

    const cohortCompletedBookings = Number(cohort?.totalCompleted ?? 0);
    const reviewedBookings = Math.min(
      cohortCompletedBookings,
      Number(cohort?.reviewedCount ?? 0),
    );
    const rawRate =
      cohortCompletedBookings > 0
        ? (reviewedBookings / cohortCompletedBookings) * 100
        : null;
    const ratePercentage =
      rawRate !== null
        ? Math.min(100, Math.max(0, Number(rawRate.toFixed(1))))
        : null;

    // 5. Cobertura de serviços ativos no mesmo período e origem do resumo
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
        eq(reviews.barbershopId, barbershopId),
        eq(reviews.status, "PUBLISHED"),
        gte(reviews.createdAt, startDate),
        lt(reviews.createdAt, endDate),
      ];
      if (reviewSourceCond) serviceCovConditions.push(reviewSourceCond);

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

    // 6. Última avaliação recebida no período e origem selecionada
    const latestConditions = [
      eq(reviews.barbershopId, barbershopId),
      eq(reviews.status, "PUBLISHED"),
      gte(reviews.createdAt, startDate),
      lt(reviews.createdAt, endDate),
    ];
    if (reviewSourceCond) latestConditions.push(reviewSourceCond);

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
      .orderBy(desc(reviews.createdAt), desc(reviews.id))
      .limit(1);

    // 7. Flags de ambiente (presença de avaliações DEMO, CUSTOMER e UNKNOWN na unidade)
    const [flagCounts] = await this.db
      .select({
        demoCount: sql<number>`COUNT(CASE WHEN ${reviews.source} = 'DEMO' THEN 1 END)`,
        customerCount: sql<number>`COUNT(CASE WHEN ${reviews.source} = 'CUSTOMER' THEN 1 END)`,
        unknownCount: sql<number>`COUNT(CASE WHEN ${reviews.source} NOT IN ('CUSTOMER', 'DEMO') THEN 1 END)`,
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
    const hasUnknownReviews = Number(flagCounts?.unknownCount ?? 0) > 0;
    const hasAnyReviews = hasDemoReviews || hasCustomerReviews || hasUnknownReviews;
    const isDemoEnvironment =
      hasDemoReviews && !hasCustomerReviews && !hasUnknownReviews;
    const isMixedEnvironment = hasDemoReviews && hasCustomerReviews;

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
      timeSeries,
      granularity,
      responseRate: {
        cohortCompletedBookings,
        reviewedBookings,
        ratePercentage,
        cohortDefinition:
          "Atendimentos concluídos no período (por conclusão do atendimento) avaliados na mesma origem",
        originScope: source,
      },
      serviceCoverage: {
        totalActiveServices,
        evaluatedActiveServices,
        coveragePercentage,
        scope: "PERIOD",
      },
      latestReview: latest
        ? {
            id: latest.id,
            createdAt: latest.createdAt.toISOString(),
            rating: latest.rating,
            comment: latest.comment,
            customerName: latest.customerName || "Cliente",
            source: normalizeDataSource(latest.source),
          }
        : null,
      flags: {
        hasAnyReviews,
        hasDemoReviews,
        hasCustomerReviews,
        hasUnknownReviews,
        isDemoEnvironment,
        isMixedEnvironment,
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
    source: ReviewSourceFilter;
    includeInactive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ServiceMetricsResponse> {
    const {
      barbershopId,
      startDate,
      endDate,
      source,
      includeInactive,
      page = 1,
      limit = 20,
    } = params;

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

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
        page: safePage,
        limit: safeLimit,
        total: 0,
        hasNext: false,
      };
    }

    const serviceIds = unitServices.map((s) => s.id);
    const reviewSourceCond = buildReviewSourceCondition(source);
    const bookingSourceCond = buildBookingSourceCondition(source);
    const bookingCompletedAt = buildBookingCompletionExpr();

    // Agregações de notas por serviço em lote
    const reviewConditions = [
      eq(reviewItems.targetType, "SERVICE"),
      inArray(reviewItems.targetId, serviceIds),
      eq(reviews.status, "PUBLISHED"),
      eq(reviews.barbershopId, barbershopId),
    ];
    if (startDate) reviewConditions.push(gte(reviews.createdAt, startDate));
    if (endDate) reviewConditions.push(lt(reviews.createdAt, endDate));
    if (reviewSourceCond) reviewConditions.push(reviewSourceCond);

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
        lastReviewAt: row.lastReviewAt
          ? new Date(row.lastReviewAt).toISOString()
          : null,
      });
    }

    // Contagem de bookings concluídos e não avaliados por associação direta (NOT EXISTS + DISTINCT booking_id)
    const bookingConditions = [
      eq(bookings.barbershopId, barbershopId),
      eq(bookings.status, "COMPLETED"),
      inArray(bookingServiceItems.serviceId, serviceIds),
    ];
    if (startDate) {
      bookingConditions.push(sql`${bookingCompletedAt} >= ${startDate}`);
    }
    if (endDate) {
      bookingConditions.push(sql`${bookingCompletedAt} < ${endDate}`);
    }
    if (bookingSourceCond) {
      bookingConditions.push(bookingSourceCond);
    }

    const reviewSourceSubqueryClause = buildReviewSourceSqlClause(source, "r");

    const bookingStats = await this.db
      .select({
        serviceId: bookingServiceItems.serviceId,
        completedCount: sql<number>`COUNT(DISTINCT ${bookings.id})`,
        unreviewedCount: sql<number>`COUNT(DISTINCT CASE WHEN NOT EXISTS (
          SELECT 1 FROM review_items ri
          INNER JOIN reviews r ON r.id = ri.review_id
          WHERE r.booking_id = ${bookings.id}
            AND r.status = 'PUBLISHED'
            AND ri.target_type = 'SERVICE'
            AND ri.target_id = ${bookingServiceItems.serviceId}
            AND (${reviewSourceSubqueryClause})
        ) THEN ${bookings.id} END)`,
      })
      .from(bookingServiceItems)
      .innerJoin(bookings, eq(bookings.id, bookingServiceItems.bookingId))
      .where(and(...bookingConditions))
      .groupBy(bookingServiceItems.serviceId);

    const bookingStatsMap = new Map<
      string,
      { completedCount: number; unreviewedCount: number }
    >();
    for (const b of bookingStats) {
      if (b.serviceId) {
        bookingStatsMap.set(b.serviceId, {
          completedCount: Number(b.completedCount ?? 0),
          unreviewedCount: Number(b.unreviewedCount ?? 0),
        });
      }
    }

    let evaluatedCount = 0;
    const allItems: ServiceReviewMetricItem[] = unitServices.map((service) => {
      const stats = statsMap.get(service.id);
      const bStats = bookingStatsMap.get(service.id) ?? {
        completedCount: 0,
        unreviewedCount: 0,
      };
      const reviewCount = stats?.count ?? 0;

      if (reviewCount > 0) {
        evaluatedCount++;
      }

      let absenceReason: "NO_COMPLETED_BOOKINGS" | "NO_CUSTOMER_FEEDBACK" | null =
        null;
      if (reviewCount === 0) {
        absenceReason =
          bStats.completedCount === 0
            ? "NO_COMPLETED_BOOKINGS"
            : "NO_CUSTOMER_FEEDBACK";
      }

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
        completedBookingsCount: bStats.completedCount,
        unreviewedBookingsCount: bStats.unreviewedCount,
        absenceReason,
      };
    });

    // Ordenação estável com desempate por serviceId
    allItems.sort((a, b) => {
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
      const ratingDiff = (b.averageRating ?? -1) - (a.averageRating ?? -1);
      if (ratingDiff !== 0) return ratingDiff;
      const nameCmp = a.serviceName.localeCompare(b.serviceName);
      if (nameCmp !== 0) return nameCmp;
      return a.serviceId.localeCompare(b.serviceId);
    });

    const totalServices = allItems.length;
    const coveragePercentage =
      totalServices > 0
        ? Number(((evaluatedCount / totalServices) * 100).toFixed(1))
        : null;

    const offset = (safePage - 1) * safeLimit;
    const pagedItems = allItems.slice(offset, offset + safeLimit);
    const hasNext = offset + pagedItems.length < totalServices;

    return {
      items: pagedItems,
      totalServices,
      evaluatedServices: evaluatedCount,
      coveragePercentage,
      page: safePage,
      limit: safeLimit,
      total: totalServices,
      hasNext,
    };
  }

  async getProfessionalMetrics(params: {
    barbershopId: string;
    startDate?: Date;
    endDate?: Date;
    source: ReviewSourceFilter;
    page?: number;
    limit?: number;
  }): Promise<ProfessionalMetricsResponse> {
    const {
      barbershopId,
      startDate,
      endDate,
      source,
      page = 1,
      limit = 20,
    } = params;

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    // Buscar membros da equipe da unidade (incluindo estado para manter histórico se tiver avaliações)
    const teamMembers = await this.db
      .select({
        userId: membership.userId,
        state: membership.state,
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
    const reviewSourceCond = buildReviewSourceCondition(source);

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

    if (professionalIds.length > 0) {
      const reviewConditions = [
        eq(reviewItems.targetType, "BARBER"),
        eq(reviews.status, "PUBLISHED"),
        eq(reviews.barbershopId, barbershopId),
        inArray(reviewItems.targetId, professionalIds),
      ];
      if (startDate) reviewConditions.push(gte(reviews.createdAt, startDate));
      if (endDate) reviewConditions.push(lt(reviews.createdAt, endDate));
      if (reviewSourceCond) reviewConditions.push(reviewSourceCond);

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
          lastReviewAt: row.lastReviewAt
            ? new Date(row.lastReviewAt).toISOString()
            : null,
        });
      }
    }

    const allItems: ProfessionalReviewMetricItem[] = teamMembers
      .filter((m) => m.state === "ACTIVE" || (statsMap.get(m.userId)?.count ?? 0) > 0)
      .map((member) => {
        const stats = statsMap.get(member.userId);
        const reviewCount = stats?.count ?? 0;
        return {
          professionalId: member.userId,
          name: member.name,
          avatarUrl: member.avatarUrl,
          isActive: member.state === "ACTIVE",
          averageRating: stats?.avg ?? null,
          reviewCount,
          distribution: stats?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          percentage1to2Stars: stats?.percentage1to2Stars ?? 0,
          isSmallSample: reviewCount < 5,
          lastReviewAt: stats?.lastReviewAt ?? null,
        };
      });

    // Ordenação estável com desempate por professionalId
    allItems.sort((a, b) => {
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
      const ratingDiff = (b.averageRating ?? -1) - (a.averageRating ?? -1);
      if (ratingDiff !== 0) return ratingDiff;
      const nameCmp = a.name.localeCompare(b.name);
      if (nameCmp !== 0) return nameCmp;
      return a.professionalId.localeCompare(b.professionalId);
    });

    const totalProfessionals = allItems.length;
    const offset = (safePage - 1) * safeLimit;
    const pagedItems = allItems.slice(offset, offset + safeLimit);
    const hasNext = offset + pagedItems.length < totalProfessionals;

    return {
      items: pagedItems,
      totalProfessionals,
      page: safePage,
      limit: safeLimit,
      total: totalProfessionals,
      hasNext,
    };
  }

  async getFeedbacks(params: {
    barbershopId: string;
    startDate?: Date;
    endDate?: Date;
    source: ReviewSourceFilter;
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

    const reviewSourceCond = buildReviewSourceCondition(source);

    const reviewConditions = [
      eq(reviews.barbershopId, barbershopId),
      eq(reviews.status, "PUBLISHED"),
    ];

    if (startDate) reviewConditions.push(gte(reviews.createdAt, startDate));
    if (endDate) reviewConditions.push(lt(reviews.createdAt, endDate));
    if (reviewSourceCond) reviewConditions.push(reviewSourceCond);

    if (hasComment === true) {
      reviewConditions.push(
        sql`${reviews.comment} IS NOT NULL AND length(trim(${reviews.comment})) > 0`,
      );
    } else if (hasComment === false) {
      reviewConditions.push(
        sql`(${reviews.comment} IS NULL OR length(trim(${reviews.comment})) = 0)`,
      );
    }

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

    const [totalRow] = await this.db
      .select({ count: count() })
      .from(reviews)
      .where(and(...reviewConditions));

    const total = Number(totalRow?.count ?? 0);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;

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
      source: normalizeDataSource(row.source),
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
