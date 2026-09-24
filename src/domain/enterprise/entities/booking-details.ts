import type { UniqueEntityId } from "../../../core/entities/unique-entity-id";

export interface BookingDetailsProps {
  bookingId: UniqueEntityId;
  barbershopId: UniqueEntityId;
  barbermanId: UniqueEntityId;
  shoppingCartId: UniqueEntityId;
  customer: {
    id: UniqueEntityId;
    name: string;
    phoneNumber: string;
  };
  services: Array<{
    id: UniqueEntityId;
    title: string;
    priceInCents: number;
    durationInMinutes: number;
  }>;
  date: Date;
  startTime: string;
  endTime: string;
  createdAt?: Date;
}

export class BookingDetails {
  private props: BookingDetailsProps;

  get bookingId(): UniqueEntityId {
    return this.props.bookingId;
  }

  get barbershopId(): UniqueEntityId {
    return this.props.barbershopId;
  }

  get barbermanId(): UniqueEntityId {
    return this.props.barbermanId;
  }

  get shoppingCartId(): UniqueEntityId {
    return this.props.shoppingCartId;
  }

  get customer() {
    return this.props.customer;
  }

  get services() {
    return this.props.services;
  }

  get date(): Date {
    return this.props.date;
  }

  get startTime(): string {
    return this.props.startTime;
  }

  get endTime(): string {
    return this.props.endTime;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt;
  }

  private constructor(props: BookingDetailsProps) {
    this.props = props;
  }

  static create(props: BookingDetailsProps) {
    return new BookingDetails(props);
  }
}
