import { Entity } from "../../../core/entities/Entity";
import { UniqueEntityId } from "../../../core/entities/unique-entity-id";
import type { Optional } from "../../../core/types/optional";

export type MediaPurpose =
  | "USER_AVATAR"
  | "BARBERSHOP_LOGO"
  | "BARBERSHOP_COVER"
  | "BARBERSHOP_GALLERY";

export type MediaStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export type MediaOwnerType = "USER" | "BARBERSHOP";

export interface MediaVariantInfo {
  objectKey: string;
  publicUrl: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
}

export interface MediaProps {
  ownerId: UniqueEntityId;
  ownerType?: MediaOwnerType;
  ownerEntityId?: UniqueEntityId;
  purpose: MediaPurpose;
  objectKey: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  generation?: number;
  variants?: Record<string, MediaVariantInfo>;
  leaseToken?: string;
  leaseExpiresAt?: Date;
  retryCount?: number;
  errorMessage?: string;
  status: MediaStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Media extends Entity<MediaProps> {
  get ownerId(): UniqueEntityId {
    return this.props.ownerId;
  }

  get ownerType(): MediaOwnerType {
    return this.props.ownerType ?? "USER";
  }

  get ownerEntityId(): UniqueEntityId | undefined {
    return this.props.ownerEntityId;
  }

  get generation(): number {
    return this.props.generation ?? 1;
  }

  get variants(): Record<string, MediaVariantInfo> | undefined {
    return this.props.variants;
  }

  get leaseToken(): string | undefined {
    return this.props.leaseToken;
  }

  get leaseExpiresAt(): Date | undefined {
    return this.props.leaseExpiresAt;
  }

  get retryCount(): number {
    return this.props.retryCount ?? 0;
  }

  get errorMessage(): string | undefined {
    return this.props.errorMessage;
  }

  get purpose(): MediaPurpose {
    return this.props.purpose;
  }

  get objectKey(): string {
    return this.props.objectKey;
  }

  get publicUrl(): string {
    return this.props.publicUrl;
  }

  get mimeType(): string {
    return this.props.mimeType;
  }

  get fileSize(): number {
    return this.props.fileSize;
  }

  get width(): number | undefined {
    return this.props.width;
  }

  get height(): number | undefined {
    return this.props.height;
  }

  get status(): MediaStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isReady(): boolean {
    return this.props.status === "READY";
  }

  isOwnedBy(userId: UniqueEntityId): boolean {
    return this.props.ownerId.toString() === userId.toString();
  }

  markReady(width?: number, height?: number): void {
    this.props.status = "READY";
    if (width !== undefined) this.props.width = width;
    if (height !== undefined) this.props.height = height;
    this.touch();
  }

  startProcessing(): boolean {
    if (this.props.status !== "PENDING") {
      return false;
    }
    this.props.status = "PROCESSING";
    this.props.generation = (this.props.generation ?? 1) + 1;
    this.touch();
    return true;
  }

  isLeaseExpired(): boolean {
    if (!this.props.leaseExpiresAt) return true;
    return this.props.leaseExpiresAt.getTime() <= Date.now();
  }

  claimProcessing(leaseToken: string, leaseDurationMs: number): boolean {
    const canClaim =
      this.props.status === "PENDING" ||
      (this.props.status === "PROCESSING" && this.isLeaseExpired());

    if (!canClaim) {
      return false;
    }

    this.props.status = "PROCESSING";
    this.props.generation = (this.props.generation ?? 1) + 1;
    this.props.leaseToken = leaseToken;
    this.props.leaseExpiresAt = new Date(Date.now() + leaseDurationMs);
    this.props.errorMessage = undefined;
    this.touch();
    return true;
  }

  releaseProcessing(options?: { resetToPending?: boolean; errorMessage?: string }): void {
    this.props.leaseToken = undefined;
    this.props.leaseExpiresAt = undefined;
    if (options?.resetToPending) {
      this.props.status = "PENDING";
      this.props.retryCount = (this.props.retryCount ?? 0) + 1;
    }
    if (options?.errorMessage !== undefined) {
      this.props.errorMessage = options.errorMessage;
    }
    this.touch();
  }

  finalizeReady(params: {
    objectKey: string;
    publicUrl: string;
    width?: number;
    height?: number;
    fileSize?: number;
    mimeType?: string;
    variants?: Record<string, MediaVariantInfo>;
  }): void {
    this.props.objectKey = params.objectKey;
    this.props.publicUrl = params.publicUrl;
    if (params.width !== undefined) this.props.width = params.width;
    if (params.height !== undefined) this.props.height = params.height;
    if (params.fileSize !== undefined) this.props.fileSize = params.fileSize;
    if (params.mimeType !== undefined) this.props.mimeType = params.mimeType;
    if (params.variants !== undefined) this.props.variants = params.variants;
    this.props.status = "READY";
    this.props.leaseToken = undefined;
    this.props.leaseExpiresAt = undefined;
    this.props.errorMessage = undefined;
    this.touch();
  }

  setVariants(variants: Record<string, MediaVariantInfo>): void {
    this.props.variants = variants;
    this.touch();
  }

  markProcessing(): void {
    this.props.status = "PROCESSING";
    this.touch();
  }

  markExpired(): void {
    this.props.status = "EXPIRED";
    this.touch();
  }

  markCancelled(): void {
    this.props.status = "CANCELLED";
    this.touch();
  }

  updateReadyVariant(params: {
    objectKey: string;
    publicUrl: string;
    width: number;
    height: number;
    fileSize: number;
    mimeType: string;
  }): void {
    this.props.objectKey = params.objectKey;
    this.props.publicUrl = params.publicUrl;
    this.props.width = params.width;
    this.props.height = params.height;
    this.props.fileSize = params.fileSize;
    this.props.mimeType = params.mimeType;
    this.props.status = "READY";
    this.touch();
  }

  markRejected(): void {
    this.props.status = "REJECTED";
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  static create(
    props: Optional<MediaProps, "status" | "createdAt" | "updatedAt">,
    id?: UniqueEntityId
  ): Media {
    return new Media(
      {
        ...props,
        ownerType: props.ownerType ?? "USER",
        generation: props.generation ?? 1,
        status: props.status ?? "PENDING",
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id
    );
  }
}
