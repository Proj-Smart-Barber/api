export interface AvailabilitySlot {
  start: string;
  end: string;
}

export interface GetAvailableSlotsResponse {
  slots: AvailabilitySlot[];
}
