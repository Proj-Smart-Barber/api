import { describe, it, expect } from "vitest";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import { Media } from "./media";

describe("Media Entity", () => {
  it("cria uma mídia com status PENDING inicial", () => {
    const ownerId = new UniqueEntityId();
    const media = Media.create({
      ownerId,
      purpose: "USER_AVATAR",
      objectKey: "avatars/user-1/avatar.png",
      publicUrl: "https://media.local/avatars/user-1/avatar.png",
      mimeType: "image/png",
      fileSize: 1024 * 100,
    });

    expect(media.status).toBe("PENDING");
    expect(media.isReady()).toBe(false);
    expect(media.isOwnedBy(ownerId)).toBe(true);
    expect(media.isOwnedBy(new UniqueEntityId())).toBe(false);
  });

  it("marca a mídia como READY com dimensões e atualiza data", () => {
    const media = Media.create({
      ownerId: new UniqueEntityId(),
      purpose: "BARBERSHOP_LOGO",
      objectKey: "logos/shop-1/logo.jpg",
      publicUrl: "https://media.local/logos/shop-1/logo.jpg",
      mimeType: "image/jpeg",
      fileSize: 1024 * 200,
    });

    media.markReady(800, 600);

    expect(media.status).toBe("READY");
    expect(media.isReady()).toBe(true);
    expect(media.width).toBe(800);
    expect(media.height).toBe(600);
  });

  it("marca a mídia como REJECTED", () => {
    const media = Media.create({
      ownerId: new UniqueEntityId(),
      purpose: "BARBERSHOP_GALLERY",
      objectKey: "gallery/shop-1/pic.jpg",
      publicUrl: "https://media.local/gallery/shop-1/pic.jpg",
      mimeType: "image/jpeg",
      fileSize: 1024 * 300,
    });

    media.markRejected();

    expect(media.status).toBe("REJECTED");
    expect(media.isReady()).toBe(false);
  });
});
