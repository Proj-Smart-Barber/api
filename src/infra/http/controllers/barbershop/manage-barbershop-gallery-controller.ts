import { z, ZodError } from "zod";
import type { Controller } from "../../../../core/infra/controller";
import {
  clientError,
  created,
  fail,
  ok,
  type HttpResponse,
} from "../../../../core/infra/http-response";
import type { ManageBarbershopGalleryUseCase } from "../../../../domain/application/use-cases/media/manage-barbershop-gallery/manage-barbershop-gallery";
import type { BarbershopGalleryRepository } from "../../../../domain/application/repositories/barbershop-gallery-repository";
import type { BarbershopGalleryItem } from "../../../../domain/enterprise/entities/barbershop-gallery-item";

import type { MediaRepository } from "../../../../domain/application/repositories/media-repository";

// List Gallery
const listGallerySchema = z.object({
  shopId: z.string().uuid(),
});

type ListGalleryRequest = z.infer<typeof listGallerySchema>;

export class ListBarbershopGalleryController implements Controller {
  constructor(
    private galleryRepository: BarbershopGalleryRepository,
    private mediaRepository?: MediaRepository
  ) {}

  async handle(request: ListGalleryRequest): Promise<HttpResponse> {
    try {
      const parsed = listGallerySchema.parse(request);
      const items = await this.galleryRepository.findByBarbershopId(parsed.shopId);

      const mappedItems = await Promise.all(
        items.map(async (item: BarbershopGalleryItem) => {
          let publicUrl = item.publicUrl;
          if (!publicUrl && this.mediaRepository) {
            const media = await this.mediaRepository.findById(item.mediaId.toString());
            publicUrl = media?.publicUrl;
          }
          return {
            id: item.id.toString(),
            barbershopId: item.barbershopId.toString(),
            mediaId: item.mediaId.toString(),
            displayOrder: item.displayOrder,
            isCover: item.isCover,
            publicUrl: publicUrl ?? "",
            createdAt: item.createdAt,
          };
        })
      );

      return ok({
        items: mappedItems,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

// Add Photo
const addGalleryPhotoSchema = z.object({
  shopId: z.string().uuid(),
  userId: z.string().uuid(),
  mediaId: z.string().uuid(),
  caption: z.string().optional(),
  isCover: z.boolean().optional(),
});

type AddGalleryPhotoRequest = z.infer<typeof addGalleryPhotoSchema>;

export class AddBarbershopGalleryPhotoController implements Controller {
  constructor(private manageGalleryUseCase: ManageBarbershopGalleryUseCase) {}

  async handle(request: AddGalleryPhotoRequest): Promise<HttpResponse> {
    try {
      const parsed = addGalleryPhotoSchema.parse(request);
      const result = await this.manageGalleryUseCase.addPhoto({
        userId: parsed.userId,
        barbershopId: parsed.shopId,
        mediaId: parsed.mediaId,
        caption: parsed.caption,
        isCover: parsed.isCover,
      });

      if (result.isLeft()) {
        return clientError({ message: result.value.message });
      }

      const item = result.value.item;
      return created({
        item: {
          id: item.id.toString(),
          barbershopId: item.barbershopId.toString(),
          mediaId: item.mediaId.toString(),
          displayOrder: item.displayOrder,
          isCover: item.isCover,
        },
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

// Remove Photo
const removeGalleryPhotoSchema = z.object({
  shopId: z.string().uuid(),
  userId: z.string().uuid(),
  galleryItemId: z.string().uuid().optional(),
  mediaId: z.string().uuid().optional(),
});

type RemoveGalleryPhotoRequest = z.infer<typeof removeGalleryPhotoSchema>;

export class RemoveBarbershopGalleryPhotoController implements Controller {
  constructor(private manageGalleryUseCase: ManageBarbershopGalleryUseCase) {}

  async handle(request: RemoveGalleryPhotoRequest): Promise<HttpResponse> {
    try {
      const parsed = removeGalleryPhotoSchema.parse(request);
      const result = await this.manageGalleryUseCase.removePhoto({
        userId: parsed.userId,
        barbershopId: parsed.shopId,
        mediaId: parsed.mediaId,
        galleryItemId: parsed.galleryItemId,
      });

      if (result.isLeft()) {
        return clientError({ message: result.value.message });
      }

      return ok(result.value);
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

// Reorder
const reorderGallerySchema = z.object({
  shopId: z.string().uuid(),
  userId: z.string().uuid(),
  itemIds: z.array(z.string().uuid()),
});

type ReorderGalleryRequest = z.infer<typeof reorderGallerySchema>;

export class ReorderBarbershopGalleryController implements Controller {
  constructor(private manageGalleryUseCase: ManageBarbershopGalleryUseCase) {}

  async handle(request: ReorderGalleryRequest): Promise<HttpResponse> {
    try {
      const parsed = reorderGallerySchema.parse(request);
      const result = await this.manageGalleryUseCase.reorder({
        userId: parsed.userId,
        barbershopId: parsed.shopId,
        itemIds: parsed.itemIds,
      });

      if (result.isLeft()) {
        return clientError({ message: result.value.message });
      }

      return ok(result.value);
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

// Set Cover
const setCoverSchema = z.object({
  shopId: z.string().uuid(),
  userId: z.string().uuid(),
  galleryItemId: z.string().uuid().optional(),
  mediaId: z.string().uuid().optional(),
});

type SetCoverRequest = z.infer<typeof setCoverSchema>;

export class SetBarbershopGalleryCoverController implements Controller {
  constructor(private manageGalleryUseCase: ManageBarbershopGalleryUseCase) {}

  async handle(request: SetCoverRequest): Promise<HttpResponse> {
    try {
      const parsed = setCoverSchema.parse(request);
      const result = await this.manageGalleryUseCase.setCover({
        userId: parsed.userId,
        barbershopId: parsed.shopId,
        mediaId: parsed.mediaId,
        galleryItemId: parsed.galleryItemId,
      });

      if (result.isLeft()) {
        return clientError({ message: result.value.message });
      }

      return ok(result.value);
    } catch (err) {
      if (err instanceof ZodError) {
        return clientError({ message: z.prettifyError(err) });
      }
      return fail(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
