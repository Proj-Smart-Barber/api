import { describe, it, expect, beforeEach } from "vitest";
import { UniqueEntityId } from "../../../../core/entities/unique-entity-id";
import { InMemoryMediaRepository } from "../../../../../test/repositories/in-memory-media-repository";
import { InMemoryBarbershopGalleryRepository } from "../../../../../test/repositories/in-memory-barbershop-gallery-repository";
import { InMemoryBarbershopsRepository } from "../../../../../test/repositories/in-memory-barbershops-repository";
import { InMemoryUsersRepository } from "../../../../../test/repositories/in-memory-users-repository";
import { InMemoryMembershipsRepository } from "../../../../../test/repositories/in-memory-memberships-repository";
import { FakeStorageService } from "../../../../../test/fakes/fake-storage-service";
import { PureImageProcessor } from "../../../../infra/storage/pure-image-processor";
import { InitiateMediaUploadUseCase } from "./initiate-upload/initiate-upload";
import { ConfirmMediaUploadUseCase } from "./confirm-upload/confirm-upload";
import { UpdateUserAvatarUseCase } from "./update-user-avatar/update-user-avatar";
import { RemoveUserAvatarUseCase } from "./remove-user-avatar/remove-user-avatar";
import { ManageBarbershopGalleryUseCase } from "./manage-barbershop-gallery/manage-barbershop-gallery";
import { UpdateBarbershopGoogleUrlUseCase } from "../barbershop/update-barbershop-google-url/update-barbershop-google-url";
import { User } from "../../../enterprise/entities/user";
import { Password } from "../../../enterprise/entities/value-objects/password";
import { Barbershop } from "../../../enterprise/entities/barbershop";
import { Membership, Role } from "../../../enterprise/entities/membership";

describe("Phase 2 Use Cases: Media, Gallery & Google Link", () => {
  let mediaRepository: InMemoryMediaRepository;
  let galleryRepository: InMemoryBarbershopGalleryRepository;
  let barbershopsRepository: InMemoryBarbershopsRepository;
  let usersRepository: InMemoryUsersRepository;
  let membershipsRepository: InMemoryMembershipsRepository;
  let storageService: FakeStorageService;
  let imageProcessor: PureImageProcessor;

  let initiateUploadUseCase: InitiateMediaUploadUseCase;
  let confirmUploadUseCase: ConfirmMediaUploadUseCase;
  let updateAvatarUseCase: UpdateUserAvatarUseCase;
  let removeAvatarUseCase: RemoveUserAvatarUseCase;
  let manageGalleryUseCase: ManageBarbershopGalleryUseCase;
  let updateGoogleUrlUseCase: UpdateBarbershopGoogleUrlUseCase;

  const createMockPng = (width = 100, height = 100): Buffer => {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = Buffer.alloc(4 + 4 + 13 + 4);
    ihdr.writeUInt32BE(13, 0);
    ihdr.write("IHDR", 4, 4, "ascii");
    ihdr.writeUInt32BE(width, 8);
    ihdr.writeUInt32BE(height, 12);
    ihdr.writeUInt8(8, 16);
    ihdr.writeUInt8(6, 17);
    ihdr.writeUInt8(0, 18);
    ihdr.writeUInt8(0, 19);
    ihdr.writeUInt8(0, 20);
    ihdr.writeUInt32BE(0x12345678, 21);
    const idat = Buffer.alloc(12);
    idat.writeUInt32BE(0, 0);
    idat.write("IDAT", 4, 4, "ascii");
    idat.writeUInt32BE(0x00000000, 8);
    const iend = Buffer.alloc(12);
    iend.writeUInt32BE(0, 0);
    iend.write("IEND", 4, 4, "ascii");
    iend.writeUInt32BE(0xae426082, 8);
    return Buffer.concat([signature, ihdr, idat, iend]);
  };

  beforeEach(async () => {
    mediaRepository = new InMemoryMediaRepository();
    galleryRepository = new InMemoryBarbershopGalleryRepository();
    barbershopsRepository = new InMemoryBarbershopsRepository();
    usersRepository = new InMemoryUsersRepository();
    membershipsRepository = new InMemoryMembershipsRepository();
    storageService = new FakeStorageService();
    imageProcessor = new PureImageProcessor();

    initiateUploadUseCase = new InitiateMediaUploadUseCase(mediaRepository, storageService);
    confirmUploadUseCase = new ConfirmMediaUploadUseCase(mediaRepository, storageService, imageProcessor);
    updateAvatarUseCase = new UpdateUserAvatarUseCase(usersRepository, mediaRepository);
    removeAvatarUseCase = new RemoveUserAvatarUseCase(usersRepository);
    manageGalleryUseCase = new ManageBarbershopGalleryUseCase(
      galleryRepository,
      barbershopsRepository,
      membershipsRepository,
      mediaRepository
    );
    updateGoogleUrlUseCase = new UpdateBarbershopGoogleUrlUseCase(
      barbershopsRepository,
      membershipsRepository
    );
  });

  describe("Initiate & Confirm Upload", () => {
    it("inicia upload de avatar dentro do limite de 5MB com sucesso", async () => {
      const result = await initiateUploadUseCase.execute({
        userId: "user-1",
        purpose: "USER_AVATAR",
        fileName: "my-photo.png",
        mimeType: "image/png",
        fileSize: 1024 * 500, // 500KB
      });

      expect(result.isRight()).toBe(true);
      if (result.isRight()) {
        expect(result.value.uploadUrl).toBeDefined();
        expect(result.value.mediaId).toBeDefined();

        const savedMedia = await mediaRepository.findById(result.value.mediaId);
        expect(savedMedia?.status).toBe("PENDING");
      }
    });

    it("rejeita upload de avatar excedendo 5MB", async () => {
      const result = await initiateUploadUseCase.execute({
        userId: "user-1",
        purpose: "USER_AVATAR",
        fileName: "large.png",
        mimeType: "image/png",
        fileSize: 6 * 1024 * 1024, // 6MB
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value.message).toContain("Tamanho do arquivo excede o limite de 5 MB");
      }
    });

    it("rejeita formato HEIC com instrução clara", async () => {
      const result = await initiateUploadUseCase.execute({
        userId: "user-1",
        purpose: "USER_AVATAR",
        fileName: "photo.heic",
        mimeType: "image/heic",
        fileSize: 1024 * 500,
      });

      expect(result.isLeft()).toBe(true);
      if (result.isLeft()) {
        expect(result.value.message).toContain("Formato HEIC não suportado diretamente");
      }
    });

    it("confirma upload após verificar objeto no storage e marca como READY", async () => {
      const initRes = await initiateUploadUseCase.execute({
        userId: "user-1",
        purpose: "USER_AVATAR",
        fileName: "photo.png",
        mimeType: "image/png",
        fileSize: 1024 * 100,
      });

      if (initRes.isLeft()) throw initRes.value;

      const media = await mediaRepository.findById(initRes.value.mediaId);
      const validPng = createMockPng(400, 400);

      // Simula que o arquivo foi enviado para o storage
      storageService.putFakeObject(media!.objectKey, validPng, "image/png");

      const confirmRes = await confirmUploadUseCase.execute({
        userId: "user-1",
        mediaId: initRes.value.mediaId,
      });

      expect(confirmRes.isRight()).toBe(true);
      if (confirmRes.isRight()) {
        expect(confirmRes.value.media.status).toBe("READY");
        expect(confirmRes.value.media.width).toBe(400);
        expect(confirmRes.value.media.height).toBe(400);
      }
    });

    it("impede que outro usuário confirme mídia alheia", async () => {
      const initRes = await initiateUploadUseCase.execute({
        userId: "user-1",
        purpose: "USER_AVATAR",
        fileName: "photo.png",
        mimeType: "image/png",
        fileSize: 1024 * 100,
      });

      if (initRes.isLeft()) throw initRes.value;

      const confirmRes = await confirmUploadUseCase.execute({
        userId: "user-attacker",
        mediaId: initRes.value.mediaId,
      });

      expect(confirmRes.isLeft()).toBe(true);
    });
  });

  describe("User Avatar Association", () => {
    it("associa avatar READY ao usuário autenticado e permite remoção", async () => {
      const user = User.create({
        name: "Carlos Barbeiro",
        email: "carlos@example.com",
        password: Password.create("hashed_senha123"),
        cpf: "12345678901",
      });
      await usersRepository.save(user);

      const initRes = await initiateUploadUseCase.execute({
        userId: user.id.toString(),
        purpose: "USER_AVATAR",
        fileName: "avatar.png",
        mimeType: "image/png",
        fileSize: 1024 * 50,
      });
      if (initRes.isLeft()) throw initRes.value;

      const media = await mediaRepository.findById(initRes.value.mediaId);
      storageService.putFakeObject(media!.objectKey, createMockPng(200, 200), "image/png");

      await confirmUploadUseCase.execute({
        userId: user.id.toString(),
        mediaId: initRes.value.mediaId,
      });

      const assocRes = await updateAvatarUseCase.execute({
        userId: user.id.toString(),
        mediaId: initRes.value.mediaId,
      });

      expect(assocRes.isRight()).toBe(true);
      const updatedUser = await usersRepository.findById(user.id.toString());
      expect(updatedUser?.avatarUrl).toBe(media?.publicUrl);

      // Remoção
      const removeRes = await removeAvatarUseCase.execute({ userId: user.id.toString() });
      expect(removeRes.isRight()).toBe(true);

      const userAfterRemove = await usersRepository.findById(user.id.toString());
      expect(userAfterRemove?.avatarUrl).toBeUndefined();
    });
  });

  describe("Barbershop Gallery & Google Link", () => {
    it("permite ao OWNER ativo adicionar fotos e limita a 10 fotos na galeria", async () => {
      const ownerId = new UniqueEntityId();
      const shop = Barbershop.create({
        name: "Barbearia Imperial",
        ownerId,
        location: "Av Paulista, 1000",
      });
      await barbershopsRepository.create(shop);

      const ownerMembership = Membership.create({
        barbershopId: shop.id,
        userId: ownerId,
        role: Role.OWNER,
      });
      await membershipsRepository.create(ownerMembership);

      // Adiciona 10 fotos
      for (let i = 1; i <= 10; i++) {
        const initRes = await initiateUploadUseCase.execute({
          userId: ownerId.toString(),
          purpose: "BARBERSHOP_GALLERY",
          fileName: `photo-${i}.png`,
          mimeType: "image/png",
          fileSize: 1024 * 100,
          barbershopId: shop.id.toString(),
        });
        if (initRes.isLeft()) throw initRes.value;

        const media = await mediaRepository.findById(initRes.value.mediaId);
        storageService.putFakeObject(media!.objectKey, createMockPng(500, 500), "image/png");
        await confirmUploadUseCase.execute({
          userId: ownerId.toString(),
          mediaId: initRes.value.mediaId,
        });

        const addRes = await manageGalleryUseCase.addPhoto({
          userId: ownerId.toString(),
          barbershopId: shop.id.toString(),
          mediaId: initRes.value.mediaId,
        });
        expect(addRes.isRight()).toBe(true);
      }

      // 11ª foto deve ser rejeitada pelo limite de 10 fotos
      const extraInit = await initiateUploadUseCase.execute({
        userId: ownerId.toString(),
        purpose: "BARBERSHOP_GALLERY",
        fileName: "photo-11.png",
        mimeType: "image/png",
        fileSize: 1024 * 100,
        barbershopId: shop.id.toString(),
      });
      if (extraInit.isLeft()) throw extraInit.value;

      const extraMedia = await mediaRepository.findById(extraInit.value.mediaId);
      storageService.putFakeObject(extraMedia!.objectKey, createMockPng(500, 500), "image/png");
      await confirmUploadUseCase.execute({
        userId: ownerId.toString(),
        mediaId: extraInit.value.mediaId,
      });

      const eleventhRes = await manageGalleryUseCase.addPhoto({
        userId: ownerId.toString(),
        barbershopId: shop.id.toString(),
        mediaId: extraInit.value.mediaId,
      });

      expect(eleventhRes.isLeft()).toBe(true);
      if (eleventhRes.isLeft()) {
        expect(eleventhRes.value.message).toContain("Limite máximo de 10 fotos");
      }
    });

    it("valida e persiste URL pública opcional do Google Maps com segurança", async () => {
      const ownerId = new UniqueEntityId();
      const shop = Barbershop.create({
        name: "Barbearia Imperial",
        ownerId,
        location: "Av Paulista, 1000",
      });
      await barbershopsRepository.create(shop);

      const ownerMembership = Membership.create({
        barbershopId: shop.id,
        userId: ownerId,
        role: Role.OWNER,
      });
      await membershipsRepository.create(ownerMembership);

      // Rejeita esquema HTTP sem SSL
      const httpRes = await updateGoogleUrlUseCase.execute({
        userId: ownerId.toString(),
        barbershopId: shop.id.toString(),
        googleMapsUrl: "http://maps.google.com/test",
      });
      expect(httpRes.isLeft()).toBe(true);

      // Rejeita domínio não-Google
      const attackerRes = await updateGoogleUrlUseCase.execute({
        userId: ownerId.toString(),
        barbershopId: shop.id.toString(),
        googleMapsUrl: "https://evil-site.com/profile",
      });
      expect(attackerRes.isLeft()).toBe(true);

      // Aceita domínio oficial Google Maps HTTPS
      const validRes = await updateGoogleUrlUseCase.execute({
        userId: ownerId.toString(),
        barbershopId: shop.id.toString(),
        googleMapsUrl: "https://maps.app.goo.gl/abcdef12345",
      });
      expect(validRes.isRight()).toBe(true);

      const updatedShop = await barbershopsRepository.findById(shop.id.toString());
      expect(updatedShop?.googleMapsUrl).toBe("https://maps.app.goo.gl/abcdef12345");
    });
  });
});
