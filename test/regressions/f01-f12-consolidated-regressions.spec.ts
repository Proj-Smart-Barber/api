import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { PureImageProcessor } from "../../src/infra/storage/pure-image-processor";
import { SharpImageProcessor } from "../../src/infra/storage/sharp-image-processor";
import { ConfirmMediaUploadUseCase } from "../../src/domain/application/use-cases/media/confirm-upload/confirm-upload";
import { InitiateMediaUploadUseCase } from "../../src/domain/application/use-cases/media/initiate-upload/initiate-upload";
import { ManageBarbershopGalleryUseCase } from "../../src/domain/application/use-cases/media/manage-barbershop-gallery/manage-barbershop-gallery";
import { GetBookingReviewUseCase } from "../../src/domain/application/use-cases/reviews/get-booking-review/get-booking-review";
import { GetBookingReviewController } from "../../src/infra/http/controllers/reviews/get-booking-review-controller";
import { ListBarbershopGalleryController } from "../../src/infra/http/controllers/barbershop/manage-barbershop-gallery-controller";
import { CreateReviewUseCase } from "../../src/domain/application/use-cases/reviews/create-review/create-review";
import { UpdateReviewUseCase } from "../../src/domain/application/use-cases/reviews/update-review/update-review";
import { ModerateReviewUseCase } from "../../src/domain/application/use-cases/reviews/moderate-review/moderate-review";
import { DeleteReviewUseCase } from "../../src/domain/application/use-cases/reviews/delete-review/delete-review";
import { UpdateBarbershopGoogleUrlUseCase } from "../../src/domain/application/use-cases/barbershop/update-barbershop-google-url/update-barbershop-google-url";
import { UpdateBarbershopLogoUseCase } from "../../src/domain/application/use-cases/media/update-barbershop-logo/update-barbershop-logo";
import { StorageCleanupService } from "../../src/domain/application/services/storage-cleanup-service";
import { InMemoryMediaRepository } from "../repositories/in-memory-media-repository";
import { InMemoryBarbershopGalleryRepository } from "../repositories/in-memory-barbershop-gallery-repository";
import { InMemoryBarbershopsRepository } from "../repositories/in-memory-barbershops-repository";
import { InMemoryMembershipsRepository } from "../repositories/in-memory-memberships-repository";
import { InMemoryReviewsRepository } from "../repositories/in-memory-reviews-repository";
import { InMemoryUsersRepository } from "../repositories/in-memory-users-repository";
import { FakeStorageService } from "../fakes/fake-storage-service";
import { UnconfiguredStorageService, StorageUnavailableError } from "../../src/infra/storage/storage-service-factory";
import { UniqueEntityId } from "../../src/core/entities/unique-entity-id";
import { Media } from "../../src/domain/enterprise/entities/media";
import { Barbershop } from "../../src/domain/enterprise/entities/barbershop";
import { Membership, Role } from "../../src/domain/enterprise/entities/membership";
import { BarbershopGalleryItem } from "../../src/domain/enterprise/entities/barbershop-gallery-item";
import { Review } from "../../src/domain/enterprise/entities/review";
import { User } from "../../src/domain/enterprise/entities/user";
import { Password } from "../../src/domain/enterprise/entities/value-objects/password";

describe("T11: Regressões Canônicas Consolidadas F01-F12", () => {
  let mediaRepo: InMemoryMediaRepository;
  let galleryRepo: InMemoryBarbershopGalleryRepository;
  let shopRepo: InMemoryBarbershopsRepository;
  let memberRepo: InMemoryMembershipsRepository;
  let reviewRepo: InMemoryReviewsRepository;
  let userRepo: InMemoryUsersRepository;
  let storage: FakeStorageService;
  let processor: PureImageProcessor;

  beforeEach(() => {
    mediaRepo = new InMemoryMediaRepository();
    galleryRepo = new InMemoryBarbershopGalleryRepository();
    shopRepo = new InMemoryBarbershopsRepository();
    memberRepo = new InMemoryMembershipsRepository();
    reviewRepo = new InMemoryReviewsRepository();
    userRepo = new InMemoryUsersRepository();
    storage = new FakeStorageService();
    processor = new PureImageProcessor();
  });

  describe("F02: Validação rigorosa de codecs e sanitização de metadados", () => {
    it("rejeita PNG truncado de 24 bytes", async () => {
      const header = Buffer.alloc(24);
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header);
      header.writeUInt32BE(1, 16);
      header.writeUInt32BE(1, 20);

      const inspection = await processor.validateAndInspect(header);
      expect(inspection.valid).toBe(false);
      expect(inspection.error).toBeDefined();
    });

    it("remove metadados EXIF ao processar imagem", async () => {
      const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const ihdr = Buffer.alloc(25);
      ihdr.writeUInt32BE(13, 0);
      ihdr.write("IHDR", 4);
      ihdr.writeUInt32BE(100, 8);
      ihdr.writeUInt32BE(100, 12);
      ihdr.writeUInt8(8, 16);
      ihdr.writeUInt8(6, 17);

      const exifData = Buffer.from("Exif\0\0SYNTHETIC_GPS_METADATA");
      const exif = Buffer.alloc(12 + exifData.length);
      exif.writeUInt32BE(exifData.length, 0);
      exif.write("eXIf", 4);
      exifData.copy(exif, 8);

      const idat = Buffer.alloc(12);
      idat.writeUInt32BE(0, 0);
      idat.write("IDAT", 4);

      const iend = Buffer.alloc(12);
      iend.writeUInt32BE(0, 0);
      iend.write("IEND", 4);

      const imageWithExif = Buffer.concat([header, ihdr, exif, idat, iend]);
      const stripped = await processor.stripExif(imageWithExif, "png");
      expect(stripped.includes(exifData)).toBe(false);
    });
  });

  describe("F03: Isolamento de staging e variantes imutáveis públicas", () => {
    it("rejeita confirmação de arquivo quando objeto no staging excede o limite real", async () => {
      const confirm = new ConfirmMediaUploadUseCase(mediaRepo, storage, processor);
      const oversized = Buffer.alloc(5 * 1024 * 1024 + 1024); // > 5 MiB
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(oversized);

      const asset = Media.create({
        ownerId: new UniqueEntityId("owner"),
        purpose: "USER_AVATAR",
        objectKey: "staging/owner/fixture-oversize",
        publicUrl: "https://example.invalid/oversize",
        mimeType: "image/png",
        fileSize: 100, // declarou falso tamanho menor
      });
      await mediaRepo.create(asset);
      storage.putStagingObject(asset.objectKey, oversized, "image/png");

      const res = await confirm.execute({ userId: "owner", mediaId: asset.id.toString() });
      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value.message).toContain("limite máximo permitido");
      }

      const updated = await mediaRepo.findById(asset.id.toString());
      expect(updated?.status).toBe("REJECTED");
    });

    it("salva variantes sob chave pública imutável e deleta staging na confirmação", async () => {
      const confirm = new ConfirmMediaUploadUseCase(mediaRepo, storage, processor);

      const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const ihdr = Buffer.alloc(25);
      ihdr.writeUInt32BE(13, 0);
      ihdr.write("IHDR", 4);
      ihdr.writeUInt32BE(100, 8);
      ihdr.writeUInt32BE(100, 12);
      ihdr.writeUInt8(8, 16);
      ihdr.writeUInt8(6, 17);
      const idat = Buffer.alloc(12);
      idat.writeUInt32BE(0, 0);
      idat.write("IDAT", 4);
      const iend = Buffer.alloc(12);
      iend.writeUInt32BE(0, 0);
      iend.write("IEND", 4);
      const validPng = Buffer.concat([header, ihdr, idat, iend]);

      const asset = Media.create({
        ownerId: new UniqueEntityId("owner"),
        purpose: "USER_AVATAR",
        objectKey: "staging/owner/valid.png",
        publicUrl: "https://example.invalid/valid.png",
        mimeType: "image/png",
        fileSize: validPng.length,
      });
      await mediaRepo.create(asset);
      storage.putStagingObject(asset.objectKey, validPng, "image/png");

      const res = await confirm.execute({ userId: "owner", mediaId: asset.id.toString() });
      expect(res.isRight()).toBe(true);

      const stagingInspection = await storage.inspectStagingObject(asset.objectKey);
      expect(stagingInspection.exists).toBe(false);

      const updated = await mediaRepo.findById(asset.id.toString());
      expect(updated?.status).toBe("READY");
      expect(updated?.objectKey.startsWith("variants/")).toBe(true);
    });

    it("StorageCleanupService marca uploads pendentes expirados e remove objetos", async () => {
      const oldDate = new Date(Date.now() - 3 * 3600 * 1000); // 3 horas atrás (> 2h)
      const expiredAsset = Media.create({
        ownerId: new UniqueEntityId("owner"),
        purpose: "USER_AVATAR",
        objectKey: "staging/owner/expired.png",
        publicUrl: "https://example.invalid/expired.png",
        mimeType: "image/png",
        fileSize: 100,
        createdAt: oldDate,
      });
      await mediaRepo.create(expiredAsset);
      storage.putStagingObject(expiredAsset.objectKey, Buffer.from("data"), "image/png");

      const cleanup = new StorageCleanupService(mediaRepo, storage);
      const result = await cleanup.execute(120);

      expect(result.cleanedCount).toBe(1);
      const updated = await mediaRepo.findById(expiredAsset.id.toString());
      expect(updated?.status).toBe("EXPIRED");
      const inspection = await storage.inspectStagingObject(expiredAsset.objectKey);
      expect(inspection.exists).toBe(false);
    });
  });

  describe("F04: Autorização estrita de OWNER ativo para barbearia", () => {
    it("impede que membro OWNER INATIVO adicione foto à galeria", async () => {
      const shop = Barbershop.create(
        { name: "Shop", ownerId: new UniqueEntityId("owner"), location: "Loc" },
        new UniqueEntityId("shop-1")
      );
      shopRepo.items.push(shop);

      memberRepo.items.push(
        Membership.create({
          userId: new UniqueEntityId("owner"),
          barbershopId: new UniqueEntityId("shop-1"),
          role: Role.OWNER,
          state: "INACTIVE",
        })
      );

      const asset = Media.create({
        ownerId: new UniqueEntityId("owner"),
        purpose: "BARBERSHOP_GALLERY",
        objectKey: "variants/media-1/main.png",
        publicUrl: "https://example.invalid/photo",
        mimeType: "image/png",
        fileSize: 100,
        status: "READY",
      });
      mediaRepo.items.push(asset);

      const manage = new ManageBarbershopGalleryUseCase(galleryRepo, shopRepo, memberRepo, mediaRepo);
      const res = await manage.addPhoto({
        userId: "owner",
        barbershopId: "shop-1",
        mediaId: asset.id.toString(),
      });

      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value.message).toContain("proprietário ativo");
      }
    });

    it("impede que proprietário anexe mídia pertencente a outro ator", async () => {
      const shop = Barbershop.create(
        { name: "Shop", ownerId: new UniqueEntityId("owner"), location: "Loc" },
        new UniqueEntityId("shop-1")
      );
      shopRepo.items.push(shop);

      memberRepo.items.push(
        Membership.create({
          userId: new UniqueEntityId("owner"),
          barbershopId: new UniqueEntityId("shop-1"),
          role: Role.OWNER,
          state: "ACTIVE",
        })
      );

      const foreignAsset = Media.create({
        ownerId: new UniqueEntityId("attacker"),
        purpose: "BARBERSHOP_GALLERY",
        objectKey: "variants/media-foreign/main.png",
        publicUrl: "https://example.invalid/photo",
        mimeType: "image/png",
        fileSize: 100,
        status: "READY",
      });
      mediaRepo.items.push(foreignAsset);

      const manage = new ManageBarbershopGalleryUseCase(galleryRepo, shopRepo, memberRepo, mediaRepo);
      const res = await manage.addPhoto({
        userId: "owner",
        barbershopId: "shop-1",
        mediaId: foreignAsset.id.toString(),
      });

      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value.message).toContain("pertence a outro usuário");
      }
    });

    it("impede alteração de Google URL por usuário sem vínculo OWNER ativo", async () => {
      const shop = Barbershop.create(
        { name: "Shop", ownerId: new UniqueEntityId("owner"), location: "Loc" },
        new UniqueEntityId("shop-1")
      );
      shopRepo.items.push(shop);

      const useCase = new UpdateBarbershopGoogleUrlUseCase(shopRepo, memberRepo);
      const res = await useCase.execute({
        userId: "owner",
        barbershopId: "shop-1",
        googleMapsUrl: "https://maps.app.goo.gl/abcdef",
      });

      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value.message).toContain("proprietário ativo");
      }
    });
  });

  describe("F05: Avaliações com controle de versão CAS e moderação segura", () => {
    it("impede edição com expectedVersion divergente", async () => {
      const review = Review.create({
        bookingId: new UniqueEntityId("booking-1"),
        barbershopId: new UniqueEntityId("shop-1"),
        customerId: new UniqueEntityId("customer-1"),
        rating: 4,
        comment: "Bom",
      });
      await reviewRepo.create(review);

      const updateUseCase = new UpdateReviewUseCase(reviewRepo, shopRepo);
      const res = await updateUseCase.execute({
        userId: "customer-1",
        reviewId: review.id.toString(),
        rating: 5,
        expectedVersion: 999, // versão incorreta
      });

      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value.message).toContain("Conflito de versão");
      }
    });

    it("proíbe restauração por moderação de avaliação removida pelo autor", async () => {
      const admin = User.create({
        name: "Admin",
        email: "admin@example.com",
        password: Password.create("hash123456"),
        cpf: "11122233344",
        accountType: "PLATFORM_ADMIN",
      });
      await userRepo.save(admin);

      const review = Review.create({
        bookingId: new UniqueEntityId("booking-1"),
        barbershopId: new UniqueEntityId("shop-1"),
        customerId: new UniqueEntityId("customer-1"),
        rating: 4,
      });
      review.deleteByAuthor();
      await reviewRepo.create(review);

      const modUseCase = new ModerateReviewUseCase(reviewRepo, userRepo, shopRepo);
      const res = await modUseCase.execute({
        adminUserId: admin.id.toString(),
        reviewId: review.id.toString(),
        action: "RESTORE",
        note: "Tentando restaurar avaliação deletada pelo autor",
        expectedVersion: review.version,
      });

      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value.message).toContain("não podem ser restauradas");
      }
    });

    it("exige motivo não-vazio para moderação", async () => {
      const admin = User.create({
        name: "Admin",
        email: "admin@example.com",
        password: Password.create("hash123456"),
        cpf: "11122233344",
        accountType: "PLATFORM_ADMIN",
      });
      await userRepo.save(admin);

      const review = Review.create({
        bookingId: new UniqueEntityId("booking-1"),
        barbershopId: new UniqueEntityId("shop-1"),
        customerId: new UniqueEntityId("customer-1"),
        rating: 4,
      });
      await reviewRepo.create(review);

      const modUseCase = new ModerateReviewUseCase(reviewRepo, userRepo, shopRepo);
      const res = await modUseCase.execute({
        adminUserId: admin.id.toString(),
        reviewId: review.id.toString(),
        action: "HIDE",
        note: "   ", // motivo em branco
        expectedVersion: review.version,
      });

      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value.message).toContain("Motivo da moderação é obrigatório");
      }
    });
  });

  describe("F06: Consulta privada de avaliação do agendamento", () => {
    it("rejeita consulta não autenticada no controller", async () => {
      const getReviewUseCase = new GetBookingReviewUseCase(reviewRepo);
      const controller = new GetBookingReviewController(getReviewUseCase);

      const res = await controller.handle({ bookingId: randomUUID() });
      expect(res.statusCode).toBe(400);
      expect((res.body as any).message).toContain("Autenticação necessária");
    });

    it("mascara comentário quando a avaliação estiver oculta pela moderação", async () => {
      const bookingId = randomUUID();
      const customerId = randomUUID();
      const hiddenReview = Review.create({
        bookingId: new UniqueEntityId(bookingId),
        barbershopId: new UniqueEntityId("shop-1"),
        customerId: new UniqueEntityId(customerId),
        rating: 1,
        comment: "Texto impróprio",
        status: "HIDDEN_BY_MODERATION",
      });
      await reviewRepo.create(hiddenReview);

      const getReviewUseCase = new GetBookingReviewUseCase(reviewRepo);
      const controller = new GetBookingReviewController(getReviewUseCase);

      const res = await controller.handle({ bookingId, userId: customerId });
      expect(res.statusCode).toBe(200);
      expect((res.body as any).review.comment).toBeUndefined();
      expect((res.body as any).review.status).toBe("HIDDEN_BY_MODERATION");
    });
  });

  describe("F07 & F11: Reordenação de galeria e projeção pública de imagem", () => {
    it("reordena itens usando array de itemIds e projeta publicUrl", async () => {
      const shopId = randomUUID();
      const shop = Barbershop.create(
        { name: "Shop", ownerId: new UniqueEntityId("owner"), location: "Loc" },
        new UniqueEntityId(shopId)
      );
      shopRepo.items.push(shop);

      memberRepo.items.push(
        Membership.create({
          userId: new UniqueEntityId("owner"),
          barbershopId: new UniqueEntityId(shopId),
          role: Role.OWNER,
          state: "ACTIVE",
        })
      );

      const item1 = BarbershopGalleryItem.create({
        barbershopId: new UniqueEntityId(shopId),
        mediaId: new UniqueEntityId(),
        displayOrder: 0,
        isCover: true,
        publicUrl: "https://cdn.example.com/item1.jpg",
      });
      const item2 = BarbershopGalleryItem.create({
        barbershopId: new UniqueEntityId(shopId),
        mediaId: new UniqueEntityId(),
        displayOrder: 1,
        isCover: false,
        publicUrl: "https://cdn.example.com/item2.jpg",
      });
      galleryRepo.items.push(item1, item2);

      const manage = new ManageBarbershopGalleryUseCase(galleryRepo, shopRepo, memberRepo, mediaRepo);

      // Reordena invertendo as posições
      const reorderRes = await manage.reorder({
        userId: "owner",
        barbershopId: shopId,
        itemIds: [item2.id.toString(), item1.id.toString()],
      });
      expect(reorderRes.isRight()).toBe(true);

      expect(item2.displayOrder).toBe(0);
      expect(item1.displayOrder).toBe(1);

      // Lista no controller e valida projeção de publicUrl
      const listController = new ListBarbershopGalleryController(galleryRepo);
      const listRes = await listController.handle({ shopId });
      expect(listRes.statusCode).toBe(200);

      const body = listRes.body as { items: Array<{ id: string; publicUrl?: string }> };
      expect(body.items.length).toBe(2);
      expect(body.items[0].publicUrl).toBe("https://cdn.example.com/item2.jpg");
      expect(body.items[1].publicUrl).toBe("https://cdn.example.com/item1.jpg");
    });
  });

  describe("F12: Storage não-configurado trata requisições graciosamente", () => {
    it("UnconfiguredStorageService lança StorageUnavailableError com status 503", async () => {
      const service = new UnconfiguredStorageService();
      expect(service.isConfigured()).toBe(false);
      await expect(
        service.generateUploadUrl({
          objectKey: "test",
          mimeType: "image/png",
          fileSize: 100,
        })
      ).rejects.toThrow(StorageUnavailableError);
    });
  });

  describe("A01: Atomicidade e concorrência na galeria de fotos", () => {
    it("serializa adições concorrentes respeitando limite estrito de 10 fotos e idempotência", async () => {
      const shopId = randomUUID();
      const shop = Barbershop.create(
        { name: "Barbearia", ownerId: new UniqueEntityId("owner-1"), location: "SP" },
        new UniqueEntityId(shopId)
      );
      shopRepo.items.push(shop);
      memberRepo.items.push(
        Membership.create({
          userId: new UniqueEntityId("owner-1"),
          barbershopId: new UniqueEntityId(shopId),
          role: Role.OWNER,
          state: "ACTIVE",
        })
      );

      const manage = new ManageBarbershopGalleryUseCase(galleryRepo, shopRepo, memberRepo, mediaRepo);

      // Pré-carrega 9 fotos
      for (let i = 0; i < 9; i++) {
        const media = Media.create({
          ownerId: new UniqueEntityId("owner-1"),
          purpose: "BARBERSHOP_GALLERY",
          objectKey: `key-${i}`,
          mimeType: "image/jpeg",
          fileSize: 1000,
          status: "READY",
          publicUrl: `https://cdn.example.com/photo-${i}.jpg`,
        });
        mediaRepo.items.push(media);
        await manage.addPhoto({
          userId: "owner-1",
          barbershopId: shopId,
          mediaId: media.id.toString(),
        });
      }

      expect(galleryRepo.items.length).toBe(9);

      // Duas adições concorrentes: apenas 1 pode ser aceita, a outra deve bater no limite de 10
      const media10 = Media.create({
        ownerId: new UniqueEntityId("owner-1"),
        purpose: "BARBERSHOP_GALLERY",
        objectKey: "key-10",
        mimeType: "image/jpeg",
        fileSize: 1000,
        status: "READY",
        publicUrl: "https://cdn.example.com/photo-10.jpg",
      });
      const media11 = Media.create({
        ownerId: new UniqueEntityId("owner-1"),
        purpose: "BARBERSHOP_GALLERY",
        objectKey: "key-11",
        mimeType: "image/jpeg",
        fileSize: 1000,
        status: "READY",
        publicUrl: "https://cdn.example.com/photo-11.jpg",
      });
      mediaRepo.items.push(media10, media11);

      const [res10, res11] = await Promise.all([
        manage.addPhoto({ userId: "owner-1", barbershopId: shopId, mediaId: media10.id.toString() }),
        manage.addPhoto({ userId: "owner-1", barbershopId: shopId, mediaId: media11.id.toString() }),
      ]);

      const successCount = [res10, res11].filter((r) => r.isRight()).length;
      const failCount = [res10, res11].filter((r) => r.isLeft()).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);
      expect(galleryRepo.items.length).toBe(10);

      // Teste de Idempotência: re-adicionar item já existente retorna sucesso sem duplicar
      const reAdd = await manage.addPhoto({
        userId: "owner-1",
        barbershopId: shopId,
        mediaId: media10.id.toString(),
      });
      expect(reAdd.isRight()).toBe(true);
      expect(galleryRepo.items.length).toBe(10);
    });
  });

  describe("A02: Lease CAS e recuperação no pipeline de upload", () => {
    it("reivindica lease atômico, libera com resetToPending em caso de ausência no staging e recupera em retry", async () => {
      const media = Media.create({
        ownerId: new UniqueEntityId("user-1"),
        purpose: "USER_AVATAR",
        objectKey: "staging/user-1/avatar.jpg",
        publicUrl: "https://example.invalid/staging/user-1/avatar.jpg",
        mimeType: "image/jpeg",
        fileSize: 2048,
        status: "PENDING",
      });
      mediaRepo.items.push(media);

      const confirmUseCase = new ConfirmMediaUploadUseCase(mediaRepo, storage, processor);

      // Tentativa 1: arquivo ainda não chegou no staging (S3/R2 ausente)
      const res1 = await confirmUseCase.execute({
        mediaId: media.id.toString(),
        userId: "user-1",
      });

      expect(res1.isLeft()).toBe(true);
      const afterFail = await mediaRepo.findById(media.id.toString());
      expect(afterFail?.status).toBe("PENDING");
      expect(afterFail?.retryCount).toBe(1);
      expect(afterFail?.errorMessage).toContain("não encontrado");
      expect(afterFail?.leaseToken).toBeUndefined();

      // Agora o arquivo chega no staging (PNG sintético válido)
      const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const ihdr = Buffer.alloc(25);
      ihdr.writeUInt32BE(13, 0);
      ihdr.write("IHDR", 4);
      ihdr.writeUInt32BE(100, 8);
      ihdr.writeUInt32BE(100, 12);
      ihdr.writeUInt8(8, 16);
      ihdr.writeUInt8(6, 17);
      const idat = Buffer.alloc(12);
      idat.writeUInt32BE(0, 0);
      idat.write("IDAT", 4);
      const iend = Buffer.alloc(12);
      iend.writeUInt32BE(0, 0);
      iend.write("IEND", 4);
      const validPng = Buffer.concat([header, ihdr, idat, iend]);

      storage.putStagingObject(media.objectKey, validPng, "image/png");

      // Tentativa 2: com o arquivo presente, claim obtém novo lease e finaliza com sucesso
      const res2 = await confirmUseCase.execute({
        mediaId: media.id.toString(),
        userId: "user-1",
      });

      expect(res2.isRight()).toBe(true);
      const afterSuccess = await mediaRepo.findById(media.id.toString());
      expect(afterSuccess?.status).toBe("READY");
      expect(afterSuccess?.publicUrl).toBeDefined();
      expect(afterSuccess?.leaseToken).toBeUndefined();
    });
  });

  describe("A06: CAS obrigatório com expectedVersion em exclusão e moderação", () => {
    it("exige expectedVersion na exclusão e rejeita concorrência desatualizada", async () => {
      const review = Review.create({
        bookingId: new UniqueEntityId("b-1"),
        barbershopId: new UniqueEntityId("s-1"),
        customerId: new UniqueEntityId("c-1"),
        rating: 5,
        comment: "Excelente",
      });
      await reviewRepo.create(review);

      const deleteUseCase = new DeleteReviewUseCase(reviewRepo, shopRepo);

      // Rejeita versão desatualizada (expectedVersion = 99)
      const conflictRes = await deleteUseCase.execute({
        userId: "c-1",
        reviewId: review.id.toString(),
        expectedVersion: 99,
      });
      expect(conflictRes.isLeft()).toBe(true);
      if (conflictRes.isLeft()) {
        expect(conflictRes.value.message.toLowerCase()).toContain("conflito");
      }

      // Aceita versão correta (expectedVersion = 1)
      const successRes = await deleteUseCase.execute({
        userId: "c-1",
        reviewId: review.id.toString(),
        expectedVersion: 1,
      });
      expect(successRes.isRight()).toBe(true);
      const deleted = await reviewRepo.findById(review.id.toString());
      expect(deleted?.status).toBe("DELETED_BY_AUTHOR");
    });
  });

  describe("B03 & B04: Autorização prévia e Fencing de lease em confirmação de upload", () => {
    it("B03: Rejeita confirmação de estranho mesmo quando mídia já está READY", async () => {
      const confirmUseCase = new ConfirmMediaUploadUseCase(mediaRepo, storage, processor);

      const readyMedia = Media.create({
        ownerId: new UniqueEntityId("legitimate-owner"),
        purpose: "USER_AVATAR",
        objectKey: "variants/legitimate-owner/1/main.png",
        publicUrl: "https://example.invalid/legitimate-owner/avatar.png",
        mimeType: "image/png",
        fileSize: 1024,
      });
      readyMedia.finalizeReady({
        objectKey: "variants/legitimate-owner/1/main.png",
        publicUrl: "https://example.invalid/legitimate-owner/avatar.png",
        fileSize: 1024,
        mimeType: "image/png",
        variants: {
          main: {
            objectKey: "variants/legitimate-owner/1/main.png",
            publicUrl: "https://example.invalid/legitimate-owner/avatar.png",
            width: 100,
            height: 100,
            fileSize: 1024,
            mimeType: "image/png",
          },
        },
      });
      await mediaRepo.create(readyMedia);

      // Usuário estranho tenta confirmar mídia de terceiro já finalizada
      const strangerRes = await confirmUseCase.execute({
        mediaId: readyMedia.id.toString(),
        userId: "stranger-user",
      });

      expect(strangerRes.isLeft()).toBe(true);
      if (strangerRes.isLeft()) {
        expect(strangerRes.value.message.toLowerCase()).toContain("não autorizado");
      }
    });

    it("B04: Rejeição com leaseToken expirado é ignorada pelo repositório (fencing)", async () => {
      const media = Media.create({
        ownerId: new UniqueEntityId("owner-1"),
        purpose: "USER_AVATAR",
        objectKey: "variants/owner-1/1/main.png",
        publicUrl: "https://example.invalid/owner-1/avatar.png",
        mimeType: "image/png",
        fileSize: 1024,
      });
      media.finalizeReady({
        objectKey: "variants/owner-1/1/main.png",
        publicUrl: "https://example.invalid/owner-1/avatar.png",
        fileSize: 1024,
        mimeType: "image/png",
        variants: {},
      });
      await mediaRepo.create(media);

      // Tentativa de worker atrasado com leaseToken vencido de rejeitar mídia finalizada
      const rejected = await mediaRepo.rejectProcessing(
        media.id.toString(),
        "expired-old-lease-token",
        "Corrupted image"
      );

      expect(rejected).toBe(false);

      const afterAttempt = await mediaRepo.findById(media.id.toString());
      expect(afterAttempt?.status).toBe("READY");
    });
  });

  describe("B05: Limpeza segura de armazenamento coordenada com o banco", () => {
    it("não expira nem remove objetos se mídia já foi confirmada para READY", async () => {
      const media = Media.create({
        ownerId: new UniqueEntityId("owner-1"),
        purpose: "USER_AVATAR",
        objectKey: "variants/owner-1/1/main.png",
        publicUrl: "https://example.invalid/owner-1/avatar.png",
        mimeType: "image/png",
        fileSize: 1024,
      });
      media.finalizeReady({
        objectKey: "variants/owner-1/1/main.png",
        publicUrl: "https://example.invalid/owner-1/avatar.png",
        fileSize: 1024,
        mimeType: "image/png",
        variants: {},
      });
      await mediaRepo.create(media);

      const expired = await mediaRepo.markExpiredConditional(media.id.toString(), {
        allowedStatuses: ["PENDING", "PROCESSING", "REJECTED"],
        currentGeneration: media.generation,
      });

      expect(expired).toBe(false);
      const after = await mediaRepo.findById(media.id.toString());
      expect(after?.status).toBe("READY");
    });
  });

  describe("B07: Transações atômicas de capa de galeria", () => {
    it("não desmarca a capa anterior se o item alvo da nova capa não existir", async () => {
      const shop = Barbershop.create({
        name: "Barbearia Central",
        ownerId: new UniqueEntityId("owner-shop"),
      });
      await shopRepo.create(shop);

      const membership = Membership.create({
        barbershopId: shop.id,
        userId: new UniqueEntityId("owner-shop"),
        role: Role.OWNER,
        state: "ACTIVE",
      });
      await memberRepo.create(membership);

      const initialCover = BarbershopGalleryItem.create({
        barbershopId: shop.id,
        mediaId: new UniqueEntityId("media-cover-1"),
        displayOrder: 0,
        isCover: true,
        publicUrl: "https://example.invalid/cover1.png",
      });
      await galleryRepo.create(initialCover);

      const galleryUseCase = new ManageBarbershopGalleryUseCase(
        galleryRepo,
        shopRepo,
        memberRepo,
        mediaRepo
      );

      // Tenta definir item inexistente como capa
      const nonExistentRes = await galleryUseCase.setCover({
        userId: "owner-shop",
        barbershopId: shop.id.toString(),
        galleryItemId: "non-existent-gallery-item-id",
      });

      expect(nonExistentRes.isLeft()).toBe(true);

      // Garante que a capa anterior permaneceu intacta
      const items = await galleryRepo.findByBarbershopId(shop.id.toString());
      const currentCover = items.find((i) => i.isCover);
      expect(currentCover).toBeDefined();
      expect(currentCover?.id.toString()).toBe(initialCover.id.toString());
    });
  });

  describe("A03 & A04: Isolamento de unidade e integridade de galeria", () => {
    it("A04: Impede adição de foto pertencente a outra barbearia", async () => {
      const shop1 = Barbershop.create({
        name: "Unidade 1",
        ownerId: new UniqueEntityId("owner-1"),
      });
      const shop2 = Barbershop.create({
        name: "Unidade 2",
        ownerId: new UniqueEntityId("owner-2"),
      });
      await shopRepo.create(shop1);
      await shopRepo.create(shop2);

      await memberRepo.create(
        Membership.create({
          barbershopId: shop1.id,
          userId: new UniqueEntityId("owner-1"),
          role: Role.OWNER,
          state: "ACTIVE",
        })
      );

      // Mídia associada à Unidade 2
      const mediaShop2 = Media.create({
        ownerId: new UniqueEntityId("owner-2"),
        ownerType: "SHOP",
        ownerEntityId: shop2.id,
        purpose: "BARBERSHOP_GALLERY",
        objectKey: "variants/shop2/1/main.png",
        publicUrl: "https://example.invalid/shop2.png",
        mimeType: "image/png",
        fileSize: 1024,
      });
      mediaShop2.finalizeReady({
        objectKey: "variants/shop2/1/main.png",
        publicUrl: "https://example.invalid/shop2.png",
        fileSize: 1024,
        mimeType: "image/png",
        variants: {},
      });
      await mediaRepo.create(mediaShop2);

      const galleryUseCase = new ManageBarbershopGalleryUseCase(
        galleryRepo,
        shopRepo,
        memberRepo,
        mediaRepo
      );

      // Tenta adicionar mídia da Unidade 2 na galeria da Unidade 1
      const res = await galleryUseCase.addPhoto({
        userId: "owner-1",
        barbershopId: shop1.id.toString(),
        mediaId: mediaShop2.id.toString(),
      });

      expect(res.isLeft()).toBe(true);
      if (res.isLeft()) {
        expect(res.value.message.toLowerCase()).toContain("outra unidade");
      }
    });

    it("A03: Reordenação exige lista completa sem duplicatas", async () => {
      const shop = Barbershop.create({
        name: "Barbearia Reorder",
        ownerId: new UniqueEntityId("owner-reorder"),
      });
      await shopRepo.create(shop);
      await memberRepo.create(
        Membership.create({
          barbershopId: shop.id,
          userId: new UniqueEntityId("owner-reorder"),
          role: Role.OWNER,
          state: "ACTIVE",
        })
      );

      const item1 = BarbershopGalleryItem.create({
        barbershopId: shop.id,
        mediaId: new UniqueEntityId("m-1"),
        displayOrder: 0,
      });
      const item2 = BarbershopGalleryItem.create({
        barbershopId: shop.id,
        mediaId: new UniqueEntityId("m-2"),
        displayOrder: 1,
      });
      await galleryRepo.create(item1);
      await galleryRepo.create(item2);

      const galleryUseCase = new ManageBarbershopGalleryUseCase(
        galleryRepo,
        shopRepo,
        memberRepo,
        mediaRepo
      );

      // Reordenação com duplicata
      const dupRes = await galleryUseCase.reorder({
        userId: "owner-reorder",
        barbershopId: shop.id.toString(),
        itemIds: [item1.id.toString(), item1.id.toString()],
      });
      expect(dupRes.isLeft()).toBe(true);
      if (dupRes.isLeft()) {
        expect(dupRes.value.message.toLowerCase()).toContain("duplicados");
      }

      // Reordenação com item faltante
      const partialRes = await galleryUseCase.reorder({
        userId: "owner-reorder",
        barbershopId: shop.id.toString(),
        itemIds: [item1.id.toString()],
      });
      expect(partialRes.isLeft()).toBe(true);
      if (partialRes.isLeft()) {
        expect(partialRes.value.message.toLowerCase()).toContain("todos os itens");
      }
    });
  });
});
