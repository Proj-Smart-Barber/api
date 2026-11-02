import {
  InMemoryExploreSnapshotRepository,
  type ExploreSnapshotRepository,
  type ExploreSnapshot,
} from "../../../repositories/explore-snapshot-repository";
import { randomUUID } from "node:crypto";
import { type Either, left, right } from "../../../../../core/logic/either";
import type { DiscoveryRepository } from "../../../repositories/discovery-repository";
import {
  computeExploreScore,
  compareExploreRankedShops,
  EXPLORE_RANKING_VERSION,
  type ShopRankingScore,
} from "../../../services/explore-ranking-engine";
import {
  computeFiltersHash,
  createExploreCursor,
  verifyAndParseExploreCursor,
  InvalidExploreCursorError,
  ExpiredExploreCursorError,
  EXPLORE_CURSOR_TTL_MS,
} from "../../../services/explore-cursor-token";
import {
  type ExploreFeedInput,
  type ExploreFeedPage,
  type ExploreFeedItem,
  type ExploreFeedMediaItem,
} from "../../../services/explore-feed.contract";
import { LocationServiceUnavailableError } from "../../_errors/location-service-unavailable-error";

export type GetExploreFeedResponse = Either<
  | LocationServiceUnavailableError
  | InvalidExploreCursorError
  | ExpiredExploreCursorError,
  ExploreFeedPage
>;

export class GetExploreFeedUseCase {
  constructor(
    private discoveryRepository: DiscoveryRepository,
    private snapshots: ExploreSnapshotRepository = new InMemoryExploreSnapshotRepository(),
  ) {}

  async execute(input: ExploreFeedInput): Promise<GetExploreFeedResponse> {
    const isHealthy = this.discoveryRepository.isLocationServiceHealthy
      ? await this.discoveryRepository.isLocationServiceHealthy()
      : false;

    if (input.mode === "NEARBY" && !isHealthy) {
      return left(new LocationServiceUnavailableError());
    }

    const latBucket = input.point ? input.point.latitude : undefined;
    const lngBucket = input.point ? input.point.longitude : undefined;

    const currentFiltersHash = computeFiltersHash({
      mode: input.mode,
      q: input.q,
      radiusKm: input.radiusKm,
      regionKey: input.regionKey,
      latBucket,
      lngBucket,
    });

    let snapshot: ExploreSnapshot | null = null;
    let offset = 0;
    let sessionId: string = randomUUID();

    if (input.cursor) {
      try {
        const cursorPayload = verifyAndParseExploreCursor(
          input.cursor,
          currentFiltersHash,
        );
        offset = cursorPayload.offset;
        sessionId = cursorPayload.sessionId;
        snapshot = await this.snapshots.find(sessionId);
        if (!snapshot || snapshot.expiresAt <= Date.now())
          return left(new ExpiredExploreCursorError());
        if (snapshot.filtersHash !== currentFiltersHash)
          return left(new InvalidExploreCursorError());
      } catch (err) {
        if (
          err instanceof InvalidExploreCursorError ||
          err instanceof ExpiredExploreCursorError
        ) {
          return left(err);
        }
        return left(new InvalidExploreCursorError());
      }
    }

    // 1. Busca os candidatos elegíveis do repositório
    // Se NEARBY: busca com ponto geográfico e raio
    // Se ALL: busca por catálogo geral
    const rawShops: import("../../../services/discovery-contract").PublicShop[] =
      [];
    if(this.discoveryRepository.rankExploreIds){
      if(!snapshot){snapshot={id:sessionId,filtersHash:currentFiltersHash,ids:await this.discoveryRepository.rankExploreIds(input),expiresAt:Date.now()+EXPLORE_CURSOR_TTL_MS};await this.snapshots.save(snapshot);}
      const ids=snapshot.ids.slice(offset);
      if(ids.length){const result=await this.discoveryRepository.search(input.mode==='NEARBY'&&input.point
        ?{mode:'NEARBY',point:input.point,radiusKm:input.radiusKm??10,q:input.q,ids,page:1,limit:50}
        :{mode:'ALL',q:input.q,regionKey:input.regionKey,ids,page:1,limit:50});rawShops.push(...result.items);}
    }else{
    let page = 1;
    while (true) {
      const result = await this.discoveryRepository.search(
        input.mode === "NEARBY" && input.point
          ? {
              mode: "NEARBY",
              point: input.point,
              radiusKm: input.radiusKm ?? 10,
              q: input.q,
              page,
              limit: 50,
            }
          : {
              mode: "ALL",
              q: input.q,
              regionKey: input.regionKey,
              page,
              limit: 50,
            },
      );
      rawShops.push(...result.items);
      if (!result.hasNext || result.items.length === 0) break;
      page++;
    }

    }

    // 2. Aplica pontuação de ranking determinística a todos os candidatos elegíveis
    const rankedShops = rawShops.map((shop) => {
      const distanceKm =
        shop.distanceMeters !== null && Number.isFinite(shop.distanceMeters)
          ? shop.distanceMeters / 1000.0
          : null;

      const rankingScore = computeExploreScore({
        id: shop.id,
        distanceKm,
        rating: shop.rating ?? null,
        reviewCount: shop.reviewCount ?? 0,
      });

      return {
        shop,
        distanceKm,
        rankingScore,
      };
    });

    // 3. Ordenação rigorosa antes da paginação
    rankedShops.sort((a, b) =>
      compareExploreRankedShops(
        {
          id: a.shop.id,
          distanceKm: a.distanceKm,
          rating: a.shop.rating ?? null,
          reviewCount: a.shop.reviewCount ?? 0,
          rankingScore: a.rankingScore,
        },
        {
          id: b.shop.id,
          distanceKm: b.distanceKm,
          rating: b.shop.rating ?? null,
          reviewCount: b.shop.reviewCount ?? 0,
          rankingScore: b.rankingScore,
        },
      ),
    );

    // 4. Paginação por fatia do offset
    const limit = Math.max(1, Math.min(20, input.limit ?? 10));
    if (!snapshot) {
      snapshot = {
        id: sessionId,
        filtersHash: currentFiltersHash,
        ids: rankedShops.map((row) => row.shop.id),
        expiresAt: Date.now() + EXPLORE_CURSOR_TTL_MS,
      };
      await this.snapshots.save(snapshot);
    }
    const eligibleById = new Map(rankedShops.map((row) => [row.shop.id, row]));
    const pagedSlice: typeof rankedShops = [];
    let nextOffset = offset;
    while (nextOffset < snapshot.ids.length && pagedSlice.length < limit) {
      const entry = eligibleById.get(snapshot.ids[nextOffset++]);
      if (entry) pagedSlice.push(entry);
    }
    const hasNext = this.discoveryRepository.rankExploreIds ? rawShops.length>pagedSlice.length : nextOffset < snapshot.ids.length;
    const nextCursor = hasNext
      ? createExploreCursor({
          offset: nextOffset,
          sessionId,
          filtersHash: currentFiltersHash,
          expiresAt: snapshot.expiresAt,
        })
      : null;

    // 5. Monta DTO enriquecido com mídias e serviços reais por barbearia
    const items: ExploreFeedItem[] = pagedSlice.map(
      ({ shop, distanceKm, rankingScore }) => {

        const mediaItems: ExploreFeedMediaItem[] = [];

        if (shop.featuredServices && shop.featuredServices.length > 0) {
          // Prioridade 1: Serviços em destaque configurados pelo owner no banco de dados
          shop.featuredServices.forEach((srv, idx) => {
            mediaItems.push({
              id: `${shop.id}-srv-${srv.id}`,
              kind: "service",
              mediaId: srv.mediaId ?? srv.id,
              serviceId: srv.id,
              url: srv.imageUrl,
              mimeType: srv.mimeType,
              posterUrl: srv.posterUrl,
              durationSeconds: srv.durationSeconds,
              width: srv.width ?? 1080,
              height: srv.height ?? 1920,
              alt: `${srv.title} na barbearia ${shop.name}`,
              focalPoint: "50% 50%",
              category: "corte",
              rightsPending: false,
              service: {
                id: srv.id,
                title: srv.title,
                priceInCents: srv.priceInCents,
                durationInMinutes: srv.durationInMinutes,
              },
            });
          });
        }
        // Environment remains a distinct context, including when it is video.
        for (const media of (shop.environmentMedia ?? []).slice(
          0,
          Math.max(0, 6 - mediaItems.length),
        )) {
          mediaItems.push({
            id: media.id,
            kind: "environment",
            mediaId: media.id,
            serviceId: null,
            url: media.url,
            width: media.width,
            height: media.height,
            mimeType: media.mimeType,
            posterUrl: media.posterUrl,
            durationSeconds: media.durationSeconds,
            alt: `Ambiente de ${shop.name}`,
            service: null,
          });
        }
        const distanceBasis =
          input.mode === "NEARBY" && shop.distanceMeters !== null
            ? "user"
            : input.regionKey
              ? "region"
              : "unavailable";

        return {
          barbershop: {
            id: shop.id,
            slug: shop.slug,
            name: shop.name,
            location: shop.location,
            logoUrl: shop.avatarUrl ?? null,
            rating: shop.rating ?? null,
            reviewCount: shop.reviewCount ?? 0,
            googleMapsUrl: shop.googleMapsUrl,
          },
          distanceMeters: shop.distanceMeters,
          distanceBasis,
          rankingScore,
          media: mediaItems,
        };
      },
    );

    return right({
      items,
      nextCursor,
      hasNext,
      total: snapshot.ids.length,
      rankingVersion: EXPLORE_RANKING_VERSION,
      snapshotExpiresAt: new Date(snapshot.expiresAt).toISOString(),
    });
  }
}
