import type { BarbershopSchedule } from "../../enterprise/entities/barbershop-schedule";
import type { ScheduleScopeState } from "../../enterprise/entities/barbershop-schedule-scope";

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

export interface ScheduleInterval {
  openTime: string;
  closeTime: string;
}

export interface DayException {
  startTime?: string | null;
  endTime?: string | null;
  barbermanId?: string | null;
}

export class EffectiveScheduleResolver {
  /**
   * Mescla intervalos contíguos ou sobrepostos ordenados
   */
  static mergeContiguousIntervals(
    intervals: ScheduleInterval[],
  ): ScheduleInterval[] {
    if (intervals.length <= 1) return [...intervals];

    const sorted = [...intervals].sort(
      (a, b) => timeToMinutes(a.openTime) - timeToMinutes(b.openTime),
    );

    const merged: ScheduleInterval[] = [];
    let current = { ...sorted[0] };

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      const curClose = timeToMinutes(current.closeTime);
      const nextOpen = timeToMinutes(next.openTime);
      const nextClose = timeToMinutes(next.closeTime);

      if (curClose >= nextOpen) {
        // Sobrepostos ou contíguos (ex: 12:00 fecha e 12:00 abre)
        if (nextClose > curClose) {
          current.closeTime = next.closeTime;
        }
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
    return merged;
  }

  /**
   * Intersecta os horários do barbeiro com os horários gerais da unidade
   * (o profissional nunca pode atender fora do horário de funcionamento geral)
   */
  static intersectIntervals(
    barberIntervals: ScheduleInterval[],
    unitIntervals: ScheduleInterval[],
  ): ScheduleInterval[] {
    const intersected: ScheduleInterval[] = [];

    for (const b of barberIntervals) {
      const bStart = timeToMinutes(b.openTime);
      const bEnd = timeToMinutes(b.closeTime);

      for (const u of unitIntervals) {
        const uStart = timeToMinutes(u.openTime);
        const uEnd = timeToMinutes(u.closeTime);

        const start = Math.max(bStart, uStart);
        const end = Math.min(bEnd, uEnd);

        if (start < end) {
          intersected.push({
            openTime: minutesToTime(start),
            closeTime: minutesToTime(end),
          });
        }
      }
    }

    return this.mergeContiguousIntervals(intersected);
  }

  /**
   * Resolve a jornada efetiva para um determinado dia da semana
   */
  static resolveEffectiveDayIntervals(params: {
    dayOfWeek: string;
    allSchedules: BarbershopSchedule[];
    barbermanId?: string | null;
    scopeState?: ScheduleScopeState | null;
    generalScopeState?: ScheduleScopeState | null;
  }): {
    intervals: ScheduleInterval[];
    state: ScheduleScopeState;
    needsReview: boolean;
  } {
    const {
      dayOfWeek,
      allSchedules,
      barbermanId,
      scopeState,
      generalScopeState,
    } = params;

    const unitGeneralSchedules = allSchedules
      .filter((s) => !s.barbermanId && s.dayOfWeek === dayOfWeek)
      .map((s) => ({ openTime: s.openTime, closeTime: s.closeTime }));

    const mergedUnitIntervals =
      this.mergeContiguousIntervals(unitGeneralSchedules);

    const isUnitExplicitlyClosed = generalScopeState === "CLOSED";

    // Se a consulta for para a unidade geral
    if (!barbermanId) {
      const state =
        scopeState ??
        generalScopeState ??
        (mergedUnitIntervals.length === 0 ? "CLOSED" : "CUSTOM");
      return {
        intervals:
          state === "CLOSED" || isUnitExplicitlyClosed
            ? []
            : mergedUnitIntervals,
        state,
        needsReview: false,
      };
    }

    // Consulta para profissional específico
    const barberShifts = allSchedules
      .filter(
        (s) =>
          s.barbermanId?.toString() === barbermanId &&
          s.dayOfWeek === dayOfWeek,
      )
      .map((s) => ({ openTime: s.openTime, closeTime: s.closeTime }));

    const mergedBarberShifts = this.mergeContiguousIntervals(barberShifts);

    const hasGeneralConfiguration =
      (generalScopeState !== null && generalScopeState !== undefined) ||
      allSchedules.some((s) => !s.barbermanId);

    // 1. Escopo explicitamente configurado
    if (scopeState) {
      if (scopeState === "CLOSED") {
        return { intervals: [], state: "CLOSED", needsReview: false };
      }

      if (scopeState === "INHERIT") {
        return {
          intervals: isUnitExplicitlyClosed ? [] : mergedUnitIntervals,
          state: "INHERIT",
          needsReview: false,
        };
      }

      // CUSTOM: se a unidade estiver explicitamente CLOSED, nenhum horário efetivo é liberado
      if (isUnitExplicitlyClosed) {
        return {
          intervals: [],
          state: "CUSTOM",
          needsReview: false,
        };
      }

      // CUSTOM: horários próprios delimitados pelo funcionamento da unidade (se configurada)
      const effectiveIntervals = hasGeneralConfiguration
        ? this.intersectIntervals(mergedBarberShifts, mergedUnitIntervals)
        : mergedBarberShifts;

      return {
        intervals: effectiveIntervals,
        state: "CUSTOM",
        needsReview: false,
      };
    }

    // 2. Legado ambíguo sem scope:
    // Se possui horários individuais cadastrados, é CUSTOM delimitado pelo geral
    if (mergedBarberShifts.length > 0) {
      if (isUnitExplicitlyClosed) {
        return {
          intervals: [],
          state: "CUSTOM",
          needsReview: false,
        };
      }

      const effectiveIntervals = hasGeneralConfiguration
        ? this.intersectIntervals(mergedBarberShifts, mergedUnitIntervals)
        : mergedBarberShifts;

      return {
        intervals: effectiveIntervals,
        state: "CUSTOM",
        needsReview: false,
      };
    }

    // Legado sem scope e sem horários cadastrados:
    // Nunca abre horários automaticamente; trata como CLOSED com needsReview: true
    return {
      intervals: [],
      state: "CLOSED",
      needsReview: true,
    };
  }

  /**
   * Verifica se o intervalo [startTime, endTime] cabe dentro dos intervalos de atendimento
   */
  static isIntervalWithinShifts(
    startTime: string,
    endTime: string,
    shifts: ScheduleInterval[],
  ): boolean {
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);

    if (startMin >= endMin) return false;

    // Deve caber inteiramente em ao menos um intervalo contínuo
    return shifts.some((shift) => {
      const shiftOpen = timeToMinutes(shift.openTime);
      const shiftClose = timeToMinutes(shift.closeTime);
      return startMin >= shiftOpen && endMin <= shiftClose;
    });
  }

  /**
   * Verifica se o intervalo sobrepõe alguma exceção do dia
   */
  static overlapsException(
    startTime: string,
    endTime: string,
    dayExceptions: DayException[],
    barbermanId?: string | null,
  ): boolean {
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);

    for (const ex of dayExceptions) {
      // Exceções gerais da unidade (barbermanId null) afetam todos
      // Exceções individuais afetam o barbeiro correspondente
      const appliesToBarber =
        !ex.barbermanId || (barbermanId && ex.barbermanId === barbermanId);

      if (!appliesToBarber) continue;

      // Fechamento total do dia
      if (!ex.startTime && !ex.endTime) {
        return true;
      }

      if (ex.startTime && ex.endTime) {
        const exStart = timeToMinutes(ex.startTime);
        const exEnd = timeToMinutes(ex.endTime);
        // Sobreposição estrita: startMin < exEnd && endMin > exStart
        if (startMin < exEnd && endMin > exStart) {
          return true;
        }
      }
    }

    return false;
  }
}
