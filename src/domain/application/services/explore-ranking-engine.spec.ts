import { describe, it, expect } from 'vitest';
import {
  computeBayesianRating,
  computeExploreScore,
  compareExploreRankedShops,
  PRIOR_REPUTATION_C,
} from './explore-ranking-engine';

describe('Explore Ranking Engine', () => {
  it('deve usar o prior neutro 3.5 quando não há avaliações (n=0)', () => {
    const bayes = computeBayesianRating(null, 0);
    expect(bayes).toBeCloseTo(PRIOR_REPUTATION_C, 4);

    const scoreOutput = computeExploreScore({
      id: 'shop-1',
      distanceKm: 2.0,
      rating: null,
      reviewCount: 0,
    });
    expect(scoreOutput.bayesRating).toBeCloseTo(3.5, 4);
    expect(scoreOutput.reputationComponent).toBeCloseTo((3.5 - 1) / 4, 4);
    expect(scoreOutput.distanceComponent).toBeGreaterThan(0);
  });

  it('deve priorizar proximidade de 1 km contra 10 km mesmo com reputação perfeita na loja distante', () => {
    // Loja A: 1 km de distância, reputação moderada 4.0 com 10 reviews
    const shopA = {
      id: 'shop-near',
      distanceKm: 1.0,
      rating: 4.0,
      reviewCount: 10,
    };
    const scoreA = computeExploreScore(shopA);

    // Loja B: 10 km de distância, reputação perfeita 5.0 com 1000 reviews
    const shopB = {
      id: 'shop-far',
      distanceKm: 10.0,
      rating: 5.0,
      reviewCount: 1000,
    };
    const scoreB = computeExploreScore(shopB);

    // Proximidade deve dominar (1 km vence 10 km)
    expect(scoreA.score).toBeGreaterThan(scoreB.score);

    const sorted = [
      { ...shopB, rankingScore: scoreB },
      { ...shopA, rankingScore: scoreA },
    ].sort(compareExploreRankedShops);

    expect(sorted[0].id).toBe('shop-near');
    expect(sorted[1].id).toBe('shop-far');
  });

  it('à mesma distância, reputação consolidada (4.8 com 50 reviews) deve vencer nota 5 única (n=1)', () => {
    const shopEstablished = {
      id: 'shop-est',
      distanceKm: 2.0,
      rating: 4.8,
      reviewCount: 50,
    };
    const scoreEst = computeExploreScore(shopEstablished);

    const shopSingleReview = {
      id: 'shop-single',
      distanceKm: 2.0,
      rating: 5.0,
      reviewCount: 1,
    };
    const scoreSingle = computeExploreScore(shopSingleReview);

    expect(scoreEst.score).toBeGreaterThan(scoreSingle.score);

    const sorted = [
      { ...shopSingleReview, rankingScore: scoreSingle },
      { ...shopEstablished, rankingScore: scoreEst },
    ].sort(compareExploreRankedShops);

    expect(sorted[0].id).toBe('shop-est');
  });

  it('no modo sem GPS (distanceKm = null), deve ranquear por reputação bayesiana', () => {
    const shopNoGpsA = {
      id: 'shop-no-gps-a',
      distanceKm: null,
      rating: 4.9,
      reviewCount: 40,
    };
    const scoreA = computeExploreScore(shopNoGpsA);

    const shopNoGpsB = {
      id: 'shop-no-gps-b',
      distanceKm: null,
      rating: 3.8,
      reviewCount: 5,
    };
    const scoreB = computeExploreScore(shopNoGpsB);

    expect(scoreA.distanceComponent).toBeNull();
    expect(scoreB.distanceComponent).toBeNull();
    expect(scoreA.score).toBeGreaterThan(scoreB.score);

    const sorted = [
      { ...shopNoGpsB, rankingScore: scoreB },
      { ...shopNoGpsA, rankingScore: scoreA },
    ].sort(compareExploreRankedShops);

    expect(sorted[0].id).toBe('shop-no-gps-a');
  });

  it('deve realizar desempate determinístico por distância, reviews e id', () => {
    const item1 = {
      id: 'shop-a',
      distanceKm: 3.0,
      rating: 4.5,
      reviewCount: 10,
    };
    const score1 = computeExploreScore(item1);

    const item2 = {
      id: 'shop-b',
      distanceKm: 3.0,
      rating: 4.5,
      reviewCount: 10,
    };
    const score2 = computeExploreScore(item2);

    expect(score1.score).toBeCloseTo(score2.score, 6);

    const sorted = [
      { ...item2, rankingScore: score2 },
      { ...item1, rankingScore: score1 },
    ].sort(compareExploreRankedShops);

    // ID alfanumérico desempatou
    expect(sorted[0].id).toBe('shop-a');
    expect(sorted[1].id).toBe('shop-b');
  });
});
