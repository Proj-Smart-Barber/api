import type { Controller } from "../../../core/infra/controller";
import { ManageBarbershopGalleryUseCase } from "../../../domain/application/use-cases/media/manage-barbershop-gallery/manage-barbershop-gallery";
import { DrizzleBarbershopGalleryRepository } from "../../drizzle/repositories/drizzle-barbershop-gallery-repository";
import { DrizzleBarbershopsRepository } from "../../drizzle/repositories/drizzle-barbershops-repository";
import { DrizzleMembershipsRepository } from "../../drizzle/repositories/drizzle-memberships-repository";
import { DrizzleMediaRepository } from "../../drizzle/repositories/drizzle-media-repository";
import {
  ListBarbershopGalleryController,
  AddBarbershopGalleryPhotoController,
  RemoveBarbershopGalleryPhotoController,
  ReorderBarbershopGalleryController,
  SetBarbershopGalleryCoverController,
} from "../controllers/barbershop/manage-barbershop-gallery-controller";

function getManageGalleryUseCase(): {
  useCase: ManageBarbershopGalleryUseCase;
  galleryRepository: DrizzleBarbershopGalleryRepository;
} {
  const galleryRepository = new DrizzleBarbershopGalleryRepository();
  const barbershopsRepository = new DrizzleBarbershopsRepository();
  const membershipsRepository = new DrizzleMembershipsRepository();
  const mediaRepository = new DrizzleMediaRepository();

  const useCase = new ManageBarbershopGalleryUseCase(
    galleryRepository,
    barbershopsRepository,
    membershipsRepository,
    mediaRepository,
  );

  return { useCase, galleryRepository };
}

export function makeListBarbershopGalleryController(): Controller {
  const { galleryRepository } = getManageGalleryUseCase();
  const mediaRepository = new DrizzleMediaRepository();
  return new ListBarbershopGalleryController(galleryRepository, mediaRepository);
}

export function makeAddBarbershopGalleryPhotoController(): Controller {
  const { useCase } = getManageGalleryUseCase();
  return new AddBarbershopGalleryPhotoController(useCase);
}

export function makeRemoveBarbershopGalleryPhotoController(): Controller {
  const { useCase } = getManageGalleryUseCase();
  return new RemoveBarbershopGalleryPhotoController(useCase);
}

export function makeReorderBarbershopGalleryController(): Controller {
  const { useCase } = getManageGalleryUseCase();
  return new ReorderBarbershopGalleryController(useCase);
}

export function makeSetBarbershopGalleryCoverController(): Controller {
  const { useCase } = getManageGalleryUseCase();
  return new SetBarbershopGalleryCoverController(useCase);
}
