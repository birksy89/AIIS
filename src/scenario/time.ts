export const INCIDENT_DATE = "2026-10-13";

export function at(time: string, date: string = INCIDENT_DATE): string {
  const withSeconds = time.length === 5 ? `${time}:00` : time;
  return `${date}T${withSeconds}Z`;
}

export function isVisible(observedAt: string, clock: string | null): boolean {
  if (!clock) return false;
  return Date.parse(observedAt) <= Date.parse(clock);
}
