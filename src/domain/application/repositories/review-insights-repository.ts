export type StarDistribution = {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
};

export interface ReviewSummaryMetrics {
  metrics: {
    averageRating: number | null;
    reviewCount: number;
    distribution: StarDistribution;
    percentage1to2Stars: number;
    isSmallSample: boolean;
  };
  comparison: {
    previousPeriodStart: string;
    previousPeriodEnd: string;
    previousAverageRating: number | null;
    previousReviewCount: number;
    ratingDiff: number | null;
    reviewCountDiff: number;
  };
  responseRate: {
    cohortCompletedBookings: number;
    reviewedBookings: number;
    ratePercentage: number | null;
    cohortDefinition: string;
  };
  serviceCoverage: {
    totalActiveServices: number;
    evaluatedActiveServices: number;
    coveragePercentage: number | null;
  };
  latestReview: {
    id: string;
    createdAt: string;
    rating: number;
    comment: string | null;
    customerName: string;
    source: "CUSTOMER" | "DEMO";
  } | null;
  flags: {
    hasAnyReviews: boolean;
    hasDemoReviews: boolean;
    hasCustomerReviews: boolean;
    isDemoEnvironment: boolean;
    appliedSource: "CUSTOMER" | "DEMO" | "ALL";
  };
  period: {
    startDate: string;
    endDate: string;
    timezone: string;
  };
}

export interface ServiceReviewMetricItem {
  serviceId: string;
  serviceName: string;
  isActive: boolean;
  averageRating: number | null;
  reviewCount: number;
  distribution: StarDistribution;
  percentage1to2Stars: number;
  isSmallSample: boolean;
  lastReviewAt: string | null;
  completedBookingsCount: number;
  unreviewedBookingsCount: number;
  absenceReason: "NO_COMPLETED_BOOKINGS" | "NO_CUSTOMER_FEEDBACK" | null;
}

export interface ServiceMetricsResponse {
  items: ServiceReviewMetricItem[];
  totalServices: number;
  evaluatedServices: number;
  coveragePercentage: number | null;
}

export interface ProfessionalReviewMetricItem {
  professionalId: string;
  name: string;
  avatarUrl: string | null;
  averageRating: number | null;
  reviewCount: number;
  distribution: StarDistribution;
  percentage1to2Stars: number;
  isSmallSample: boolean;
  lastReviewAt: string | null;
}

export interface ProfessionalMetricsResponse {
  items: ProfessionalReviewMetricItem[];
  totalProfessionals: number;
}

export interface OwnerFeedbackReviewItem {
  targetType: "BARBERSHOP" | "BARBER" | "SERVICE";
  targetId: string | null;
  targetLabel: string;
  rating: number;
}

export interface OwnerFeedbackItem {
  id: string;
  bookingId: string;
  source: "CUSTOMER" | "DEMO";
  createdAt: string;
  customer: {
    name: string;
    avatarUrl: string | null;
  };
  generalComment: string | null;
  barbershopRating: number;
  items: OwnerFeedbackReviewItem[];
}

export interface FeedbacksResponse {
  items: OwnerFeedbackItem[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}

export interface ReviewInsightsRepository {
  getSummaryMetrics(params: {
    barbershopId: string;
    startDate: Date;
    endDate: Date;
    source: "CUSTOMER" | "DEMO" | "ALL";
    timezone: string;
  }): Promise<ReviewSummaryMetrics>;

  getServiceMetrics(params: {
    barbershopId: string;
    startDate?: Date;
    endDate?: Date;
    source: "CUSTOMER" | "DEMO" | "ALL";
    includeInactive?: boolean;
  }): Promise<ServiceMetricsResponse>;

  getProfessionalMetrics(params: {
    barbershopId: string;
    startDate?: Date;
    endDate?: Date;
    source: "CUSTOMER" | "DEMO" | "ALL";
  }): Promise<ProfessionalMetricsResponse>;

  getFeedbacks(params: {
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
  }): Promise<FeedbacksResponse>;
}
