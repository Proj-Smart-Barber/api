export type BookingScope = "PERSONAL" | "UNIT";

export interface CapabilityItem {
  allowed: boolean;
  reasonCode?: string;
  deadlineAt?: Date | null;
}

export interface BookingCapabilities {
  canCancel: boolean;
  canReschedule: boolean;
  canComplete: boolean;
  canMarkNoShow: boolean;
  cancel: CapabilityItem;
  reschedule: CapabilityItem;
  complete: CapabilityItem;
  noShow: CapabilityItem;
}

export interface BookingPolicyParams {
  status?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  customerId?: string | null;
  barbermanId: string;
  barbershopOwnerId?: string | null;
  actorId?: string | null;
  serverTime: Date;
  scope?: BookingScope;
}

export class BookingPolicy {
  static readonly TERMINAL_STATUSES = new Set([
    "CANCELLED",
    "COMPLETED",
    "NO_SHOW",
  ]);

  static isTerminal(status: string | null | undefined): boolean {
    if (!status) return false;
    return this.TERMINAL_STATUSES.has(status.toUpperCase());
  }

  static canCancel({
    status,
    startsAt,
    actorId,
    customerId,
    barbermanId,
    barbershopOwnerId,
    serverTime,
    scope,
  }: BookingPolicyParams): {
    allowed: boolean;
    reasonCode?: string;
    deadlineAt: Date;
  } {
    if (this.isTerminal(status)) {
      return {
        allowed: false,
        reasonCode: "TERMINAL_STATE",
        deadlineAt: startsAt,
      };
    }

    const effectiveScope =
      scope ??
      (actorId && customerId && actorId === customerId ? "PERSONAL" : "UNIT");

    if (effectiveScope === "PERSONAL") {
      // PERSONAL: serverNow <= startsAt - 2h (inclusive)
      const deadlineAt = new Date(startsAt.getTime() - 2 * 60 * 60 * 1000);
      if (serverTime.getTime() > deadlineAt.getTime()) {
        return {
          allowed: false,
          reasonCode: "ACTION_DEADLINE_PASSED",
          deadlineAt,
        };
      }
      return { allowed: true, deadlineAt };
    }

    // UNIT: serverNow < startsAt (exclusive: strictly before startsAt)
    const deadlineAt = startsAt;
    if (serverTime.getTime() >= deadlineAt.getTime()) {
      return {
        allowed: false,
        reasonCode: "ACTION_DEADLINE_PASSED",
        deadlineAt,
      };
    }
    return { allowed: true, deadlineAt };
  }

  static canReschedule(params: BookingPolicyParams): {
    allowed: boolean;
    reasonCode?: string;
    deadlineAt: Date;
  } {
    return this.canCancel(params);
  }

  static canComplete({ status, startsAt, serverTime }: BookingPolicyParams): {
    allowed: boolean;
    reasonCode?: string;
    deadlineAt: Date;
  } {
    if (this.isTerminal(status)) {
      return {
        allowed: false,
        reasonCode: "TERMINAL_STATE",
        deadlineAt: startsAt,
      };
    }

    // COMPLETED: serverNow >= startsAt (inclusive)
    if (serverTime.getTime() < startsAt.getTime()) {
      return {
        allowed: false,
        reasonCode: "NOT_YET_STARTED",
        deadlineAt: startsAt,
      };
    }

    return { allowed: true, deadlineAt: startsAt };
  }

  static canMarkNoShow({ status, startsAt, serverTime }: BookingPolicyParams): {
    allowed: boolean;
    reasonCode?: string;
    deadlineAt: Date;
  } {
    if (this.isTerminal(status)) {
      return {
        allowed: false,
        reasonCode: "TERMINAL_STATE",
        deadlineAt: new Date(startsAt.getTime() + 15 * 60 * 1000),
      };
    }

    // NO_SHOW: serverNow >= startsAt + 15 min (inclusive)
    const threshold = new Date(startsAt.getTime() + 15 * 60 * 1000);
    if (serverTime.getTime() < threshold.getTime()) {
      return {
        allowed: false,
        reasonCode: "THRESHOLD_NOT_REACHED",
        deadlineAt: threshold,
      };
    }

    return { allowed: true, deadlineAt: threshold };
  }

  static evaluateCapabilities(
    params: BookingPolicyParams,
  ): BookingCapabilities {
    const cancelEval = this.canCancel(params);
    const rescheduleEval = this.canReschedule(params);
    const completeEval = this.canComplete(params);
    const noShowEval = this.canMarkNoShow(params);

    const isStaff =
      params.actorId &&
      (params.actorId === params.barbermanId ||
        params.actorId === params.barbershopOwnerId);

    const finalComplete = isStaff
      ? completeEval
      : {
          allowed: false,
          reasonCode: "UNAUTHORIZED_FOR_CLIENT",
          deadlineAt: completeEval.deadlineAt,
        };

    const finalNoShow = isStaff
      ? noShowEval
      : {
          allowed: false,
          reasonCode: "UNAUTHORIZED_FOR_CLIENT",
          deadlineAt: noShowEval.deadlineAt,
        };

    return {
      canCancel: cancelEval.allowed,
      canReschedule: rescheduleEval.allowed,
      canComplete: finalComplete.allowed,
      canMarkNoShow: finalNoShow.allowed,
      cancel: cancelEval,
      reschedule: rescheduleEval,
      complete: finalComplete,
      noShow: finalNoShow,
    };
  }
}
