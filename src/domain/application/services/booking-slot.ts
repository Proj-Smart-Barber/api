export function slotMatchesLocalTime(
  instant: Date,
  date: string,
  time: string,
  timezone: string,
): boolean {
  if (!Number.isFinite(instant.getTime())) return false;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const value = (type: string) => parts.find((p) => p.type === type)?.value;
    return (
      `${value("year")}-${value("month")}-${value("day")}` === date &&
      `${value("hour")}:${value("minute")}` === time
    );
  } catch {
    return false;
  }
}
