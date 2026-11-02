/**
 * Motor de Ranking Matemático do Feed Explorar
 *
 * Fórmula:
 * d = distância em km
 * D = exp(-d / 3) [decaimento suave de proximidade]
 * B = (n * R + 10 * C) / (n + 10) [reputação bayesiana com prior interno C = 3.5]
 * Q = clamp((B - 1) / 4, 0, 1) [normalização da qualidade em [0, 1]]
 * score = 0.70 * D + 0.30 * Q [ponderação com dominância de proximidade]
 *
 * Sem GPS: score = Q (ordenação por reputação bayesiana ponderada)
 */

export const EXPLORE_RANKING_VERSION = "v1-2026-11-01";
export const PRIOR_REPUTATION_C = 3.5;
export const PRIOR_WEIGHT_M = 10;
export const DISTANCE_SCALE_KM = 3.0;
export const WEIGHT_DISTANCE = 0.70;
export const WEIGHT_REPUTATION = 0.30;

export interface ShopRankingInput {
  id: string;
  distanceKm: number | null;
  rating: number | null;
  reviewCount: number;
}

export interface ShopRankingScore {
  score: number;
  distanceComponent: number | null;
  reputationComponent: number;
  bayesRating: number;
}

export function computeBayesianRating(rating: number | null, count: number): number {
  const n = Math.max(0, count);
  const R = rating !== null && Number.isFinite(rating) ? Math.min(5, Math.max(1, rating)) : PRIOR_REPUTATION_C;
  return (n * R + PRIOR_WEIGHT_M * PRIOR_REPUTATION_C) / (n + PRIOR_WEIGHT_M);
}

export function computeExploreScore(input: ShopRankingInput): ShopRankingScore {
  const bayesRating = computeBayesianRating(input.rating, input.reviewCount);
  const Q = Math.max(0, Math.min(1, (bayesRating - 1.0) / 4.0));

  if (input.distanceKm !== null && Number.isFinite(input.distanceKm) && input.distanceKm >= 0) {
    const D = Math.exp(-input.distanceKm / DISTANCE_SCALE_KM);
    const score = WEIGHT_DISTANCE * D + WEIGHT_REPUTATION * Q;
    return {
      score,
      distanceComponent: D,
      reputationComponent: Q,
      bayesRating,
    };
  }

  return {
    score: Q,
    distanceComponent: null,
    reputationComponent: Q,
    bayesRating,
  };
}

export function compareExploreRankedShops(
  a: ShopRankingInput & { rankingScore: ShopRankingScore },
  b: ShopRankingInput & { rankingScore: ShopRankingScore }
): number {
  // 1. Maior score vence
  const scoreDiff = b.rankingScore.score - a.rankingScore.score;
  if (Math.abs(scoreDiff) > 1e-7) {
    return scoreDiff > 0 ? 1 : -1;
  }

  // 2. Se ambos têm distância, menor distância vence
  if (a.distanceKm !== null && b.distanceKm !== null) {
    const distDiff = a.distanceKm - b.distanceKm;
    if (Math.abs(distDiff) > 1e-4) {
      return distDiff > 0 ? 1 : -1;
    }
  }

  // 3. Maior quantidade de avaliações publicadas vence
  if (b.reviewCount !== a.reviewCount) {
    return b.reviewCount - a.reviewCount;
  }

  // 4. Desempate determinístico por ID
  return a.id.localeCompare(b.id);
}
