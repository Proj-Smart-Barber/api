import { Entity } from "../../../core/entities/Entity";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

export interface BarbershopGalleryItemProps {
  barbershopId: UniqueEntityId;
  mediaId: UniqueEntityId;
  displayOrder: number;
  caption?: string;
  isCover: boolean;
  publicUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BarbershopGalleryItem extends Entity<BarbershopGalleryItemProps> {
  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get mediaId(): UniqueEntityId {
    return this.props.mediaId;
  }

  get displayOrder(): number {
    return this.props.displayOrder;
  }

  get caption(): string | undefined {
    return this.props.caption;
  }

  get isCover(): boolean {
    return this.props.isCover;
  }

  get publicUrl(): string | undefined {
    return this.props.publicUrl;
  }

  setPublicUrl(url: string): void {
    this.props.publicUrl = url;
    this.touch();
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  changeOrder(newOrder: number): void {
    if (newOrder < 0) throw new Error("A ordem de exibição não pode ser negativa.");
    this.props.displayOrder = newOrder;
    this.touch();
  }

  setCover(isCover: boolean): void {
    this.props.isCover = isCover;
    this.touch();
  }

  updateCaption(caption?: string): void {
    this.props.caption = caption;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  static create(
    props: Optional<BarbershopGalleryItemProps, "isCover" | "createdAt" | "updatedAt">,
    id?: UniqueEntityId
  ): BarbershopGalleryItem {
    return new BarbershopGalleryItem(
      {
        ...props,
        isCover: props.isCover ?? false,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id
    );
  }
}
